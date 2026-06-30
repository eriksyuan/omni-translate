#!/usr/bin/env bash
# 强制使用项目内 CARGO_HOME，避免继承 shell 里指向 ~/.cargo 的 CARGO_HOME，
# 以及 ~/.cargo/config.toml 中过时的 rsproxy 链与 Cargo 1.96+ 冲突。
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export CARGO_HOME="${ROOT}/.cargo-home"
exec "$@"
