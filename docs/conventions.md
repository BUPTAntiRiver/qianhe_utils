# 仓库约定

这个仓库会长期混着网页工具和几种语言的库。为了避免半年后自己都找不到东西，下面几条是硬规则。

## 1. 目录只按「交付形态 / 生态」分区

```
web/      给别人直接用、不需要编译和安装的成品
rust/     Rust 库
cpp/      C++ 库
python/   Python 包
docs/     约定、决策记录
scripts/  仓库级脚本
```

不要在仓库根目录放任何语言的构建入口（`Cargo.toml`、`CMakeLists.txt`、`pyproject.toml`、`package.json`）。根目录只允许出现索引、约定和跨语言脚本。原因很简单：每种语言的工具链都假设自己独占一个根，混在一起会互相抢 `target/`、`build/`、虚拟环境。

## 2. 每个项目目录自包含

一个工具或库的目录里必须有：

- `README.md`：做什么、怎么用、怎么测、已知限制
- 能独立运行的测试（不依赖仓库其他部分）
- 该语言的标准构建文件

不允许出现「要配合仓库根目录的某个配置才能跑」的子项目。

## 3. 依赖方向

```
web/  ──可以依赖──>  rust/ | cpp/ | python/
各语言库之间  ──尽量平级，不互相依赖──
任何东西  ──都不允许依赖──> web/
```

库之间确实需要复用时，把公共部分抽成第三个库，而不是让 A 依赖 B 的私货。

## 4. 命名

| 位置 | 规则 | 例子 |
| --- | --- | --- |
| 网页工具目录 | kebab-case | `web/pixel-art/` |
| Rust crate | `qh-` 前缀，包名 snake_case | `crates/qh-image/` |
| C++ 库目录 | `qh-` 前缀 | `cpp/qh-image/` |
| C++ 命名空间 | `qh::` | `qh::image::resize()` |
| Python 包 | `qh_` 前缀 | `packages/qh_image/` |
| 发布名 | `qh-` 前缀 | `qh-image` on crates.io / PyPI |

前缀是为了发布时不跟别人的同名包打架，也让导入方一眼知道来源。

## 5. 单文件网页工具：保持「源码即发布物」

现状：`web/<tool>/index.html` 同时是源码和发布物，测试用正则从 HTML 里抽出 `id="xxx-engine"` 的脚本在 Node 里跑。这个不变量要保留，因为它同时保证了：

- 任何人下载单个文件就能用，不需要构建、不需要联网；
- 被测试的代码和发布出去的代码是同一份。

### 什么时候允许拆成需要构建的工程

出现下面任意一条再拆，不要提前：

1. 单个 `index.html` 超过约 150–200 KB，改动时定位困难（现在两个都约 100 KB，还没到）；
2. 两个网页工具之间开始出现真正重复的逻辑；
3. 需要引入 npm 依赖；
4. 要把 Rust/C++ 核心通过 wasm 接进网页。

### 拆了之后的结构

```
web/<tool>/
├── src/                  # 真正的源码，测试直接 import
├── build.mjs             # 把 js/css 内联进模板
├── dist/index.html       # 发布物，提交进 git，保证"下载即用"
├── README.md
└── tests/
```

拆分那一次提交要同时完成：把 `dist/index.html` 提交进仓库、把测试从「正则抽脚本」改成「import src 模块」、在 README 里补构建命令。不要让仓库里出现「必须构建才能用」的中间状态。

## 6. 测试

- 每个项目目录自带测试，且能在仓库根目录用一条命令跑起来。
- 全部测试统一入口：`./scripts/check.sh`。它按目录自动发现，某个语言还没有内容时跳过而不是报错。
- 单文件网页继续用 `node --test`，不引入测试框架依赖。

## 7. 版本与发布

- 不搞全仓统一版本号。各项目独立演进。
- 网页工具用 tag 标记：`web/pixel-art@1.0.0`。
- 库用各自生态的版本字段（`Cargo.toml`、`pyproject.toml`），tag 用 `<语言>/<名字>@<版本>`。
- 发布渠道：网页工具走 GitHub Pages（发布源设为 `web/` 目录，URL 路径与现在一致）；Rust 走 crates.io，Python 走 PyPI Trusted Publishing，C++ 暂不发布，先保证能被本仓库和 `add_subdirectory` 使用。

## 8. CI（需要时再加）

按路径过滤，一个生态一个 workflow，不要写「所有语言都跑」的大 job：

```yaml
on:
  push:
    paths: ["rust/**"]
```

改一行网页文案不应该触发 Rust 编译。
