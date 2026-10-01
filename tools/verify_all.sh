#!/usr/bin/env bash
# verify_all.sh —— **一条命令跑完全部离线检查**（PLAN 的 C2）。
#
#   bash tools/verify_all.sh              # 离线全套（不需要 Metro / 模拟器 / 后端）
#   bash tools/verify_all.sh --with-e2e   # 再加 Web 端到端三门（需要 Metro 在 8081、后端在 8787）
#
# 为什么要有这个入口：这些检查散在十几个脚本里，改完代码**记不住全跑**；
# 而其中任何一个单跑都很快，一起跑也就几十秒。CI（C3）接的也是这个入口。
#
# ⚠️ 项数别抄在这里（会漂）—— 跑一遍看汇总那一行；最近的分数见 `docs/STATUS.md` §2。
#
# 与"端到端"的分工：
#   · 离线检查（本脚本默认）—— 编译、行尾、链接、泄漏、vendor 一致性、外部模块可用性、
#     组件库接入、脚手架三条门（模板 / 承载真应用 / 同源 T1）、注册表一致性、副本新鲜度。
#     **不依赖**浏览器、模拟器、后端，所以 CI 上能跑。
#   · 端到端（`--with-e2e`）—— 真浏览器 + CDP 驱动 UI/本地库/同步；真机另跑
#     `python3 tools/verify_android.py`（需要模拟器，不进 CI）。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WITH_E2E=0
[ "${1:-}" = "--with-e2e" ] && WITH_E2E=1

LOGDIR="$(mktemp -d)"
trap 'rm -rf "$LOGDIR"' EXIT

PASS=0
FAIL=0
SKIP=0
declare -a LINES

run() { # run <名字> <命令...>
  local name="$1"; shift
  local log="$LOGDIR/$(echo "$name" | tr -c 'A-Za-z0-9' '_').log"
  "$@" >"$log" 2>&1
  tally "$name" "$?" "$log"
}

tally() { # tally <名字> <退出码> <日志>
  local name="$1" rc="$2" log="$3"
  if [ "$rc" = "0" ]; then
    PASS=$((PASS + 1))
    LINES+=("PASS  $name")
    printf 'PASS  %s\n' "$name"
  else
    FAIL=$((FAIL + 1))
    LINES+=("FAIL  $name  (日志 ${log})")
    printf 'FAIL  %s\n' "$name"
    printf '      ---- 末尾 12 行 ----\n'
    tail -12 "$log" | sed 's/^/      /'
  fi
}

skip() {
  SKIP=$((SKIP + 1))
  LINES+=("SKIP  $1（$2）")
  printf 'SKIP  %s（%s）\n' "$1" "$2"
}

cd "$ROOT"

echo "== 离线检查 =="
run "moon check --target js" moon check --target js
run "行尾规范（lf_normalize --check）" bash tools/lf_normalize.sh --check
# 文档搬家最容易留下的坑：相对链接静默失效（GitHub 上 404，本地看不出来）
run "文档相对链接（check_links）" bash tools/py.sh tools/check_links.py --quiet
# 公开泄漏：本机绝对路径 / 凭据（README 曾把本机路径带进发布包，所以这条必须有）
run "公开内容无本机路径与凭据（check_public_leaks）" bash tools/py.sh tools/check_public_leaks.py --quiet
run "vendor 一致性（vendor_sync --check）" bash tools/vendor_sync.sh --check
run "外部模块可用性（check_external）" bash tools/check_external.sh

# 转发包（根上的 html/ cmd/ sub/ http/）是从 vendor 的 .mbti **生成**的，生成物入库 → 能 diff。
# 改了 vendor/rabbita/** 或升级 fork 之后忘了重跑生成器，就会在这里红。
run "转发包与 mbti 一致（gen_forwarders --check）" bash tools/py.sh tools/gen_forwarders.py --check

# lockfile 里的 `resolved` URL 是否与包名对得上（**不联网**，纯结构判据）。
#
# 为什么必须有：这台机器的 npm 走 npmmirror，而它会把**畸形路径**写进 lockfile ——
# 实测两条：`expo-server` 被写成 `expo-examples/services/todo-server/-/...`、
# `@expo/router-server` 被写成 `@expo/router-examples/services/todo-server/-/...`，**都 404**。
# 后果与"本机看不出来"的原因一样值得记：本机 node_modules 早就装好了，npm 不必再取那两个
# tarball；而**任何新鲜克隆的 `npm install` 都会挂**（新贡献者、CI 都是新鲜克隆）。
run "lockfile 的 resolved URL 与包名一致（check_lockfile_urls）" node "$ROOT/tools/check_lockfile_urls.mjs" --quiet

# 宿主平台替代物（`MOBILE_HOST.native`）的 RN 侧实现。
#
# 为什么必须有这条门：`npm/moobile-host/native-rn.js` 里 `import 'react-native'`，
# 而那个包在本仓库**没装**（optional peerDependency）——
#   · `moon check` 碰不到它（那是 MoonBit 侧的门）；
#   · 其它离线门也编译不到它；
#   · 于是它是个**纯盲区**，写错了要等真机才知道。
# 这条门用 stub 的 react-native 真 import、真调 subscribe、真断言载荷语义与退订；
# 它**不**验真机上 AppState 的实际行为（那要 verify_android 的形状）。
run "宿主平台替代物（native_rn_check，15 项）" node "$ROOT/tools/native_rn_check.mjs"

# 能力包的「哪端可用」矩阵（PLAN §3.6 的 N5）。
#
# 为什么是门而不是文档：这张表（`tools/cap_platform.mjs` 里的两个常量）**会漂** ——
# 新增一个 `pub fn`、或新引入一条 `@dom.*`，都可能悄悄产生"在 RN 上不工作"的能力。
# 这条门查三个方向：代码里的公开 API / DOM 链路必须都在表里（逼着做平台判断），
# 表里的条目也必须都还在代码里（不留幽灵），以及"根上有没有转发包"的声明要与事实一致。
# 它顺手会**单独报出"在 RN 上静默给错值"的那几条** —— 那是最难发现的一类。
run "能力包平台矩阵（cap_platform）" node "$ROOT/tools/cap_platform.mjs"

# React 组件库接入（antd 试金石）—— **离线可跑**：SSR 出 HTML 断言 + jsdom 真实点击，
# 不需要浏览器、不需要 Metro、不需要后端。26 项判据见
# `examples/apps/antd-spike/host/verify.mjs`，设计见 `docs/design/DESIGN-COMPONENT-LIBRARY.md`。
#
# 为什么值得进这个入口：组件库接入是本库少数"跨了四层（标签表 / 契约 / 宿主包 / 宿主预设）"
# 的功能，任何一层退回去，这条门都会红 —— 而它跑起来只要几秒。
if [ -d "$ROOT/examples/apps/antd-spike/host/node_modules" ]; then
  run "组件库接入（antd 试金石，26 项）" \
    bash -c "cd '$ROOT/examples/apps/antd-spike/host' && node verify.mjs"
else
  skip "组件库接入（antd 试金石）" "examples/apps/antd-spike/host/node_modules 没装（cd 进去跑 npm install）"
fi

# ── 脚手架（E 轨道）────────────────────────────────────────────────────────────
# 模板是**唯一真源**（docs/design/SCAFFOLD.md §3.4）：生成出来的项目才是用户拿到的东西，
# 而"模板自己坏了"以前没有任何一条门看得见 —— 因为模板当时还不存在。
#
# 三条门都是**离线**的（临时工作区连本地源码，不联网）：
#   · template_check   —— 生成 / 替换干净 / 生成物能编能构建 / 无头跑起最小 Todo（约 6 秒）
#   · scaffold_probe   —— 把一份**多文件 + 多页面 + 带过滤**的应用覆盖进刚生成的项目里再跑（约 6 秒）
#   · template_compare —— T1：生成物与 demo 的差异**一条条对着清单**（约 1 秒）
# 为什么第二条必须有：产物路径不是模块名的函数、`host/` 这层生成物没有、`App.js` 只有 4 行 ——
# 每一处都足以让"模板能跑"与"生成物能跑"分家，"模板原样跑一遍"证明不了形状撑得住真应用。
# 为什么第三条必须有：前两条验的是"模板自己好不好"，没有一条验"**模板与 demo 还是一家人吗**"——
# 而"demo 能从模板重新生成"是 S4 判据的全部内容（差异清单见 tools/template/deltas.txt）。
#
# ⚠️ 三条**并发**跑：各自用临时目录、互不依赖，实测 12 秒 → 7 秒。
#    （`run` 是同步的，所以这里不等价改写 —— 但要自己记账，见下面的 tally。）
LOG_TPL="$LOGDIR/scaffold__template.log"
LOG_PROBE="$LOGDIR/scaffold__probe.log"
LOG_CMP="$LOGDIR/scaffold__compare.log"
node "$ROOT/tools/template_check.mjs" >"$LOG_TPL" 2>&1 &
P_TPL=$!
node "$ROOT/tools/scaffold_probe.mjs" >"$LOG_PROBE" 2>&1 &
P_PROBE=$!
node "$ROOT/tools/template_compare.mjs" >"$LOG_CMP" 2>&1 &
P_CMP=$!
wait "$P_TPL"; RC_TPL=$?
wait "$P_PROBE"; RC_PROBE=$?
wait "$P_CMP"; RC_CMP=$?
tally "脚手架模板（生成/替换干净/可编译/可运行）" "$RC_TPL" "$LOG_TPL"
tally "脚手架承载真应用（探针：多文件+多页面+过滤）" "$RC_PROBE" "$LOG_PROBE"
tally "模板同源 T1（生成物 vs demo，清单外差异即红）" "$RC_CMP" "$LOG_CMP"

# 能力注册表与依赖是否仍一致（生成物是入库的，所以能 diff）
if [ -d "$ROOT/examples/apps/todo-app/host/node_modules/moobile-host" ]; then
  # ⚠️ 不要用 `( cd … && run … )`：run 里改的 PASS/FAIL 落在**子 shell**，
  #    父进程的计数会少一个（第一版就这么漏掉了这项，汇总显示 4 而实际过了 5）。
  #
  # ⚠️⚠️ **必须跑源码，不能跑 `npx moobile-host`**（2026-09 修）。
  #    原写法是 `npx moobile-host regen --check`，而 `npx` 解析到的是
  #    `node_modules/moobile-host` —— 那是 `npm install` 时冻结的**副本**
  #    （`file:` 依赖不是 symlink，实测两边 inode 不同）。
  #    后果：门验的是副本、不是源码。曾出现「副本是好的、源码与**已发布的
  #    npm 包**都是坏的，而门是绿的」—— 见 `tools/check_npm_fresh.mjs` 的说明。
  #    跑源码脚本仍需 cwd = 应用根（它从 cwd 读**应用**的 package.json，
  #    并按 cwd 解析 --out），所以保留 `cd`，只把 `npx` 换成源码的绝对路径。
  run "能力注册表一致性（regen --check，跑源码）" \
    bash -c "cd '$ROOT/examples/apps/todo-app/host' && node '$ROOT/npm/moobile-host/bin/cli.js' regen --check"

  # 副本新鲜度：`node_modules/moobile-host` 必须是 `npm/moobile-host/` 的复制品。
  # 副本陈旧 = 上面那条门与 e2e 都在验旧代码（本轮就是这么被骗过去的）。
  run "宿主包副本新鲜度（check_npm_fresh）" node "$ROOT/tools/check_npm_fresh.mjs" --quiet
else
  skip "能力注册表一致性（moobile-host regen --check）" "examples/apps/todo-app/host/node_modules 里没装 moobile-host"
fi

if [ "$WITH_E2E" = "1" ]; then
  echo
  echo "== 端到端（Web）=="
  mcode="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8081 || true)"
  acode="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/health || true)"
  if [ "$mcode" = "200" ]; then
    run "Web UI 27 项（tools/verify_web.js）" node tools/verify_web.js
    run "本地库 8 项（db_probe.js）" node tools/db_probe.js
    if [ "$acode" = "200" ]; then
      run "同步 14 项（sync_probe.js）" node tools/sync_probe.js
    else
      skip "同步 14 项（sync_probe.js）" "后端不在 8787（cd server && moon build --target native && ./_build/native/debug/build/moobile-todo-server.exe）"
    fi
  else
    skip "Web UI 27 项（tools/verify_web.js）" "Metro 不在 8081（cd host && npx expo start --port 8081）"
    skip "本地库 8 项（db_probe.js）" "Metro 不在 8081"
    skip "同步 14 项（sync_probe.js）" "Metro 不在 8081"
  fi

  # ── C0：换宿主（PLAN §3.4）─────────────────────────────────────────────────
  # 与 Metro/后端**无关**（它自带 esbuild + 静态服务），所以不放在上面那个 if 里。
  # 它验的是 §1.2 那句"宿主是可替换件"：同一份 MoonBit 产物挂到**零 Expo、零 Metro**的
  # 裸 RN(Web) 宿主上，真 Chrome 里渲染 + 交互。见 examples/apps/host-swap-spike/。
  # ⚠️ 退出码 2 = "环境不够，没验"（缺 Chrome / 缺 node_modules）→ 记 SKIP，**不是** PASS。
  SPIKE="$ROOT/examples/apps/host-swap-spike"
  SPIKE_LOG="$LOGDIR/c0-host-swap.log"
  if [ -d "$SPIKE/node_modules" ]; then
    node "$SPIKE/verify.mjs" >"$SPIKE_LOG" 2>&1
    rc=$?
    if [ "$rc" = "2" ]; then
      skip "C0 换宿主（裸 RN(Web)，零 Expo）" "$(sed -n 's/^SKIP  *//p' "$SPIKE_LOG" | head -1)"
    else
      tally "C0 换宿主（裸 RN(Web)，零 Expo）" "$rc" "$SPIKE_LOG"
    fi
  else
    skip "C0 换宿主（裸 RN(Web)，零 Expo）" "examples/apps/host-swap-spike 没装（cd 进去跑 npm install）"
  fi

  echo
  echo "提示：真机那套不进这个入口（需要模拟器 + APK）——"
  echo "      python3 tools/verify_android.py        # 真机 21 项"
  echo "      bash tools/check_published.sh          # 已发布版本可用性（发版后跑）"
fi

echo
echo "================ 汇总 ================"
printf '通过 %d  失败 %d  跳过 %d\n' "$PASS" "$FAIL" "$SKIP"
for l in "${LINES[@]}"; do echo "  $l"; done

[ "$FAIL" = "0" ]
