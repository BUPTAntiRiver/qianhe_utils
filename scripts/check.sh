#!/usr/bin/env bash
# 仓库级检查入口：自动发现各生态的测试，没有内容的目录跳过而不是报错。
set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
shopt -s nullglob

fail=0

echo "== web =="
web_tests=(web/*/tests/*.test.js)
if [ ${#web_tests[@]} -eq 0 ]; then
  echo "   (跳过：还没有网页工具测试)"
else
  for f in "${web_tests[@]}"; do
    echo "  -> $f"
    node --test "$f" || fail=1
  done
fi

echo "== rust =="
rust_crates=(rust/crates/*/Cargo.toml)
if [ ${#rust_crates[@]} -eq 0 ]; then
  echo "   (跳过：rust/crates/ 下还没有 crate)"
else
  cargo test --manifest-path rust/Cargo.toml --workspace || fail=1
  if cargo clippy --version >/dev/null 2>&1; then
    cargo clippy --manifest-path rust/Cargo.toml --workspace --all-targets -- -D warnings || fail=1
    cargo fmt --manifest-path rust/Cargo.toml --all --check || fail=1
  else
    echo "   (跳过 clippy/fmt：未安装)"
  fi
fi

echo "== python =="
py_pkgs=(python/packages/*/pyproject.toml)
if [ ${#py_pkgs[@]} -eq 0 ]; then
  echo "   (跳过：python/packages/ 下还没有包)"
elif ! command -v uv >/dev/null 2>&1; then
  echo "   (跳过：未安装 uv)"
else
  ( cd python && uv run --quiet pytest -q ) || fail=1
  ( cd python && uv run --quiet ruff check . ) || fail=1
  ( cd python && uv run --quiet ruff format --check . ) || fail=1
fi

echo "== cpp =="
cpp_libs=(cpp/qh-*/CMakeLists.txt)
if ! command -v cmake >/dev/null 2>&1; then
  echo "   (跳过：未安装 cmake)"
elif [ ${#cpp_libs[@]} -eq 0 ]; then
  echo "   (跳过：cpp/ 下还没有库)"
else
  cmake -S cpp -B cpp/build -DCMAKE_BUILD_TYPE=Debug || fail=1
  cmake --build cpp/build -j || fail=1
  ctest --test-dir cpp/build --output-on-failure || fail=1
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "有检查未通过。"
  exit 1
fi
echo "全部通过。"
