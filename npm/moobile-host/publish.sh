#!/usr/bin/env bash
# 发布 `moobile-host` 到 npm。
#
#   bash npm/moobile-examples/apps/todo-app/host/publish.sh            # 交互式（需要 2FA 时 npm 会提示）
#   bash npm/moobile-examples/apps/todo-app/host/publish.sh 123456     # 直接带上一次性密码
#
# ⚠️ 两个必须知道的点：
#   1. **本机默认 registry 是淘宝镜像（只读），发不上去** —— 所以这里显式指向官方，
#      不靠 `~/.npmrc` 的默认值；
#   2. 账号开了 2FA 时，`npm publish` 需要一次性密码（`--otp=`），否则报 EOTP。
#
# 发布前先 `npm pack --dry-run` 把内容打印出来 —— 发出去就收不回来了（只能发新版本）。

set -euo pipefail

cd "$(dirname "$0")"

REGISTRY="https://registry.npmjs.org/"
OTP="${1:-}"

PACK_OUT="$(npm pack --dry-run 2>&1)"
echo "== 将要发布的文件（npm pack --dry-run）=="
echo "$PACK_OUT" | sed -n '/Tarball Contents/,/Tarball Details/p'
echo

# 打包白名单自检 —— `files` 里漏一个目录，发出去的就是一个坏包，而 npm 不能撤回。
# 这几个文件是"装到别人工程里必需"的最小集合：入口、能力目录、CLI、元数据。
REQUIRED="package.json index.js bin/cli.js capabilities/db.js README.md LICENSE"
MISSING=""
for f in $REQUIRED; do
  case "$PACK_OUT" in
    *"$f"*) ;;
    *) MISSING="$MISSING $f" ;;
  esac
done
if [ -n "$MISSING" ]; then
  echo "ERROR: 打包内容缺文件：$MISSING"
  echo "       检查 npm/moobile-examples/apps/todo-app/host/package.json 的 \`files\` 白名单。"
  exit 1
fi
echo "== 打包自检：必需文件齐全 ✓ =="
echo

# 泄漏自检：**发出去就收不回来**。README 曾经把维护者机器的绝对路径（一个盘符开头的
# 本机路径）带进发布包 —— 那次是 mooncakes 的 0.1.0/0.2.0，只能靠发新版本补救。
# （工具见 tools/check_public_leaks.py；确需字面举例时在同行写 `leak-ok` 豁免。）
echo "== 泄漏自检（本机路径 / 凭据）=="
PKG_TGZ="$(npm pack --silent 2>/dev/null | tail -1)"
if [ -n "$PKG_TGZ" ] && [ -f "$PKG_TGZ" ]; then
  if ! python3 "$(cd .. && cd .. && pwd)/tools/check_public_leaks.py" --zip "$PKG_TGZ" --quiet; then
    echo "ERROR: 包里有本机路径或凭据 —— 已停止发布。改完再跑一次。"
    rm -f "$PKG_TGZ"
    exit 1
  fi
  rm -f "$PKG_TGZ"
else
  echo "WARN: 没拿到 npm pack 的产物，跳过泄漏自检（请手动确认）"
fi
echo
echo "== 版本与名字 =="
node -e "const p=require('./package.json');console.log(p.name+'@'+p.version+'  ('+p.license+')')"
echo

ARGS=(--registry="$REGISTRY")
if [ -n "$OTP" ]; then
  ARGS+=(--otp="$OTP")
fi

echo "== npm publish ${ARGS[*]} =="
npm publish "${ARGS[@]}"
