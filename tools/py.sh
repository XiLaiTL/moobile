#!/usr/bin/env bash
# py.sh —— 解析出一个**不经过 pyenv shim** 的 Python 解释器并 exec 它。
#
#   bash tools/py.sh tools/cr_scan.py --root . --mode check
#
# ## 为什么需要这一层（实测数据，2026-09）
#
# 本机 `python3` 是 **pyenv-win 的 shim**（`~/.pyenv/pyenv-win/shims/python3`）——
# 它每次调用都要重新解析版本再转发一次进程：
#
# | 命令 | 耗时 |
# |---|---|
# | `python3 -c pass`（经 shim） | **~630ms** |
# | 真解释器 `-c pass` | **~60ms** |
# | `python3 tools/cr_scan.py`（真活 ~350ms） | 980ms 级别 |
#
# 本仓有 6 处 `python3` 调用，`verify_all.sh` 因此白花 **3~4 秒**，而且每个工具单跑
# 都"感觉卡一下"——其实**卡的几乎全是 shim，不是脚本**。
#
# ## 解析顺序
#
#   1. `$PYTHON`（显式指定最优先，便于换机器/换版本）
#   2. PATH 上的 `python3` / `python`；**若它落在 `*/shims/*` 里，就问 pyenv 要真路径**
#      （`pyenv which python3`）；结果缓存到 `_build/.python-path`，避免每次都问
#      —— `pyenv which` 自己也要 ~440ms
#   3. 实在解析不出来就用 PATH 上那个（慢，但能跑）
#
# 非 pyenv 环境（macOS / Linux / 官方安装包）走的还是 PATH 上那个，行为不变。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/_build/.python-path"

is_usable() { [ -n "${1:-}" ] && [ -x "$1" ]; }

resolve() {
  if is_usable "${PYTHON:-}"; then printf '%s' "$PYTHON"; return; fi

  local p
  p="$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)"

  # pyenv shim：问一次真路径（带缓存）
  case "$p" in
    */shims/*)
      local cached=""
      [ -f "$CACHE" ] && cached="$(cat "$CACHE" 2>/dev/null || true)"
      if is_usable "$cached"; then printf '%s' "$cached"; return; fi
      if command -v pyenv >/dev/null 2>&1; then
        local real
        real="$(pyenv which python3 2>/dev/null | tr -d '\r' || true)"
        if is_usable "$real"; then
          mkdir -p "$(dirname "$CACHE")" 2>/dev/null
          printf '%s\n' "$real" > "$CACHE" 2>/dev/null || true
          printf '%s' "$real"; return
        fi
      fi
      ;;
  esac

  printf '%s' "$p"
}

PY="$(resolve)"
if ! is_usable "$PY"; then
  echo "ERROR(py.sh): 找不到可用的 Python 解释器（设 \$PYTHON 或装一个 python3）" >&2
  exit 127
fi

# `--show` 便于排查"到底用了哪一个"
if [ "${1:-}" = "--show" ]; then
  echo "$PY"
  exit 0
fi

exec "$PY" "$@"
