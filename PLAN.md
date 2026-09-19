# PLAN.md —— moobile 计划

> 这份是**当前生效**的计划。上一版（以"移植 yi 阅读器"为终点的 P0–P7）归档在
> [`docs/PLAN-2026Q3-yi-port.md`](docs/PLAN-2026Q3-yi-port.md)，其中 P0（清理固化）与
> P7（发布为库）已完成，P1–P5 的去留见 §6。**旧任务编号只在那份文件里有效。**
>
> 现状（2026-09）：
> - 已发布 **`XiLaiTL/moobile@0.1.0`**（mooncakes `200 OK`，registry `build_status: success`）
> - 外部模块可用性已验证：`moon check` / `moon build` 通过，产物含 `export { … as start }`
> - 离线检查：Web 端到端 26/26、真机（Android 14 模拟器）验证过、R1 文本排版判决通过
> - **尚未做过任何真实应用的完整移植**（这是当前最大的空白）

---

## 1. 定位与远景

**定位**：MoonBit 生态里的**跨端 UI 层** —— 用 MoonBit 写一次界面，同时产出 Web / Android / iOS。
渲染不自己实现（交给 React Native / react-native-web）；我们提供 TEA 模型、类型化样式，
以及 VNode → React 元素的翻译层。

**本文档要规划的两个远景能力**：

1. **多端脚手架**：`moobile create <name>`，交互选择目标平台与变体，直接得到一个能跑的项目。
2. **迁移工具链**：把已有的 rabbita 项目迁到 moobile —— 至少要有"迁移动检报告"，
   最好是样式层的半自动改造。

### 1.1 事实核查（决定这两条能做到什么程度）

| 问题 | 实测事实 | 结论 |
|---|---|---|
| moon 有官方模板机制吗 | `moon new <PATH> [--user] [--name]` 只生成内置脚手架，**没有 `--template` 一类开关** | 模板机制要我们自己实现 |
| `moobile create` 怎么分发 | `moon install <SOURCE>` 支持 **registry 包路径**（`user/module/pkg[@version]`）、git URL、本地路径 | 发布一个 CLI 模块（例如 `XiLaiTL/moobile-cli`），用户 `moon install` 后得到全局 `moobile` 命令 |
| 有没有"被添加时执行"的钩子 | `moon.mod` 支持 `options(scripts: { "postadd": "…" })`，`moon add` 后自动运行 | 可用于"添加依赖时打印上手 / 迁移清单" |
| 多端现实 | Android ✓（真机验证过）；Web ✓（react-native-web）；iOS 只能出工程（Windows 上无法构建验证）。桌面/新平台的关键事实：**RN 版本由宿主决定，库不绑版本**（证据见 §1.2）。因此：① **WebView 壳**（PWA / Tauri / Electron）复用已跑通的 Web 产物，本机工具链齐备（实测 Node 24 / Rust 1.97.1 / WebView2 153），可做可验证；② **原生桌面**（react-native-windows / react-native-macos）**可行，代价是多一套宿主** —— RNW 最新 0.84.0 的 peer 写死 `react-native@0.84.1`，与 Expo 57 的 RN 0.86.3 不兼容，所以要另建一个**不带 Expo 的裸 RN 宿主**（pin 它要求的版本），共用同一份 MoonBit 产物；macOS 仍需 Mac 或 CI 才能构建 |
| 迁移的硬约束 | `internal` 可见性按模块判 → 使用者必须整模块替换；`style/` 是公开包；`class=` 与 `style="…"` 在 RN 上**静默失效** | 迁移工具的核心价值是**把静默失效变成可见的报告**，而不是追求全自动改写 |

### 1.2 架构事实：宿主是可替换件（"多端"的真正机制）

我们验证过：**库与具体 RN 版本无关，也与 Expo 无关**。

| 检查 | 实测结果 |
|---|---|
| 库侧向宿主索要什么 | 只有 `MOBILE_HOST.react.{createElement, Fragment, cloneElement}`、`components` 表（5 个组件名）、以及 `scheduleTask` / `scheduleFrame` 两个调度钩子 —— **没有任何 RN 版本相关的 API** |
| 库发出的 RN 专有 props | 只有 `onPress` / `onLongPress` / `onChangeText` / `onFocus` / `onBlur` 与 `style` 对象；这些在 RN 各版本间长期稳定 |
| Expo 出现在哪里 | **只在宿主工程**：`host/index.js` 一行 `registerRootComponent`（换成裸 RN 就是 `AppRegistry.registerComponent`）；`host/app.json` 与 prebuild 流程 |
| 我们自己的工具链 | `build.sh` / `_verify.js` / `_r1.js` **完全不引用 Expo**，只产出并喂 JS 产物 |

**推论（这是本计划后面几条轨道的依据）**：

1. 支持一个新平台，通常等于**写一个新宿主**（约 30 行 + 构建配置），而不是改库；
2. 桌面端的"版本冲突"是**宿主之间的冲突**（Expo 宿主 vs RNW 宿主），各宿主可以各自 pin 自己的 RN 版本，
   共享同一个 MoonBit 产物；
3. 因此脚手架真正的可配置维度是**宿主**，不是"平台"：`host-expo`（android/ios/web）、
   `host-webview`（桌面壳）、`host-rn-desktop`（原生桌面，后续）。

---

---

## 2. 轨道划分

| 轨道 | 内容 | 何时 |
|---|---|---|
| **A 仓库与文档治理** | 目录结构、文档分层与风格、贡献/发布流程、CI | 近期 |
| **B 对外叙事** | mooncakes description/keywords、README 首屏、版本与 CHANGELOG 策略 | 近期 |
| **C 库可用性与回归** | demo 改用远端包、离线检查入口、CI、安卓断言脚本 | 近期 |
| **D 性能** | 建立基线 → 定位热点 → 优化 → 回归 | 中期 |
| **E 脚手架** | `moobile create`（多端 + 模板 + 交互选择） | 远景（依赖 A/B/C） |
| **F 迁移工具链** | 迁移动检报告 + 样式层半自动改造 + 指南 | 远景（F1 可提前） |
| **G（待定）真实应用移植** | 原 P1–P5：把 yi 搬上来，作为"真实应用验证" | 待决策，见 §6 |

轨道之间的依赖：**B 依赖 A**（文档没理顺之前，对外叙事会继续漂）；
**E 依赖 C**（脚手架生成的项目必须是我们自己验证过的那条链路）；
**F 依赖 A + style 层 API 冻结**（迁移工具一旦生成代码，改 API 就是双倍成本）。

---

## 3. 近期：轨道 A / B / C

### 3.1（C）demo 改用远端包

- **现状**：`demo/` 与库在**同一个模块**里，用的是源码；`host/` 通过 `host/moobile.js` 吃构建产物。
  也就是说，我们从没以"用户"的身份用过自己发布的包。
- **目标**：把 `demo/` 拆成独立模块，通过 `moon add XiLaiTL/moobile@0.1.0` 依赖发布版。
- **判据**：demo 独立模块 `moon check` / `moon build` 通过；Web 端到端仍 26/26（`_verify.js` 指向新宿主）；
  真机上能跑起来。
- **收益**：这条链路建立后，**每次发版都能自动验证"用户视角"**。现在 `check_external.sh` 只保证能编译，
  不保证能跑。

### 3.2（A）仓库治理

**问题清单（具体到条目，便于逐条消掉）**

| # | 问题 | 说明 |
|---|---|---|
| A-a | 目录混杂 | 库根同时存在：库本体（`*.mbt`）、第三方 fork（16 个目录，生成物）、应用（`demo/`、`host/`）、脚本（`_tools/`）、证据（`_r1/`）。第三方铺在根是**技术必需**（`internal` 可见性），但应用与证据不必留在库仓 |
| A-b | 文档职责重叠 | README 与 `docs/ARCHITECTURE.md` 都讲架构；`docs/FINDINGS.md` 与 `docs/EVIDENCE.md` 都是实测记录；PLAN 与 ARCHITECTURE 的 §7 都列任务 |
| A-c | 文档风格 | 过度口语化、大量 emoji 与加粗、结论先行但没有证据链，读起来像聊天记录而不是工程文档 |
| A-d | 缺工程化基础设施 | 没有 CONTRIBUTING、CHANGELOG、issue/PR 模板、CI 配置、代码风格说明 |

**参考项目（待选，见 §7-2）**

| 参考 | 借什么 |
|---|---|
| **Dioxus**（Rust 跨端 UI） | 仓库布局（`packages/` `examples/` `docs/`）、ROADMAP 写法、`dx create` 脚手架 UX —— 与本项目形态最接近 |
| **Tauri** | 多端脚手架的交互设计（`create-tauri-app`） |
| **ratatui / egui** | CONTRIBUTING / CHANGELOG / issue 模板的克制写法 |
| 生态内 **rabbita / moonbitlang/x** | MoonBit 模块的目录与 README 惯例（不能脱离生态自创一套） |

**任务**（草案，待参考项目选定后细化）

- A1 目录重排：`demo/` + `host/` 是否拆出库仓（与 §7-7 决策绑定）；`_tools/` 是否改名 `tools/`；
  `_r1/` 是否移入 `docs/evidence/`
- A2 文档分层：明确"给使用者 / 给贡献者 / 给维护者"三类，消掉重叠内容
- A3 风格规则：写成 `CONTRIBUTING.md`（含"哪些话不要写"的负面清单）
- A4 CHANGELOG 与版本策略
- A5 CI（GitHub Actions）：`moon check` + 离线检查三连
- **判据**：新读者按 README → CONTRIBUTING 能独立跑起来并提交第一个 PR；文档之间不再互相矛盾

### 3.3（B）对外叙事

**现状（registry API 实测）**：

```
description: "moobile：MoonBit 写 UI，React / React Native 渲染（内含 rabbita vendor fork）"
keywords:    ["moonbit", "moobile", "react-native", "rabbita"]
```

**问题**：① 把实现细节（vendor fork）当卖点；② 通篇没提**移动端**——而这是我们唯一的差异点；
③ 中英混杂，英文读者读不懂；④ keywords 缺 `mobile` / `android` / `ios` / `cross-platform` / `ui`。

**任务**

- B1 description 重写（中英两版候选，见下），要点：**这是什么 → 给谁用 → 一句怎么开始**
- B2 keywords 扩充
- B3 README 首屏（前 10 行）三秒说清定位；决定是否需要英文版 README
- B4 版本与 CHANGELOG 策略（0.1.x 修 bug / 0.2 起才动 API）
- **判据**：在 registry 搜索 `mobile` / `android` 能命中；首屏读完能回答"这是什么、给谁用、怎么开始"

description 候选（待定稿）：

```
中文：用 MoonBit 写一次 UI，跑在 Android / iOS / Web —— MoonBit 的跨端 UI 框架。
      模型与视图沿用 TEA，渲染交给 React Native，类型化样式免写 CSS。
英文：Write UI once in MoonBit, run it on Android, iOS and the Web.
      A cross-platform UI framework for MoonBit: TEA model and views, rendering by React Native,
      typed styles instead of CSS.
```

### 3.4（C）回归与验证补齐

- **C0 宿主可替换性验证（约半天）**：把 `host/index.js` 的 Expo 依赖换成裸 RN 的 `AppRegistry`，或在最小裸 RN 工程里跑一次 —— 目的是把 §1.2 的论断**变成实测事实**。这条一旦成立，桌面原生、多宿主脚手架、以及"换 RN 版本"都不再是未知量
- **C1** 把 R1 的测量固化成安卓端断言脚本（原 T0.2）：`_tools/verify_android.py`，
  解析 `uiautomator dump`，对判决表逐项断言，输出 `通过 N / N`
- **C2** 离线检查入口 `_tools/verify_all.sh`：`moon check` + `check_external.sh` +
  `vendor_sync.sh --check` + `lf_normalize.sh --check`
- **C3** CI：把 C2 接到 GitHub Actions（Windows runner；Android 断言暂不进 CI）
- **判据**：一条命令跑完全部离线检查；CI 在 PR 上必须绿

### 3.5（A）依赖与 API 面治理

**已做的审计**（方法：对每个 `moon.pkg` 反查依赖使用者，不看印象）：

| 依赖 | 谁在用 | 结论 |
|---|---|---|
| `moonbitlang/async@0.21.0` | `cmd/` `http/` `internal/rabbita/` `internal/runtime/` | **保留**（真需要） |
| `hackwaly/moonback` | **只有 `server/moon.pkg`** | 已裁 |
| `moonbitlang/x` | **也只有 `server/moon.pkg`** | 已裁 |
| `server/`（rabbita 的 SSR/HTTP） | **没有任何包依赖它**（叶子），且从未被编译过（声明 native+wasm，我们只跑 js） | 已裁 |

**结果**：发布依赖 **3 → 1**；发布包少两个文件（235 → 233）。验证：`moon check` 0 错误、
`_verify.js` 26/26、`check_external.sh` 通过、`vendor_sync.sh --check` 一致。
⚠️ **这条改动只在仓库里生效** —— mooncakes 上的 0.1.0 仍是旧的，要发 0.1.1 才带上。

**策略（写下来，避免下次凭感觉加依赖）**：
`moon.mod` 的 `import` 是**模块粒度**，没法按包细分；所以引入任何依赖前先问两句：
① 是不是只有某个包用得到？② 那个包能不能一起裁掉？（`server/` 这次就是这条规则的第一个例子）
三个直接依赖里剩下的 `async` 是硬需求，不在此列。

**顺带发现的 API 面缺口（重要，需要决策）**：
「形态 B」把 rabbita 的主包挪进了 `internal/rabbita/`，于是外部使用者**已经拿不到增量模型**
（`Val` / `create_state` / `elmish`）。实测报错：

```
Cannot import internal package XiLaiTL/moobile/internal/rabbita@0.1.0
in probe/api@0.1.0 due to internal visibility rules
```

影响：从 rabbita 迁过来的应用若用了局部组件状态（`Val` / `create_state`），**只能退化成手写 TEA**。
两条修法：

| 方案 | 做法 | 代价 |
|---|---|---|
| (i) 把该包放回**公开路径** | `internal/rabbita/` → `rabbita/`（或 `model/`），使用者显式 `import { "XiLaiTL/moobile/rabbita" @rabbita }` | 布局与 patch 要改；公开面多一个包名 |
| (ii) 从模块根包**再导出** | 在库本体里 `pub using @rabbita_root {type Val, create_state, …}`，于是 `@moobile.Val` 可用 | 要手工枚举符号；将来 API 变化容易漂 |

**倾向 (ii)**：对使用者更友好（一个 import 拿全），代价只是枚举；且它同时解决了"rabbita 迁移时状态模型怎么写"的问题。
**这条要在 E/F 轨道之前定**（脚手架与迁移工具都会依赖这个 API 面）。

**同批该处理的另外两条（都属"对外诚实性"）**：

- **`supported_targets` 的声明是假的**：14 个包声称 `js+native+wasm`、14 个声称 `+native`，
  但 `moon check --target native` 实测失败（`html/attrs_event.mbt` 等处报 unbound）。
  要么把这些声明收敛成 `+js`（native 使用者会**快速失败并拿到清楚理由**），
  要么把 `html/` 的 native 构建修回来（那是 fork 的又一笔改动）。
- **公开签名里的 internal 类型**：`render_node(v : @vdom.VNode, …)` 这类函数对外**等于不可调用**
  （能编译，但碰它的参数类型就报错）。与决策点 7 的 API 面工作同批处理。


---

## 4. 中期：轨道 D（性能）

### 4.1 先建基线（没有基线就没有优化）

- **D1** 基准负载：长列表（100 / 1000 / 5000 项）+ 高频更新（输入回显、连续滚动），Web 与 Android 各一套
- **D2** 指标与工具：首屏时间、每帧 JS 时间、内存峰值、掉帧率；
  Web 用 Chrome Performance，Android 用 Android Studio Profiler + `adb shell dumpsys gfxinfo`
- **判据**：产出 `docs/PERF.md`，含硬件、版本、复现命令与基线数字

### 4.2 已定位的嫌疑点（读代码得到，**待测量确认**）

| # | 位置 | 问题 | 预期影响 |
|---|---|---|---|
| 1 | `render.mbt` `map_tag()` | 每次调用都**新建 42 条数组**（`tag_table()` 返回字面量数组）再做线性扫描 | 每个元素每帧一次分配 + O(42) 比较；应改成预建 Map 或缓存 |
| 2 | `render.mbt` `styles_to_js()` | 没有样式时也新建对象并挂 `style={}` | 无谓分配，且让 React 无法跳过该 prop |
| 3 | `host.mbt` `js_as_handler()` | 每个 handler 每帧新建一个 JS 闭包 | 引用恒变 → 任何记忆化失效，分配压力 |
| 4 | `render.mbt` `Children::Map` | 每个带 key 的子节点每帧 `React.cloneElement` | 额外分配与 diff 成本 |
| 5 | `render.mbt` `VNode::Thunk` | 每帧强制求值 | 重复计算（上游 0.16 的 HTML memoization 正是治这个） |

### 4.3 优化任务（按性价比排序）

- **D3** 标签表：`map_tag` 改成 Map 查表（或首次调用后缓存）
- **D4** 空样式短路（`props.styles_map()` 为空时不挂 `style`）
- **D5** handler 复用策略：评估"元素层记忆化"与"闭包池"两条路，先测量再选
- **D6** 评估升级到上游 0.16.0 拿 memoization —— 与 `FORK.md` §4 的升级演练是同一件事，合并做
- **判据**：基线报告里的关键指标至少有一项显著改善（例如长列表滚动帧率），且 26/26 不回归

---

## 5. 远景：轨道 E（脚手架）与 F（迁移）

### 5.1（E）`moobile create`

- **E1 技术选型**（决策点，见 §7-5）
  - 方案一：**MoonBit CLI** —— `moon install XiLaiTL/moobile-cli` 分发，与生态一致，
    但交互式 CLI 与模板管理要自己写
  - 方案二：**Node 包**（`create-moobile-app` 约定）—— 交互（prompts）与模板生态成熟，
    但引入"用 JS 工具生成 MoonBit 项目"的割裂
- **E2 模板矩阵**：**以宿主为单位**（不是按"平台"切，理由见 §1.2），变体先只做**最小**：
  - `host-expo`：一份宿主吃 web / android / ios（iOS 只生成不验证）
  - `host-webview`：复用 web 产物套壳（**Tauri 优先**，二进制小、走系统 WebView2；PWA 作为零依赖兜底，`expo export --platform web` + manifest 即可"安装为应用"）
  - `host-rn-desktop`（RN Windows/macOS）：**第一版不提供**，但要写清"为什么现在不做、以后怎么做"——另建一个不带 Expo 的裸 RN 宿主 pin 到 RNW 要求的版本即可（见 §1.2）
- **E3 交互**：`moobile create my-app` → 勾平台 → 生成 + 打印后续命令
- **E4 生成物**：Expo 宿主 + `moon.mod` / `moon.work` + 首屏示例 + README + `.gitignore`
- **E5 诚实标注**：iOS 标注"只生成、未在本机验证"；桌面原生要说明"需要第二个宿主（不带 Expo、pin RNW 要求的 RN 版本），当前未提供"
- **E6（前置验证，约半天）**：先用 Tauri 或 PWA 把现有 web 产物包起来跑通一次，证明"桌面壳"这条路成立，再决定要不要进模板 —— **本机可验证**，所以风险低
- **E7 跨平台产物**：桌面/移动的原生产物**不能交叉编译**（Windows 上只能出 Windows 桌面与 Android APK；macOS、Linux 桌面与 iOS 要在各自系统上构建）。可行的做法是脚手架直接生成 **GitHub Actions 构建矩阵**（windows / macos / ubuntu 三个 runner），这样"我们没 Mac 也能验证 iOS 与 macOS 产物能不能构建"
- **判据**：干净机器上 `moon install … && moobile create demo-app` → 选 Android → 能在 Expo Go 里跑起来

### 5.2（F）迁移工具链

| 任务 | 内容 | 价值/成本 |
|---|---|---|
| **F1 迁移动检报告** | 扫描一个 rabbita 项目，列出所有**会静默失效**的东西：`class=`/`style="…"` 数量、标签表外的标签、`@dom` 直连、读坐标的事件、`:hover` / `@media` 用法 | **价值最高、成本最低**——先做这个 |
| F2 样式层半自动改造 | 解析项目 CSS → 生成 `styles/` 模块（`Style` 调用）；把 `class="card"` 映射成 `styles.card()` | 成本中高，需要 CSS 子集解析器 |
| F3 迁移指南 | 逐条对照表 + 手工步骤（含 `details`/`summary`、`canvas`、表格等结构性差异） | 成本低，必须做 |
| F4 与 `postadd` 结合 | `moon add` 之后自动打印体检清单入口 | 成本低 |
| **判据** | 拿一个真实 rabbita 项目跑 F1，**静默失效项零遗漏**（与手工清点对照） |

---

## 6. 归档：原 P1–P5（yi 移植）的去留

原计划以"`interest/yi` 在真机上跑通"为终点。其中最有价值的部分是**它提供了一个真实应用的验证场景**；
最贵的部分是罗盘（`canvas` → Skia + 手势，原 P3，3–5 天，且与库本身的能力关系最弱）。

| 选项 | 说明 | 代价 |
|---|---|---|
| (a) 全做 | 按原 P1–P5 走完，yi 在真机可读 | 2–3 周；期间库的 API 会被真实需求推着改（好），但节奏被应用牵着走 |
| (b) 小步 | 只做 P1（整卦静态页）+ P4（真实数据接入），跳过罗盘 | 3–5 天；能验证"复杂中文排版 + 长列表 + 真实数据"，不碰 Skia |
| (c) 暂停 | 改用更小的真实应用（或等脚手架出来后再回头） | 省时间，但失去唯一的真实压力测试 |

**倾向 (b)**：罗盘那部分（Skia + 手势通道）是独立课题，可以等脚手架与迁移工具成型后再做，
届时它还是"高级能力示例"的素材。

---

## 7. 决策点（需要拍板）

1. **文档语言**：对外（README / mooncakes / CONTRIBUTING）用英文还是双语？内部（PLAN / DEV / FORK）保持中文？
   —— 影响 B 与 A3 的全部工作。
2. **参考项目**：Dioxus / Tauri / ratatui / 生态内 rabbita，选哪几个当模板？
3. **yi 移植去留**：§6 的 (a) / (b) / (c)。
4. **桌面端支持到哪一档**：① WebView 壳（Tauri / PWA，本机可验证，推荐先做）；② 原生 RN Windows/macOS（**可行但要维护第二个宿主**：裸 RN + RNW，各自 pin 版本，共用同一份产物）；③ 暂不支持。
5. **脚手架技术选型**：MoonBit CLI（`moon install` 分发）还是 Node（`create-*` 约定）。
6. **性能目标**：给出量化标准（例如"长列表滚动 ≥ 55 fps、首屏 < 1.5 s（中端安卓）"）。
7. **API 面**：`Val` / `create_state` 这类增量模型 API 要不要对使用者开放？方案 (i) 公开包 vs (ii) 根包再导出（见 §3.5）。
8. **`demo/` 与 `host/` 是否拆出库仓**：拆出更干净（也顺带满足 §3.1 的"以用户视角验证"），
   但要维护第二个仓库。

---

## 8. 建议顺序与里程碑

```
P8 近期   C0 宿主可替换性验证（半天）→ C1 安卓断言 → A 治理 + B 叙事（并行）→ C2 检查入口 → C3 CI
P9 中期   D1/D2 性能基线 → D3–D5 优化 →（可选）D6 升级演练
P10 远景  E 脚手架（依赖 A/B/C）  ∥  F1 迁移动检（可提前，成本低）
```

| 里程碑 | 内容 |
|---|---|
| **M1** | 治理完成：目录与文档分层落地、CI 绿、README 与新读者对得上 |
| **M2** | 对外叙事到位：description/keywords/首屏改完，搜索能命中 |
| **M3** | demo 以"用户视角"跑通（远端包 + 真机） |
| **M4** | 性能基线 + 至少一项实质优化 |
| **M5** | `moobile create` 可用 |
| **M6** | 迁移动检报告可用 |
