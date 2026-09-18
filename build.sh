#!/usr/bin/env bash
# 编 MoonBit → 把 JS 产物放进宿主目录，供 Metro 打包。
set -euo pipefail

cd "$(dirname "$0")"

PROFILE="${1:-debug}"

if [ "$PROFILE" = "release" ]; then
  moon build --target js --release
else
  moon build --target js
fi

cp "_build/js/$PROFILE/build/demo/demo.js" host/moobile.js
echo "moonbit ($PROFILE) -> host/moobile.js"
