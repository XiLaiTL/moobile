# STATUS —— 现状与分数（**唯一来源**）

> **规矩**：这个项目"现在到哪了"**只写在这一份文件里**。其他文档（[`PLAN.md`](../PLAN.md)、
> `docs/design/**`、`README.md`、CI 注释）只留一句"见 `docs/STATUS.md`"。
>
> 为什么立这条规矩：2026-09-20 整理文档时，光 `PLAN.md` 一份文件里就同时存在
> Web **26/26** 与 **27/27**、真机 **21/21** 与 **14/14**、"已发布"停在 `0.1.0`
> （而月亮包已经到 `0.2.2`）三处互相矛盾的数字。**数字抄一份就会漂一份。**
>
> **每个数字都要能回答三件事**：哪条命令跑的、什么时候跑的、是不是本轮跑的。
> 本轮（2026-09-20）没重跑的，一律标"文档记载"，不许混进实测那一栏。

---

## 1. 已发布 vs 工作区

| 东西 | registry 上的 | 工作区里的 | 差异 |
|---|---|---|---|
| 月亮包 `XiLaiTL/moobile` | **`0.3.0`**（2026-10-01 发布；mooncakes API 实测版本列表 `0.3.0 / 0.2.2 / 0.2.1 / 0.2.0 / 0.1.0`） | `0.3.0` | **已对齐** —— 契约 `2`、`canvas/`、`gesture/`、组件库机制、`libgen`、脚手架都发出去了 |
| 宿主包 `moobile-host`（npm） | **`0.3.0`**（2026-10-01 发布；`dist-tags.latest = 0.3.0`，线上 tarball **35 个文件**） | `0.3.0` | **已对齐** —— `lib/init.js`、`lib/build.js`、`bin/libgen.js`、整套 `template/`（含 `template/.gitignore`）都在线上 |
| **契约版本** | **两边都是 `2`** | 两边都是 `2` | **已自洽**（线上 npm 的 `core.js` 是 `export const CONTRACT = 2`） |

> ✅ **2026-10-01：0.3.0 已发布，两个包都核过 —— §4-1 那条"最硬的阻塞"结了。**
> 实测证据（本轮跑的，见 §2.1）：`check_published.sh` 对 **线上** `0.3.0` 通过（9 个公开包齐全）；
> 线上 npm tarball 拉下来逐个查过；**从 registry 上两个包从零走了一遍用户的三条命令**，
> 真 Chrome 断言 **9 / 9**（见 §2.1 的「干净机器（registry 版）」）。
>
> ⚠️ 两个**只在发布日成立**的坑，都记进了 [`FINDINGS.md`](FINDINGS.md)：
> ① npm 对**未认证**的 `PUT` 回 **404**（看着像"包名不对"，其实是 token 过期）；
> ② 发布成功时服务端回 **202 = 异步受理**，`0.3.0` **约 6 分钟后**才在 registry 上可见 ——
> 一分钟就去查会得出"没发出去"的错误结论（我这一轮就判错了一次）。
> ③ 本机默认的 **npmmirror 镜像还没同步**（`npm install` 报 `notarget … ^0.3.0`），
> 官方源上已经有 —— 按需同步已触发。

---

## 2. 门与分数

### 2.1 最近**实测**过的（每条带日期 —— 数字要能回答"哪条命令、什么时候、是不是本轮"）

| 门 | 命令 | 日期 | 结果 |
|---|---|---|---|
| 离线全集 | `bash tools/verify_all.sh` | 10-01 | **16 / 16 通过、0 失败、0 跳过**（约 20 秒；`--with-e2e` 再追加 Web 端到端 3 项，本轮未跑） |
| ↳ 同一条命令，换成 **CI 那一代的工具链**（`0.1.20260920 (914d7da)`） | 先 `moon build --target js`，再 `MOON_HOME=.scratch/moonlatest` + 该工具链的 `bin` 进 PATH，跑 `bash tools/verify_all.sh` | 10-01 | **16 / 16 通过、0 失败、0 跳过** —— 「本机绿 ≠ CI 会绿」里**工具链漂移**那一半，第一次在本机被验掉（做法见 §4-8 与 FINDINGS 的 CI 收口补记） |
| ↳ 换回工作区钉的 `0.1.20260827 (d0aaa07)` | 同上 | 10-01 | **16 / 16 通过、0 失败、0 跳过** —— 新旧**两代都绿**，这是「改法是安全的」的判据 |
| ↳ 其中「lockfile 的 resolved URL 与包名一致」（**新增**） | `node tools/check_lockfile_urls.mjs` | 10-01 | 通过（8 份 lockfile、2088 个 `resolved` URL）。**立它的原因**：镜像源把两条 URL 写成了 404 的畸形路径（`expo-server` / `@expo/router-server`），而**任何新鲜克隆的 `npm install` 都会挂在它们上面**（本机因 node_modules 已存在而看不出来）。**已用诱饵证伪**：塞回一条坏 URL → 点名 + exit 1 |
| ↳ 其中「宿主平台替代物」 | `node tools/native_rn_check.mjs` | 09-21 | **15 项**通过（`visibility` / `geometry` 的形状、取整、不补发初始值） |
| ↳ 其中「能力包平台矩阵」 | `node tools/cap_platform.mjs` | 09-21 | 通过（29 个公开 API × 31 条 DOM 链路，「哪端可用 + 失效形态」齐全，漂了就红） |
| ↳ 其中「组件库接入（antd 试金石）」 | （在离线全集里） | 10-01 | **26 项**通过 —— ⚠️ 这一条**原来是个假通过**：负例 (b)「不给事件覆盖时点 antd 按钮应当无效」之所以绿，是因为 `installHostCore` 把事件表**合并**进全局 `MOBILE_HOST`（为修"重复 install 会冲掉注册"），前面用例装的 `"*": {click:"onClick"}` 一直留着；而它被**一份陈旧的 `moobile-host` 副本**（整体替换语义，天然干净）掩盖了很久。补了 `installHostCore({reset:true})` 之后它才名副其实（并终于能看到 React 那句 `Unknown event handler property onPress`）。见 FINDINGS「陈旧副本掩盖了一条门的假通过」 |
| ↳ 其中「脚手架模板」 | `node tools/template_check.mjs` | 09-21 | **14 / 14** |
| ↳ 其中「脚手架承载真应用」 | `node tools/scaffold_probe.mjs` | 09-21 | **7 / 7**（探针剧本另 22 项） |
| ↳ 其中「**模板同源 T1**」 | `node tools/template_compare.mjs` | 09-21 | **15 / 15**（清单 26 条，死条目 0）—— 装上当天做过证伪 8/8 |
| ↳ 其中「无头界面验证」 | `node tools/verify_headless.mjs` | 09-21 | **10 通过 / 0 失败 + 1 SKIP**（订阅通道要 `--slow`） |
| **C0 换宿主**（新增） | `node examples/apps/host-swap-spike/verify.mjs`（要 Chrome + `npm install`） | 09-21 | **27 / 27**：同一份 `moobile.js` 在**零 Expo、零 Metro** 的裸 RN(Web) 宿主下渲染 + 四条交互都回到 `update`（`--with-e2e` 那一组里也会跑；缺 Chrome / 没装依赖记 SKIP，**不是** PASS） |
| **打包形态**（新增） | `node tools/package_check.mjs` | 09-21 | **10 / 10**：真打 tarball → 真 `npm install` → 用**装好的 CLI** `init`，断言用户拿到 `.gitignore`（就是这条抓出了 npm 解包改名那个 bug）。**发布前必跑**（`publish.sh` 调它），不进离线全集 |
| **canvas 通道**（新增） | `cd examples/apps/canvas-spike/host && node verify.mjs`（要 `npm install`，只有 `canvaskit-wasm`；含 `moon build`） | 09-21 | **32 / 32**：库包 `canvas/` 的 18 条指令 → JSON 载荷 → 宿主包的解码器/翻译器 → **真 Skia**（CanvasKit）出图。含**跨语言对账**：MoonBit 编出来的载荷与 JS 镜像程序**逐字节相同**、两份载荷各自出图**像素逐点相同（0/40000）**；罗盘 **384 个采样点**颜色逐一等于卦爻数据；另有 3 个证伪诱饵。⚠️ **只到"绘制语义 + 载荷契约"这一层**：真机上的 `<Canvas>` 组件挂载与文字字形**未验**，边界写在它的 `README.md` §5。不进离线全集（要 wasm 运行时），同 `host-swap-spike` |
| **手势试金石** | `cd examples/apps/gesture-spike/host && node verify.mjs`（要 Chrome + `npm install`） | 10-01 | **40 / 40**：§1-4 是三盒对照（RNGH 默认 / `minDistance(0)` / `PanResponder` —— 都挂载成功、都给元素内坐标、位置都精确跟手 40px；RNGH 默认 `translationX` **落后 20px**，`minDistance(0)` 后归位）；**§5 是边界 20 项**：嵌套归属（子赢父 0）、深层子元素的参照系、多指 `pointers=2` 且 `dx` 锁第一指、滚动容器、同挂、无处理器（带正对照）、相位状态机。⚠️ **只测 web 宿主**；多指的真机行为、JS 线程忙时的手感仍未测（README §6/§7） |
| **gesture-edges · 真机**（新增） | `cd examples/apps/gesture-edges && node device_check.mjs`（要模拟器 + Metro + 已装 APK） | 10-01 | **18 / 18**：验 web 上**压根问不出来**的四条 —— ① 嵌套归属（`外 n=0`，`序外` 为空）② **`x/y` 相对挂手势的元素**（`深 起=130,50`、`末=170,50`，`深xs=[130,131,…,169]` 单一参照系；修前是 `[6,7,79,…]`）③ `on_pan` 的块吞掉外层滚动（`拖A c=0`、哨兵不出现）④ 只挂 `on_tap` 的块**让**滚动（`底B 见` 出现、`点B n=0`，带"无手势块滑得动"的正对照）。⚠️ 这条**逼出三处实现错误**（投机 grant / 原生 `locationX` 参照系 / `onShouldBlockNativeResponder`），见 FINDINGS 与它的 README §4 |
| **canvas-demo · 真机** | `cd examples/apps/canvas-demo && node device_check.mjs`（要模拟器 + Metro + 已装 APK） | 10-01 | **12 / 12**：`画布 ops=13` · 品红 3798px / 绿 324px / 蓝 424px · **横滑 80px → `dx=80 dy=0 n=9`** · 蓝指针质心移动 **74.5px**（手势→Model→画布整条链）· 点按 0→1 · 证伪屏 token 全不变。⚠️ 过程中发现两个**对使用者都成立**的坑：原生依赖版本必须用 `npx expo install --check` 认的那套、这个组合下**必须**有 `babel.config.js`（Expo 文档说不用）—— 见 FINDINGS |
| **画布通道 · 真机**（新增） | `cd examples/apps/canvas-spike/host && node device_check.mjs`（要模拟器 + Metro + **临时接线的 APK**，见 FINDINGS） | 10-01 | **7 / 7**：`画布 ops=9` token + 截图里**品红 4016 px / 绿 1600 px**（真 Skia 画到 Android 屏上）+ 切到无画布那屏 **0 / 0**（证伪）+ 无 JS 致命错误。**过程中抓到我们自己的两个真 bug**：`installHost` 号称幂等其实会冲掉已注册组件、`registerLibrary` 的 `components` 只认数组（详见 FINDINGS） |
| **SSE 流式通道（试金石，web/node）**（新增） | `node examples/apps/sse-spike/verify.mjs`（无头，自己起本地 SSE 服务；已接成 `verify_all.sh` 第 17 条门） | 10-01 | **12 / 12**：边收边长（第 1 帧到、第 3 帧还没到）· 顺序 · **一帧被切成两半要拼回一条** · **两帧挤在一次读取里要拆成两条** · `[DONE]`→完成 · HTTP 500→失败 · 非 SSE 响应一行不出（负例）· **abort 后一条都不再出现** |
| **SSE 流式通道（真机）**（新增） | `node examples/apps/sse-spike/device_check.mjs`（要模拟器 + Metro 服务本工程；自己起 SSE 服务并 `adb reverse`） | 10-01 | **14 / 14** —— ⚠️ **这条验的是另一份代码**：RN 的 `fetch` 没有 `response.body`，走的是 **XHR 渐进读**。边收边长 ✅ · 顺序 ✅ · `[DONE]` ✅ · 中途「停止」后**服务端继续推、界面一条不涨** ✅ |
| **F1 迁移动检**（新增） | `bash tools/mb.sh migrate-scan --root ../yi/zhouyi_reader`（要 moon；被扫项目在仓库外） | 09-21 | 候选 **6 文件 / 3139 行**；**15 类命中数与人工清点逐项一致**（见 FINDINGS 的 F1 补记）。顺手照出**我们自己的错**：标签表文档写 42、真源是 **44**（已修 5 处 + 归档 1 处）。⚠️ 边界：判据是"对这 15 类、在这一个项目上零遗漏"，新失效形态要加规则 |
| ↳ **同一项目重跑**（10-01） | 同上 | 10-01 | 候选 **6 文件 / 3139 行**、**44 映射 / 12 排除** —— 与 09-21 **逐项不变**（只改了报告里的话，没动判据）。**顺手修掉报告里三处过期的"下一步"**：`gesture.mouse` 说"手势通道尚未实现"、`canvas.api` 说"真机未验、手势未做"、`gesture.coord` 把量原点算在未做里 —— 都已被 10-01 的落地推翻，见 FINDINGS 的 F1 坑四 |
| ↳ 其中库包本身 | `moon test canvas` | 09-21 | **7 / 7**：载荷 JSON 逐字（18 条 op）、数字格式三条契约、字符串转义、`OpCtx` 18 个方法、`arc` 默认方向、节点接线（标签 + `ops`/`width`/`height` prop 落在 VNode 上） |
| ↳ 其中宿主包翻译器 | `moon test canvas` + canvas-spike 的形状组 | 09-21 | 指令→元素树逐条（整圆拆两段、无当前点时补 `M`、有当前点时补 `L`、`fill`/`stroke` 同路径两条、负例不许静默） |
| antd demo（生成物 + 交互 24 条） | `cd examples/apps/antd-demo/host && npm run check` | 09-21 | **24 / 24**；`--check` 一致 |
| **S1 本地代理**（新增） | 见 [`FINDINGS.md`](FINDINGS.md) 的 09-21 补记（`s1-local-run/probe-web.mjs` 是**仓库外**的一次性脚本） | 09-21 | 两段各 **9 / 9**：① 从**仓库布局**生成 → `npm install` → `npm run build` → `npm run web` → 真 Chrome；② 从**打包形态**（`npm pack` → `npm install <tarball>` → 用装好的 CLI `init`）同上。**发版仍是解锁"干净机器"的最后一步** |
| 组件库生成器读数 | `npx moobile-host libgen` | 09-20 | **71 个组件 / 65 个复合子组件 / 注册 136 个键 / 9317 个 prop（其中 4965 个进 DSL）**，抽取 ~0.6s；生成的 `components.generated.mbt` **12062 行**（`moon check` 0 错误） |
| 已发布包内容（npm） | `npm view moobile-host version` + 拉 tarball 列清单 | 09-20 | `0.2.0`，**无 `lib/`、无 `core.js`**（见 §1） |
| 已发布包内容（mooncakes） | mooncakes API 查 `XiLaiTL/moobile` | 09-20 | `0.2.2` |
| **已发布包到底缺什么**（10-01 复核） | `bash tools/check_published.sh XiLaiTL/moobile@0.2.2`（改成了**逐个查公开包**） | 10-01 | 9 个公开包里 **`✗ canvas`、`✗ gesture`**，其余 7 个（`cmd html http sqlite style sub vendor/rabbita`）都在 —— **独立复现了"发布用户拿不到画布与手势"这句话** |
| 打包形态门（发布前） | `node tools/package_check.mjs`（由 `publish.sh --dry-run` 调起） | 10-01 | **10 / 10**：装成功 / 模板随包在 / 用**装好的 CLI** `init` 跑通 / 生成物**有** `.gitignore` / 没有漏出来的 `.npmignore` / 11 个文件逐一对得上 |
| npm 发布前空跑 | `bash npm/moobile-host/publish.sh --dry-run` | 10-01 | **通过 10 / 失败 0**，版本读出来是 `moobile-host@0.3.0`；泄漏自检 ✓ —— **没有发布** |
| 月亮包发布前空跑 | `moon publish --dry-run` | 10-01 | `Check passed`；服务端 **202 Accepted**：`Dry run completed successfully. No changes were made. The dry-run was made for package XiLaiTL/moobile version 0.3.0.` ⚠️ 命令**最后仍打 `Error: moon publish failed`** —— 那是 dry-run 的正常收尾，别当成失败 |
| 发布包里有哪些包 | `moon package --list` | 10-01 | 303 个文件；**`canvas/` 与 `gesture/` 各 3 个文件都在**，9 个公开包齐全（所以抬版本之后一发布就补上了 0.2.2 缺的那两块） |
| **已发布 · 月亮包 0.3.0** | `bash tools/check_published.sh`（默认就跟 `moon.mod` 的版本走） | 10-01 | **通过**：9 个公开包 `✓ canvas ✓ cmd ✓ gesture ✓ html ✓ http ✓ sqlite ✓ style ✓ sub ✓ vendor/rabbita`；README 的 5 条 import 路径对着**线上这一版**编过；外部模块装得下来也编得过 |
| **已发布 · 宿主包 0.3.0** | `npm pack moobile-host@0.3.0 --registry=https://registry.npmjs.org/` + 解包查 | 10-01 | 线上 tarball **35 个文件**；`lib/init.js` `lib/build.js` `bin/libgen.js` `template/moon.mod` `template/.gitignore` 全在；`core.js` 里 **`export const CONTRACT = 2`**（与月亮包 `host_contract_version` 同代） |
| **干净机器（**registry 版**）** —— 本轮最重要的一条 | `npx moobile-host@0.3.0 init hello --name hello` → `npm install` → `npm run build` → `npx expo start --web` → 真 Chrome 断言（`s1-local-run/probe-web.mjs`） | 10-01 | **9 / 9**：生成 11 个文件（**含 `.gitignore`**）→ 装到 **488 个包**（`moobile-host@0.3.0` 就是本项目自己那份）→ `moon build --target js` 用的是**线上** `XiLaiTL/moobile@0.3.0` → `moobile-host build` 出 `moobile.js` **629 KB** → Metro 服务的就是这个工程（`<title>hello</title>`）→ 浏览器：标题「待办」/ 计数「还有 0 件」/ 输入回灌 / 点「添加」→「还有 1 件」/ 列表出现 / 输入框清空 / **全程无 console 错误** |
| ↳ 同一轮里的**镜像延迟**（不是包的问题） | `npm install`（默认源 = npmmirror） | 10-01 | **失败**：`notarget No matching version found for moobile-host@^0.3.0` —— 官方源上已有、镜像未同步。已触发按需同步（`PUT https://registry.npmmirror.com/-/package/moobile-host/syncs` → `state: waiting`）；改走官方源后安装成功（488 包 / 4 分钟） |
| **发布后核对（扩成两个包）** | `bash tools/check_published.sh`（第 6 段是 10-01 新加的） | 10-01 | **通过**：月亮包 9 个公开包齐 + README 路径成立；宿主包线上 `latest = 0.3.0` 与工作区一致、12 个用户路径文件全在（tarball 35 个）；**契约对账 `月亮包 2 = 宿主包 2`**。⚠️ 这一条补上的是 `docs/design/SCAFFOLD.md` §6.1 早就点名的缺口（"npm 那一半从来没有发布后验"） |
| ↳ 同一段门的**证伪**（用真实的错配组合） | `bash tools/check_published.sh XiLaiTL/moobile@0.2.2` | 10-01 | **`exit 1`** 且点名：`线上两个包的契约版本不一致（月亮包 1 / 宿主包 2）` —— 即"只发了一边"的场景，门能抓住 |
| ↳ 同一段门的**宽松分支** | `bash tools/check_published.sh XiLaiTL/moobile@0.2.2`（历史核对） | 10-01 | 缺包/版本不一致只**提示**，不判红（`PUBLISHED_REQUIRE_ALL=0/1` 可强制） |
| **CI（C3）· GitHub Actions**（**第一次绿**） | push 后自动跑 `.github/workflows/ci.yml`（读结果：`python3 tools/ci_status.py <sha>`） | 10-01 | run **`36888896799`** @ `3e4a3fc` → **`conclusion = success`**，8 个步骤全 success，annotation 只剩两条与本仓库无关的弃用提示。**它落地以来第一次通过**（此前两次都是 failure，见 §4-8） |

⚠️ **口径**：09-20 那三行是**那天**跑的，这一轮没重跑（数字本身没错，但别当成今天的）。
`tools/verify_headless.mjs` 裸跑是 **10 通过 + 1 SKIP**，SKIP 数**取决于调用方式**
（订阅通道要 `--slow`；"计数文案"那条断言只在模板门带 `--count-pattern` 的调用里存在）——
所以设计文档里**不再自报项数**，一律指向本表。

### 2.2 需要本机资源、本轮**没有**重跑的（文档记载，别当成本轮实测）

| 门 | 命令 | 最近已知 | 前置 |
|---|---|---|---|
| Web 端到端 | `node tools/verify_web.js` | 27 / 27（含订阅心跳） | Metro 在 8081 + 后端在 8787 |
| 本地数据库 | `node tools/db_probe.js` | 8 / 8 | 同上 |
| 同步链路 | `node tools/sync_probe.js` | 14 / 14 | 同上 |
| 真机 Android 14 | `python3 tools/verify_android.py` | 27 项，**25/27**（删除链路 2 条挂 —— **既有的**，见 §4 第 6 条）；可见性 3 条 + 尺寸 3 条（**精确数值**）全过 | 模拟器（AVD `moobile64`，**x86_64**）+ APK |
| 一键（含 e2e） | `bash tools/verify_all.sh --with-e2e` | 追加 Web 那三项 | Metro + 后端 |
| 发布后核对 | `bash tools/check_published.sh` | —— | 网络 + 已发布版本 |

---

## 3. 轨道进度

| 轨道 | 已落地 | 还剩什么 | 正文 |
|---|---|---|---|
| **A 治理** | 目录重排、文档分层、风格规则、CHANGELOG、CI | —— | [`PLAN.md`](../PLAN.md) §3.2 |
| **B 叙事** | description / keywords / README 首屏（registry 实测已是新版） | 要不要英文版 README（决策点 1） | §3.3 |
| **C 回归** | 安卓断言脚本、离线入口（15 项）、CI、**C0 宿主可替换性验证（09-21 ✅ 实测）** | **C2 那条"干净机器"的完整判据要等发版**（见 §1/§4） | §3.4 |
| **H 接入收敛** | 宿主收成 npm 包、单导出、注册表生成、fail-fast、契约校验 | H3（可选，已降级） | §3.7 |
| **N 原生能力** | `Cmd`/`Sub` 接线、真能力样板（expo-sqlite）、`@sub.every` 两端验过、**N2 能力通道两层都验过（`MOBILE_HOST.native` + `visibility`）**、**N5a 平台矩阵（29 API × 平台 × 失效形态，已进门禁）**、**N5b 3/4 有结论，其中 `on_visibility_change` 与 `on_resize` 真机验过（后者断言精确数值）** | N4 后半（`custom_sub` + 退订）、N6 文档、`clipboard`/`nav`/`dialog` 的处置（卡决策点 17） | §3.6 |
| **I 生态接入** | 机制 + I1 事件载荷 + I2/I3/I5 生成器（三份产物同源、`--check` 可 diff） | **I7 真浏览器样式**、I6 样式交集量化、I4 平台矩阵 | §3.8 |
| **E 脚手架** | 模板唯一真源、`init`、`build`（发现产物）、**三条离线门（模板 / 承载真应用 / 同源 T1）**、**打包形态门**（`package_check`，发布前跑；09-21 抓起 npm 解包改名那个 bug） | **发一版带 `init` 的宿主包**、`doctor`、E5/E6/E7、E8 接线 | §3.9 |
| **CAN 画布通道** | 设计定案（**不新开通道**：组件通道 + `prop_json`）、库包 `canvas/`（18 条指令 + `OpCtx` + `canvas()`）、宿主包两个入口（`canvas-ops` 纯翻译器 / `canvas-skia` React 桥）、本机真 Skia 验证 32 项、跨语言对账：载荷**逐字节相同** | **真机**（`<Canvas>` 挂载 + 文字字形，要 prebuild + 重建 APK）、**手势**（P3 T3.4）、**坐标换算/devicePixelRatio**（T3.5）、性能基线（D 轨道） | §3.6 补记 + [`design/DESIGN.md`](design/DESIGN.md) 阶段 4 |
| **GES 手势通道** | 库包 `gesture/`（`Gesture` + `Phase` + `attrs`/`pan`/`tap`）、宿主包 `gesture-rn.js`（**默认装载**，PanResponder、零新依赖）、**契约的不变量 4 条**（`start` 恰一次且在最先 / 起点 `dx=0` / 全程同一参照系 / `cancel` = 这次不算）、web 试金石 **40/40**（含边界 20 项）、真机 `gesture-edges` **18/18** | **多指 / pinch / rotate**（`pointers` 已**诚实报数**、`dx` 锁第一指，但真机多指没验 —— `adb shell input` 只能发单指）、iOS、**元素自身在拖动中移动时 `x/y` 怎么解释**（契约未写）、"JS 线程忙时的手感" | §3.6 / §7-19 |
| **SSE 流式通道**（新增） | 库包 `sse/`（`Event` + `stream` + `abort`；web 用 `fetch` 流、RN 用 XHR 渐进）、试金石 `examples/apps/sse-spike/`（无头 **12/12**、真机 **14/14**）、已接成第 17 条门 | 契约里**没有**取消之外的流控（背压）；多路并发流（一次开多条）未验 | 见 `FINDINGS.md` 的 SSE 补记 |
| **F 迁移** | **F1 迁移动检**（`tools/mb.sh migrate-scan`；判据"与人工清点零遗漏"✅ 已达成） | F2 样式半自动、F3 指南、F4 `moon add` 提示；**E9 从此有了前置** | §5.1 |
| **D 性能** | D4 空样式短路（顺手做的） | D1/D2 基线、D3（表分成三档但查表仍是线性扫描）、D5、D6 | §4 |
| **G 真实应用** | —— | 全部（`interest/yi` 移植仍未拍板，见决策点 3） | §6 |

---

## 4. 现在最大的几处空白（按"卡不卡别人"排序）

1. ~~**线上包没有 `init`/`build`** → S1 判据不成立、E 轨道卡住。~~ ✅ **2026-10-01 解决**：
   `moon publish` + `npm publish` 都做完了，两个包都在线上是 **`0.3.0`**（见 §1）。
   ✅ 2026-09-21 补：**"干净机器三条命令"这条链路的本地代理已经两段全通**（仓库布局与打包形态各 9/9，
   见 §2.1），发版前又新抓了一个 bug（打包后 `init` 生成的项目的 `.gitignore` 被 npm 改名吃掉，
   已修 + 已有发布前门）。
   ✅ **10-01 收口**：发布后**从 registry 上两个包从零走了一遍用户的三条命令**
   （`npx moobile-host@0.3.0 init` → `npm install` → `npm run build` → `npm run web`），
   真 Chrome **9 / 9**（§2.1）。这条判据**这次是真的成立了**，不再是"本地代理"。
   剩下的是**镜像延迟**（npmmirror 还没同步 0.3.0，属时间问题，见 §1 与 FINDINGS）。
2. **I7 没做** → M9 差的这半条正是"能不能在真浏览器里看样式"。
3. **D 整条未开始** → 没有基线，也就没有"够好了"的判据。
4. **没有任何真实应用的完整移植**（F1 已跑出报告、G 未拍板）——
   这仍是**从立项起就没变过的最大空白**（决策点 3）。

5. **C0 只验到 web 目标那半**（09-21 新增的边界）：裸 RN **native** 宿主（gradle + 真机、不经 Expo）
   还没跑过；带能力的宿主（换一个 db 实现去挂 `todo-app`）也还没写 —— 实测下来卡点很明确：
   **把平台拉进来的是注册表那一环**（`registry.generated.js` → `moobile-host/capabilities/db` →
   `expo-sqlite`，连打包都过不去），换成空注册表则启动那条 db 命令直接 abort（页面全空）。
   见 [`FINDINGS.md`](FINDINGS.md) 的 C0 补记。
6. **真机上"删除"这条链路是挂的，而且一直都在挂**（2026-09-21 实测）：`verify_android.py` 里
   `删除在真机上生效` 与 `同步后服务器上那条也没了` 两条**稳定失败**（新增 / 勾选 / 同步都过）。
   §2.1 里过去记的"真机 21/21"**已经不准**。判定过程与"不是新引入的"这条结论的依据见
   [`FINDINGS.md`](FINDINGS.md) 的 N2 补记（关键：先核验 Metro **实际服务**的产物内容，
   再跑基线对照 —— 前两次对照因为 Metro 的缓存行为跑的都是新代码，白跑）。
   另：真机断言**本身**的证伪（把可见性映射写反）试了两次都**没有得到有效结果**，
   原因记在同一处 —— 所以「它能抓映射写反」这句**没有被证明**，别当已验。
7. **canvas 通道：真机"画得出 + 拖得动"都已验（10-01），仍差文字字形与坐标换算**：`<Canvas>` 的
   **组件挂载 + 真绘制**已在 Android 模拟器上验过（`canvas-spike/device_check.mjs` 7/7：token + 截图取色 + 证伪），
   **整条链（手势 → Msg → Model → 绘制指令 → Skia）**在 `canvas-demo` 里验过（真机 12/12），
   Skia 原生库也确实链上了（`RNSkia: JniSkiaManager` 出现在 logcat）。
   ✅ **10-01 划掉一条**：原写的"手势（T3.4）未验"**已经收口** —— 手势通道独立成包（`gesture/`）、
   宿主默认实现（`gesture-rn.js`，零新依赖），web 试金石 **40/40**（含边界 20 项）、
   真机 `gesture-edges` **18/18**，过程中逼出三处**只在真机露头**的实现错误（见 FINDINGS 的手势边界补记）。
   **未验**：**文字字形**（`makeFont` 那条路没上过真机）与 `devicePixelRatio` 换算（T3.5）。
   ⚠️ 另：这次验证用的是**临时接线**（把画布塞进 todo-app 做实验，验完回滚）——
   画布是**可选特性**（要原生依赖），按"库优先"它该有自己的示例应用，不该进模板。
   见 [`FINDINGS.md`](FINDINGS.md) 的真机补记与 `examples/apps/canvas-spike/host/device_check.mjs`。

> 2026-10-01 新增两条：
> · **CI（C3）此前从未运行过，且按原写法永远不可能绿**：提交一直没推出去，GitHub 不会跑远端没有的工作流；
>   一推上去两次都是 `failure`，而本机同一个命令全绿。真因是它**漏了"新克隆"的第一步** ——
>   `vendor/` 是 gitignore 的生成物（`tools/vendor_sync.sh` 生成），而 **CI 每次运行都是一个新克隆**；
>   外加 npm 安装那步 `continue-on-error: true` 把失败线索抹掉。实测：新鲜克隆 4 通过 / 8 失败，
>   补上 `vendor_sync --apply` 后 **14 / 0 / 1、exit 0**。修法在 `.github/workflows/ci.yml`（**待推**，见 §4-8）。
>   ✅ **10-01 收口**：剩下那 4 条红门的真因是**一条语法错误**（`gallery.mbt` 的旧式泛型 `fn f[T]`），
>   已在本地修掉；**新旧两代工具链各 16 / 16**，但**修复本身还没推**（§4-8）。
> · **宿主包副本新鲜度门原来只守 1 份，而仓库里有 7 份**：另有两份早就漂了。已经吃到代价 ——
>   陈旧副本让一轮边界探测**测的是老实现**，还掩盖过一条门的假通过（antd 负例 (b)）。
>   门已改成发现式，配 `tools/refresh_host_copies.sh` 一键全刷。
>
> 2026-09-21 划掉两条：
> · **T1 比对器已装**（原第 2 条）—— 门 + 证伪都做了，见 §2.1 与 [`SCAFFOLD.md`](design/SCAFFOLD.md) §6；
>   清单本身也被机器核过一遍（手量首版**漏登 3 处、多登 1 处**，见 [`FINDINGS.md`](FINDINGS.md) 的 T1 补记）。
> · **C0 已实测**（原第 2 条）—— 同一份产物挂到零 Expo 的裸 RN(Web) 宿主，27 项断言全过，
>   见 `examples/apps/host-swap-spike/`。**但结论有边界**：web 目标 + 零能力应用，
>   这两条边界写进了新的第 5 条。

---

8. **CI（C3）：✅ 2026-10-01 第一次绿了**（run `36888896799`，提交 `3e4a3fc`，全部步骤 success）。
   它此前**从未运行过**（提交一直没推），第一次跑就红，一共红了两次、两个真因：

   - **第一次跑的 4 条红门 → 真因是一条语法错误，不是警告。**
     `examples/apps/antd-demo/gallery.mbt:10` 用了旧式泛型写法 `fn cell[C : …](…)`，
     CI 那代 moon 判 **E3002 解析错误**（新写法 `fn[T] f`）；另外三条红门
     （`gen_forwarders` / 脚手架两条）只是**需要能编译**。
     上一轮把 `[0079]` 当嫌疑犯是**猜错了方向** —— 那次是"322 warnings, **1 errors**"。
   - **怎么拿到的**：不再求 CI 日志（job log 走 API 403），而是**在本地把 CI 那代工具链装出来**
     （Windows 也有 `latest` 的 zip）：`0.1.20260920 (914d7da)`，用它**一行不差**复现了 CI 的报错形状。
     复现配方写在 [`FINDINGS.md`](FINDINGS.md) 的 CI 收口补记里。
   - **修法**：改那一行语法（**不钉工具链** —— 实测带日期的路径全 403，bucket 只有 `latest`/`nightly`；
     何况用户拿到的就是 `latest`，库必须在新工具链上能编）。**新旧两代各跑一遍离线全集，都是 16 / 16**（§2.1）。
   - **第二次跑的 2 条脚手架门 → 真因在"依赖的形态"，不在代码。**
     `file:` 依赖在 **Linux 上是软链**（真身 = 仓库源码）→ `core.js` 里的 `import 'react'` 从仓库那层
     往上找、必然找不到；在 **Windows 上是拷贝** → 就在装着 react 的 `node_modules` 里。
     ⇒ 同一份代码本机 16/16、CI 红。修法是 `tools/verify_headless.mjs` re-exec 加 `--preserve-symlinks`。
   - **两处出口也修了**（真因都不难，难的是"出口给的信息不指向它"）：`verify_all.sh` 失败时
     **先打错误行**（带 3 行上下文）再打尾巴；CI 的 annotation 顺序改成 **门名 → 错误行 → 尾巴 → 工具链版本**。
     **第二次红就是靠它一步定位的** —— 第一次红只能看到一串警告尾巴。
   - ⚠️ 顺带修掉一个**对使用者成立**的坑：`todo-app/host/package-lock.json` 里两条 404 的
     `resolved` URL 会让**任何新鲜克隆的 `npm install` 挂掉**（修法验过 integrity 一致）。
   - ⚠️ **仍未解决（记在这里，别当已做）**：① 新工具链下 `moon check` 有 **322 warnings**，
     其中 **238 条是 `implicit_impl_as_method`**（官方说将来会从警告**变成错误**），
     243 条落在 `vendor/rabbita/**`（我们的 fork，得走 patch 流程）；
     ② **`check_npm_fresh` 在 CI 上是空的** —— 副本是软链时它比的是"源码 vs 源码"，恒等，
     只有本机（真目录）才有意义（见 FINDINGS 的 CI 第二次红补记）。

## 5. 维护这份文件的三条纪律

1. **只有跑过的命令才能写进 §2.1**，并写明日期；没跑的一律进 §2.2 并标"文档记载"。
2. **项数/分数变了的当天就改这里**，别去改别的文档 —— 别的文档只该有链接。
3. **别写"已完成"除非同条给了命令**（[`CONTRIBUTING.md`](../CONTRIBUTING.md) 的负面清单第一条）。
