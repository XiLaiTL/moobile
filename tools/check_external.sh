#!/usr/bin/env bash
# check_external.sh —— 「**使用者视角**能不能用 moobile」的冒烟测试（两个探针，一次编译）。
#
# 为什么需要它：`examples/apps/todo-app/` 在模块**内部**，它编译得过证明不了外部可用。
#
# 两个探针，都是"照使用者会写的东西写"，但角度不同：
#
#   · `tools/ext_probe/app/`      —— 手写的外部模块（依赖库本体 + `style/`，含能力包用法）
#   · README 的快速上手            —— **文档承诺**的 import 路径与 API
#     （由 `tools/readme_probe.py --generate-into` 从 README 里解析出来再生成）
#
# ⚠️ 第二个探针是补出来的，而且是**踩过事故才补的**：0.2.1 发出去之后才发现，
#    随包发布的 README 让使用者 import `XiLaiTL/moobile/html`，而那份包里根本没有这个包 ——
#    照 README 写的第一行就编不过。光验"库能被外部依赖"是不够的，**文档也是契约**。
#
# ⚠️ 两个探针放在**同一个工作区**里，只跑**一次** `moon check`。
#    最初是各建一个临时工作区、各跑一次 —— 同一件事做两遍（实测 ~6s → ~3s）。
#
# 用法：
#   bash tools/check_external.sh
# 判据：输出 `外部模块 check 通过`，退出码 0。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/tools/ext_probe/app"

# moon 是原生 Windows 程序，moon.work 里的路径要 Windows 形式（D:/...）
if command -v cygpath >/dev/null 2>&1; then
  WIN_ROOT="$(cygpath -m "$ROOT")"
else
  WIN_ROOT="$ROOT"
fi

W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT

# 探针 1：手写的外部模块
mkdir -p "$W/app"
cp "$SRC"/* "$W/app/"

# 探针 2：README 承诺的路径与 API（生成到同一个工作区里）
echo "== README 承诺的 import 路径（README 是契约）"
if ! bash "$ROOT/tools/py.sh" "$ROOT/tools/readme_probe.py" --generate-into "$W"; then
  echo ""
  echo "ERROR: 读不出 README 的 import 路径（README 结构变了？见 tools/readme_probe.py 的解析规则）"
  exit 1
fi

cat > "$W/moon.work" <<EOF
members = [
  "$WIN_ROOT",
  "app",
  "readmeprobe",
]
EOF

cd "$W" || exit 1
echo "临时工作区: $W"
echo "被验证的模块: $WIN_ROOT"

OUT="$(moon check --target js 2>&1)"
RC=$?
echo "$OUT" | tail -3

if [ $RC -ne 0 ]; then
  echo ""
  # ⚠️ moon 失败时返回的是 **127**（不是 1）—— 实测。所以判断一律用 `-ne 0`，
  #    对外只归一化成 1（127 在 shell 里是"command not found"的约定，容易被误读）。
  echo "外部视角编译失败（moon 退出码 $RC）："
  # 指出是哪个探针挂了（两个包名一定出现在错误里，省得人再翻日志）
  case "$OUT" in
    *readmepaths*|*readmeprobe*)
      echo "  → 命中 **README 快速上手**：README 写的路径/API 在产物里不存在，照抄编不过。" ;;
    *"probe/app"*|*"app\\"*|*"app/"*)
      echo "  → 命中 **tools/ext_probe/app**：公开 API 不够用了。" ;;
    *) echo "  → 看上面的错误（两个探针共用一个工作区，报错里会带包名）。" ;;
  esac
  exit 1
fi

case "$OUT" in
  *"0 errors"*)
    echo ""
    echo "外部模块 check 通过："
    echo "  · tools/ext_probe/app 能依赖 XiLaiTL/moobile + style 并编译"
    echo "  · README 快速上手写的 import 路径与 API 在本地源码里都成立"
    exit 0
    ;;
  *) echo ""; echo "外部模块 check 未报错但也没有 '0 errors'，请人工确认上面的输出"; exit 1 ;;
esac
