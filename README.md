# qianhe_utils

个人工具库：一部分是「双击就能用」的单文件网页工具，一部分是按语言分区的可复用库。

## 工具

| 名称 | 类型 | 入口 | 说明 |
| --- | --- | --- | --- |
| 瑞士轮编排工具 | 网页 · 单文件 | [web/swiss-system/index.html](web/swiss-system/index.html) | 瑞士轮赛事编排、成绩录入、破同分排名、JSON / CSV 导出 |
| 像素画工坊 | 网页 · 单文件 | [web/pixel-art/index.html](web/pixel-art/index.html) | 图片转像素画，自定义网格、调色板、抖动，整数倍放大导出 PNG |

网页工具全部零依赖、零构建，直接用浏览器打开即可，不需要安装任何东西。

## 目录

```
web/      交付给使用者的成品（单文件网页工具）
rust/     Rust 库（Cargo workspace）
cpp/      C++ 库（CMake，每个库一个 qh-* 目录）
python/   Python 包（uv workspace）
docs/     跨仓库的约定
scripts/  一键检查脚本
```

顶层只按「交付形态 / 生态」分区，具体项目各自在自己的目录里自包含：README、测试、构建文件、产物。

## 测试

```bash
./scripts/check.sh          # 跑全部语言的全部测试，没有内容的目录会自动跳过
node --test web/*/tests/*.test.js   # 只跑网页工具
```

## 加东西

- 新的网页工具 → `web/<kebab-case>/`，放 `index.html` + `README.md` + `tests/`
- 新的 Rust crate → `cd rust && cargo new --lib crates/qh-<name>`
- 新的 C++ 库 → `cpp/qh-<name>/`，参考 [cpp/README.md](cpp/README.md)
- 新的 Python 包 → `cd python && uv init --lib packages/qh_<name>`

细节（命名、依赖方向、单文件网页什么时候该拆、发布流程）见 [docs/conventions.md](docs/conventions.md)。
