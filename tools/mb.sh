#!/usr/bin/env bash
# mb.sh —— 跑 MoonBit 工具链 CLI（`tools/mbtools/`）。
#
#   bash tools/mb.sh cr-scan --root . --mode check
#
# 为什么需要这层包装：`moon run` 必须在**模块所在目录**里执行（`tools/mbtools/`），
# 否则 moon 会在库模块里找那个包。但调用者关心的是**当前工作目录**下的相对路径 ——
# 所以这里把调用者的 cwd 通过 `MBTOOLS_CWD` 传进去，工具侧用它解析相对 `--root`。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export MBTOOLS_CWD="$PWD"

cd "$ROOT/tools/mbtools" || exit 1
exec moon run --target js src -- "$@"
