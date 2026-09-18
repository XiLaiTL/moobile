#!/usr/bin/env bash
# check_external.sh —— 「外部模块能不能用 moobile」的冒烟测试。
#
# 为什么需要它：`demo/` 在模块**内部**，它编译得过证明不了外部可用；
# T0.0 把 `internal/style` 提为公开包 `style/`，图的就是外部能用。
#
# 做法：把 `_tools/ext_probe/app/` 拷进一个临时目录，生成一份 `moon.work`
# （成员 = 本模块 + app），在里面 `moon check --target js`。
# 不动本仓库，跑完自动清理。
#
# 用法：
#   bash _tools/check_external.sh
# 判据：输出 `外部模块 check 通过`，退出码 0。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/_tools/ext_probe/app"

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
  *"0 errors"*) echo ""; echo "外部模块 check 通过：probe/app 能依赖 moobile/moobile/moobile + style 并编译"; exit 0 ;;
  *) echo ""; echo "外部模块 check 未报错但也没有 '0 errors'，请人工确认上面的输出"; exit 1 ;;
esac
