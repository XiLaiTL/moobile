#!/usr/bin/env bash
# check_published.sh —— 用**外部使用者**的视角验证 **registry 上已发布**的那一版。
#
#   bash tools/check_published.sh                      # 默认验 moon.mod 里的那一版
#   bash tools/check_published.sh XiLaiTL/moobile@0.1.0
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

if [ -d "$GOT/sqlite" ]; then
  echo "== 4) 能力包 sqlite/ 在发布产物里 ✓"
else
  echo "WARN: 发布产物里没有 sqlite/"
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
