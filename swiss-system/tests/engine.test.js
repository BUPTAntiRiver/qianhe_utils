'use strict';

/**
 * 瑞士轮编排引擎测试
 *
 * 运行：node --test swiss-system/tests/engine.test.js
 *
 * 测试直接从 index.html 中提取 <script id="swiss-engine">，这样发布用的
 * 单文件网页和被测引擎始终是同一份代码。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEngine() {
  const file = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/<script id="swiss-engine">([\s\S]*?)<\/script>/);
  assert.ok(match, 'index.html 中应包含 swiss-engine 脚本');
  const sandbox = { window: {}, performance: { now: () => Date.now() }, console };
  vm.createContext(sandbox);
  vm.runInContext(match[1], sandbox, { filename: 'swiss-engine.js' });
  return sandbox.window.SwissEngine;
}

const E = loadEngine();

function makeRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeState(count, totalRounds) {
  const state = E.createEmptyState();
  state.tournament.totalRounds = totalRounds;
  for (let i = 0; i < count; i += 1) {
    state.players.push({
      id: i + 1,
      name: `P${i + 1}`,
      rating: 2000 - i * 10,
      team: `T${i % 3}`,
      withdrawn: false
    });
  }
  state.nextPlayerId = count + 1;
  return state;
}

function finishRound(round, rng) {
  for (const game of round.pairings) {
    const value = rng();
    game.result = value < 0.45 ? '1-0' : value < 0.9 ? '0-1' : 'draw';
  }
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function pairKey(game) {
  return [game.white, game.black].sort((a, b) => a - b).join('-');
}

function assertRoundShape(round, activeCount) {
  assert.equal(round.pairings.length, Math.floor(activeCount / 2));
  assert.equal(round.bye != null, activeCount % 2 === 1);

  const seen = new Set();
  if (round.bye != null) seen.add(round.bye);
  for (const game of round.pairings) {
    assert.notEqual(game.white, game.black);
    assert.ok(!seen.has(game.white), '同一轮中选手不能出现两次');
    assert.ok(!seen.has(game.black), '同一轮中选手不能出现两次');
    seen.add(game.white);
    seen.add(game.black);
  }
}

test('首轮按等级分高低折叠配对', () => {
  const state = makeState(6, 3);
  const round = E.pairNextRound(state);
  assert.deepEqual(
    plain(round.pairings.map(game => [game.white, game.black])),
    [[1, 4], [2, 5], [3, 6]]
  );
  assert.equal(round.bye, null);
});

test('首轮随机配对时所有选手恰好出场一次', () => {
  const state = makeState(7, 3);
  state.tournament.firstRoundRandom = true;
  const round = E.pairNextRound(state, { rng: makeRng(2026) });
  assertRoundShape(round, 7);
});

test('首轮开启同队回避时交换对手，避免同队对阵', () => {
  const state = makeState(6, 3);
  const teams = ['A', 'B', 'C', 'A', 'B', 'C'];
  state.players.forEach((player, index) => {
    player.team = teams[index];
  });
  state.tournament.avoidSameTeam = true;

  const round = E.pairNextRound(state);
  assert.equal(round.pairings.length, 3);
  for (const game of round.pairings) {
    const white = state.players.find(player => player.id === game.white);
    const black = state.players.find(player => player.id === game.black);
    assert.notEqual(white.team, black.team, `${white.name} 与 ${black.name} 不应同队对阵`);
  }
});

test('奇数选手自动轮空，且轮空不重复', () => {
  const state = makeState(9, 4);
  const rng = makeRng(11);
  const byes = [];

  for (let i = 0; i < 4; i += 1) {
    const round = E.pairNextRound(state);
    assertRoundShape(round, 9);
    if (round.bye != null) byes.push(round.bye);
    state.rounds.push(round);
    finishRound(round, rng);
  }

  assert.equal(byes.length, 4);
  assert.equal(new Set(byes).size, 4, '轮空机会应优先分配给尚未轮空的选手');
});

test('多轮编排不会产生重复对阵', () => {
  const state = makeState(8, 5);
  const rng = makeRng(99);
  const played = new Set();

  for (let i = 0; i < 5; i += 1) {
    const round = E.pairNextRound(state);
    assertRoundShape(round, 8);
    assert.equal(round.warnings.length, 0);
    for (const game of round.pairings) {
      const key = pairKey(game);
      assert.ok(!played.has(key), `不应重复对阵：${key}`);
      played.add(key);
    }
    state.rounds.push(round);
    finishRound(round, rng);
  }
});

test('无法避免重复对阵时给出提示', () => {
  const state = makeState(2, 2);
  state.rounds.push(E.pairNextRound(state));
  finishRound(state.rounds[0], makeRng(1));
  const round = E.pairNextRound(state);
  assert.ok(round.warnings.some(message => message.includes('重复')));
});

test('上一轮未完成时拒绝生成下一轮', () => {
  const state = makeState(4, 3);
  state.rounds.push(E.pairNextRound(state));
  assert.throws(() => E.pairNextRound(state), /未录入|未完成/);
});

test('胜、和、负计分与对手分、SB 计算正确', () => {
  const state = makeState(4, 3);
  state.rounds.push({
    number: 1,
    bye: null,
    warnings: [],
    pairings: [
      { white: 1, black: 2, result: '1-0' },
      { white: 3, black: 4, result: 'draw' }
    ]
  });

  const stats = E.computeStats(state);
  const p1 = stats.get(1);
  const p2 = stats.get(2);
  const p3 = stats.get(3);
  const p4 = stats.get(4);

  assert.equal(p1.score, 1);
  assert.equal(p1.wins, 1);
  assert.equal(p1.buchholz, 0);
  assert.equal(p1.sonneborn, 0);

  assert.equal(p2.score, 0);
  assert.equal(p2.losses, 1);
  assert.equal(p2.buchholz, 1);

  assert.equal(p3.score, 0.5);
  assert.equal(p3.draws, 1);
  assert.equal(p3.buchholz, 0.5);
  assert.equal(p3.sonneborn, 0.25);
  assert.equal(p3.direct, 0.5);

  assert.equal(p4.score, 0.5);
  assert.equal(p4.buchholz, 0.5);
  assert.equal(p4.sonneborn, 0.25);
});

test('对手分（去最低）和中间分计算正确', () => {
  const state = makeState(6, 3);
  state.rounds.push({
    number: 1,
    bye: null,
    warnings: [],
    pairings: [
      { white: 1, black: 2, result: '1-0' },
      { white: 3, black: 4, result: '1-0' },
      { white: 5, black: 6, result: 'draw' }
    ]
  });
  state.rounds.push({
    number: 2,
    bye: null,
    warnings: [],
    pairings: [
      { white: 1, black: 3, result: '1-0' },
      { white: 2, black: 4, result: '0-1' },
      { white: 5, black: 6, result: 'draw' }
    ]
  });

  const stats = E.computeStats(state);
  // P1: 2 分，对手 P2(0) + P3(1)，对手分 1，去最低后 1
  assert.equal(stats.get(1).score, 2);
  assert.equal(stats.get(1).buchholz, 1);
  assert.equal(stats.get(1).buchholzCut1, 1);
  // P3: 1 分，对手 P4(1) + P1(2)，对手分 3，去最低后 2
  assert.equal(stats.get(3).score, 1);
  assert.equal(stats.get(3).buchholz, 3);
  assert.equal(stats.get(3).buchholzCut1, 2);
  assert.equal(stats.get(3).median, 3);
});

test('轮空得分可配置，且轮空不计入对手分', () => {
  const state = makeState(3, 2);
  state.tournament.byePoints = 1;
  state.rounds.push({
    number: 1,
    bye: 3,
    warnings: [],
    pairings: [{ white: 1, black: 2, result: '1-0' }]
  });

  let stats = E.computeStats(state);
  assert.equal(stats.get(3).score, 1);
  assert.equal(stats.get(3).byes, 1);
  assert.equal(stats.get(3).buchholz, 0);
  assert.equal(stats.get(3).wins, 0);

  state.tournament.byePoints = 0.5;
  stats = E.computeStats(state);
  assert.equal(stats.get(3).score, 0.5);
});

test('排名按积分和破同分排序，并支持并列名次', () => {
  const state = makeState(4, 2);
  state.tournament.tiebreaks = ['buchholzCut1', 'buchholz', 'sonneborn', 'wins', 'rating'];
  state.rounds.push({
    number: 1,
    bye: null,
    warnings: [],
    pairings: [
      { white: 1, black: 2, result: 'draw' },
      { white: 3, black: 4, result: 'draw' }
    ]
  });

  const standings = E.buildStandings(state);
  assert.deepEqual(plain(standings.map(entry => entry.score)), [0.5, 0.5, 0.5, 0.5]);
  // 等级分作为最后的破同分项，四人分数相同但等级分不同，因此名次不同
  assert.deepEqual(plain(standings.map(entry => entry.rank)), [1, 2, 3, 4]);
  assert.deepEqual(plain(standings.map(entry => entry.player.id)), [1, 2, 3, 4]);
});

test('完全同分时共享名次', () => {
  const state = makeState(4, 2);
  state.tournament.tiebreaks = ['buchholz'];
  for (const player of state.players) player.rating = 1800;
  state.rounds.push({
    number: 1,
    bye: null,
    warnings: [],
    pairings: [
      { white: 1, black: 2, result: 'draw' },
      { white: 3, black: 4, result: 'draw' }
    ]
  });

  const standings = E.buildStandings(state);
  assert.deepEqual(plain(standings.map(entry => entry.rank)), [1, 1, 1, 1]);
});

test('退赛选手不参与后续编排', () => {
  const state = makeState(6, 3);
  state.players[0].withdrawn = true;
  const round = E.pairNextRound(state);
  assertRoundShape(round, 5);
  for (const game of round.pairings) {
    assert.notEqual(game.white, 1);
    assert.notEqual(game.black, 1);
  }
  assert.notEqual(round.bye, 1);
});

test('颜色历史尽量交替，不出现四连白或四连黑', () => {
  const state = makeState(10, 6);
  const rng = makeRng(77);

  for (let i = 0; i < 6; i += 1) {
    const round = E.pairNextRound(state);
    state.rounds.push(round);
    finishRound(round, rng);
  }

  const stats = E.computeStats(state);
  for (const player of stats.values()) {
    let streak = 1;
    for (let i = 1; i < player.colors.length; i += 1) {
      if (player.colors[i] === player.colors[i - 1]) streak += 1;
      else streak = 1;
      assert.ok(streak <= 3, `选手 ${player.player.name} 出现 ${streak} 连色`);
    }
  }
});

test('normalizeState 能恢复导出数据', () => {
  const state = makeState(5, 3);
  const rng = makeRng(5);
  for (let i = 0; i < 2; i += 1) {
    const round = E.pairNextRound(state);
    state.rounds.push(round);
    finishRound(round, rng);
  }
  state.rounds[0].pairings[0].result = 'draw';

  const restored = E.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.players.length, 5);
  assert.equal(restored.rounds.length, 2);
  assert.equal(restored.tournament.totalRounds, 3);
  assert.equal(restored.tournament.name, state.tournament.name);
  assert.equal(restored.nextPlayerId, 6);
  assert.equal(restored.rounds[0].pairings[0].result, 'draw');
});

test('normalizeState 拒绝引用不存在选手的数据', () => {
  assert.throws(() => E.normalizeState({
    players: [{ id: 1, name: 'A' }],
    rounds: [{ pairings: [{ white: 1, black: 2 }] }]
  }), /不存在/);
});

test('normalizeState 拒绝同一轮重复编排', () => {
  assert.throws(() => E.normalizeState({
    players: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }],
    rounds: [{
      pairings: [
        { white: 1, black: 2 },
        { white: 1, black: 3 }
      ]
    }]
  }), /重复/);
});

test('大规模模拟：每轮结构合法且无意外重复对阵', () => {
  for (let count = 2; count <= 24; count += 1) {
    const rounds = Math.max(1, Math.ceil(Math.log2(count)));
    const state = makeState(count, rounds);
    const rng = makeRng(count * 1009 + 7);
    const played = new Set();

    for (let i = 0; i < rounds; i += 1) {
      const round = E.pairNextRound(state);
      assertRoundShape(round, count);

      for (const game of round.pairings) {
        const key = pairKey(game);
        if (round.warnings.length === 0) {
          assert.ok(!played.has(key), `${count} 人第 ${i + 1} 轮出现了未提示的重复对阵`);
        }
        played.add(key);
      }

      state.rounds.push(round);
      finishRound(round, rng);
    }

    const standings = E.buildStandings(state);
    assert.equal(standings.length, count);
    for (let i = 1; i < standings.length; i += 1) {
      assert.ok(standings[i - 1].score >= standings[i].score, '排名必须按积分降序');
    }
  }
});
