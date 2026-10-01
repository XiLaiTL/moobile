#!/usr/bin/env bash
# 编 MoonBit → 把 JS 产物放进宿主目录，供 Metro 打包。
#
#   bash tools/build.sh [debug|release]
#
# 说明：demo 是**独立模块**（`examples/apps/todo-app/moon.mod`），由仓库根的 `moon.work`
# 工作区与库本体连起来 —— 所以从仓库根跑 `moon build` 即可。
#
# 「搬到哪」这一步现在交给 `moobile-host build`（**发现**产物，而不是写死一条路径）。
# 为什么要发现：实测产物路径**不是模块名的函数，而是模块在构建根里身份的函数** ——
#   · 工作区成员（demo、模板）：`_build/js/<profile>/build/<作者>/<模块>/<模块>.js`
#   · 独立模块（用户在空目录里新建的）：`_build/js/<profile>/build/<模块>.js`
# 写死任何一条，都会在"仓库里能跑"与"用户机器上能跑"之间错一边。
# 真源是 `npm/moobile-host/lib/build.js`（那里有实测记录与"匹配到多个就报错"的理由）。
#
# 它从 `host/` 往上自己找应用根（最近的 `moon.mod`）与构建根（最近的 `_build/js/…/build`），
# 所以在生成出来的项目里同样能跑 —— 那时应用根与宿主目录是同一个。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROFILE="${1:-debug}"
CLI="$ROOT/npm/moobile-host/bin/cli.js"

if [ "$PROFILE" = "release" ]; then
  moon build --target js --release
  FLAG="--release"
else
  moon build --target js
  FLAG=""
fi

cd "$ROOT/examples/apps/todo-app/host"
# shellcheck disable=SC2086
node "$CLI" build $FLAG
