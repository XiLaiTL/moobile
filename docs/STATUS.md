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
| 月亮包 `XiLaiTL/moobile` | ✅ **`0.4.0`**（**2026-10-03 发布**；`moon publish` 回 `Server status: 200 OK`；API 复核 `latest = 0.4.0`） | `0.4.0` | **已对齐** ✅ |
| 宿主包 `moobile-host`（npm） | ✅ **`0.4.0`**（**2026-10-03 发布**；复核 `dist-tags.latest = 0.4.0`、`versions = ['0.2.0','0.3.0','0.4.0']`） | `0.4.0` | **已对齐** ✅ |
| **契约版本** | 两边都是 `2` | 两边都是 `2` | **已自洽** —— `0.4.0` 契约不变 |

> ✅ **2026-10-03：`0.4.0` 两个包都已发布**（**月亮包先、宿主包后**，顺序不能反的理由见 `CHANGELOG.md`）。
> 下面三条是这一版发布时**踩到的**，都留下 —— 因为它们都是"会再犯"的那一类。
>
> 1. ★ **宿主包第一次发失败：`npm ERR! code E404 … PUT https://registry.npmjs.org/moobile-host - Not found`**。
>    这是 [`FINDINGS.md`](FINDINGS.md) **记过的那条坑的原样复现** ——
>    **npm 对"未认证"的 `PUT` 回 404**（看着像"包名不对"，其实是 **token 过期**）；
>    佐证：`npm whoami` → **`E401`**。刷新凭据
>    （`npm login --registry=https://registry.npmjs.org/`）后重发成功。
>    ⚠️ **别用默认 registry 登录** —— 本机默认是淘宝镜像（只读，发不上去）。
>    （失败的 PUT **什么都没发出去**：当时复核线上仍是 `0.3.0`，工作树也干净、没留 tarball 或模板副本。）
> 2. ⚠️ **"发完了"要以 registry 为准，而且要给它传播时间**：重发之后**头几分钟**查
>    `npm view moobile-host version` **仍然是 `0.3.0`**，过一会儿再查才是 `0.4.0` ——
>    与 `FINDINGS.md` 记的"**成功时回 202 异步受理、约 6 分钟才可见**"一致。
>    ⇒ **一分钟就去查会得出"没发出去"的错误结论**（这条坑本仓库已经踩过至少两次）。
> 3. ⚠️ **发布前必须先修 CHANGELOG**：原文写着"这一版是纯增量、**没有破坏性改动** ——
>    老代码不用改"，而 vendor 换底（rabbita `0.15.4 → 0.16.3`）带进来**三处源码级破坏**
>    （`@js.Promise` → `Promise[T]`、`@common.Viewport` 的 `width`/`height` `Int` → `Double`）。
>    **发出去的文档把事实说反了** —— 那比漏写一条严重。详见 [`CHANGELOG.md`](../CHANGELOG.md) 的 `0.4.0` 第一节。
>
> 发布前的自检（都是实跑）：`publish.sh --dry-run` 打包自检 ✓ · **打包形态门 10/10** ✓ ·
> 泄漏自检 ✓；`moon package --list` 产物齐全（`_build/publish/XiLaiTL-moobile-0.4.0.zip`）；
> 离线全集 **25 / 25**、白盒测试 **104 / 104**。宿主包线上 tarball **64 个文件 / 199.3 kB**
> （`template/` 与新增的 `hosts/` 都在）。
>
> 发布前的自检（都是本会话实跑）：`publish.sh --dry-run` 打包自检 ✓ ·
> **打包形态门 10/10** ✓ · 泄漏自检 ✓；`moon package --list` 产物齐全
> （`_build/publish/XiLaiTL-moobile-0.4.0.zip`）。⚠️ 离线全集在本会话是 **25 / 25**、
> 白盒测试 **104 / 104**。

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
| 离线全集 | `bash tools/verify_all.sh` | 10-02 | **24 / 24 通过、0 失败、0 跳过**（门数长过三次：第 21 条 = **F1 迁移动检两份实现逐 finding 逐 hit 对账**；第 23 条 = **生成物自查：根样式 `page()` 与根上的滚动容器**；第 24 条 = **F1 新规则 `click.on-view`（诱饵 + 两侧对账）**。⚠️ 门**内容**也会长：原来的"桌面宿主生成器"这一轮变成**宿主矩阵生成器**（20 → 32 项，见下）。这一格**只记最近一次**；同一天早些时候的 20/20、21/21、23/23 都是真的，别当成矛盾 |
| ↳ 其中「F1 迁移动检对账」（**新增**） | `node tools/migrate_scan_reconcile.mjs` | 10-02 | 通过：**19 类 / 362 条命中**（10-02 晚新增第 15 类 `click.on-view` 5 条 —— 见下一行），JS 版与 MoonBit 版**逐 finding 逐 hit** 一致（`interest/yi/zhouyi_reader`，6 文件 / 3139 行）。**已证伪**：改一个 needle、只改 `excerpt` 截断长度、删掉整条规则 —— 三种都能让它非零退出 |
| ↳ **F1 新规则 `click.on-view`**（`on_click` 挂在不会响的标签上，**新增**） | `node tools/migrate_click_scan.mjs` | 10-02 | **13 / 13**（进 `verify_all.sh` → **24 项**）：★ **诱饵项目**把期望值写死 —— `div` / 跨行的 `@html.div(` / `div (` / `span` / **注释里那行**都命中，`button` / `a` / `on_clicked` **一条都不报**（负例），`.mbt.bak` 不算；★ 两侧实现（JS 的 `click-on-view.js` 与 MoonBit 真源）逐 hit（`file:line` + `text`）一致；★ 真项目读数 **5 处**（`frontend/main.mbt:484/1269/1372/1400/1463`）—— 与**当年手工数出的 5 处**一致。**已证伪两个方向**：只改 JS（把 `span` 当会响的）→ 9/13；只改 MoonBit → 11/13 |
| **迁移过来的真实应用（`examples/apps/zhouyi-reader/`）** | Metro（`npx expo start --web --port 8081`）→ `node examples/apps/zhouyi-reader/verify.mjs` | 10-02 晚（十轮） | **真 Chrome 99 / 99**（45 → 81 → 83：十轮补**详情页五个折叠族 + 三个状态族**；**十一轮补响应式** 2 条、**十二轮补罗盘面板控件 16 条**（四模式 / 立竿测影 / 两两不同 / 可逆） —— 首屏画布边长 = min(94vw,720)（修前一直是回落值 **360**）、窗口收窄到 400px 时跟着变 376）。★ 补判据的过程**逮到三个真缺陷**并修掉：① **爻线根本不存在**（动态 `class=` 静默失效 + RN 默认 column）⇒ 变爻点不到；② **侧栏 sticky 退化成 `relative; top:70`** ⇒ 压住下一栏 70px，**大象点不开**；③ **两栏布局的 grid 丢失** ⇒ 改成"row + wrap + min-width"**结构性表达那个 760px 断点**。判据同时抓到**四处判据自己的错**（○/× 本来就在提示文案里、RNW 不落 `title`、按祖先找元素找错了、变卦期望值算错）。原始读数（同一轮的早期版本）：**真 Chrome 45 / 45**：首屏（页头/副题/页脚印章）、数据装载（应用日志 `658049 字符`）、**罗盘画出像素（非透明 518400）+ 拖拽后画面变化 + 轻点外环进卦（落到「萃」）**、搜索「乾」→ 过滤网格、点卦卡 → 详情页（真爻辞「乾，元，亨，利，贞。」）、样式落地（纸色底 / 边框 / 字距 / 衬线体）、**底部三块折叠（21 条：常显 + 默认折叠 + 点开出现正文的具体句子 + 箭头 ▸→▾ + 再点收起）**、无 console 错误。**已证伪**：把 `more_section` 的 `if open` 改成 `if true`（永远展开）→ **39 / 45**，红的正好是那 6 条折叠断言。⚠️ 罗盘**只在 web 上验过**（原生走 Skia、桌面走 `react-native-svg`，两条另有判据） |
| ↳ 同一条链上的编译与生成量 | `moon check --target js`（工作区含生成物）；`create --from-rabbita` 的产物 | 10-02 | 生成物 **0 错误**；样式层 **104 个函数**、声明对账 **510 = 已映射 435 + 有损 75**；报告 **21 项 TODO**（3 保底桩 + 13 整块注释 + 5 `on_click`-on-view） |
| **画布通道的 Web 后端（新增 `npm/moobile-host/canvas-web.js`）** | `node examples/apps/zhouyi-reader/verify.mjs`（真 Chrome，罗盘那三条断言） | 10-02 | 通过：18 条 draw-op → DOM 2D 重放，零依赖；应用侧不再需要自己写 `prepare_canvas`（高分屏收进后端）。**起因**：组件通道在 Web 上原本**没有后端**，`moobile:Canvas` 会 fail-fast，而 React 会把整页卸掉（现场是 root 空 + 控制台无 error） |
| **Android（模拟器）· 迁移过来的应用** | 起模拟器 → Metro 在 8081（同一条命令服务原生与 web）→ `node examples/apps/zhouyi-reader/device_check.mjs` | 10-02 晚（十轮） | **真机 29 / 29**（⚠️ 条数 27 → 26：删掉一条**阈值型**判据（"折叠时标题下的长文本 ≤2 条"，真机实测是 3 条——另外两个折叠标题 + 页脚也算），换成"**展开后才出现的那句正文**在展开时在、收起时不在"，判据少一条、硬一档）；十二轮 +3 条**模式切换**（点「京房八宫」→ 截屏指纹变、切回默认 → **指纹复原**）。上一轮读数 **真机 27 / 27**（含「同一点、转过之后命中另一卦」—— 它逼出了并修掉了库侧 `gesture-rn.js` 的一处真 bug：`start` 与 `move` 用了两个参照系；以及本轮新增的 **9 条折叠断言** —— 判据是"边滚边收长文本集合、再做差集"：展开比折叠态多 **14** 条、收起后多 **0** 条）。★ **这一轮它逮到两个 web 判据永远看不见的洞**（根上没滚动容器 → 滚 30 次界面纹丝不动；`page()` 没人挂），已修为两层根容器并把判据写进库（见下一行）。⚠️ 验不到：输入中文 → 点卦卡（adb 打不出中文），那条由 web 判据覆盖 |
| ↳ **生成物自查**（新增，库侧判据 + 离线门） | `node tools/migrate_app_audit.mjs`；`moobile-host create --from-rabbita …` 落盘后自动跑 | 10-02 | **13 / 13**（进 `verify_all.sh` → **23 项**）：4 个真实应用**必须干净**、2 个**已记录**的例外逐条点名（`perf-bench` 压测 harness / `antd-demo` web 画廊）、**5 个故意做坏的样本必须逐条点名**（含两个诱饵：注释里的假代码、组件属性名也叫 `scroll`）。拿仓库外的真源跑 `create`：当场报 **2 条必须处理**（`page-style-unused` + `no-native-scroll`），并写进生成物的 `MIGRATION.md §5` |
| ↳ 它的 APK（含 **Skia 的 C++**） | `cd examples/apps/zhouyi-reader/android && ./gradlew assembleDebug` | 10-02 | `BUILD SUCCESSFUL in 7m 23s`（240 tasks）；76 MB debug 包；装到 emulator-5554 并启动成功。**画布文字走 `makeFont` 那条路第一次上真机**（库里原来记着未验），截图逐点取色见 `docs/evidence/zhouyi-android-compass.png` |
| **画布通道第三条后端（新增 `npm/moobile-host/canvas-svg.js`）** | 真 Chrome + `EXPO_PUBLIC_CANVAS=svg` → `node examples/apps/zhouyi-reader/verify.mjs` | 10-02 | **24 / 24**（罗盘 758 个矢量元素 / 拖拽重绘 / 轻点外环进卦）。**它的意义是桌面**：`react-native-svg` 的 tarball 里有 153 个 windows 文件，是 RNW 上唯一现成的矢量通道 —— 而它同时支持 web，所以**桌面那条画布路径在本机就验掉了**（不必等 VS 工具链）。默认 web 后端仍是 DOM 2D，同一份判据也 **24 / 24** |
| **桌面宿主生成器（`--host rnw`）**（⚠️ 10-02 晚这个文件**改名成 `tools/host_probe.mjs`** 并扩成三宿主矩阵 —— 见下面第 55 行那一格；这一格是当时那一版的读数，留着不改成"历史被重写"的样子） | `node tools/desktop_host_probe.mjs` | 10-02 | **20 / 20**（离线，进 `verify_all.sh`）：★ 两个宿主生成物的 `moon.mod`/`moon.pkg`/`app.mbt` **逐字节相同**（「换宿主不改应用」的硬判据）＋ 宿主文件确实换了（expo ↔ rnw 的依赖 / 入口 / metro 配置）＋ 错参数当场红 |
| **桌面宿主（新增 `examples/apps/zhouyi-reader-desktop/`）** | `node examples/apps/zhouyi-reader-desktop/verify.mjs` | 10-02 | **5 / 5**：`react-native bundle --platform windows` 退出码 0（34.6 s）→ 产物 **8.80 MB**，里面既有**这个应用的真串**（比对串是**从应用源码与产物里同时取**的，不是写死的），也有宿主接线（`mountApp` + `registerSvgCanvas`）。⇒ “同一份 MoonBit 产物进第三个宿主”**从论断变成了判据**。⚠️ 这**不是**“桌面窗口能起来”：那要 VS 2026 + SDK 22621（本机没有）|
| **宿主矩阵生成器**（原「桌面宿主生成器」，**改名+扩容**） | `node tools/host_probe.mjs` | 10-02 | **32 / 32**（离线，进 `verify_all.sh`）：★ **三个**宿主（expo / rnw / **webview**）生成物的 `moon.mod`/`moon.pkg`/`app.mbt` **逐字节相同**（「换宿主不改应用」的硬判据，三个宿主 = 三份证据）＋ 各宿主的定义面确实换了（expo↔rnw 的依赖/入口/metro；webview 的依赖表无 expo/RN、入口不 import expo、`build-web.mjs` 那行 `alias`、模板专属文件被 `drop` 掉）＋ 错参数当场红。**已证伪**：删掉 `drop` → **31 / 32** |
| **静态 Web 宿主（新增 `examples/apps/zhouyi-reader-webview/`）** | `node examples/apps/zhouyi-reader-webview/verify.mjs` | 10-02 | **15 / 15**：esbuild 输入清单里 **0 个 expo / Metro 包**、产物是静态站点、服务端指纹 = 磁盘 `moobile.js` 的 sha256；★ 第 3 层是**把应用自己那 45 条界面判据原样指向这个静态宿主的 URL** → **45 / 0**。⇒ “同一份 MoonBit 产物 + 同一套界面判据，换宿主管用”**从论断变成判据**。⚠️ 不覆盖 PWA/Tauri/Electron 外壳本身。★ 另外拿**模板生成**的工程端到端再撞了一次（`init --host webview` → `build-web.mjs` → `serve-web.mjs` → 同那 45 条判据）：**45 / 0** ⇒ "模板生成物能承载真应用"也是判据（细节见 FINDINGS 九续第七节） |
| **桌面端（Electron）· 新增 `examples/apps/zhouyi-reader-electron/`** | `node examples/apps/zhouyi-reader-electron/verify.mjs`（要 `npm install` 装 Electron） | 10-02 晚（十三轮） | **17 / 17** —— ★ 起**真窗口**、把**应用自己那 97 条界面判据原样打在这个窗口上**（`PROBE_CDP_URL` 附着模式，应用那份脚本不自己起浏览器、也不导航）、再加两个**真窗口**（1280 / 420）比画布边长（跟随窗口宽度、**不是回落值 360**）。⇒ 目标里"桌面端**实测**"这一格**第一次真的有判据**（`--host rnw` 那条仍要 VS 2026 + SDK 22621）。⚠️ 打包安装包 / 自动更新 / 原生菜单**没做**；这条路线**还没进脚手架**（下一步做成 `--host electron`）。踩到的五个宿主坑见 FINDINGS 十三续 |
| **桌面端（RNW）可行性** | `.scratch/rnw-probe/` 的 17 份日志；`npx react-native bundle --platform windows` | 10-02 | **JS 侧通过**（退出码 0，裸 RN + 仓库源码版 `moobile-host` + **同一份** `moobile.js`）；**原生侧卡在 VS 版本闸门**：`NoMSBuild: … Visual Studio 18.6.0 or later`（RNW 0.83.2 要 **VS 2026**，不是文档写的 2022），绕过闸门后是 `MSB8036: 找不到 Windows SDK 版本 10.0.22621.0`。另：**Skia 无 Windows 后端**（`npm pack` 后 `package/windows/` 0 文件）⇒ 桌面罗盘要改 `react-native-svg` |（`--with-e2e` 再追加 Web 端到端 3 项，本轮未跑）。10-02 新增两条门：**组件库生成器（`libgen` 假包探针，24 项）** 与 **chat-app 的生成物一致性（`libgen --check`）** |
| ↳ 同一条命令，换成 **CI 那一代的工具链**（`0.1.20260920 (914d7da)`） | 先 `moon build --target js`，再 `MOON_HOME=.scratch/moonlatest` + 该工具链的 `bin` 进 PATH，跑 `bash tools/verify_all.sh` | 10-01 | **16 / 16 通过、0 失败、0 跳过** —— 「本机绿 ≠ CI 会绿」里**工具链漂移**那一半，第一次在本机被验掉（做法见 §4-8 与 FINDINGS 的 CI 收口补记） |
| ↳ 换回工作区钉的 `0.1.20260827 (d0aaa07)` | 同上 | 10-01 | **16 / 16 通过、0 失败、0 跳过** —— 新旧**两代都绿**，这是「改法是安全的」的判据 |
| ↳ 其中「lockfile 的 resolved URL 与包名一致」（**新增**） | `node tools/check_lockfile_urls.mjs` | 10-01 | 通过（8 份 lockfile、2088 个 `resolved` URL）。**立它的原因**：镜像源把两条 URL 写成了 404 的畸形路径（`expo-server` / `@expo/router-server`），而**任何新鲜克隆的 `npm install` 都会挂在它们上面**（本机因 node_modules 已存在而看不出来）。**已用诱饵证伪**：塞回一条坏 URL → 点名 + exit 1 |
| ↳ 其中「宿主平台替代物」 | `node tools/native_rn_check.mjs` | 10-02 晚（十一轮） | **19 项**通过（原 15 项；新增 4 条盯 `geometry.read()`：存在 / 取整 / **读的是当前值** / 两个形状都在）。起因：`@sub.on_resize` **只推变化、不补发初始值**，而应用需要"**现在多大**"（罗盘边长按窗口宽度算）⇒ 库侧补了 `HostCapability::read_json` + `@sub.current_viewport()` |
| ↳ 其中「能力包平台矩阵」 | `node tools/cap_platform.mjs` | 10-02 晚（十一轮） | 通过（**30 个公开 API** × 31 条 DOM 链路，「哪端可用 + 失效形态」齐全，漂了就红） |
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
| **真实应用（chat-app，无头）**（新增） | `node examples/apps/chat-app/verify.mjs`（自带假 OpenAI 服务 + 假 `MOBILE_HOST.db`；已接成 `verify_all.sh` 的门） | 10-02 | **22 / 22**：没有 key→设置页 · 保存→回聊 · 发送→**逐字长**（此刻 4 字而非一次 8 字）· 请求对（`Authorization` / `stream:true` / **不发空的助手占位**）· **重启历史还在** · 停止后服务端还在推而界面不涨 · 401 显示在界面上 · **200 的流里的错误帧**也算错 · 非 SSE 的 200（负例）· 清空（界面+库）。10-02 新增第 22 条：**★ markdown 组件收到的是原始字符串**（读 `md:Markdown` 元素的 `props.children` **类型**；"渲染成什么样"只有真机/浏览器验得到） |
| **组件库生成器（`libgen` 假包探针）**（新增） | `node tools/libgen_probe.mjs`（临时目录手写假包 + 四条负例；已接成 `verify_all.sh` 的门，**离线、不装任何包**） | 10-02 | **24 / 24** —— 生成器的规则第一次有离线门看得见：洞一（`PropsWithChildren` 认得出 / `PropsWithoutRef` 透明）· 洞二（`children: string` 自动 raw、`content` 声明 raw、没声明**不会**自己 raw）· `defaultExports` 两侧都通（宿主编用 stub react 真 import 真注册）· 负例 A/B/D（拼错的组件名 / prop 名 → 退出码 2 且点名）· 负例 C（挡住"规则放宽成全都当原始字符串"）。**落地当天抓到两个真 bug**（详见 FINDINGS） |
| **真实应用（chat-app，真机）**（新增） | `node examples/apps/chat-app/device_check.mjs`（要模拟器 + Metro 服务本工程；借已装的 debug 壳） | 10-02 | **17 / 17** —— 验的是**无头验不到的两件事**：① **RN 那条传输**（XHR 渐进；与 web 的 fetch 流是**两份代码**）；② **markdown 真的渲染出来了**：界面上读到 `AI | 标题一 | 这是粗体和行内代码。 | const a = 1; | • | 列表甲 | • | 列表乙` —— `#` / `**` / 反引号 / 围栏**全被吃掉**；流到一半时读到的正是 `AI | 标题一 | 这是** | ▍ | 生成中…`。⚠️ 这一轮它**先红了一次**（`registerLibrary("md") 里列了 Markdown，但模块里没有这个导出`）—— 真因是**类型定义谎报了导出**，只有真机看得见，见 FINDINGS |
| **干净机器（**registry 版**）** —— 本轮最重要的一条 | `npx moobile-host@0.3.0 init hello --name hello` → `npm install` → `npm run build` → `npx expo start --web` → 真 Chrome 断言（`s1-local-run/probe-web.mjs`） | 10-01 | **9 / 9**：生成 11 个文件（**含 `.gitignore`**）→ 装到 **488 个包**（`moobile-host@0.3.0` 就是本项目自己那份）→ `moon build --target js` 用的是**线上** `XiLaiTL/moobile@0.3.0` → `moobile-host build` 出 `moobile.js` **629 KB** → Metro 服务的就是这个工程（`<title>hello</title>`）→ 浏览器：标题「待办」/ 计数「还有 0 件」/ 输入回灌 / 点「添加」→「还有 1 件」/ 列表出现 / 输入框清空 / **全程无 console 错误** |
| ↳ 同一轮里的**镜像延迟**（不是包的问题） | `npm install`（默认源 = npmmirror） | 10-01 | **失败**：`notarget No matching version found for moobile-host@^0.3.0` —— 官方源上已有、镜像未同步。已触发按需同步（`PUT https://registry.npmmirror.com/-/package/moobile-host/syncs` → `state: waiting`）；改走官方源后安装成功（488 包 / 4 分钟） |
| **发布后核对（扩成两个包）** | `bash tools/check_published.sh`（第 6 段是 10-01 新加的） | 10-01 | **通过**：月亮包 9 个公开包齐 + README 路径成立；宿主包线上 `latest = 0.3.0` 与工作区一致、12 个用户路径文件全在（tarball 35 个）；**契约对账 `月亮包 2 = 宿主包 2`**。⚠️ 这一条补上的是 `docs/design/SCAFFOLD.md` §6.1 早就点名的缺口（"npm 那一半从来没有发布后验"） |
| ↳ 同一段门的**证伪**（用真实的错配组合） | `bash tools/check_published.sh XiLaiTL/moobile@0.2.2` | 10-01 | **`exit 1`** 且点名：`线上两个包的契约版本不一致（月亮包 1 / 宿主包 2）` —— 即"只发了一边"的场景，门能抓住 |
| ↳ 同一段门的**宽松分支** | `bash tools/check_published.sh XiLaiTL/moobile@0.2.2`（历史核对） | 10-01 | 缺包/版本不一致只**提示**，不判红（`PUBLISHED_REQUIRE_ALL=0/1` 可强制） |
| **性能基线 · 离线每帧成本（D1/D2 的离线那一半）**（新增） | `node tools/perf_bench.mjs --n 1000,5000 --mode translate --frames 100 --warmup 30 --trials 9`（负载 `examples/apps/perf-bench/`，先 `moon build --target js`） | 10-02 | **基线（重测，机器空闲；各 9 次 `min` 统计量）**：N=1000 **12.64 ms**（7007 元素）· N=5000 **84.90 ms**（35007 元素）· 每元素 **1.8–2.4 µs**。⚠️ translate 档 = **只算翻译层**，不含 React / 布局 / 原生渲染。⚠️ **首测是在并发负载下量的，两批不可混用**（`PERF.md` §3.1）。全部数字与边界见 `PERF.md` |
| **D3 标签表索引化**（新增） | 同上，用 `--artifact` 量两份**留档的构建**（改前 `3d8b00bf0ca5419a` / 改后 `90bdcb5fbaac274e`，各 9 次、交错跑） | 10-02 | **−10.5%（N=5000，两组 9 次 `min` 区间完全不重叠）/ −7.6%（N=1000，区间轻微重叠）**。⚠️ 首测报的 −10.7%@N=1000 是**并发负载放大**的；**单次读数能差 1.4–2.2×** ⇒ 判据是多次的 `min`，不是单次中位（`PERF.md` §5）。两份产物**都能从源码重建出同一哈希**（即 A/B 只差 D3 一处）。F1 复验仍 **44 映射 / 12 排除** |
| **★ 每帧成本归因（消融探针）**（新增） | 把 `Props::copy` 临时改成共享（**测完字节级还原**，不入 patch 系列），构建留档产物与对照同会话交错跑 | 10-02 | **−36.1%（N=1000）/ −27.8%（N=5000）**，即 **0.64 µs/元素**（两个规模几乎完全相同 ⇒ 归因成立）。**这改判了首测的归因**：大头是 `resolve_attrs` → `Attrs::copy` → `Props::copy` 那**四张表**的 `copy_map`，**不是**上一版写的 `styles_map()`（那里根本没有 `copy_map`） |
| **★ P1 的正确性回归（已修）**（新增） | `moon test --target js`（**本轮才补进 `verify_all.sh`**） | 10-03 | 上游自带的 `attrs_copy_test.mbt`（`Attrs::copy isolates later mutations`）**原来是红的**：`Props::copy` 把四张**可变**表连句柄一起共享 ⇒ 往副本里写会**漏回原件**（同一个 Attrs 传给两个元素就串味）——**已发出的语义回归**。修法：新增 `PropsTable::share()`（共享不可变数据、句柄各自新建）。**代价实测**：`translate` 中位 **+6.3%** / 均值 +7.6%（区间重叠）· `dom` +1.5~4.3% ⇒ **P1 净收益 −32% → 约 −25%**。门已补 `moon test`（**96/96**）——`moon check` 查不到行为，这一格原来没人守 |
| **★ 插入成本探针（给 P1b 定大小）**（新增） | 把 `Attrs::styles` 的插入**做 3 遍**（输出逐项不变：7007/1001/4005，`shape_ok` 仍 true），8 轮交错 | 10-03 | `min` **+61.4%（区间不重叠）**/ 中位 +37.8% / 均值 +29.1% ⇒ 反推每帧 **4005 次样式插入 ≈ 1.8 ms ≈ 翻译层的 30%**。⚠️ **profile 只报 3.2%** —— 低估一个数量级（内联/归属漂移）⇒ **给一刀定大小要用消融探针，别用 profile 份额**（`PERF.md` §12.3） |
| **★ memo 成为新应用的默认写法：脚手架模板**（新增） | `node tools/template_compare.mjs`（T1）· `node tools/verify_headless.mjs` · `node tools/template_check.mjs` | 10-03 | 模板的最小 Todo 列表改用 `@moobile.memo_list`（键 = `text` + `done` + `id` 三样；**`id` 那一条防的是「被复用的 handler 闭包在重排后切换错行」**）。判据：T1 **15/0**（`app.mbt` 属「生成物独有」，**不需要改 `deltas.txt`**）、无头 **10/0**（添加/勾选/删除都真的驱动了这个列表 ⇒ 键的三条被端到端走到）、模板门 **15/0**。**`id` 位的失败模式已有测试守着**：`verify_headless.mjs` 新增「同名两条 → 删第一条 → 勾剩下那条」剧本，无头判据 **10 → 13 项**；**并做了证伪** —— 把 `id` 从键里临时拿掉后那条**准确变红**（报 `点过之后 text=""`，与预测一致）（`PERF.md` §14.8） |
| **★ memo 落到真应用：chat-app 消息列表**（新增） | `node examples/apps/chat-app/verify.mjs`（无头，含新增的一条 memo 判据） | 10-03 | 消息列表改用 `@moobile.memo_list_i`（新增**带序号**的 helper；键 = `role` + `text` + `streaming_tail` 三样齐全）。**端到端判据**：流式期间读库自报的计数 ⇒ `命中 +4 · 未命中 +4`（4 帧 × 两行 ⇒ 每帧 1 命中 1 未命中）——**两个数都涨才算过**（只涨命中=界面冻住；只涨未命中=memo 没接上）。chat-app 无头判据 **22 → 23 项**，本次 **23/23** |
| **★ memo 落地（应用侧）：`@moobile.memo_list` + 诊断计数 + 配方**（新增） | 基准负载**改走这个公开入口**后重跑；`--memo` 8 轮交错；另加 `moon test` 3 条 | 10-03 | `translate` 中位 **4.9 → 0.13 ms（−97.5%）** · `dom` **12.00 → 0.37 ms（−96.9%）**、`min` 9.58 → **0.30 ms**（区间不重叠 ✅）。新增 `memo_hits()`/`memo_misses()` 诊断计数 ⇒ **读数自报命中率**（`--memo` 档零命中时仪器**直接报错**、并声明该批数字不可引用）。配方 [`PERF-RECIPES.md`](PERF-RECIPES.md)（长列表/虚拟化/update/样式，各带自查判据）。`PERF.md` §14.1 |
| **★ P3 收尾：记账快路（不用 memo 的应用不再付那笔税）**（新增） | 12 轮交错两档；另加 memo 档形状/命中与真应用无头判据 | 10-03 | `MCtx` 的路径记账**只有 thunk 用得上**却是每帧每元素都要付的（含时归因：`render_memo`+`render_children_memo` 自身 ≈ 14.6% vs 改造前 ≈ 6.3%）。改法：**先走零记账快路；真遇到 thunk 就把这一帧作废、武装记账并重画**（只发生一次）——**不做猜**，所以不存在「换屏后 memo 静默失效」。实测 `translate` **min −29.7% / 中位 −22.1% / 均值 −33.3% / p95 −41.1%（四列全不重叠 ✅）**；`dom` −15.8% / −15.9% / −15.0% / −12.3%（**同向但区间重叠**）。正确性四条都实跑：`--memo` 档形状 7 + 命中 1000/帧、chat-app **23/23**（命中 +4/未命中 +4）、模板无头 **13/13**、全量门 **25/25**。顺带重测 memo：**`translate` −97.0% · `dom` −96.1%**（`PERF.md` §14.9/§14.10） |
| **★ P3 续：没有 handler 就别建迭代器**（新增） | 20 轮（translate）/ 10 轮（dom）交错；同一份产物的 profile 对照 | 10-03 | 加 `Props::has_handlers()`（O(1)）挡住 `each_handler` 的循环（本负载 7007 个元素里只有 1001 个有 handler）。墙钟：`translate` 中位 **−10.5%** / 均值 −5.4% / min −2.0%，**区间全部重叠 ⇒ 只算方向一致**；`dom` 测不出。**直接证据**：profile 里 **`each_handler` 从榜单消失**（原 5.1%）⇒ 工作确实被拿掉了。⚠️ 这一档**堆增量 +295% 且区间不重叠** —— 因为**分配变少 ⇒ GC 更少 ⇒ 净堆更高**（堆增量 ≠ 分配量，`PERF.md` §14.6） |
| **★ 试过又退掉：Text 元素的 props 传 `null`**（新增） | 12 轮交错，两档 | 10-03 | 账本上说得通（每帧少 3000 个 JS 对象），实测 **四列符号自相矛盾、区间全重叠 ⇒ 测不出** ⇒ **回退**（回退后产物逐字节相同）。`PERF.md` §14.6 |
| **★ P3 落地：空表不建迭代器 + 样式走索引**（新增） | 含时归因定位 → 两刀 → 10 轮交错 | 10-03 | `translate` **min −20.7% / 中位 −16.7% / 均值 −28.4% / p95 −40.8%（四列区间全不重叠 ✅）**；`dom` −9.6% / −9.4% / −8.6% / −8.2%（**四列同向但区间重叠**，只算方向一致）。改法：① `render_props` 里空表不建迭代器（本负载 7007 个元素的 attrs/props **全空**）；② `styles_to_js` 用新增的 `Styles::at(i)` 按序号遍历，不再走闭包迭代器（省每元素一次间接调用 + 一个 `Option`）。定位手段：**含时归因**（`.cpuprofile` + 自己写的树分析），因为它**不新增分配 ⇒ 不扰动 GC**。`PERF.md` §14.5 |
| **★ P3 的探针（属性 → JS 对象值多少）**（新增） | 把 `render_props` 的构造**做两遍、丢掉结果**（输出逐项不变），8 轮交错 ×2 种 GC 条件 | 10-03 | **`min` +23.2% / 中位 +14.1%**（默认）· **`min` +25.3%（区间不重叠）/ 中位 +20.9%**（半空间 64 MB）⇒ 这笔成本 ≈ **翻译层的 20~25%**，与 profile 的 `render_props` 7.5~12% + `styles_to_js` 6~9% 吻合。⚠️ **均值/p95 反向**（探针更快）⇒ **这个探针会扰动 GC**（多造一倍垃圾改变了「GC 落在哪一帧」）；结论**只用 `min`/中位**，并把反向那两列如实写明。下一轮的具体改法：把「每键一次 FFI」改成**批量接口**（`PERF.md` §14.4） |
| **★ 试过又退掉：`Styles` 用 `ArrayView`（类型保证只读）**（新增） | 10 轮交错，两档 | 10-03 | **更优雅但更慢**：`translate` min **+15.2%** / 中位 +10.1% · `dom` min **+9.5%** / 中位 +8.4% / 堆增量 **+86.5%**（区间重叠，但两档六个统计量方向完全一致）⇒ **回退**。安全收益改走便宜那条路：**删掉会漏出可变数组的 `Styles::entries()` 访问器**。⚠️ 回退时顺手丢了一条快路径（+5.5%），靠 A/B 抓回 ⇒ 纪律：**回退要用「产物哈希回到原值」验收**（`PERF.md` §14.2/§14.3） |
| **★ P1b：样式表改扁平数组（本轮最大的一刀）**（新增） | 同一负载、同会话交错 12 轮（`--artifact` 两份留档产物） | 10-03 | **`translate` `min` 6.58 → 3.45 ms（−47.6%）· 中位 −38.7% · 均值 −34.9%**；**`dom` `min` 12.53 → 8.93 ms（−28.8%）· 中位 −22.7% · p95 −15.6%** —— **两档区间全部不重叠 ✅**。形状逐项不变（7007/1001/4005）⇒ 纯成本移除。改法：`Props.styles` 从不可变 HAMT 换成 `Styles`（扁平数组 + **可变句柄 + 数组永不原地改**，三条不变式写进注释）；写入点三处（`html`/`svg` 的 `Attrs::styles`、`Props::styles`）。⚠️ 上一轮那条探针估 30%，实测更大（连 `styles_to_js` 的 HAMT 迭代开销一起去掉了）。`PERF.md` §13 |
| **★ `memo` 在新树上重测**（新增） | 同一份产物切 `--memo`，8 轮交错 | 10-03 | `translate` 3.548 → **0.090 ms（−97.5%）** · `dom` 10.29 → **0.32 ms（−96.9%）**，区间不重叠。⇒ §11.1 的 −98.5%/−97.0% 是**旧树**读数，结论不变、幅度略小；**引用用新数**（`PERF.md` §13.4） |
| **★ P3a：`is_empty()` 去 O(N)**（新增） | `translate` / `dom` 各 12 轮交错 | 10-03 | `PropsTable::is_empty` 原来是 `length() == 0`，而 core 的 `immut/hashmap` 把 `length()` 标成 **O(N)**。改成保守非空位 ⇒ O(1)（语义精确）。⚠️ **墙钟在噪声内**（中位 −0.9%，区间全重叠）——真因：小表走 `Flat` 节点时 `length()` 本来就不遍历。**保留的理由**：去掉一个有文档背书的 O(N)；**没换到可测收益**（`PERF.md` §12.2） |
| **★ P1：属性表改不可变（每元素那次复制的开销）**（新增） | 四张表换成 `PropsTable[V]`（包 core 的 `immut/hashmap`）⇒ `Props::copy()` 变 **O(1) 指针拷贝**；留档产物同会话交错跑，`--artifact` 各 9 次 | 10-02 | **−32.4%（N=1000）/ −29.3%（N=5000）**，两组各 9 次 `min` 区间**完全不重叠**；三种统计量同向；**形状断言逐项不变**；**全量门 24/24**（含 chat-app 22 项等行为判据）。⚠️ **契约没破** —— 复制还在，只是变便宜了（对比消融上界 0.64 µs/元素，实测省 0.52/0.60）。已在 `tools/patches/{08,10,11,01,06,34}`，`vendor_sync --check` 通过 |
| **★ `dom` 档口径（真 React + jsdom）**（新增） | `node tools/perf_bench.mjs --n 1000 --mode dom --frames 100 --warmup 30 --trials 9`（⚠️ **量纲取决于 `NODE_ENV`**：production 构建没有 `act`，见 `PERF.md` §6.1） | 10-03 | **N=1000 `min` 统计量 14.29 ms**（9 轮交错 [13.05..16.45]）；同会话 `translate` 8.70 ms ⇒ **React 的 diff/commit + DOM ≈ 5.6 ms（39%）**。⚠️ jsdom **不做布局**、DOM 比真浏览器慢 ⇒ 绝对值偏悲观、只有差值方向可信。**新增「每帧自证落地」**（`frames_landed/missed/dropped`）——它第一次跑就抓到一次「帧压根没发生」的假读数（0.03 ms/帧，`PERF.md` §6.4） |
| **★ D6：`memo` 接通（0.16 那把刀原本在我们这条通道上是空转的）**（新增） | 同一份产物、宿主注入的开关切两格（`--memo`），`--mode translate` 与 `--mode dom`，各 9 轮交错 | 10-03 | **`translate` 8.70 → 0.133 ms（−98.5%）· `dom` 14.29 → 0.43 ms（−97.0%）**，两档区间均**不重叠**；每帧新建元素 **7007 → 7**、handler 1001 → 1。⚠️ **这是「只有表头在变」这个访问模式的上界**，别搬到真实应用。**「空转」有三层证据**（源码 / 编译产物里 `_Thunk._0` 从未被引用 / 实跑 `row_html` 调用计数 1000 vs 0），见 `PERF.md` §11.2。⚠️ **那条「未解释的 −27%」已查明**：不是记忆化，是 **GC 的复制量** —— `view()` 建的整棵树被 duplix 图持有到下一帧（活对象 11.73 → 8.74 MB、单次 Scavenge **2.0 → 6.5 ms**）。顺着它做的「惰性根」把 GC 时间砍到 **216 → 63 ms**、活对象 −29%，但**三种条件下 `min`/中位都不动** ⇒ **已回退**（否定结果与被我推翻的解释都留在 `PERF.md` §11.6） |
| **★ vendor 换底：rabbita 0.15.4 → 0.16.0**（新增） | 分支 `drill/rabbita-0.16.0`：`tools/vendor.lock` 改 0.16.0 → 4 个冲突 patch 用**三方合并**重做 → `vendor_sync.sh --apply` → 重生成转发包 | 10-03 | **`moon check` 0 错误 · `verify_all.sh` 24 / 24** · 基准**不回归**（N=1000 7.40→**7.36** ms；N=5000 46.62→**47.52** ms，区间重叠）· **P1 的 `PropsTable` 保住**（0.16.0 的 `vdom.mbt` 里 24 处）。33 个 patch 里**只有 4 个**要手工重做（`04`/`08`/`09`/`28`），其余 29 个直接重放；干净基树上 **33/33** 可打。⚠️ **对库使用者是 breaking**：`@common.Viewport` 的 `width/height` 变 `Double`、`@js.Promise` 变 `Promise[T]` ⇒ 下次发版必须进 CHANGELOG（`vendor/rabbita` 也在发布包里）。⚠️ 注册表最新是 **0.16.3**，但它需要**更新的工具链**（`moon upgrade`；见 `FORK.md` §4.3）。坑与手法见 `FINDINGS.md`（第十四轮·七） |
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
| **N 原生能力** | `Cmd`/`Sub` 接线、真能力样板（expo-sqlite）、`@sub.every` 两端验过、**能力通道第三种形状 `read_json`（"读一次当前视口"，十一轮）**、**N2 能力通道两层都验过（`MOBILE_HOST.native` + `visibility`）**、**N5a 平台矩阵（29 API × 平台 × 失效形态，已进门禁）**、**N5b 3/4 有结论，其中 `on_visibility_change` 与 `on_resize` 真机验过（后者断言精确数值）** | N4 后半（`custom_sub` + 退订）、N6 文档、`clipboard`/`nav`/`dialog` 的处置（卡决策点 17） | §3.6 |
| **I 生态接入** | 机制 + I1 事件载荷 + I2/I3/I5 生成器（三份产物同源、`--check` 可 diff）、**生成器自己的规则有了离线门（假包探针 24 项）**、**两处「类型定义撒谎」由声明兜住**（`content`：children 是原始字符串；`defaultExports`：名字只在 default 上）、**一个真实 RN 组件库接进来了**（`react-native-markdown-display`，无头 22/22 + 真机 17/17，宿主侧零手写） | **I7 真浏览器样式**、I6 样式交集量化、I4 平台矩阵 | §3.8 |
| **E 脚手架** | 模板唯一真源、`init`、`build`（发现产物）、**三条离线门（模板 / 承载真应用 / 同源 T1）**、**宿主矩阵三个宿主（expo / rnw / webview：第三个是零 Expo/零 Metro 的静态站点）**、**打包形态门**（`package_check`，发布前跑；09-21 抓起 npm 解包改名那个 bug） | **发一版带 `init` 的宿主包**、`doctor`、E5/E6/E7、E8 接线 | §3.9 |
| **CAN 画布通道** | 设计定案（**不新开通道**：组件通道 + `prop_json`）、库包 `canvas/`（18 条指令 + `OpCtx` + `canvas()`）、宿主包两个入口（`canvas-ops` 纯翻译器 / `canvas-skia` React 桥）、本机真 Skia 验证 32 项、跨语言对账：载荷**逐字节相同** | **真机**（`<Canvas>` 挂载 + 文字字形，要 prebuild + 重建 APK）、**手势**（P3 T3.4）、**坐标换算/devicePixelRatio**（T3.5）、性能基线（D 轨道） | §3.6 补记 + [`design/DESIGN.md`](design/DESIGN.md) 阶段 4 |
| **GES 手势通道** | 库包 `gesture/`（`Gesture` + `Phase` + `attrs`/`pan`/`tap`）、宿主包 `gesture-rn.js`（**默认装载**，PanResponder、零新依赖）、**契约的不变量 4 条**（`start` 恰一次且在最先 / 起点 `dx=0` / 全程同一参照系 / `cancel` = 这次不算）、web 试金石 **40/40**（含边界 20 项）、真机 `gesture-edges` **18/18**（⚠️ **本机 2026-10-02 实测是 14/18**，4 条红与当轮改动**无关** —— 已用「stash 掉改动再跑」对照证明前后逐条一致；两条是夹具前提（哨兵初始不该在屏内）、一条是 dp/px 单位假设，见 FINDINGS 的 Android 补记）| **多指 / pinch / rotate**（`pointers` 已**诚实报数**、`dx` 锁第一指，但真机多指没验 —— `adb shell input` 只能发单指）、iOS、**元素自身在拖动中移动时 `x/y` 怎么解释**（契约未写）、"JS 线程忙时的手感" | §3.6 / §7-19 |
| **SSE 流式通道**（新增） | **`@http` 的流式那一半**（`http/stream.mbt`：`StreamEvent` + `stream` + `abort`；web 用 `fetch` 流、RN 用 XHR 渐进）、试金石 `examples/apps/sse-spike/`（无头 **12/12**、真机 **14/14**）、已接成第 17 条门 | 契约里**没有**取消之外的流控（背压）；多路并发流（一次开多条）未验 | 见 `FINDINGS.md` 的 SSE 补记 |
| **F 迁移** | **F1 动检**（MoonBit 版 + 新增的 JS 版，两者逐项对账已进门；**19 类**，含新增的结构规则 `click.on-view`）· **F2 样式层**（✅ 已落地：CSS → `styles.mbt`，对本仓库真实应用量到 510 = 435 + 75）· **E9 装配器**（✅ 已落地：`create --from-rabbita`，判据 S9-1…S9-6 全达成）+ **生成后自查**（✅ 10-02 新增：`lib/migrate/app-audit.js`，`create` 落盘后自动跑、结果进报告 §5；离线门 `tools/migrate_app_audit.mjs` 13 项） | F3 指南、F4 `moon add` 提示 | §5.1、[`plan/PLAN-yi-port-2026-10.md`](plan/PLAN-yi-port-2026-10.md) |
| **D 性能** | D4 空样式短路；**D3 标签表索引化（−10.5%@N=5000 / −7.6%@N=1000，重测）**；**P1 属性表改不可变（−32.4%@N=1000 / −29.3%@N=5000，实测；契约未破）**；**D1 离线基线（重测）**（`docs/PERF.md` + `tools/perf_bench.mjs` + `examples/apps/perf-bench/`）；**归因（消融探针：每元素每帧那四张表的复制 = 0.64 µs/元素 ≈ −28~−36%）**；**`dom` 档统计口径 ✅（14.29 ms，React 占 39%）**；**D6 `memo` 接通 ✅（`dom` −97%，区间不重叠）** | **D1 的真机/真浏览器那两套**（D2 的掉帧率/内存峰值/首屏、连续滚动那一路）、**P1b（`styles` 改扁平数组）**、P2/P3（handler 与 JS 对象构造）、D5（元素身份/闭包池）、**P0（「推迟子树构造」省了什么 —— 未解释）**、**P0b（memo 路径记账的零成本化）**、虚拟化列表下的 memo 收益 | §4 |
| **G 真实应用** | **决策点 3 已拍板（2026-10，走 (a) 全做）且主体已落地**：`interest/yi` → [`examples/apps/zhouyi-reader/`](../examples/apps/zhouyi-reader/)，**四个宿主形态**（Expo / RNW / 静态 webview / Electron）都跑过判据（web **99/99** · 真机 **29/29** · 静态宿主 **15/15** · Electron **17/17**，见 §2.1） | **"完整"**：迁移报告里剩 **21 项 TODO**（3 保底桩 + 13 整块注释 + **5 处 `on_click` 挂在不会响的标签上**）—— 逐条在生成物的 `MIGRATION.md §4`。⚠️ RNW 的**真窗口**仍未起（要 VS 2026 + SDK 22621） | §6、[`plan/PLAN-yi-port-2026-10.md`](plan/PLAN-yi-port-2026-10.md) |

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
3. ✅ **有了**（10-02 划掉一半）：**离线基线已建**（`PERF.md`：每元素 ~2–2.6 µs、成本随元素数线性）。
   但**"够好了"的判据仍然没有** —— 真机与真浏览器那两套（D2 的掉帧率/内存/首屏）一条都没采，
   而"手感"只在那里看得见。归因已经把下一刀指出来（**每帧重建 Map ≈ 四成**，`PERF.md` §7/§8）。
4. ✅ **主体已落地**（10-02 划掉大半）：决策点 3 已拍板（走 (a) 全做），
   `interest/yi` → [`examples/apps/zhouyi-reader/`](../examples/apps/zhouyi-reader/)，
   **四个宿主形态**都跑过判据（见 §2.1）。
   **剩下的不是"有没有真实应用"，而是"完整性"**：迁移报告里 **21 项 TODO**
   （3 保底桩 + 13 整块注释 + 5 处 `on_click` 挂在不会响的标签上）**还没有人处理** ——
   这条**从立项起就在**，只是形状从"完全没有"变成了"逐条点名、等人决定"。

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

> 2026-10-02 新增（M3 手机 LLM 聊天应用 + 组件库生成器补洞）：
> · **一个真实的 RN 组件库接进来了，宿主侧零手写**：`react-native-markdown-display`
>   （LLM 的回复基本都是 markdown）。以前 `App.js` 里有一段手写 `registerLibrary` +
>   `({markdown, ...rest}) => createElement(Markdown, rest, …)` 适配层，现在**整段没有了** ——
>   接一个组件库 = 写 `libgen.config.json` + 跑一条命令。判据：无头 **22/22**、真机 **17/17**。
> · **两处「类型定义在撒谎」由声明兜住**（这是这一轮最有复用价值的东西）：
>   `content`（children 是**原始字符串**而非子树）与 `defaultExports`（名字**只在 default 上**）。
>   两处都**不猜**：类型说不准就由人声明，声明错了就报错并指出怎么改。机制与真因见
>   [`FINDINGS.md`](FINDINGS.md) 的 10-02 补记。
> · **生成器自己的规则第一次有离线门**：`tools/libgen_probe.mjs`（假包 + 四条负例，**不装任何包**）
>   已进 `verify_all.sh`。它落地当天就抓到两个真 bug（一个"清单字段被静默丢掉"、
>   一个 `defaultExports` 的语义写错）。⚠️ 它也是**唯一一条在 CI 上真的会跑**的组件库门
>   （antd / chat-app / sse 那几条在 CI 上是 SKIP，理由与下面的空白一致）。
> · ⚠️ **仍未验（别读大）**：markdown 只在 **Android 模拟器**上验过（**iOS 从未跑过**、
>   web/RNW 上的渲染没验）；chat-app 用的是**借来的 debug 壳**（`com.anonymous.host`），
>   **它自己的 APK 没编过**；`antd-demo` 的 `libgen:check` 与 24 项宿主判据**不在离线门里**
>   （要装 antd，靠人手动跑 `cd examples/apps/antd-demo/host && npm run check`）。
>
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
