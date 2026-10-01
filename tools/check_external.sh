#!/usr/bin/env bash
# check_external.sh —— 「外部模块能不能用 moobile」的冒烟测试。
#
# 为什么需要它：`examples/apps/todo-app/` 在模块**内部**，它编译得过证明不了外部可用；
# T0.0 把 `internal/style` 提为公开包 `style/`，图的就是外部能用。
#
# 做法：把 `tools/ext_probe/app/` 拷进一个临时目录，生成一份 `moon.work`
# （成员 = 本模块 + app），在里面 `moon check --target js`。
# 不动本仓库，跑完自动清理。
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

mkdir -p "$W/app"
cp "$SRC"/* "$W/app/"

cat > "$W/moon.work" <<EOF
members = [
  "$WIN_ROOT",
  "app",
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
  echo "外部模块 check 失败（退出码 $RC）—— 公开 API 不够用了，看上面的错误。"
  exit $RC
fi

case "$OUT" in
  *"0 errors"*)
    echo ""
    echo "外部模块 check 通过：probe/app 能依赖 XiLaiTL/moobile + style 并编译"
    echo ""
    # 光"能编"不够：README 才是使用者照抄的东西。它写的 import 路径必须真实存在
    # （2026-09 的事故：搬家后 README 还写着 `XiLaiTL/moobile/html`，照抄就编不过）。
    echo "== README 快速上手是否真能编过（README 的 import 路径就是契约）"
    if bash "$ROOT/tools/py.sh" "$ROOT/tools/readme_probe.py" --workspace; then
      exit 0
    fi
    echo ""
    echo "README 与库的公开路径不一致 —— 使用者照 README 写的第一行就编不过。"
    exit 1
    ;;
  *) echo ""; echo "外部模块 check 未报错但也没有 '0 errors'，请人工确认上面的输出"; exit 1 ;;
esac
