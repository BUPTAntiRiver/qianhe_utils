# Python 包

一个 uv workspace。每个包放在 `packages/` 下，共用 `python/.venv` 和 `python/uv.lock`。

## 新增包

```bash
cd python
uv init --lib --python 3.10 packages/qh_example
```

`uv init --lib` 会生成 `src/qh_example/` 布局。不加 `--python` 时会以本机版本写成 `requires-python = ">=3.13"`，对个人库来说限制太紧，建议显式指定。把 `pyproject.toml` 补成：

```toml
[project]
name = "qh-example"
version = "0.1.0"
description = "一句话说明"
requires-python = ">=3.10"
readme = "README.md"
```

测试放包内 `tests/` 下（`packages/qh_example/tests/test_xxx.py`），`python/pyproject.toml` 里的 `testpaths` 已经指向 `packages`。

用 `src/` 布局的意义：测试和脚本必须通过安装后的包导入，避免「在当前目录碰巧 import 到了没被安装的源码」这种只在别人机器上炸的问题。

## 命令

```bash
cd python
uv sync                 # 建立 .venv 并安装所有包（含 dev 依赖）
uv run pytest -q
uv run ruff check .
uv run ruff format .
```

## 约定

- 包名用 `qh_` 前缀，发布名用 `qh-`（PyPI 上撞名概率低）。
- 一个包一个职责；不要建 `qh_utils` 这种什么都往里塞的包。
- `py.typed` 标记和类型注解跟着代码一起写，别等以后再补。
- 发布用 `uv build` + PyPI Trusted Publishing，不要手动 `twine upload`。
