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
    # ★ 先捞**错误行**，再给尾巴 —— 顺序是 2026-10-01 定的。
    #
    # 为什么：那天 CI 上 4 条门红，而 `---- 末尾 12 行 ----` 里**全是 deprecated 警告**
    # （真因是一条 E3002 解析错误，落在更早的位置）。于是读者只能顺着尾巴猜，
    # 而"尾巴全是警告"看起来就像"警告把门弄红了"。**日志的尾巴不是日志的重点。**
    #
    # 只在真有错误行时才打这一段（否则是纯噪声）；判据放宽到 Python / node 那类
    # `AssertionError:`、`TypeError:`（所以不是只匹配行首的 `Error`）。
    if grep -qE '^[[:space:]]*([A-Za-z_.]*Error|ERROR|error)[: ]' "$log"; then
      printf '      ---- 错误行（真因常常不在尾巴上）----\n'
      # 带 3 行上下文：诊断头里有**文件与行列**，再下一行往往是**出问题的那一行源码** ——
      # 没有它，「Error: [3002]」这种只有错误码的行等于没说。
      grep -nE '^[[:space:]]*([A-Za-z_.]*Error|ERROR|error)[: ]' -A 3 --no-group-separator "$log" | head -20 | sed 's/^/      /'
    fi
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
# ★ **本仓库/test 里的 96 项白盒测试**（2026-10-03 补进门）。
#
# 为什么必须有这条：`moon check` **只查类型**，碰不到行为。P1（属性表改不可变）就把
# 上游自带的 `attrs_copy_test.mbt`（"Attrs::copy isolates later mutations"）**弄红过**——
# 而它**不在门里**，于是那是一个**已发出的语义回归**：`Props::copy` 共享了可变表对象，
# 往副本里写会漏回原件（同一个 Attrs 传给两个元素就会串味）。
# 是"顺手跑了一次 moon test"才发现的 —— 那说明门缺了这一格。
# ⚠️ 它比 `moon check` 慢（要编测试），但这是"行为"这一层唯一自动化的判据。
# ⚠️ 标签里**不写项数** —— 写死的数字一定会过期（本轮就撞上了：加了 6 条测试，标签还写着 96）。
#    项数由 `moon test` 自己打出来（`Total tests: N`）。
run "白盒测试（moon test --target js）" moon test --target js
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

# F1 迁移动检：**两个实现逐项对账**（MoonBit 版是 F1 的真源，JS 版要随 npm 包发给使用者）。
# 为什么要这条门：F1 与 E9 是两条腿 —— `create --from-rabbita` 用的是 JS 那份扫描器，
# 而"哪些会静默失效"的判据一直挂在 MoonBit 那份上。两份答案不一致时，
# 迁移报告会**看起来是对的**（它自己很自洽），而结论与我们的判据漂了。
#
# ⚠️ 默认扫描对象是**仓库外**的真实项目 `interest/yi/zhouyi_reader`；
#    新鲜克隆 / CI 上没有它 —— 那时是 SKIP（不是 PASS）：判据不成立就不许说通过。
if [ -d "$ROOT/../yi/zhouyi_reader" ]; then
  run "F1 迁移动检对账（JS vs MoonBit，逐 finding 逐 hit）" node "$ROOT/tools/migrate_scan_reconcile.mjs"
else
  skip "F1 迁移动检对账（JS vs MoonBit）" "仓库外的 ../yi/zhouyi_reader 不在（CI / 新鲜克隆上正常）"
fi

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
run "宿主平台替代物（native_rn_check，19 项）" node "$ROOT/tools/native_rn_check.mjs"

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

# `libgen`（组件库 → MoonBit DSL + 宿主注册）**自己的规则** —— 假包探针，17 项。
#
# 为什么必须有这一条：生成器的产物是**两侧共同的承诺面**（MoonBit 的 `@antd.button(...)`
# 与宿主注册表同源于一份 manifest），而此前**没有任何一条离线门**看得见生成器自己的规则 ——
# antd 那条要装 antd、chat-app 那条要装 markdown 渲染器，都验不了
# "哪一档算 children / 哪一档算原始字符串 / 拼错名字会不会报错"。
#
# 它在一个临时目录里手写一个假包（四个组件各代表一档规则）+ 四条负例：
#   · 负例 A/B/D：`content` 里拼错组件名 / prop 名、`defaultExports` 里拼错名字 → 退出码 2 并**点名**；
#   · 负例 C：**没声明**时不能自己变成原始字符串（挡住"把规则放宽成全都当原始字符串"）。
# 宿主编（`defaultExports` 能不能真的从 `default` 上取到组件）用 stub 的 react 真 import 真注册。
#
# 它落地当天就抓到两个真 bug：
#   · 清单条目是**逐字段重建**的，`children: string` 判出来的 `deliver: 'raw'` 被静默丢掉；
#   · `defaultExports` 的第一版语义写错（"从 default 里找同名属性"，而 `export default Markdown`
#     的名字不在自己身上）—— 后者连真机都验过一轮才定住。
run "组件库生成器（libgen 探针，24 项）" node "$ROOT/tools/libgen_probe.mjs"

# SSE（流式）通道 —— 试金石在 `examples/apps/sse-spike/`。
#
# 为什么必须有这一条：它是库里**第一个"一个请求、很多条消息"**的通道（`@http` 是一问一答），
# 而它横跨四层（MoonBit 的 Cmd → 编译出来的 JS → 网络 → 消息回到 update）。
# 只测其中一层都会漏：**光调 `emit(msg)` 而不把返回的 Cmd 交给 scheduler，消息是静默丢掉的**
# —— 这条判据第一天就抓到了两个真 bug（收尾事件被自己挡掉、以及探针自己的引号盲点）。
#
# ⚠️ 它验的是 **web/node 那条传输**（fetch + ReadableStream）。**RN 那条是另一份代码**
#    （RN 的 fetch 没有 `response.body`，走 XHR 渐进读）—— 只有真机验得到：
#    `node examples/apps/sse-spike/device_check.mjs`（要模拟器 + Metro）。
if [ -d "$ROOT/examples/apps/sse-spike/node_modules" ]; then
  run "SSE 流式通道（试金石，12 项）" node "$ROOT/examples/apps/sse-spike/verify.mjs"
else
  skip "SSE 流式通道（试金石）" "examples/apps/sse-spike/node_modules 没装（cd 进去跑 npm install）"
fi

# **真实应用**（chat-app）—— 这条门是这一整条轨道的收束点，所以它验的**不是某个能力**，
# 而是"几件事同时用起来还对不对"：设置 → 发送 → **逐字长出来** → 停止 → 错误不白屏 →
# 历史落库**重启还在** → 清空。
#
# 它自带三样东西，于是**离线、不需要 key、不需要模拟器**：
#   · 假的 OpenAI 兼容 SSE 服务（判据自己起在随机端口上）；
#   · 假的 `MOBILE_HOST.db`（内存版**宿主实现** —— 见 `sqlite/sqlite.mbt` 的边界说明；
#     真机上那份是 expo-sqlite。它顺带让"重启还在"这条变得可测：内存活过应用重建）；
#   · 判据自己 `moon build`（否则它在 CI 里永远只是 SKIP）。
#
# ⚠️ 它验的是 **web/node 那条传输**；真机那条（RN 的 XHR）要看 `device_check.mjs`。
#
# 判据里还带一条**生成物一致性**（`libgen --check`）：chat-app 的 markdown 组件是
# `libgen` 从 `react-native-markdown-display` 的类型定义现生成的（`md/` 那三份产物），
# 而"手改生成物"与"忘了重跑生成器"这两件事**必须红**（与 `gen_forwarders --check` 同规矩）。
if [ -d "$ROOT/examples/apps/chat-app/node_modules" ]; then
  run "组件库生成物一致（chat-app，libgen --check）" \
    bash -c "cd '$ROOT/examples/apps/chat-app' && node '$ROOT/npm/moobile-host/bin/cli.js' libgen --check"
  run "真实应用（chat-app，23 项）" node "$ROOT/examples/apps/chat-app/verify.mjs"
else
  skip "真实应用（chat-app）" "examples/apps/chat-app/node_modules 没装（cd 进去跑 npm install）"
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

# 宿主矩阵（`--host expo | rnw | webview`）：这条门守的是 SCAFFOLD §3.3 那句承诺的
# **可执行形式** —— 「换宿主不改应用」：三个宿主生成物的 moon.mod / moon.pkg / app.mbt
# 必须**逐字节相同**，差别只在宿主文件。离线、不装依赖、不需要 VS 工具链。
# 「换宿主之后界面一样不一样」由两条示例守：zhouyi-reader-desktop（RNW：打进桌面宿主）与
# zhouyi-reader-webview（静态宿主：esbuild → 静态服务 → **应用自己那 45 条判据**原样复用）。
# ⚠️ 标签里**不能写反引号**：它在双引号里会被 bash 当成命令替换 ——
#    原来这行写的是 `--host rnw`，于是每跑一次都会先执行一条叫 `--host` 的命令
#    （输出 `line 238: --host: command not found`），汇总里的那格还少了半句话。
run "宿主矩阵生成器（expo / rnw / webview，32 项）" node "$ROOT/tools/host_probe.mjs"

# 生成物自查（迁移的洞）：机械迁移**移不过来**的那两块 —— 根样式 `page()` 没人挂、
# 根上没有滚动容器（RN 的 `View` 不滚动 → 真机上超过一屏的内容够不着）。
# 两条都**只在原生上现形**：本轮实测真机上滚 30 次界面纹丝不动，而**同一个页面**在
# web 判据里 45/45。探针既跑真实应用（必须干净），也跑 5 个**故意做坏**的样本（必须逐条点名）。
run "生成物自查（迁移的洞，13 项）" node "$ROOT/tools/migrate_app_audit.mjs"

# F1 的新规则 `click.on-view`（`on_click` 挂在不会响的标签上）：**诱饵项目 + 真项目读数**，
# 而且两侧实现（JS 包里的 `click-on-view.js` 与 MoonBit 真源）逐 hit 对账。
# 当年这 5 处是**手工**找出来的（卦卡点不动、折叠点不开），现在是报告里的一条。
run "F1 新规则 on_click-on-view（诱饵 + 两侧对账，13 项）" node "$ROOT/tools/migrate_click_scan.mjs"

# 按下态的组装顺序（`Style::press`）——**生成器语义**判据，不是"有没有这个块"。
#
# 为什么必须有：第十七轮"验过生成器"验的是数量（`grep -c '.press()'` ⇒ 10 个函数有这个块），
# 而 `emitModule` 把常态写在 `.press()` 之前、把 `:hover` 写在它之后 ⇒ 常态与按下态
# **整体互换**（`button.bagua_mode` 常态只剩两条：按住才变成一个按钮；grid 子项的
# `min_width` 也变成"只在按住时生效"）。**数量判据对语义反了的实现照样绿。**
# 这条门拿真 `emitModule` 跑两个最小夹具（普通按下态 + grid 子项），按 `Style::press`
# 的语义把链推一遍，断言常态/按下态各拿到什么值；再拿**两种错形状**做证伪。
# 不依赖仓库外的源项目，所以在新鲜克隆 / CI 上也跑得动。
run "按下态组装顺序（press，含证伪）" node "$ROOT/tools/press_order_check.mjs"

# 样式**源侧账本**：每一条源声明都必须落进一个"有名字的桶"（桶里的条目带 `file:line`），
# 并且"算成已映射 ⇒ 至少给一条调用、或者给一句说明"。
#
# 为什么必须有：第十八轮做了一次**人工只读清点**（656 条声明逐条对账、"无痕消失 0"）——
# 但那次清点**没变成判据** ⇒ 下次动生成器会不会又漏、漏多少，没人知道。
# 这条门把那次清点变成每次生成都算一遍的东西，并加一条第十八轮没有的兜底：
# `emitted++` 与"真的产出了调用"是**两件独立的事**，以前没有任何东西把它们绑在一起。
#
# ⚠️ 它里面有一条判据是**门自己重跑映射**（不依赖生成器的自述）—— 实测：把生成器里那段
#    兜底删掉，建在自述上的那条会**空转**，而自己重跑的那条照样能红。
# ⚠️ 真实应用那一半要仓库外的源项目，不在本机时 SKIP（不是 PASS）—— 夹具那一半照跑。
run "样式源侧账本（每声明一个桶 + 零调用兜底，含证伪）" node "$ROOT/tools/migrate_ledger_check.mjs"

# 库能产出的**样式键** vs **原生 RN 真认的键**（"有没有对应物"）。
#
# 为什么必须有：`style/style.mbt` 里那句"下面这批是**可移植且 RN 支持**的"对 **6 个键不成立**
# （2026-10-23 在**装在本仓库里的真 RN** 的 `ReactNativeStyleAttributes.js` 上逐条核过：
# 0.83.10 / 0.86.3 / 0.87.1 三份都缺 `whiteSpace` / `order` / 四个 `border*Style`）。
# 形状与本仓库栽过好几次的"web 绿、真机红"完全一样：RNW 当 CSS 照单全收、原生静默不认。
# 而且**不是潜伏的**：真实应用 `zhouyi-reader` 的产物里就有 **11 处**，它的 web 判据 103/0 全过。
#
# 判据的形状是"**新键必须登记**"：库有、RN 没有 ⇒ 必须在 `RN_UNSUPPORTED` 里写清
# `why`（原生的事实）与 `instead`（**对应物/替代路径**）；RN 哪天支持了它也会红（表过期）。
# 找不到装好的 RN 时那几条 SKIP（新鲜克隆 / CI 上正常），键集与表的一致性判据照跑。
run "样式键的平台矩阵（库 vs 原生 RN 登记表，含证伪）" node "$ROOT/tools/style_platform_check.mjs"

# **分边 `border-*-style` 的自动折叠**（原生 RN 只有四边共用的 `borderStyle`）。
#
# 为什么必须有：上面那条门只证明"这个键 RN 不认"，**不证明"我们怎么处理它"**。
# 2026-10-23 实测：`.m-yao { border-bottom: 1px dashed }` 在真机上画成**实线**
# （web 是虚线 ⇒ 又一处"web 绿、真机红"）。正解是**等价折叠**：几条"有宽度的边"共用同一个
# style 时，发一次四边共用的 `borderStyle` 是等价的。
# ⚠️★ 这条门里"能折"与"不许折"是**同一件事的两半**，两组证伪都要做：
#   折得动却不折 ⇒ 真机还是实线（就是本轮修的那个）；折不动却折了 ⇒ 把"左实线 + 上虚线"
#   画错，**比不折更糟**。所以夹具里有一个**反例控制**（两条边 style 不同 ⇒ 一条都不许折）。
run "分边边框样式的自动折叠（能折 / 不许折两半，含两组证伪）" node "$ROOT/tools/border_fold_check.mjs"

# **机器可读产物里的"当前事实"必须真的当前**（`migration.generated.json` 的 `facts` 块）。
#
# 为什么只修这一份、不修 `MIGRATION.md`：两份都漂了同样的数（实测 `510=435+75` vs `439+71`、
# `unmatchedLost 18` vs `0`、`18 类/357 处` vs `19/362`），但**性质不同** ——
# `MIGRATION.md` 里有**人手补记**（重新生成会冲掉它）⇒ 它只能当叙述；
# 而 `migration.generated.json` 是**纯生成物**、读者是**机器/LLM**（会拿它当数据用）
# ⇒ 它必须说现在的事，也能干净地"重算 + 比对 + 同步"。
#
# ⚠️ 判据 ①（时间戳/事实块在不在）与判据 ③（证伪）不需要源项目，CI 上照跑；
#    判据 ②（逐字段与重算一致）要仓库外的源项目，不在本机时 SKIP。
run "机器可读迁移事实（facts 与重算一致，含证伪）" node "$ROOT/tools/migrate_facts_check.mjs"

# **`MIGRATION.md` 的两个区**（生成区每次重写 / 手写区逐字节保留）。
#
# 为什么必须有：那份报告是"迁移当天的生成物 + 人手补记"两种东西，混在一起**两头都疼** ——
# 重生成冲掉人的补记（不可逆），不重生成数字一直漂（实测漂过 4 处）。2026-10-23 拍板分区。
# 判据里最要紧的一条是"**重新生成之后人的补记逐字节还在**"（另有"老格式整份不丢"那个方向）。
run "迁移报告分两区（生成区可覆盖 / 手写区永不覆盖，含证伪）" node "$ROOT/tools/report_region_check.mjs"

# ── **画布通道**（`canvas/` + 宿主侧三个后端）────────────────────────────────────
#
# 为什么现在才进门（2026-10-23）：这条试金石**一直存在**（35 项，离线可跑：node_modules +
# CanvasKit 的 wasm，不需要浏览器/网络），但它**没进这个入口** ⇒ 平时没人跑它。
# 代价实测到了：`canvas-ops.js` 把变换写成"两项合一"（`{translateX, translateY}`），
# 而 RN Skia 的 `processTransform3d` **只读每项的第一个键** ⇒ 真机上 `scale` 只缩 x、
# `translate` 只移 x —— **正圆画成横扁的椭圆（实测 a/b=0.512≈k）、内外圈对不上**。
# 更糟的是这条门里的期望值把**错形状**钉住了，而且它的 CanvasKit 回放**两个键都读**，
# 所以"形状自洽 + 回放正确"两边都对，唯独真机那条路是坏的。现在：
#   · 期望值改成拆开的写法；新增"每项只有一个键"+"按 RN Skia 的规则重放 == 按 canvas 的规则重放"
#     两条判据（含证伪）；
#   · 并且**把它接进这个入口** —— 没进门的好判据等于没有。
if [ -d "$ROOT/examples/apps/canvas-spike/host/node_modules" ]; then
  run "画布通道（canvas 试金石：指令→树→真 Skia 回放，35 项）" \
    bash -c "cd '$ROOT/examples/apps/canvas-spike/host' && node verify.mjs"
else
  skip "画布通道（canvas 试金石）" "examples/apps/canvas-spike/host/node_modules 没装（cd 进去跑 npm install）"
fi

# 样式层再生成的判据：迁移生成的应用，`styles/styles.mbt` 必须与**重算出来的**逐函数一致。
#
# 为什么它是一条门而不是"顺手 a diff"：`styles.mbt` 头上写着"不要手改"，但人就是会改。
# 一旦允许"生成器改了、产物沉默地不跟"，下次谁都不敢重生成 —— 2026-10-23 我实际就是
# 卡在这里（要修文字样式就必须动生成器，而产物被人改过）。**同步必须是有意识的一步。**
# 门里带证伪（人工改一格 + 加一格 ⇒ 必须报出来），所以它同时证明"比对是活的"。
#
# ⚠️ 退出码 2 = "环境不够，没验"（源项目 `../yi/zhouyi_reader` 在**仓库外面**，
#    新鲜克隆 / CI 上必然找不到）→ 记 **SKIP**，不是 PASS 也不是 FAIL。
#    实测（2026-10-23）：这条件原先一律记失败 ⇒ 这条门一提交就会让 CI 红，本机全绿。
run_regen_styles() {
  local log="$LOGDIR/regen-styles.log"
  node "$ROOT/tools/regen_styles_check.mjs" >"$log" 2>&1
  local rc=$?
  if [ "$rc" = "2" ]; then
    skip "样式层再生成同步（regen --styles）" "$(sed -n 's/^SKIP  *//p' "$log" | head -1)"
  else
    tally "样式层再生成同步（regen --styles，含证伪）" "$rc" "$log"
  fi
}
run_regen_styles

# 观感缺口扫描器（`migrate/motion-gap.js` → `MIGRATION.md §2.4`）：它是"迁移后看/用起来
# 会差什么"那张清单的唯一来源。一坏，报告就**安静地少一节**。
# 门里带证伪（换掉 hover 的判据 ⇒ 那一类必须消失；诱饵属性必须不进结果），
# 并对真实源项目断言"清单非空且含 hover"。
run "观感缺口扫描（motion-gap，含证伪）" node "$ROOT/tools/motion_gap_check.mjs"


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
