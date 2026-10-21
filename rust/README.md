# Rust 库

一个 Cargo workspace。所有 crate 放在 `crates/` 下，共享同一份依赖版本与构建产物目录 `rust/target/`。

## 新增 crate

```bash
cd rust
cargo new --lib crates/qh-example
```

因为 workspace 里定义了 `[workspace.package]`，`cargo new` 会自动生成继承字段，不用手改：

```toml
[package]
name = "qh-example"
version = "0.1.0"
edition.workspace = true
rust-version.workspace = true
repository.workspace = true

[dependencies]
# serde.workspace = true
```

`members = ["crates/*"]` 会自动纳入新目录，不需要改 workspace 的 `Cargo.toml`。新增后跑一次 `cargo test --workspace` 确认。

## 命令

```bash
cd rust
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all
```

## 约定

- crate 名带 `qh-` 前缀（crates.io 上同名概率低，也方便一眼看出是自己的）。
- 库代码加 `#![forbid(unsafe_code)]`，除非确实需要 unsafe。
- 一个 crate 一个职责；不要把互不相关的小工具塞进同一个 crate，也不要为了一行函数单独建 crate。
- 发布前确认 `Cargo.toml` 里有 `description`、`license`、`readme`，否则 crates.io 会拒收。
