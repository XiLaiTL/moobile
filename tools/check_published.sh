#!/usr/bin/env bash
# check_published.sh —— 用**外部使用者**的视角验证 **registry 上已发布**的那两个包。
#
#   bash tools/check_published.sh                      # 默认验 moon.mod 里的那一版
#   bash tools/check_published.sh XiLaiTL/moobile@0.1.0
#   PUBLISHED_REQUIRE_ALL=0 bash tools/check_published.sh XiLaiTL/moobile@0.2.2   # 历史核对：缺包只提示
#
# 验**两个**包（2026-10-01 从"只验月亮包"扩成两个）：
#   · 月亮包 `XiLaiTL/moobile@<ver>`  —— 装得下来、能编译、公开包齐、README 的路径成立（第 1–5 步）
#   · 宿主包 `moobile-host@<latest>`（npm）—— 用户路径的文件在不在，**以及两边的契约版本对不对得上**（第 6 步）
#
# ⚠️ 为什么第 6 步是**必须**的（`docs/design/SCAFFOLD.md` §6 早就点过这个缺口，现在补上了）：
#    `moobile-host` 是**另一个 registry、另一条发布命令**，所以"月亮包验过了"对它**一个字都不成立**。
#    代价已经付过两次：
#      · 线上 `moobile-host@0.2.0` 的 tarball 只有 6 个文件 —— **没有 `init` / `build` / `libgen` / 模板**，
#        用户 `npx moobile-host init` 直接扑空（而当时没有任何一条门看得见）；
#      · 契约 `1 → 2` 是**破坏性**的，**只发一边**会让线上错配、挂载即抛 —— 而"两边是否同代"
#        以前只能靠人记着。
#
# 与 `check_external.sh` 的分工（两件事，都要有）：
#   · `check_external.sh`  —— 验"**本地工作区**能被外部模块依赖并编译"（改本库时跑）
#   · `check_published.sh` —— 验"**发出去的那一版**能被别人装下来并编译"（发版后跑）
#
# 为什么必须分开：发布包是 `.moonignore` 过滤后的产物，跟工作区**不是同一份东西**
# （历史上就出过"把截图、安卓构建配置、计划书一起发出去"的事）。只有从 registry
# 装下来编译过，才算"这一版对外可用"。
#
# ⚠️ 本机环境坑（实测）：`git` 全局配了代理 `127.0.0.1:7890`，代理没开时
#    `moon update` / `moon add` 拉索引会失败，而报错是
#    `no version satisfies requirement …` —— 看起来像"包没发出去"，其实是**索引没刷新**。
#    所以下面在第一次失败时会用 `GIT_CONFIG_*` 把代理关掉重试一次。
#
# ⚠️ 另一个容易搞错的地方：依赖**已经**写在 `moon.mod` 里时，`moon add` 会说
#    "already exists, will not update it" 并且**不下载**；下载发生在 `moon check`。
#    所以这里走的是真实用户流程：**先空 moon.mod → `moon add` → `moon check`（这时才落盘）**。
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# ⚠️ 默认目标**跟着 moon.mod 的版本走**，不能写死。
#    曾经写死 `@0.2.0`：于是发了 0.2.1 之后，这个"发版后验一遍"的闸门验的仍然是 0.2.0 ——
#    真正的缺陷（0.2.1 的 README 写了产物里不存在的 import 路径）就这样溜过去了。
#    `moon.mod` 的版本就是"我正要发/刚发的这一版"，这是唯一不会漂的锚点。
LATEST="XiLaiTL/moobile@$(sed -n 's/^version = "\(.*\)"/\1/p' "$ROOT/moon.mod" | tr -d '\r')"
TARGET="${1:-$LATEST}"
MODNAME="${TARGET%@*}"
TPL="$ROOT/tools/pub_probe"

[ -d "$TPL" ] || { echo "ERROR: 找不到模板目录 $TPL"; exit 2; }

W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT
mkdir -p "$W/app"
cp "$TPL/moon.pkg" "$W/app/moon.pkg"
cp "$TPL/main.mbt" "$W/app/main.mbt"
printf 'name = "probe/pubapp"\n\nversion = "0.1.0"\n\npreferred_target = "js"\n' > "$W/app/moon.mod"

cd "$W/app"
echo "== 目标：$TARGET"

# 关掉 git 代理的那组环境变量（只在重试时用）
no_proxy_git() {
  env GIT_CONFIG_COUNT=2 \
      GIT_CONFIG_KEY_0=http.proxy  GIT_CONFIG_VALUE_0= \
      GIT_CONFIG_KEY_1=https.proxy GIT_CONFIG_VALUE_1= \
      "$@"
}

echo "== 1) 装（外部视角，从 registry）"
if ! moon add "$TARGET" >"$W/add.log" 2>&1; then
  echo "   第一次没成（多半是索引没刷新 / git 代理挂着），绕过代理重试…"
  if ! no_proxy_git moon update >/dev/null 2>&1 || ! moon add "$TARGET" >>"$W/add.log" 2>&1; then
    echo "ERROR: 装不上 $TARGET"
    tail -6 "$W/add.log"
    exit 1
  fi
fi

echo "== 2) 编译（js 目标，按公开 API 写；下载也发生在这一步）"
if ! moon check --target js >"$W/check.log" 2>&1; then
  echo "ERROR: 外部模块编译失败"
  tail -25 "$W/check.log"
  exit 1
fi
tail -1 "$W/check.log"

GOT=".mooncakes/$MODNAME"
if [ ! -d "$GOT" ]; then
  echo "ERROR: 装完找不到模块目录 $GOT"; ls -R .mooncakes 2>/dev/null | head; exit 1
fi
VER="$(sed -n 's/^version = "\(.*\)"/\1/p' "$GOT/moon.mod" | tr -d '\r')"
echo "== 3) 实际装到的版本：$MODNAME@$VER"

# 4) 发布产物里**必须有的公开包** —— 逐个查，缺一个就红。
#
# 为什么从"只查 `sqlite/` 而且只 WARN"改成这样（两个真实的教训）：
#   · 原来那条正好没覆盖到出问题的地方：0.2.2 发出去之后才发现
#     **`canvas/` 与 `gesture/` 根本不在产物里**（拿一个只 import 这两个包的模块去
#     `moon check`，两个都报 `Cannot find import`）；
#   · **清单不写死，从工作区发现**：根上每个带 `moon.pkg` 的目录就是一个公开包 ——
#     硬编码的话，下次新增一个包又会漏（本仓库在"写死路径"上栽过好几次）。
#     第三方 fork（`vendor/rabbita`）不在根上，单列。
#
# ⚠️ 验的不是"工作区自己这一版"时（例如 `check_published.sh XiLaiTL/moobile@0.2.2`
#    做历史核对），缺包**不判红**，只提示 —— 那一版本来就没有 canvas/gesture。
#    想强制判红/关掉判红，用环境变量 `PUBLISHED_REQUIRE_ALL=0|1`。
echo
echo "== 4) 发布产物里的公开包（清单从工作区发现，不写死）"
PKGS=""
for d in "$ROOT"/*/; do
  [ -f "$d/moon.pkg" ] || continue
  PKGS="$PKGS $(basename "$d")"
done
PKGS="$PKGS vendor/rabbita"
MISSING=""
for p in $PKGS; do
  if [ -e "$GOT/$p" ]; then
    printf '   ✓ %s\n' "$p"
  else
    printf '   ✗ %s（缺）\n' "$p"
    MISSING="$MISSING $p"
  fi
done

REQUIRE_ALL="${PUBLISHED_REQUIRE_ALL:-}"
if [ -z "$REQUIRE_ALL" ]; then
  if [ "$TARGET" = "$LATEST" ]; then REQUIRE_ALL=1; else REQUIRE_ALL=0; fi
fi
if [ -n "$MISSING" ]; then
  if [ "$REQUIRE_ALL" = "1" ]; then
    echo "ERROR: 发布产物里缺这些包：$MISSING"
    echo "       （发布包 = .moonignore **过滤后**的产物 —— 别拿工作区当证据）"
    exit 1
  fi
  echo "   （验的不是工作区这一版，缺包只提示：缺$MISSING）"
fi

# 5) README 是**随包发出去**的落地页：它写的 import 路径必须在产物里真的存在。
#    这一条是补出来的 —— 0.2.1 发出去之后才发现照 README 写的第一行编不过。
echo
echo "== 5) README 快速上手能否编过（对着 registry 上这一版）"
if ! bash "$ROOT/tools/py.sh" "$ROOT/tools/readme_probe.py" --target "$TARGET"; then
  echo "ERROR: README 与发布产物不一致 —— 使用者照 README 写的代码编不过。"
  exit 1
fi

echo
echo "通过：$MODNAME@$VER 能被外部模块装下来、按公开 API 编译过，且 README 的路径与产物一致"

# ── 6) 宿主包（npm）────────────────────────────────────────────────────────────
#
# 见文件头：这是**另一个 registry、另一条发布命令**，"月亮包验过了"对它一个字都不成立。
# 三条断言，从便宜到值钱：
#   a) 线上 latest 与工作区是同一个版本号（"发了没"）；
#   b) 用户路径的文件真的在 tarball 里（0.2.0 就是缺 `init` / `build` / 模板）；
#   c) **契约版本两边对得上** —— 这条是"只发一边"的探针，也是唯一一条**跨两个 registry** 的断言。
NPMREG="https://registry.npmjs.org/"
HOSTPKG="$ROOT/npm/moobile-host/package.json"
HOST_WS="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$HOSTPKG" | head -1 | tr -d '\r')"

echo
echo "== 6) 宿主包（npm）与契约对账"
HOST_LATEST="$(npm view moobile-host version --registry="$NPMREG" 2>/dev/null | tr -d '\r' | head -1)"
if [ -z "$HOST_LATEST" ]; then
  echo "WARN: 读不到 npm 上的 moobile-host（网络 / 镜像？）—— 跳过第 6 步"
  exit 0
fi
echo "   线上 latest = $HOST_LATEST · 工作区 = $HOST_WS"
if [ "$HOST_LATEST" = "$HOST_WS" ]; then
  echo "   ✓ 版本号一致"
elif [ "$REQUIRE_ALL" = "1" ]; then
  echo "ERROR: npm 上的 latest（$HOST_LATEST）与工作区（$HOST_WS）不是同一个版本 —— 这一版没发出去，或者发了别的。"
  exit 1
else
  echo "   （验的是历史版本，版本号不一致只提示）"
fi

HOSTW="$(mktemp -d)"
TGZ="$(cd "$HOSTW" && npm pack "moobile-host@$HOST_LATEST" --registry="$NPMREG" --silent 2>"$HOSTW/pack.err" | tr -d '\r' | tail -1)"
if [ -z "$TGZ" ] || [ ! -f "$HOSTW/$TGZ" ]; then
  echo "ERROR: 拉不下 moobile-host@$HOST_LATEST 的 tarball"; tail -3 "$HOSTW/pack.err"; exit 1
fi
tar -xzf "$HOSTW/$TGZ" -C "$HOSTW"

# b) 用户路径上的文件 —— 缺哪个，用户就在哪一步扑空。
#    ⚠️ `template/.gitignore` 单列：它被 npm 解包改名这件事踩过两次（见 FINDINGS），
#       而它**在 tarball 里存在**是 init 那条链路的前提。
HOST_LIST="$HOSTW/files.txt"
tar -tzf "$HOSTW/$TGZ" | sed 's#^package/##' | sort > "$HOST_LIST"
HOST_MISSING=""
for f in bin/cli.js core.js index.js lib/init.js lib/build.js lib/regen.js bin/libgen.js \
         template/moon.mod template/moon.pkg template/package.json template/.gitignore template/app.mbt; do
  if grep -qx "$f" "$HOST_LIST"; then printf '   ✓ %s\n' "$f"
  else printf '   ✗ %s（缺）\n' "$f"; HOST_MISSING="$HOST_MISSING $f"; fi
done
echo "   （tarball 共 $(wc -l < "$HOST_LIST" | tr -d ' ') 个文件）"
if [ -n "$HOST_MISSING" ]; then
  if [ "$REQUIRE_ALL" = "1" ]; then
    echo "ERROR: 线上宿主包缺这些文件：$HOST_MISSING"
    echo "       （0.2.0 就缺过整套 init/build/模板 —— 用户照 README 敲的第一条命令会扑空）"
    exit 1
  fi
  echo "   （历史版本，缺文件只提示：缺$HOST_MISSING）"
fi

# c) **契约对账** —— 唯一一条能抓住"只发了一边"的断言。
#    月亮包那边从**装下来的那一份**里读（第 1 步已经装在 .mooncakes 下），不读工作区。
MOON_CONTRACT="$(sed -n 's/.*host_contract_version *: *Int *= *\([0-9][0-9]*\).*/\1/p' "$GOT/app.mbt" 2>/dev/null | head -1 | tr -d '\r')"
NPM_CONTRACT="$(sed -n 's/.*export const CONTRACT *= *\([0-9][0-9]*\).*/\1/p' "$HOSTW/package/core.js" 2>/dev/null | head -1 | tr -d '\r')"
echo "   契约：月亮包（线上装的）= ${MOON_CONTRACT:-?} · 宿主包（线上拉的）= ${NPM_CONTRACT:-?}"
if [ -z "$MOON_CONTRACT" ] || [ -z "$NPM_CONTRACT" ]; then
  echo "ERROR: 两边的契约版本有一边读不出来 —— 断言的落点没了，别当通过。"
  exit 1
fi
if [ "$MOON_CONTRACT" = "$NPM_CONTRACT" ]; then
  echo "   ✓ 契约一致（$MOON_CONTRACT）—— 这一对是自洽的"
else
  echo "ERROR: 线上两个包的契约版本不一致（月亮包 $MOON_CONTRACT / 宿主包 $NPM_CONTRACT）。"
  echo "       ⚠️ 这就是「只发了一边」：用户装到的是错配的一对，挂载时会同时报出这两个版本号。"
  echo "       修法：把缺的那一半也发出去（两个包必须同代发，见 CHANGELOG 头部）。"
  exit 1
fi
