#!/usr/bin/env bash
# 发布 `moobile-host` 到 npm。
#
#   bash npm/moobile-host/publish.sh            # 交互式（需要 2FA 时 npm 会提示）
#   bash npm/moobile-host/publish.sh 123456     # 直接带上一次性密码
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
DRY=0
# `--dry-run`：把发布前的全部检查跑一遍就停（**这条就是给"改完 publish.sh 自己先试一遍"用的**）。
if [ "$OTP" = "--dry-run" ]; then
  DRY=1
  OTP=""
fi

# ── 模板：把真源拷进包里 ────────────────────────────────────────────────────────
#
# `moobile-host init` 跑在**别人的机器**上，模板必须随包走（SCAFFOLD §8 的 D2）。
# 真源只有一个：仓库的 `examples/apps/template/`（§3.4）—— 所以这里拷的是一份
# **按发布规矩的副本**，而且**发完就删**（它不入库，只是打包中间物）。
#
# ⚠️ 副本 = 又一个"副本 ≠ 源码"的漂移点（本仓库被这件事咬过好几次），所以：
#   · `tools/template_check.mjs` 会比对**包内副本与真源**，不一致就红（副本存在时）；
#   · 下面的 REQUIRED 自检里也钉住了 `template/moon.mod` —— 漏了它，发出去的 CLI 就是瞎的。
#
# ⚠️ `.gitignore` 这条踩过**两次**（两次都"在我们这边复现不出来"，见 docs/FINDINGS.md）：
#    ① npm **永远不把 `.gitignore` 打进 tarball**（即使 `files` 里写了 `template/`）——
#       所以 `package.json` 的 `files` 里必须**单独列出** `template/.gitignore`（2026-09-21 复验）；
#    ② **但列了也不够**：`npm install` 解包时会把包里的 `.gitignore` **改名成 `.npmignore`**，
#       于是用户 `init` 出来的项目**还是没有 `.gitignore`**（`moobile.js` 与 `_build/` 会被提交）。
#    ②的收口在 `lib/init.js`（它永远写出 `.gitignore`），判据是下面的**打包形态自检**
#    （真装一遍、用装好的 CLI 生成一个项目）—— 那也是唯一看得见它的地方。
TPL_SRC="../../examples/apps/template"
TPL_DST="template"
rm -rf "$TPL_DST"
cp -R "$TPL_SRC" "$TPL_DST"
rm -rf "$TPL_DST/node_modules" "$TPL_DST/_build" "$TPL_DST/moobile.js" "$TPL_DST/package-lock.json"
trap 'rm -rf "$TPL_DST"' EXIT
echo "== 模板已按发布规矩拷进包内（发包后自动删）=="
echo

PACK_OUT="$(npm pack --dry-run 2>&1)"
echo "== 将要发布的文件（npm pack --dry-run）=="
echo "$PACK_OUT" | sed -n '/Tarball Contents/,/Tarball Details/p'
echo

# 打包白名单自检 —— `files` 里漏一个目录，发出去的就是一个坏包，而 npm 不能撤回。
# 这几个文件是"装到别人工程里必需"的最小集合：入口、能力目录、CLI、生成器、模板、元数据。
# ⚠️ `template/` 与 `template/.gitignore` 是 2026-09 加进来的：**少了模板，`init` 在别人机器上
#    根本没法跑**（它找不到真源 —— 真源在仓库里，不随包走），而这在我们这边永远复现不出来。
REQUIRED="package.json index.js bin/cli.js capabilities/db.js lib/init.js lib/build.js template/moon.mod template/app.mbt template/.gitignore README.md LICENSE"
MISSING=""
for f in $REQUIRED; do
  case "$PACK_OUT" in
    *"$f"*) ;;
    *) MISSING="$MISSING $f" ;;
  esac
done
if [ -n "$MISSING" ]; then
  echo "ERROR: 打包内容缺文件：$MISSING"
  echo "       检查 npm/moobile-host/package.json 的 \`files\` 白名单。"
  exit 1
fi
echo "== 打包自检：必需文件齐全 ✓ =="
echo

# ── 打包形态自检（**装完之后再生成一遍**）──────────────────────────────────────
#
# ⚠️ 为什么必须有这一步（2026-09-21 实测出来的）：上面那张"必需文件齐全"是查 **tarball 条目**，
#    而 bug 恰恰在**装**的那一步 —— `npm install` 解包时会把包里的 `.gitignore` **改名成
#    `.npmignore`**（手写 `tar -xzf` 不会）。于是用户 `init` 出来的项目**没有 `.gitignore`**，
#    `moobile.js` / `_build/` 会被提交进他的仓库 —— 而这在我们这边永远复现不出来。
#    所以判据只能落到最下游那一句：**从装好的包生成一个项目，然后看它的文件名**。
#
# 它真打 tarball、真 `npm install`（要 registry），所以**只在发布前跑**，不进日常门。
# 日常门里那份离线代理在 tools/template_check.mjs（把改名这件事模拟出来）。
echo "== 打包形态自检（真装一遍 + 用装好的 CLI 生成一个项目）=="
if node ../../tools/package_check.mjs; then
  echo "== 打包形态自检 ✓ =="
else
  echo "ERROR: 打包形态自检没过 —— **别发**（发出去就收不回来了）。"
  exit 1
fi
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

if [ "$DRY" = "1" ]; then
  echo "== --dry-run：发布前的检查全跑完了，**没有发布** =="
  echo "   （包内模板会在本脚本退出时自动删掉）"
  exit 0
fi

echo "== npm publish ${ARGS[*]} =="
npm publish "${ARGS[@]}"
