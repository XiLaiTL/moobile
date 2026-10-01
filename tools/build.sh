#!/usr/bin/env bash
# 编 MoonBit → 把 JS 产物放进宿主目录，供 Metro 打包。
#
#   bash tools/build.sh [debug|release]
#
# 说明：demo 现在是**独立模块**（`examples/apps/todo-app/moon.mod`），
# 由仓库根的 `moon.work` 工作区与库本体连起来 —— 所以从仓库根跑 `moon build` 即可，
# 产物路径按**模块名**组织：`_build/js/<profile>/build/<模块名>/<模块名>.js`。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROFILE="${1:-debug}"

if [ "$PROFILE" = "release" ]; then
  moon build --target js --release
else
  moon build --target js
fi

SRC="_build/js/$PROFILE/build/XiLaiTL/moobile-todo-app/moobile-todo-app.js"
DST="examples/apps/todo-app/host/moobile.js"

[ -f "$SRC" ] || { echo "ERROR: 找不到产物 $SRC"; echo "（包名/模块名变了？看一眼 _build/js/$PROFILE/build/ 下面）"; exit 1; }

cp "$SRC" "$DST"
echo "moonbit ($PROFILE) -> $DST"
