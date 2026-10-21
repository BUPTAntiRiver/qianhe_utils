'use strict';

/**
 * 像素画处理引擎测试
 *
 * 运行：node --test web/pixel-art/tests/engine.test.js
 *
 * 与网页一致：直接从 index.html 中提取 <script id="pixel-engine">。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEngine() {
  const file = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const match = html.match(/<script id="pixel-engine">([\s\S]*?)<\/script>/);
  assert.ok(match, 'index.html 中应包含 pixel-engine 脚本');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(match[1], sandbox, { filename: 'pixel-engine.js' });
  assert.ok(sandbox.PixelEngine, '引擎应挂载到全局对象');
  return sandbox.PixelEngine;
}

const E = loadEngine();

function toRgba(colors) {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((color, index) => {
    data[index * 4] = color[0];
    data[index * 4 + 1] = color[1];
    data[index * 4 + 2] = color[2];
    data[index * 4 + 3] = color.length > 3 ? color[3] : 255;
  });
  return data;
}

function makeGradient(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      data[index] = Math.round((x / (width - 1)) * 255);
      data[index + 1] = Math.round((y / (height - 1)) * 255);
      data[index + 2] = 128;
      data[index + 3] = 255;
    }
  }
  return data;
}

function colorKey(r, g, b) {
  return `${r},${g},${b}`;
}

test('十六进制颜色可以在 RGB 之间互转', () => {
  assert.deepEqual(Array.from(E.hexToRgb('#e8582a')), [232, 88, 42]);
  assert.deepEqual(Array.from(E.hexToRgb('9bbc0f')), [155, 188, 15]);
  assert.deepEqual(Array.from(E.hexToRgb('#fff')), [255, 255, 255]);
  assert.equal(E.rgbToHex([232, 88, 42]), '#e8582a');
  assert.equal(E.rgbToHex([255, 255, 255]), '#ffffff');
  assert.throws(() => E.hexToRgb('not-a-color'));
});

test('自适应调色板能准确还原分离的色簇', () => {
  const colors = [];
  const clusters = [
    [245, 32, 32],
    [22, 235, 22],
    [35, 40, 240],
    [242, 228, 18]
  ];
  clusters.forEach((color) => {
    for (let i = 0; i < 12; i += 1) colors.push(color);
  });
  const palette = E.buildAdaptivePalette(toRgba(colors), 4);
  assert.ok(palette.length >= 2 && palette.length <= 4, '调色板数量应在限制内');
  for (const cluster of clusters) {
    const index = E.nearestColorIndex(cluster[0], cluster[1], cluster[2], palette);
    const match = palette[index];
    const distance = Math.hypot(
      match[0] - cluster[0],
      match[1] - cluster[1],
      match[2] - cluster[2]
    );
    assert.ok(distance < 20, `色簇 ${cluster} 应被保留，实际距离 ${distance.toFixed(1)}`);
  }
});

test('自适应调色板不会超过请求的颜色数量', () => {
  const data = makeGradient(72, 48);
  for (const limit of [2, 6, 12, 24, 48]) {
    const palette = E.buildAdaptivePalette(data, limit);
    assert.ok(palette.length >= 1);
    assert.ok(palette.length <= limit, `${limit} 色请求不应产生 ${palette.length} 色`);
    for (const color of palette) {
      for (const channel of color) {
        assert.ok(Number.isInteger(channel) && channel >= 0 && channel <= 255);
      }
    }
  }
});

test('透明像素不参与自适应取色', () => {
  const transparentRed = Array.from({ length: 100 }, () => [255, 0, 0, 0]);
  const opaqueBlue = [[12, 34, 240, 255]];
  const palette = E.buildAdaptivePalette(toRgba(transparentRed.concat(opaqueBlue)), 8);
  assert.equal(palette.length, 1);
  assert.deepEqual(Array.from(palette[0]), [12, 34, 240]);
});

test('固定调色板映射只输出调色板中的颜色', () => {
  const data = makeGradient(24, 16);
  const palette = E.getPalette('pico8');
  const allowed = new Set(palette.map((color) => colorKey(color[0], color[1], color[2])));
  const output = E.quantizeImageData(data, 24, 16, palette, { dither: 'none' });
  assert.equal(output.length, data.length);
  for (let i = 0; i < output.length; i += 4) {
    const key = colorKey(output[i], output[i + 1], output[i + 2]);
    assert.ok(allowed.has(key), `输出颜色 ${key} 不在 PICO-8 调色板中`);
    assert.equal(output[i + 3], 255);
  }
});

test('误差扩散与网点抖动只使用调色板颜色且结果稳定', () => {
  const data = makeGradient(40, 20);
  const palette = E.getPalette('mono');
  const allowed = new Set(palette.map((color) => colorKey(color[0], color[1], color[2])));
  const flat = E.quantizeImageData(data, 40, 20, palette, { dither: 'none' });
  const floydA = E.quantizeImageData(data, 40, 20, palette, { dither: 'floyd' });
  const floydB = E.quantizeImageData(data, 40, 20, palette, { dither: 'floyd' });
  const bayer = E.quantizeImageData(data, 40, 20, palette, { dither: 'bayer' });

  for (let i = 0; i < floydA.length; i += 4) {
    assert.ok(allowed.has(colorKey(floydA[i], floydA[i + 1], floydA[i + 2])));
    assert.ok(allowed.has(colorKey(bayer[i], bayer[i + 1], bayer[i + 2])));
  }
  assert.deepEqual(Array.from(floydA), Array.from(floydB), '抖动算法必须是确定性的');
  assert.notDeepEqual(Array.from(flat), Array.from(floydA), '误差扩散应产生不同于无抖动的结果');
  assert.notDeepEqual(Array.from(floydA), Array.from(bayer), '两种抖动效果应不同');
});

test('量化保留透明度并清空全透明像素', () => {
  const data = toRgba([
    [240, 20, 20, 255],
    [20, 240, 20, 128],
    [20, 20, 240, 0]
  ]);
  const palette = E.getPalette('gameboy');
  const output = E.quantizeImageData(data, 3, 1, palette, { dither: 'floyd' });
  assert.equal(output[3], 255);
  assert.equal(output[7], 128);
  assert.equal(output[11], 0);
  assert.equal(output[8], 0);
  assert.equal(output[9], 0);
  assert.equal(output[10], 0);
});

test('透明图片返回空调色板而不会崩溃', () => {
  const data = new Uint8ClampedArray(16 * 16 * 4);
  const palette = E.buildAdaptivePalette(data, 16);
  assert.deepEqual(Array.from(palette), []);
});

test('颜色统计按出现次数降序并忽略透明像素', () => {
  const data = toRgba([
    [10, 20, 30, 255],
    [10, 20, 30, 255],
    [40, 50, 60, 255],
    [99, 99, 99, 0]
  ]);
  const colors = E.countColors(data);
  assert.equal(colors.length, 2);
  assert.equal(colors[0].hex, '#0a141e');
  assert.equal(colors[0].count, 2);
  assert.equal(colors[1].hex, '#28323c');
});
