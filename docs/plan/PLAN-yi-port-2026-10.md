# 生效中的工作计划：把 `interest/yi` 移植到 moobile（web / 桌面端 / app）

> **这份是当前的工作计划**（2026-10）。它取代 [`PLAN-2026Q3-yi-port.md`](PLAN-2026Q3-yi-port.md)
> 里 P1–P5 那套估算 —— 那一份已归档，其任务编号**只在那份文件内有效**。
>
> 计划总纲与轨道划分仍在根上的 [`PLAN.md`](../../PLAN.md)；**分数与现状只在
> [`../STATUS.md`](../STATUS.md)**（唯一来源）。本文只写：**拍板了什么、按什么顺序做、每步的判据是哪条命令**。
>
> 写法遵循本仓库的规矩：**先测再断言**，每个数字都要能回答"哪条命令、什么时候、是不是本轮跑的"。

---

## 0. 一句话

`interest/yi`（《御纂周易折中》阅读器，rabbita + 1924 行视图 + 1.7 MB 数据 + 一张 canvas 罗盘）
要在 moobile 上跑起来，**一套 MoonBit 代码同时出 web / Windows 桌面 / Android**；
脚手架现有移植能力不够，**先把两条命令补齐再搬**。

---

## 1. 决策（2026-10，用户拍板）

| # | 决策 | 备选与代价 | 影响的文档 |
|---|---|---|---|
| D-1 | **移植做，且做全** —— 即 `PLAN.md` §6 的选项 (a)（列表页 + 卦详情 + 罗盘全部搬） | (b) 跳过罗盘：理由已少一半（**画布通道早已落地并真机验过**）；(c) 暂停：那"没有任何真实应用移植"这条最大空白继续挂着 | `PLAN.md` §6、§7-3 |
| D-2 | **桌面端 = 原生 RN Windows**（`react-native-windows`），不是 Tauri/Electron 外壳 | 外壳（WebView）复用 web 产物、最轻，但"原生"这条更彻底；代价是**第二套宿主** + 一套 VS 工具链 | 本文 §3、§5 |
| D-3 | **RN 版本统一到 0.83.x**：web/app 用 Expo SDK 55（钉 RN **0.83.10**），桌面用裸 RN 0.83.10 + RNW **0.83.2** | 见 §2 的版本矩阵 —— 这是唯一"三端同一个 RN 大版本、且两边都是 stable"的落点 | 本文 §2 |
| D-4 | **先补齐脚手架两条命令**（E9 迁移装配器 + F2 样式转换），**再开始搬 yi** | 反过来会把迁移经验留在应用里，脚手架不涨能力 | `docs/design/SCAFFOLD.md` §3.7 / §8-D8 的档位 ② |
| D-5 | **三端宿主的骨架先并行搭起来**，再逐块填内容 | 骨架先行的价值：把"宿主可替换"从论断变成三次实测 | 本文 §4 |
| D-6 | **VS 工具链暂不安装**：桌面端本轮只交「工程骨架 + 可行性报告」 | 缺的是 VS 工作负载与 Windows SDK 22621（见 §3），装齐要管理员 + 数 GB；先不阻塞 web/app | 本文 §3 |

**本文与 `PLAN.md` §6/§7 的关系**：`PLAN.md` 那两处仍是"决策点"的登记处；
本文件是决策落地后的执行稿。**两处冲突时以本文为准，并回头改 `PLAN.md`。**

---

## 2. RN 版本矩阵（D-3 的依据）

**RN 版本由宿主决定，库不绑版本** —— 这条是本仓库已有的实测结论（`PLAN.md` §1.2）。
落到具体是哪一份文件在钉：

| 谁 | 钉在哪 | 事实 |
|---|---|---|
| 桌面端 | `react-native-windows` 的 peer | `rnw@0.84.0` → **`react-native: "0.84.1"`（精确钉到补丁号）**；`rnw@0.83.2` → `^0.83.0`（宽松） |
| web / app | Expo SDK | 官方每个 SDK 钉一个 RN（见下表） |
| moobile 库 | **不钉** | 产物是 ESM，只认 `mountApp` 契约；`examples/apps/template/moon.pkg` 里没有一处 RN 字样 |

**Expo SDK ↔ RN ↔ 能配的 RNW**（2026-10 用 `npm view` 实测：`npm view expo-template-blank@sdk-<n> dependencies.react-native`）：

| Expo SDK | 钉的 RN | 能配的 RNW | 结论 |
|---|---|---|---|
| 54 | 0.81.5 | 0.81.36 | 可用，但离现状更远 |
| **55** | **0.83.10** | **0.83.2**（peer `^0.83.0`） | ★ **选定**：两边都 stable |
| 56 | 0.85.3 | 0.85.0-**preview**.1 | 桌面吃 preview，不好归因 |
| 57（仓库现状） | 0.86.3 | **不存在** | 与 RNW 无交集 |

**为什么不是"把 RN 降到 0.84 就一致了"**：RNW 最新 stable 是 `0.84.0`，它精确钉 `react-native@0.84.1`，
而 **Expo 从 0.83.10 直接跳到 0.85.3 —— 0.84 是个空隙**。所以不一致的真因不是"选错了 Expo"，
而是 **RNW 与 Expo 的版本节奏本来就错开半格**；能对齐的落点是 0.83.x。

> ⚠️ **这条决策的验证状态**：库里现有的门（`verify_all.sh` 的那几条）全部跑在
> **RN 0.86.3 / Expo 57** 上。RN 0.83 这条链**要让门自己证明**，见 §4 的 V-1。
> **在 V-1 通过之前，"统一到 0.83"只是一个待验的假设，不是事实。**

---

## 3. 桌面端的硬前提（D-6 的依据）

RNW 在 Windows 上开发要 VS 2022 + 一堆工作负载与 Windows SDK。**这台机器现在缺**：

| 要求 | 现状 | 怎么查的 |
|---|---|---|
| **VS 2026（≥ 18.6.1）** —— ⚠️ **不是文档写的 VS 2022** | ❌ 缺（本机是 VS **2022** BuildTools 17.14） | RNW 0.83.2 **包内自带**的 `rnw-dependencies.ps1`：`$vsver = "18.6.1"`；CLI `msbuildtools.js:160` 默认 `'18.6.0'`。实测报错 `NoMSBuild: Could not find MSBuild with VCTools for Visual Studio 18.6.0 or later` |
| VS 的 `Desktop development with C++` / `.NET Desktop` / `UWP + C++ (v143) UWP tools` | ❌ 全缺（只装了 **BuildTools**） | `vswhere -products '*' -requires Microsoft.VisualStudio.Workload.NativeDesktop -property installationPath` → 空（另两项同样） |
| `.NET Desktop development` | ❌ 缺 | 同上换 `...Workload.ManagedDesktop` → 空 |
| `Universal Windows Platform development` + `C++ (v143) UWP tools` | ❌ 缺 | 同上换 `...ComponentGroup.UWP.VC` → 空 |
| MSVC v143 编译器 | ✅ 在（`14.44.35207`，MSBuild.exe 也在） | `ls "<BuildTools>/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe"` |
| Windows SDK **10.0.22621.0** | ❌ 只有 `10.0.19041.0` | `ls "/c/Program Files (x86)/Windows Kits/10/Include/"` |
| 磁盘 | C: 23G / D: 16G / **E: 806G** 可用 | `df -h` |

⇒ **桌面端本轮的交货定义**：工程骨架（文件齐、依赖 pin 死、JS 侧接线正确）+ 一份把上面这张表
逐项复核过的可行性报告（`docs/design/DESKTOP-RNW.md`，由探针轮产出）。
**"能构建"不在本轮承诺里** —— 除非工具链补齐。

---

## 4. 阶段与判据

| 阶段 | 内容 | 判据（命令） | 状态 |
|---|---|---|---|
| **S0** | 决策与判据固化成文（本文 + `PLAN.md` §6/§7 回填） | 本文存在且每条决策都指得出证据命令 | ✅ 2026-10 |
| **S1** | **E9 迁移装配器**：`moobile-host create --from-rabbita <src> <dir>` → 报告 + 项目 + TODO | SCAFFOLD §3.7.6 的 **S9-1…S9-5** | ✅ **2026-10-02 落地**：S9-1 对 yi 真跑（`examples/apps/zhouyi-reader/`）；S9-2 报告 21 项 TODO 零遗漏（`MIGRATION.md`）；**S9-3 生成物 `moon check` 0 错误**；S9-4 真 Chrome **19/19**；S9-5 每项都指了下一步 |
| **S1b** | **F1 扫描器的 JS 实现 + 与 MoonBit 版逐项对账** | `node tools/migrate_scan_reconcile.mjs` 两侧逐项一致 + 证伪能红 | ✅ **已落地并进 `verify_all.sh`**：18 类 / 357 条命中**逐 finding 逐 hit**一致；门本身验过证伪（改一个 needle / 删一条规则都能红） |
| **S2** | **F2 样式转换**：`<style>`/`.css` → `styles.mbt`（`@style.Style` 调用），逐条标出**有损** | 生成的 `styles.mbt` 在本仓 `moon check` 通过；**对账**闭合 | ✅ **已落地**：104 个样式函数；**声明 510 = 已映射 435 + 有损 75**（不闭合就抛）；生成物 `moon check` 0 错误 |
| **S3** | **三端骨架**：web / app（Expo 55 + RN 0.83.10）＋ desktop（裸 RN 0.83.10 + RNW 0.83.2） | **V-1**：同一份 `moobile.js` 在三个宿主上都把界面渲染出来 | ✅ **web**（真 Chrome 24/24）· ✅ **app**（真机 18/18，含 Skia 的 APK 自建自装）· 🟡 **desktop**：宿主**已落进仓库**（`examples/apps/zhouyi-reader-desktop/`），`node verify.mjs` **5/5**（`--platform windows` 打包退出码 0、产物 8.80 MB、里面有本应用真串与宿主接线）+ 画布后端 `canvas-svg.js` 已验；**只剩原生窗口**未跑（缺 VS 2026 + SDK 22621，见 §3） |
| **S4** | 数据接入（`reader_data.json` 1.7 MB 怎么进 app） | 真数据正确显示；代价记录在案 | ✅ **已落地**：**编译期嵌进产物**（`data_reader.mbt`）。量过：源 1.79 MB / `moon build` 4.6 s / JS 产物 1358 KB → **3104 KB**。⚠️ 相对 URL 那条路**在库里本来就不通**（`moonbitlang/async` 只认完整 URL） |
| **S5** | 卦列表页 | web 上可搜索、可点进详情（断言脚本） | ✅ **已通过**：搜索「乾」→ 过滤网格渲染出卦卡（`verify.mjs`） |
| **S6** | 卦详情页（六爻 / 注疏 / 折叠 / 关联 / 变卦） | 同上，含折叠交互断言 | ✅ **已做**（10-02）：`<details>/<summary>` 迁不动（标签表排除）→ 三块折叠改成**受控**（`open_more` 进 Model + `ToggleMore(i)`）；web **21 条**折叠断言（含"再点一次收起"）、真机 **9 条**（判据是"边滚边收长文本集合再做差集"：展开多 14 条、收起多 0 条）。**已证伪**：把 `if open` 改成 `if true` → 39/45，红的正好那 6 条 |
| **S7** | 罗盘（`@canvas` + `@gesture`） | web 拖拽连续跟手 + 真机断言；⚠️ **桌面端要改用 `react-native-svg`**（Skia 无 Windows 后端，已查实） | ✅ **web 已通过**（真 Chrome：画布画出 518400 个非透明像素 / 拖拽后画面变化 / 轻点外环进卦）；顺带**补了库的缺口**：Web 上画布原本没有后端，新增 `npm/moobile-host/canvas-web.js`（零依赖，18 条 op → DOM 2D 重放）。✅ **三端都通**：web（DOM 2D）真 Chrome 判据、**原生（Skia）真机判据**、**桌面（`react-native-svg`）在同一份 web 判据下验过**（`EXPO_PUBLIC_CANVAS=svg`）；`more_view` 的折叠见 S6 |
| **S8** | 三端验收 | web 断言 / app 模拟器 `uiautomator` / 桌面截图（依赖 D-6 的工具链） | 🟡 **web ✅ 45/45 · app ✅ 27/27 · 桌面 ✅「同一份产物进 RNW 宿主」（5/5，不必等 VS 工具链）**；⏳ 剩下的只有**桌面窗口本身**（等 VS 2026 + SDK 22621）。★ 本轮的 app 判据还逮到**两个 web 判据永远看不见的洞**（根上没滚动容器 → 真机滚不动；`page()` 没人挂），判据已写进库（`lib/migrate/app-audit.js` + `tools/migrate_app_audit.mjs`，离线 13 项）。★ 10-02 又加了**第三个宿主**（`--host webview`：零 Expo / 零 Metro 的静态站点）：`examples/apps/zhouyi-reader-webview/verify.mjs` **15/15** —— 其中把**这同一套 45 条界面判据**原样指向静态宿主的 URL 也全过 ⇒ 「同一份产物 + 同一套判据，换宿主管用」 |

**V-1（S3 的硬判据，先于一切内容移植）**：库在 **RN 0.83.10** 上能跑。
做法：起一个最小应用，宿主钉 Expo SDK 55，跑 `npm run web` 并断言渲染成功。
**它红了就说明 D-3 选错了落点** —— 那要回到 §2 换档，而不是继续往下搬。

---

## 5. 已知风险（登记处，别当已解决）

| # | 风险 | 现状 | 什么时候处理 |
|---|---|---|---|
| R-1 | ~~Skia 在 RNW 上有没有支持~~ **已查实：不支持**（`npm pack` 后 `package/windows/` 0 个文件；维护者原话"需要专门的 Windows 后端"）⇒ 桌面上的罗盘改用 **`react-native-svg`**（它的 tarball 里有 153 个 windows 文件，含 Fabric 实现） | ✅ 结论已定 | S7 时落地 |
| R-2 | **vs 工具链缺失** → 桌面"能构建"无法验证 | 已确认为缺（§3） | 用户决定何时装 |
| R-3 | 1924 行视图里有 **122 处 `class=`、166 处 CSS 变量、16 处 `:hover`、7 处 `details/summary`、11 处 canvas API、4 处 mouse 事件** | F1 报告实测（`bash tools/mb.sh migrate-scan --root ../yi/zhouyi_reader`） | S1/S2/S5/S6/S7 |
| R-4 | 数据 1.7 MB：运行时解析 vs 编译期字面量 | 未测 | S4 |
| R-5 | 仓库里 **7 份宿主副本**（`file:` 依赖）—— 新增应用会让它变 8 份 | ✅ 已变成 **10 份**并已同步（`bash tools/refresh_host_copies.sh` → `check_npm_fresh` 全绿） | 已办 |
| R-6 | **RNW 0.83.2 要的是 VS 2026（≥18.6.1）**，官方文档页写的是 VS 2022 —— 照文档准备会白做 | 已实测（包内 `rnw-dependencies.ps1` 的 `$vsver`；CLI `msbuildtools.js:160`） | 用户决定何时装 |
| R-7 | **`on_click` 挂在 `div`/`span`/`p` 上 = 静默点不动**（`onPress` 只存在于 `Pressable`）—— F1 的按行规则抓不到 | ✅ 已在 `create` 里做成 `detectClickOnView()`，对 yi 检出 **5 处**；本应用已手改 `div`→`button` | 建议把这条也补进 F1 的两份实现 |

---

## 6. 移植产物放哪（已定）

`examples/apps/zhouyi-reader/`（moobile 仓库内，进 `moon.work`）。
理由：① 它是"真实应用验证"，进仓库才能进那几道门；② 它要吃**本地库源码**（`moon.work`），
发布形态验不到未发布的 API；③ 与 `chat-app`（另一个真实应用样本）同构。
**源项目 `interest/yi` 不动** —— 它是迁移的输入，不是被改的对象。

---

## 7. 别做（负面清单）

- **不重写业务逻辑**：`update` / `view` 的结构、数据模型、文案一个字都不猜着改（SCAFFOLD §3.7.4）。
- **不"顺手删掉"迁移不过去的代码**：留 `TODO(migrate)` 注释并点名，决定权留在人手上。
- **不承诺"迁移后效果一致"**：RN 的排版与浏览器不同（R1 行内流那条），效果要重新验。
- **不为了让门变绿而放宽断言**（本仓库的禁区）。
- **不在没跑验证的情况下说"已完成"**。
