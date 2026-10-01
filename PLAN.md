# PLAN.md —— moobile 计划

> 这份是**当前生效**的计划。上一版（以"移植 yi 阅读器"为终点的 P0–P7）归档在
> [`docs/plan/PLAN-2026Q3-yi-port.md`](docs/plan/PLAN-2026Q3-yi-port.md)，其中 P0（清理固化）与
> P7（发布为库）已完成，P1–P5 的去留见 §6。**旧任务编号只在那份文件里有效。**
>
> 现状（2026-09）：
> - 已发布 **`XiLaiTL/moobile@0.1.0`**（mooncakes `200 OK`，registry `build_status: success`）
> - 外部模块可用性已验证：`moon check` / `moon build` 通过，产物含 `export { … as start }`
> - 离线检查：Web 端到端 26/26、真机（Android 14 模拟器）验证过、R1 文本排版判决通过
> - **尚未做过任何真实应用的完整移植**（这是当前最大的空白）
>
> **进度快照（2026-09，数字与命令都在 `docs/FINDINGS.md` 里）**：
> Web UI **27/27**（`node tools/verify_web.js`）、本地库 **8/8**（`tools/db_probe.js`）、
> 同步链路 **14/14**（`tools/sync_probe.js`）、真机 Android 14 **21/21**（`tools/verify_android.py`）、
> 离线检查 **7/7**（`bash tools/verify_all.sh`）。
> ⚠️ 这些数字**只放这里**：README 是给使用者的，不写我们的验收分数（曾经写过，很快就过期了）。
>
> **R2 落地进度（2026-09，见 `docs/FINDINGS.md` 的 R2）**：N1 与 H2 **已完成并验证**
> （`mount` 补齐 `Cmd`/`Sub`；应用侧导出一行，`examples/apps/todo-app/moon.pkg` 的 exports 7 → 1）；
> H1/H6/H7 **已在本地跑通**（宿主收成 npm 包 `npm/moobile-examples/apps/todo-app/host/`，含 `regen` 生成器、
> 启动 fail-fast、契约版本校验），**尚未发布到 npm**；N3 **已打通一个真能力**
> （本地数据库 `expo-sqlite` → `sqlite/`），并在 Web 与 Android 14 真机上验证。
> 四道门：Web UI **27/27**（含订阅）、本地库 **8/8**、同步链路 **14/14**、真机 **14/14**（含订阅）。
> 尚未做：N4 后半（`custom_sub` + RN emitter + 退订）、N5（能力可用性标注）、H3/H4、
> 以及 **npm 发布（卡在 2FA：`npm publish` 需要一次性密码）** —— 月亮包 **0.2.2 已发出**（0.2.1 的"README 与产物不符"已在 0.2.2 修掉，见 `docs/FINDINGS.md` R7）。
>
> **接手要先读哪几份**：`README.md`（使用者视角：这是什么、怎么用、能力边界）→
> `docs/ARCHITECTURE.md`（架构分层、发布体检、宿主契约）→ `FORK.md`（第三方 fork 与 patch 系列）→
> `DEV.md`（环境怎么跑、排错、禁区）。实测结论在 `docs/FINDINGS.md`，
> 设计期证据在 `docs/design/DESIGN-FEASIBILITY.md`，旧计划（T0.x–T7.x 编号）在 `docs/plan/PLAN-2026Q3-yi-port.md`。

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
| Expo 出现在哪里 | **只在宿主工程**：`examples/apps/todo-app/host/index.js` 一行 `registerRootComponent`（换成裸 RN 就是 `AppRegistry.registerComponent`）；`examples/apps/todo-app/host/app.json` 与 prebuild 流程 |
| 我们自己的工具链 | `tools/build.sh` / `tools/verify_web.js` / `tools/measure_r1.js` **完全不引用 Expo**，只产出并喂 JS 产物 |

**推论（这是本计划后面几条轨道的依据）**：

1. 支持一个新平台，通常等于**写一个新宿主**（约 30 行 + 构建配置），而不是改库；
   这 30 行是**现在的成本，不是必须的成本** —— 轨道 H（§3.7）的目标就是把它收进一个可复用的宿主包；
2. 桌面端的"版本冲突"是**宿主之间的冲突**（Expo 宿主 vs RNW 宿主），各宿主可以各自 pin 自己的 RN 版本，
   共享同一个 MoonBit 产物；
3. 因此脚手架真正的可配置维度是**宿主**，不是"平台"：`host-expo`（android/ios/web）、
   `host-webview`（桌面壳）、`host-rn-desktop`（原生桌面，后续）。
   **推论 3 的落地形态（2026-09 已定）**：宿主**就是 npm 包** —— 于是"换宿主"从"抄 30 行"变成
   "换一个 `npm install` 目标"，这是这句话从论断变成可安装实体的关键一步。命名家族：
   `moobile-host`（RN/Expo 宿主 + 注册表生成器，**首发**）、后续的 WebView/桌面宿主按同一前缀续。

---

---

## 2. 轨道划分

| 轨道 | 内容 | 何时 |
|---|---|---|
| **A 仓库与文档治理** | 目录结构、文档分层与风格、贡献/发布流程、CI | 近期 |
| **B 对外叙事** | mooncakes description/keywords、README 首屏、版本与 CHANGELOG 策略 | 近期 |
| **C 库可用性与回归** | demo 改用远端包、离线检查入口、CI、安卓断言脚本 | 近期 |
| **H 接入收敛** | 把宿主胶水（~40 行 JS）与应用样板（~30 行 MoonBit）压成"1 行 MoonBit + 3 行 JS"；宿主收成 npm 包 `moobile-host` + 注册表生成器 | 近期（**E 的前置**） |
| **N 原生能力** | 补 `Cmd` / `Sub` 接线 → 能力包样板 → 能力可用性诚实标注 | 近期—中期 |
| **I 生态接入** | 第三方 React 组件库当标签用（antd 已端到端跑通）；事件载荷 → prop 清单生成 → 平台矩阵 → 适配器目录 | 近期—中期（机制已落地，见 §3.8） |
| **D 性能** | 建立基线 → 定位热点 → 优化 → 回归 | 中期 |
| **E 脚手架** | `moobile create`（多端 + 模板 + 交互选择）；**接好 I 的组件库生成命令**（E8）；**从既有 rabbita 项目迁移的入口**（E9，依赖 F） | 远景（依赖 A/B/C + H + **I 的命令形态** + **F**） |
| **F 迁移工具链** | 迁移动检报告 + 样式层半自动改造 + 指南 | 远景（F1 可提前） |
| **G（待定）真实应用移植** | 原 P1–P5：把 yi 搬上来，作为"真实应用验证" | 待决策，见 §6 |

轨道之间的依赖：**B 依赖 A**（文档没理顺之前，对外叙事会继续漂）；
**E 依赖 C + H**（脚手架生成的项目必须是我们自己验证过的那条链路，且必须生成**已经收敛过的**接入形态，
否则等于把 40 行宿主胶水复制进每个新项目）；
**N1 与 H2 是同一次 API 变更**（都动 L3 签名与导出面，合并发 0.2.0，见 §3.6 / §3.7）；
**F 依赖 A + style 层 API 冻结**（迁移工具一旦生成代码，改 API 就是双倍成本）。

**I 与 H 是同一套机制的两面**：都动宿主契约（`components` / `events` / `wrapRoot`）——
所以 I 的契约扩展与 H 的契约校验**必须同代发布**（契约 `1 → 2` 就是这个原因，见 §3.8）。
**I1（事件载荷）与 F1（迁移报告）互相独立，可并行**；**I3 依赖 I2**（没有 manifest 就没有类型化 setter）。
**E 依赖 I 的"命令形态"**（不是反过来）：组件库生成器必须先是**能重跑的应用侧命令**，
脚手架只在 `create` 时接线（E8）；把 I2/I3 排到 E 后面，等于让便宜又高价值的收益等远景。

---

## 3. 近期：轨道 A / B / C / N / H

### 3.1（C）demo 改用远端包

- **现状**：`examples/apps/todo-app/` 与库在**同一个模块**里，用的是源码；`examples/apps/todo-app/host/` 通过 `examples/apps/todo-app/host/moobile.js` 吃构建产物。
  也就是说，我们从没以"用户"的身份用过自己发布的包。
- **目标**：把 `examples/apps/todo-app/` 拆成独立模块，通过 `moon add XiLaiTL/moobile@0.1.0` 依赖发布版。
- **判据**：demo 独立模块 `moon check` / `moon build` 通过；Web 端到端仍 26/26（`tools/verify_web.js` 指向新宿主）；
  真机上能跑起来。
- **收益**：这条链路建立后，**每次发版都能自动验证"用户视角"**。现在 `check_external.sh` 只保证能编译，
  不保证能跑。

### 3.2（A）仓库治理

**问题清单（具体到条目，便于逐条消掉）**

| # | 问题 | 说明 |
|---|---|---|
| A-a | 目录混杂 | 库根同时存在：库本体（`*.mbt`）、第三方 fork（16 个目录，生成物）、应用（`examples/apps/todo-app/`、`examples/apps/todo-app/host/`）、脚本（`tools/`）、证据（`docs/evidence/r1/`）。第三方铺在根是**技术必需**（`internal` 可见性），但应用与证据不必留在库仓 |
| A-b | 文档职责重叠 | README 与 `docs/ARCHITECTURE.md` 都讲架构；`docs/FINDINGS.md` 与 `docs/design/DESIGN-FEASIBILITY.md` 都是实测记录；PLAN 与 ARCHITECTURE 的 §7 都列任务 |
| A-c | 文档风格 | 过度口语化、大量 emoji 与加粗、结论先行但没有证据链，读起来像聊天记录而不是工程文档 |
| A-d | 缺工程化基础设施 | 没有 CONTRIBUTING、CHANGELOG、issue/PR 模板、CI 配置、代码风格说明 |

**参考项目（待选，见 §7-2）**

| 参考 | 借什么 |
|---|---|
| **Dioxus**（Rust 跨端 UI） | 仓库布局（`npm/` `examples/` `docs/`）、ROADMAP 写法、`dx create` 脚手架 UX —— 与本项目形态最接近 |
| **Tauri** | 多端脚手架的交互设计（`create-tauri-app`） |
| **ratatui / egui** | CONTRIBUTING / CHANGELOG / issue 模板的克制写法 |
| 生态内 **rabbita / moonbitlang/x** | MoonBit 模块的目录与 README 惯例（不能脱离生态自创一套） |

**任务**

- ✅ **A1 目录重排（2026-09 已落地）**：根目录 **44 项 → 24 项**，实际采用的结构：

  ```
  moobile/
  ├── moon.mod moon.pkg app.mbt render.mbt host.mbt store.mbt schedule.mbt   ← 库本体（必须在根）
  ├── style/  sqlite/                  ← 我们写的公开包
  ├── vendor/rabbita/                  ← 整个 fork（1 项代替原来的 16 项；internal/* 已摊平）
  ├── examples/apps/todo-app/          ← Todo 示例（**独立模块**）+ host/（Expo 宿主）
  ├── examples/services/todo-server/   ← 示例后端（独立模块，只支持 native）
  ├── npm/moobile-host/                ← 宿主 npm 包
  ├── tools/                           ← 脚本（原 `_tools/`）+ verify / build
  ├── docs/{…, evidence/r1}/           ← 文档与证据
  └── moon.work                        ← 工作区：把库与 demo 连起来（demo 吃本地源码）
  ```

  **关键发现**：fork 搬进 `vendor/rabbita/` 是可行的 —— `internal` 的可见性只认**路径段恰好等于
  `internal`**，把 `internal/*` 摊平即可；而"加一层公开再导出包"**不通**（类型只能被命名、不能被使用）。
  旧结论"必须铺在模块根"已被推翻，实验记录见 `docs/FINDINGS.md` 的 R3。
  ⚠️ 消费者的导入路径**一个都没变**（`XiLaiTL/moobile` / `/style` / `/sqlite`）。
- ✅ **A2 文档分层（2026-09）**：新增 `docs/README.md` —— 三类读者三条路线，
  并写明分工："架构讲为什么 / FINDINGS 讲实测 / PLAN 讲接下来"。
- ✅ **A3 风格规则（2026-09）**：`CONTRIBUTING.md`，以**负面清单**为主
  （不要写"已对齐/已验证"除非同条给了命令；不要把"没做过"说成"做过"；
  不要只写机制不写为什么；断言粒度要能抓住设计错误）。
- ✅ **A4 CHANGELOG 与版本策略（2026-09）**：`CHANGELOG.md`（补写 0.1.0 / 0.2.0，
  含那次破坏性变更的完整清单与理由）。
- ✅ **A5 CI（2026-09）**：`.github/workflows/ci.yml` —— 跑的就是本地同一个入口
  `tools/verify_all.sh`（6 项离线检查）。端到端与真机刻意**不进** CI（要 Metro / 模拟器），文件头写清了原因。
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

- **C0 宿主可替换性验证（约半天）**：把 `examples/apps/todo-app/host/index.js` 的 Expo 依赖换成裸 RN 的 `AppRegistry`，或在最小裸 RN 工程里跑一次 —— 目的是把 §1.2 的论断**变成实测事实**。这条一旦成立，桌面原生、多宿主脚手架、以及"换 RN 版本"都不再是未知量
- **C1** 把 R1 的测量固化成安卓端断言脚本（原 T0.2）：`tools/verify_android.py`，
  解析 `uiautomator dump`，对判决表逐项断言，输出 `通过 N / N`
- **C2** 离线检查入口 `tools/verify_all.sh`：`moon check` + `check_external.sh` +
  `vendor_sync.sh --check` + `lf_normalize.sh --check`
  ✅ **已落地**（2026-09）：再加上 `moobile-host regen --check`（能力注册表与依赖是否仍一致），
  共 **5 项离线检查**一条命令跑完（实测通过 5 / 失败 0）；
  `--with-e2e` 追加 Web 三门（实测 8 / 0 / 0）。真机与"已发布版本"两套刻意**不进**这个入口。
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
`tools/verify_web.js` 26/26、`check_external.sh` 通过、`vendor_sync.sh --check` 一致。
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

### 3.6（N）原生能力：语言不是瓶颈，接线是瓶颈

**问题**：一个真实 app 除了 UI 还有原生能力（文件、剪贴板、通知、相机、传感器、权限、返回键…）。
这些能不能只写 MoonBit？

**结论：能写"调用与编排"，写不了"原生实现本身"。但当前代码里有两个接线缺口，导致持续型能力一个也接不上。**

**事实（读代码得到，不是推测）**

| 事实 | 位置 |
|---|---|
| MoonBit 侧 JS FFI 家底齐全：内联 `extern "js"`、`#external` 不透明类型、`@js.{Value,Promise,require,Object,…}`、async 桥 | `host.mbt:3` `schedule.mbt` `js/` |
| 异步副作用的完整回路**已铺好**：`@cmd.effect` / `perform` / `attempt` | `cmd/commands.mbt:86` |
| 已有"能力包"样板（纯 MoonBit，419 行，底下是 `moonbitlang/async` 的 http） | `http/op.mbt` |
| **`update` 不能返回 `Cmd`**：`mount` 两处硬编码 `@cmd.none`，签名为 `(Model, Msg) -> Model` | `app.mbt:27,50` |
| **上游 `elmish` 本来就有** `update : (Model, Msg, Emit[Msg]) -> (Model, Cmd)` 与 `subscriptions?` | `internal/rabbita/top.mbt:33` |
| **`Sub` 完全没接线**：`create_state_machine` 支持 `subscriptions?`，但 `mount` 没传 | `internal/runtime/stores.mbt:55` vs `app.mbt:46` |
| 事件处理器**能**返回任意 `Cmd`（类型是 `(MouseEvent) -> Cmd`） | `html/attrs_event.mbt:251` |
| vendor 能力包是 **DOM 实现**，RN 上不存在（`navigator.clipboard` / `history_go_back` / `document()`） | `clipboard/op.mbt:33`、`nav/op.mbt:69`、`dialog/op.mbt:35` |
| 内建订阅同为 DOM 的；`custom_sub` 才是通用扩展点 | `sub/sub.mbt:33,365-425` |
| `@js.require` 在 Metro + ESM 产物下**未实测** | `js/require.mbt` |

**含义**：生态有现成 RN/Expo 包的能力，可以全在 MoonBit 里写"绑定 + 编排"，**一行 Kotlin 都不写**
（`clipboard/ dialog/ websocket/` 就是这种包的形状）。但 ① `update` 里发起不了副作用；
② 持续数据流（传感器 / 定位 / 网络状态 / 返回键 / AppState）当前**一个都写不了**。
自研原生模块（生态没有的能力）仍必须由人写 Kotlin/Swift，MoonBit 只能绑它的 shim ——
MoonBit 没有 Kotlin/Swift 后端。

**任务**

- **N1 `mount` 补齐（与 H2 合并做，见 §3.7）**：按上游 `elmish` 对齐补 `subscriptions?`，
  并让 `update` 返回 `(Model, Cmd)`。判据：26/26 与真机验证不回归；demo 新增一个
  "从 `update` 发起 `@cmd.perform`"的例子并在真机跑通。⚠️ 破坏性变更 → 走 0.2.0（B4）。
  ✅ **已落地**：Todo 示例的每一次写库/每个网络请求都是 `update` 返回的 `Cmd`；
  `moon.mod` 已升到 **0.2.0**。
- **N2 宿主能力契约**：`MOBILE_HOST` 增加 `native` 注册表，并把 `docs/ARCHITECTURE.md` §2.1
  （现在只规定 4 个成员）同步改掉。判据：契约文档与 `App.js` 参考实现同批更新。
- **N3 打通一个真能力（做样板）**：从剪贴板 / 文件系统里挑一个（选择标准：有现成 RN 包、结果可断言、
  不碰权限模型）。产出 = `clipboard-rn/op.mbt` 这种形状的包 + 真机断言。
  判据：真机上可复现的一次读/写，并固化进 `tools/` 断言脚本（接 C1）。
  ✅ **已落地**：选了**本地数据库**（`expo-sqlite`）—— 只写 MoonBit 绑定 + 宿主的 60 行 JS，
  **一行 Kotlin 没写**；断言在 `tools/db_probe.js`（Web 8/8）与 `tools/verify_android.py`（真机 13/13）。
- **N4 `Sub` 打通（持续流）**：用 `custom_sub` 接一个 RN emitter（候选 `AppState` / `NetInfo` / `DeviceMotion`），
  验证"注册 / 更新 tagger / 退订"三件事。判据：真机上事件驱动 UI 更新，且退订可断言不泄漏。
  🟡 **前半已落地**：内置订阅 `@sub.every` 在 **Web 与真机 Android 都验过**
  （`tools/verify_web.js` 27/27 与 `verify_android.py` 14/14 各有一条"心跳自己会涨"的断言）。
  **后半（`custom_sub` + RN emitter + 退订不泄漏）仍未做。**
  ⚠️ 间隔最后定成 5 秒（1 秒会让 `uiautomator dump` 永远等不到 idle，见 FINDINGS R2 的 N4 一节）。
- **N5 诚实标注**：把 `clipboard/ nav/ dialog/` 与内建订阅标成 **Web-only**（或改写 RN 版）。
  口径与 `F1 迁移动检报告` 一致：**把静默失效变成可见的**。
  判据：每个能力包都有"哪端可用"的明确标注。
- **N6 只写文档、不写代码**：把"自研原生模块的边界"讲清（谁提供实现、为什么走 autolink 就不用写 Kotlin）。

**不在本轨道内**（防止范围蔓延）：应用签名与上架、权限文案与合规、iOS 侧验证 ——
这些属于"真实应用"（G）或发布工程，不是库能力。

### 3.7（H）接入收敛：把宿主胶水与应用样板压成"一行"

**问题的准确形状**：现在接一个 app，用户至少要手写三样非视图代码 ——
`examples/apps/todo-app/host/App.js`（~40 行：`MOBILE_HOST` 四件套 + `useSyncExternalStore` 根组件 + 5 个组件的 import/枚举）、
应用包的 30 行四件套包装（`start/snapshot/subscribe/element`）+ `moon.pkg` 里 4 个导出名、
以及 `tools/build.sh` 的拷贝与 Expo/Gradle 本机配置（`tools/android_env_setup.sh`）。

**能不能压成一行**：能压掉绝大部分。先把"真约束"和"只是我们没做"分开 ——
三个约束里只有一个（视图本身）是硬的：

| 约束 | 硬不硬 | 办法 |
|---|---|---|
| 导出必须单态（`mount` 对 `Model`/`Msg` 泛型） | **软** —— `Mount` 本身是**非泛型**具体类型 | **H2**：库提供 `handlers(model, update, view) -> JsValue`，交出 `{start, snapshot, subscribe, element}`；应用导出名 4 → **1** |
| 宿主必须提供 `MOBILE_HOST` | **软** —— 5 个基础组件**全在 `react-native` 包里**，本就不该由人枚举 | **H1** 宿主包自己 import；**H3** 传命名空间 |
| 应用必须自己写 `model` / `update` / `view` | **硬**（这就是应用本身） | 不省 |

**任务**

- **H1 宿主包 = npm 包 `moobile-host`（已定名，2026-09）**：把 `examples/apps/todo-app/host/App.js` 抽成可复用的宿主模块，
  导出 `mountApp(handles)`；app 侧手写 JS 收敛到 **2 行 import + 1 行挂载**：
  ```js
  import { mountApp } from 'moobile-host';
  import { app } from './moobile.js';
  export default mountApp(app);
  ```
  **为什么走 npm 而不是让 mooncakes 包自带**（这条比较过，见决策点 9）：宿主是给 JS/RN 开发者用的，
  `npm install` 本来就是他们的动作；能独立版本化、进 lockfile、被 Metro 原生解析。
  而 `.mooncakes/` 那条路是"点开头的目录 + 包管理器的地盘 + 无版本号目录"（实测形态），
  让 Node 的 import 指着它不稳。
  判据：`examples/apps/todo-app/host/App.js` 从 ~40 行降到 ≤5 行，且 26/26 与真机验证照旧。
  ✅ **已落地**：`examples/apps/todo-app/host/App.js` 现在 **12 行**（其中 8 行是注释），`npm/moobile-examples/apps/todo-app/host/` 是包本体。
- **H2 单导出（MoonBit 侧）**：库提供"返回句柄表"的入口，应用侧只需 **1 个导出名 + 1 行调用**：
  ```moonbit
  pub fn app() -> @moobile.JsValue { @moobile.handlers(initial(), update, view) }
  ```
  与 N1 同批（两者都动 L3 API 与 `moon.pkg` 导出名单）。
  判据：`examples/apps/todo-app/moon.pkg` 的 exports 从 7 个降到 1 个（3 个诊断钩子只在测试 profile 保留），
  `tools/ext_probe/` 同步简化并仍能 `moon check` 通过。
  ✅ **已落地**：exports = `["app"]`；诊断钩子进了句柄表；`tools/ext_probe/` 已迁到新签名。
  ⚠️ spike 结论：**通过**（26/26 就是走这条路）—— 见 `docs/FINDINGS.md` R2 的「H2」一节。
  ⚠️ **前置 spike（约 1 小时）**：先验证"MoonBit 构造的 JS 对象里放 4 个闭包，Metro/Hermes 打包后 React 能调"。
  先例是好的（`js_microtask` / `js_frame` 已在传 MoonBit 闭包；`js_as_handler` 说明**必须显式包成 JS 闭包**），
  但没做过就是没做过 —— **不通过就退回 H1 + 4 个导出名**。
- **H3 组件表：由宿主包内置，不做命名空间**（**2026-09 修订**）：H1 之后，那张 5 项的表不再是
  "每个 app 手写的东西"，而是**我们维护的那一个包内部的一行** —— 所以"新增组件要改两处"的痛感
  从"每个用户都要改"降到"我们改一次、用户 `npm update` 一次"。**H3 的原始动机因此消失**。
  命名空间方案（`components: RN`）降级为**可选优化**，且**先测包体积**：`import * as RN` 会保留整个
  命名空间、阻止 tree-shaking，代价可能为 0（RN 本来几乎全在包里）也可能不小 —— **没测之前不做**。
  判据（若做）：新增组件不必发宿主包新版，且打包后体积与基线无显著差异。
- **H4 构建胶水**：`tools/build.sh` 的 `cp → examples/apps/todo-app/host/moobile.js` 收成一条明确入口（宿主模板里的 npm script 或
  `moon run` 任务），并确认 `expo prebuild` 不会把它冲掉。判据：干净机器上按 README 两条命令出首屏。
- **H5 与 E 的关系**：`E4 生成物` 必须按 H 的形态产出（`moobile-host` 依赖 + 3 行 App.js + 1 个导出），
  **E 依赖 H1/H2/H6/H7**；否则脚手架等于把 40 行胶水复制进每个新项目。
- **H6 发布流程（npm）**：把 `moobile-host` 的骨架与发布脚本立起来（`package.json` / README / LICENSE /
  导出面 / `files` 白名单），脚本里**写死**发布目标。**实测事实（2026-09）**：

  | 事实 | 值 |
  |---|---|
  | 本机 node / npm | v24.14.1 / 9.2.0 |
  | 本机默认 registry | `https://registry.npmmirror.com/`（**只读镜像**） |
  | 发布必须显式指定 | `npm publish --registry=https://registry.npmjs.org/` —— 不指定就会撞在镜像上，报错难懂 |
  | 账号 | `xilaitl`（已登录；`~/.npmrc` 里原有的 `_authToken` 曾失效，已重新登录） |
  | 名字占用 | `moobile-host` / `moobile` / `moobile-cli` / `create-moobile-app` **全部未被占用** |

  判据：干净机器上 `npm install moobile-host` 后能跑起来；README 里把 `--registry` 的坑写明。
  **附带建议（成本极低，值得顺手做）**：名字家族现在**全空**，先各发一个 `0.0.1` 占位
  （至少 `moobile-host`，可考虑 `moobile` 与 `create-moobile-app` —— 后者是 E 轨道的候选名）。
  通用词被抢注之后再改名，成本远高于现在占一个位。发布后 `npm view <name>` 验证。
- **H7 注册表生成器（把"清单"从人手写改成工具生成）**：这是决策 10 的落地。**静态生成，不是运行时读取** ——
  Metro 不能靠运行时拼字符串 import，所以流程固定为：
  ```
  读 examples/apps/todo-app/host/package.json 的 dependencies + 一张"包名 → 模块对象名"映射表
    ↓  npx moobile-host regen
  生成 examples/apps/todo-app/host/registry.generated.js（自动生成，勿手改）
    ↓  App.js import 它 → 交给 MOBILE_HOST
  ```
  映射表必须显式（约定推不出来），例：`expo-clipboard`→`Clipboard`、
  `expo-file-system`→`FileSystem`、`@react-native-async-storage/async-storage`→`AsyncStorage`。
  **生成物要做两件事才算值钱**：
  1. **启动 fail-fast**：库要的能力不在表里 → 立刻报错并**说出缺哪个包**，而不是渲染成 `undefined`
     （现在 `map_tag` 未命中就是这个下场，只能靠事后 `unmapped_tag_count` 诊断）；
  2. **契约版本校验**：`handlers()` 返回值里带 `contract`（整数），宿主包里有 `HOST_CONTRACT`，
     不等就抛错并同时报出两个版本号；README 附兼容表（库 0.2.x ↔ host 0.2.x）。
     这条消掉"npm 包与 mooncakes 包两条版本线各走各的"这个真实风险。
  **诚实边界**：注册表只解决"JS 对象怎么进到库手里"**半截**；MoonBit 侧的类型化绑定
  （`clipboard-rn/op.mbt` 里的 `extern "js"`）**仍然手写** —— 但那是**能力包作者**（我们）的活，
  不是 app 作者的活。app 作者只需：加一行依赖 → `regen` → 完事。
  判据：故意从依赖里删掉一个包后，**启动时报出它的名字**（而不是静默失败）。
  ✅ **已落地**：`npx moobile-host regen` 读依赖生成 `registry.generated.js`（静态 import，
  注释里列出"识别了什么/哪些没装"）；`mountApp` 装完再核对一遍，缺了点名能力与包；
  MoonBit 侧 `sqlite/sqlite.mbt` 的 `ensure()` 也会 fail-fast 并说明怎么装。
- **判据（轨道级）**：一个 app 手写的非视图代码 = **1 行 MoonBit**（`handlers(...)`）
  **+ 3 行 JS**（2 行 import + 1 行 `mountApp`）**+ 两处声明**
  （`moon.pkg` 的导出名单、`package.json` 的依赖）。
  **原生能力清单仍是 per-app 的**（它是依赖清单，本就该 per-app）—— 但它由 H7 **生成**，不由人手写。

---

### 3.8（I）生态接入：第三方 React 组件库

> **轨道定位**：H 解决"**我们**的接入要几行"，I 解决"**别人生态里的组件**能不能用"。
> 两者共用同一套机制（组件表 + 契约 + fail-fast），但诉求相反：H 要**少写**，I 要**能写**。
>
> **设计与证据**：[`docs/design/DESIGN-COMPONENT-LIBRARY.md`](docs/design/DESIGN-COMPONENT-LIBRARY.md)（机制 N1–N7）
> ｜试金石 [`examples/apps/antd-spike/`](examples/apps/antd-spike/)（怎么跑、20 条判据）

**现状（2026-09 实测）**：机制已落地并端到端跑通 —— antd 6.6.4 的组件在 MoonBit 视图里
以 `@html.node("antd:Button", …)` 可用；`bash tools/verify_all.sh` 的
"组件库接入（antd 试金石，26 项）"在门内。**I1（事件载荷）也已落地** ——
受控组件（antd `Input` 打字 → Model 收到该文本 → 回填 DOM）有了自己的断言，
所以现在能说的是"**能画、能点、能用**"（表单一类的受控组件可用）。

| # | 任务 | 现状 | 判据 |
|---|---|---|---|
| **I1** | **事件载荷**：`Attrs::on_raw(event, f : (Payload) -> Cmd)` + `Payload::text/json/num/bool/field`（vendor patch **27**，`html/payload.mbt`） | ✅ **已落地** | 试金石 3 条断言：打字 → 回显**该文本** / `input.value` 等于 Model 的值（受控回填）/ 第二次输入同样到达。**判据是"值对上了"，不是"事件触发了"** |
| **I2** | **prop 清单生成（manifest）**：从组件库的类型定义抽"组件 → prop 名 + 类别"（string/bool/number/json/event/reactnode/unsupported） | ❌ 未做（`jsonProps` / `events` 现在**手写**） | ① 宿主侧不再手写 `jsonProps`/`events`；② 用到清单外的 prop 名 → **首次渲染就点名**（写 `tpy` 而不是 `type` 必须报）；③ 生成器入库 + `--check` 可 diff 漂移（与 `regen`、`gen_forwarders` 同规矩） |
| **I3** | **生成"与 `@svg` 平级的组件库 DSL 包"**（可选，见决策点 13）：目标是让组件在写法上与 `@html` 平起平坐，而不是让用户写 `@html.node("antd:Button", …)` | 🟡 **形状已实测**（`examples/apps/antd-spike/generated_shape_probe.mbt`，`moon check` 0 错误）；**生成器本身未做** | 由 manifest 生成：① 调用点写成 `@antd.button(type_="primary", danger=true, on_click=…, "加一条")` —— 与 `@html.button(...)` **同款形状**（具名可选参数 + children），且能直接塞进 `@html.div([...])`；② typo 变**编译错误**、有 IDE 补全；③ **生成包的组件名集合 == 宿主注册表的键集合**（两边同源于一份 manifest，不许各写一份）。⚠️ 名字必须**小写** —— `pub fn Button(...)` 实测是 parse error（大写开头是类型名），要大写只能 `Button::new(...)`，反而更长 |
| **I4** | **平台矩阵**：同一 `库名:` 命名空间按平台注册不同实现（Web→`antd`，Android/iOS→`@ant-design/react-native`） | 🟡 机制有（`platforms` 闸门 + 同一命名空间可多处注册），**未实测第二个实现** | 同一份 MoonBit 视图在 Web 与 Android 上分别用两套库渲染；**漏注册的那一端启动时报错**（不是渲染成空白） |
| **I5** | **适配器目录**：`npm/moobile-host/libraries/<lib>.js`（与 `capabilities/db.js` 同构）+ `regen` 自动接 | ❌ 未做（试金石里约 20 行适配写在验证脚本中） | 新项目 `npm install antd` + `regen` 之后，MoonBit 侧直接写 `antd:Button` 就能跑，**宿主侧零手写** |
| **I6** | **样式交集量化**：typed style 在 DOM/antd 上到底哪些属性有效 | ❌ 未做 | 给 `@style.Style` 的每个属性标一列"DOM 是否有效"，产出**数字**（不是感觉）；做法参照 `docs/evidence/r1/style_gap.md` |
| **I7** | **真浏览器 / 真机实测**（antd 的 CSS-in-JS 是否真的生效、移动端表现） | ❌ 未做（试金石只验结构，不验样式） | headless Chrome 断言**计算样式**（不是类名）；真机另算 |

**成本与边界（免得把它想成"再来一遍 H"）**：I 不需要新依赖、不需要动渲染架构 ——
机制部分是 ~120 行库代码 + 宿主包一次拆分，**已经做完**。剩下的是 I1（小而关键）
与 I2（小而收益高）；I3/I4 属于"看需求再上"。

**I2 的难度已量测**（`node examples/apps/antd-spike/host/manifest_probe.mjs`，可复现；2026-09，antd 6.6.4）：
- 规模很小：**79** 个组件目录 / **73** 个 Props 接口 / **1260** 个直接 prop（平均 17.3 个/组件）——
  清单总量是"一份 JSON"，不是"一个项目"。
- 浅解析（正则 + 花括号配对，**不需要 TypeScript**）能分类 **~88%**：直接落通道的 863 个
  （`scalar` 248 / `bool` 160 / `union` 111 / `reactnode` 109 / `function` 108 / `css` 69 / `array` 31 / `event` 24 / `object` 3）
  + "命名类型"桶 397 个里 **230 个一跳可分类**（antd 本地 564 个 `type` 别名 + 503 个 `interface`）
  + 16 个需拆工具类型（`NonNullable` / `Partial` / `LiteralUnion`）。剩下 ~12% 是**跨组件/外部类型**
  （`ButtonProps` / `Locale` / `ComponentStyleConfig`）→ 标 `unsupported` **并在报告里点名**（不是失败）。
- **真正的坑是"继承"**：**33/73** 个组件的 Props 接口 `extends` 了别处，
  而 `onClick` / `href` / `className` / `style` / `aria-*` 这些**最常用的 prop 根本不在场** ——
  它们定义在 `@types/react` 里，而 **antd 不依赖它、纯 JS 应用也不会有**（实测三者皆不存在）。
  → 必须自备一份"React 公共属性"小表（`on*` + `className`/`style`/`id`/`title`/`href`/`aria-*`/`data-*`），
  并**对清单外的名字放行**（清单本身不完整，严报会大面积误报 —— 这正是 I2 判据里
  "`onClick` / `href` 必须**不**被误报"那条的由来）。



**I2 / I3 / I5 收敛成同一条应用侧命令**（暂名 `npx moobile-host libgen`），三段一条流水线：

```
应用装好的组件库（node_modules/**/*.d.ts）
        │  ① 抽"组件 → prop 名 + 类别"        ← I2
        ▼
   manifest（JSON，入库、可 diff、可手改兜底）
        │  ② 生成宿主侧注册调用（components / jsonProps / events / wrap / platforms）   ← I5
        │  ③ 生成 MoonBit DSL 包（@antd.button(...) 这种"平级 DSL"）                    ← I3
        ▼
   应用侧生成物（入库 + `--check`，与 registry.generated.js / 转发包同规矩）
```

**为什么必须是"一条命令、一份 manifest、两个产物"**：宿主侧认的是**名字**
（`MOBILE_HOST.components["antd:Button"]`），MoonBit 侧发的也是**名字**（标签字符串）——
两边各写一份清单就是等着漂。让它俩同源于一份 manifest，是"生成物之间不会对不上"的**机制保证**，
而不是靠人记得同步。**判据**：`--check` 能同时发现两侧任一边被手改。

**落地形态（决策点 15）**：生成器住在**应用侧工具链**（Node，与 `moobile-host` 的 CLI 同一个包），
**不**是我们预先发布 `XiLaiTL/moobile-antd` 包；脚手架（E）只负责在 `create` 时把它接好（E8）。

**位置必须是 Node 侧的一条硬理由**：它的输入是 `.d.ts`（决策点 12 里 (b) 那条路要用 TypeScript
编译器 API）与 `node_modules` —— 这两样只有 Node 侧拿得到，MoonBit CLI 拿不到。

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

- **E0 前置**：先落 H1–H3（§3.7）**与 I2/I3 的"命令形态"（§3.8）**。脚手架的生成物必须是
  **已经收敛过的接入形态**（宿主包 + 1 行 App.js + 1 个导出）——否则每生成一个项目，就把 40 行宿主胶水复制一份，
  等于把债固化进模板。组件库那部分同理：**E 消费 I 的命令，不自己实现生成逻辑**（理由见 E8）。
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
- **E8 组件库接线（消费 I，不实现 I）**：脚手架要生成的是**"接好这条流水线"**，而不是生成代码本身 ——
  ① `package.json` 里一条命令（暂名 `npx moobile-host libgen`，产出 manifest + MoonBit DSL 包 + 宿主注册调用）；
  ② 那条命令进 `scripts` 与 CI 的 `--check`（生成物入库、可 diff，与 `registry.generated.js` 同规矩）；
  ③ README 一行"**升级组件库之后重跑它**"。
  ⚠️ **为什么生成逻辑不能写在脚手架里**：脚手架只在 `create` 那一刻存在，而升级 antd 之后**还要重跑**；
  把逻辑藏在脚手架里 = 用户升级后生成物悄悄漂掉。**依赖方向是 E → I，不是 I → E** ——
  否则 I2/I3（便宜、马上能用）会被远景的 E 卡住。
- **E9 第三类输入：从既有 rabbita 项目迁移（远期）** ——
  `npx moobile-host create --from-rabbita <既有项目路径> my-app`。
  **为什么是我们的天然能力**：moobile 是 rabbita 的**换后端** fork（TEA 与 `@html` DSL 同构），
  所以迁移**不是重写视图**，而是改四处边界（入口/宿主、样式、能力、构建目标）——
  视图与 TEA 那两行是**照搬**，成本集中在样式与"无等价物标签"上。
  **产出三件东西**：① F1 的动检报告（会静默失效的项逐条点名）② 新项目（视图尽量原样搬运，
  编不过就留 `TODO`，不做"猜意图"的改写）③ 指向 F2/F3/I 的 TODO 清单。
  **一条硬约束**：迁移是**换依赖**，不是两个 rabbita 并存（两边的 `Html`/`VNode` 是不同类型，混用编不过）。
  **判据是"报告零遗漏"，不是"自动改对了多少"**（S9-1…S9-5 见 `docs/design/SCAFFOLD.md` §3.7）。
  **依赖与顺序**：`F1 → I → C → E9`，所以 **E9 天然最后一个做**，但今天就能定形态与判据。
- **判据**：干净机器上 `moon install … && moobile create demo-app` → 选 Android → 能在 Expo Go 里跑起来；
  **外加组件库那半条**：`create` 时勾一个组件库 → 项目开箱能写 `@antd.button(...)`（编译通过），
  升级该库版本后重跑生成命令 → `--check` 能 diff 出变化（而不是静默漂移）；
  **迁移那半条**（远期，S9）：真实 rabbita 项目迁完 → 动检零遗漏 + `moon check` 0 错误 + Web 上跑得起来。

### 5.2（F）迁移工具链

| 任务 | 内容 | 价值/成本 |
|---|---|---|
| **F1 迁移动检报告** | 扫描一个 rabbita 项目，列出所有**会静默失效**的东西：`class=`/`style="…"` 数量、标签表外的标签、`@dom` 直连、读坐标的事件、`:hover` / `@media` 用法 | **价值最高、成本最低**——先做这个 |
| F2 样式层半自动改造 | 解析项目 CSS → 生成 `styles/` 模块（`Style` 调用）；把 `class="card"` 映射成 `styles.card()` | 成本中高，需要 CSS 子集解析器 |
| F3 迁移指南 | 逐条对照表 + 手工步骤（含 `details`/`summary`、`canvas`、表格等结构性差异） | 成本低，必须做 |
| F4 与 `postadd` 结合 | `moon add` 之后自动打印体检清单入口 | 成本低 |
| **判据** | 拿一个真实 rabbita 项目跑 F1，**静默失效项零遗漏**（与手工清点对照） |

> **F 不只是"给用户一个报告"，它还是 E9（从 rabbita 项目迁移）的前置**：
> E9 的报告就是 F1，样式那半就是 F2。顺序上 **F1 必须先于 E9** ——
> 没有动检，"哪些会静默失效"没有答案，迁移器只能瞎猜（`docs/design/SCAFFOLD.md` §3.7.5）。
> 反过来，**F1 可以今天就单独做**：它成本最低、价值最高，且不依赖脚手架。

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

> **已拍板（2026-09）**：9（宿主包分发 → npm 包 `moobile-host`）、10（注册表 → 组件表内置 + 能力清单生成）。
> 下方保留原选项与否掉的理由，**不要再重新讨论**，除非有新证据。

1. **文档语言**：对外（README / mooncakes / CONTRIBUTING）用英文还是双语？内部（PLAN / DEV / FORK）保持中文？
   —— 影响 B 与 A3 的全部工作。
2. **参考项目**：Dioxus / Tauri / ratatui / 生态内 rabbita，选哪几个当模板？
3. **yi 移植去留**：§6 的 (a) / (b) / (c)。
4. **桌面端支持到哪一档**：① WebView 壳（Tauri / PWA，本机可验证，推荐先做）；② 原生 RN Windows/macOS（**可行但要维护第二个宿主**：裸 RN + RNW，各自 pin 版本，共用同一份产物）；③ 暂不支持。
5. **脚手架技术选型**：MoonBit CLI（`moon install` 分发）还是 Node（`create-*` 约定）。
   ⚠️ **天平移了（2026-09）**：既然已经有了 npm 包（`moobile-host`）与 npm 账号，
   Node 方案从"引入一套新基础设施"变成"复用已有基础设施"（同一个账号、同一条发布脚本、
   `npx create-moobile-app` 的交互生态成熟）—— 而 `moon install XiLaiTL/moobile-cli` 依然要自己写 CLI。
   **待定，但倾向已从"MoonBit CLI"转向 Node**。
6. **性能目标**：给出量化标准（例如"长列表滚动 ≥ 55 fps、首屏 < 1.5 s（中端安卓）"）。
7. **API 面**：`Val` / `create_state` 这类增量模型 API 要不要对使用者开放？方案 (i) 公开包 vs (ii) 根包再导出（见 §3.5）。
8. ✅ **已定（2026-09）：留同仓、按目录分** —— `examples/apps/todo-app/`（含它的 `host/`）+
   `examples/services/todo-server/` + `npm/moobile-host/`。理由：改动小、四道门能一次跑完；
   而 demo 已经是**独立模块**，不会污染库的依赖闭包 —— 这才是"拆出去"真正要解决的问题。
9. ✅ **已定（2026-09）：宿主包发 unscoped npm 包 `moobile-host`**（决策点原文三选项：npm 包 / 脚手架拷贝 /
    放进 MoonBit 模块当资源）。
    - **选它的理由**：宿主是给 JS/RN 开发者用的，`npm install` 本来就是他们的动作；可独立版本化、
      进 lockfile、被 Metro 原生解析（`node_modules` 是它的主场）。
    - **否掉"放 MoonBit 模块里当资源"的理由**（实测形态，不是猜的）：`moon add` 后依赖躺在项目的
      `.mooncakes/<author>/<module>/`，三个问题叠在一起 —— ① 目录以点开头，Metro 这类打包器默认跳过/不监听；
      ② 那是包管理器的地盘（`moon update` / `moon clean` 会动它）；③ **该布局没有版本号目录**
      （实测 `.mooncakes/moonbitlang/async/`，不是 `async/0.21.0/`），升级时同名路径下内容悄悄变，
      Metro 缓存不一定察觉。**注意：MoonBit 包"能不能带 JS 文件"从来不是问题** ——
      打包清单实测会带任意文件（曾经混进过 png、`package-lock.json`、`PLAN.md`），
      今天不带是我们自己在 `.moonignore` 里主动排除的（262 → 235 个文件）。
    - **兜底路线**（不引入 npm 的形态）保留为"mooncakes 自带 + CLI 同步"，**当前不做**，
      只在 README 留一句"离线/内网场景怎么办"。
10. ✅ **已定（2026-09）：拆成两半，各用各的机制** ——
    **① 基础 UI 组件表（View/Text/… 共 5 个）：由宿主包内置**，不生成、不用命名空间
    （H1 之后它不再是 per-app 手写物，"改两处"的痛感降成"我们改一次"，原动机消失）；
    **② 原生能力清单：由工具从依赖生成**（H7 的 `regen`），生成物是**显式**清单（可见、可 diff、可审计）。
    于是原三选项的 (a)/(b) 之争消失 —— 两者被分到不同的机制里。
    配套两条：启动 **fail-fast**（缺什么能力就报出那个包名，不静默变 `undefined`）+
    **契约版本校验**（防止 npm 包与 mooncakes 包版本线漂移）。
11. **是否接受 0.1 → 0.2 的破坏性变更**：N1 + H2 会改 `mount` 签名（对齐上游 `elmish`：`update` 返回 `Cmd`
    + `subscriptions?`）与导出面。**倾向现在就做** —— 现在只有一个使用者（我们自己），
    等有人用了再改就是双倍成本；且这条同时也修好了"声称对齐 elmish 却没对齐"的对外诚实性问题。

12. **prop 清单（I2）的真相源**：组件的 prop 名与类别从哪里来？
    - (a) **浅解析 `.d.ts`**（antd 装了 **1988** 个 `.d.ts`，`BaseButtonProps` 是干净接口）—— 零新依赖，
      但 `interface ButtonProps extends BaseButtonProps, MergedHTMLAttributes` 这种**跨文件继承会漏**
      （`onClick` / `href` 这类继承来的 prop 抽不到，而它们恰恰是常用的）；
    - (b) **用 TypeScript 编译器 API 真解析** —— 准，但引入 `typescript` 依赖 + 要处理 `Omit<…>` / 联合类型 / 泛型；
    - (c) **手写 / 半自动清单**（先覆盖常用组件，清单外"未知即放过"）。
    **倾向**：**(a) 打底 + 跟着 `extends` 上溯（浅解析也能走继承链）+ (c) 兜底清单**；
    (b) 只在 (a) 的漏检被证明是真问题时才上。**判据**：写 `tpy`（`type` 的 typo）必须被点名，
    而 `onClick` / `href` 这类继承来的 prop 必须**不**被误报。
13. **要不要生成 MoonBit 类型化 setter（I3）**：
    - (a) **不做**：`prop_str("type", …)` 就够用，代价是 typo 没有编译期检查（靠 I2 的运行期点名兜底）；
    - (b) **生成"常用子集"**（`Button` / `Card` / `Table` / `Input` / `Select` 这类高频组件，约 20 个）；
    - (c) **全量生成**（每个组件每个 prop 都精确类型）。
    **倾向**：**(b)**。(c) 面对 `ReactNode` / 联合类型 / `React.HTMLAttributes` 的几百个继承属性，
    映射过来是一个独立项目、且大半在 MoonBit 里表达不了；(a) 则让"用第三方库"一直带着
    "写错了没人告诉你"的隐患。**代价必须先看清**：(b) 是**跟着 antd 版本走的生成物**
    （入库 + `--check`），跟版成本要算进去（参照 `gen_forwarders.py` 的规矩）。
14. **跨平台承诺到哪一档**：① **只承诺 Web**（`antd` 这类 react-dom 库），原生上直接报错；
    ② 承诺"同名组件两端都有"（同一命名空间按平台注册两套实现，RN 侧要 `@ant-design/react-native`
    + `gesture-handler` + `reanimated` 两个原生依赖）；③ 不承诺，交应用自己按平台分支。
    **倾向**：**① 作默认**（诚实、零成本，`registerLibrary` 的 `platforms` 闸门已经实现这条）；
    ② 等真有需求时按 §3.8 的 I4 验一次再决定。
15. **组件库生成器（I2/I3/I5）的落地形态**：
    - (a) **应用侧命令**（`npx moobile-host libgen`，产出 manifest + 宿主调用 + MoonBit DSL 包，生成物入库 + `--check`）；
    - (b) **我们预先生成并发布** `XiLaiTL/moobile-antd` 之类的 MoonBit 包；
    - (c) **只在脚手架里跑一次**（`create` 时生成好就完事）。
    **倾向 (a)**，理由三条：
    ① **它不依赖脚手架** —— (c) 会把"写错 prop 会编译报错"这种便宜又高价值的收益，绑到远景的 E 上；
    ② **它必须能重跑** —— 升级 antd 之后清单会变，命令跑一次就完事的形态必然漂；生成逻辑尤其不能藏在脚手架里
    （脚手架只在 `create` 那一刻存在）；
    ③ **输入只有 Node 侧拿得到**（`.d.ts` + `node_modules`；决策点 12 的 (b) 还要 TypeScript 编译器 API）。
    (b) 的代价是"每个库 × 每个版本"都要我们发一个包，且版本耦合到我们的发版节奏 ——
    **留作后手**：真出现某个库被大量使用时再预生成发布，不冲突（生成器本来就产出同样的代码）。
    配套：生成物**入库、可 diff、可手改**（手改要在标记区外，`--check` 会看见），
    并给生成器一个**自己的版本号**写进产物头部 —— 我们改命名约定时，用户重跑会立刻看见 diff 而不是静默变样。

16. **rabbita 项目迁移（E9）的野心到哪一档**：① **只做"新项目 + 报告 + TODO"**（一行用户代码都不改写）；
    ② 在 ① 上加**样式层的机械映射**（F2）；③ 连视图/逻辑一起自动改写。
    **倾向 ① 起步、② 作为增量**：迁移的价值在**把"静默失效"变成显式清单**，不在替用户猜意图；
    ③ 猜错的代价是把 bug 埋进用户代码，而用户不会知道。② 的边界要写死 ——
    机械映射出的 `Style` 与原 CSS **不等价**（伪类 / 媒体查询 / 后代选择器无对应物），必须逐条标"有损"。
    配套见 `docs/design/SCAFFOLD.md` §8 的 **D8**（野心档位）与 **D9**（用哪个真实项目验收：以 `interest/yi` 为主）。

---

## 8. 建议顺序与里程碑

```
P8  近期    N1 + H2 API 对齐（一次改完，发 0.2.0）→ H1 + H6 宿主包发 npm（App.js 40 行 → 3 行）
            → H7 注册表生成器 + fail-fast + 契约版本 → C0 宿主可替换性验证（半天）
            → C1 安卓断言 → A 治理 + B 叙事（并行）→ C2 检查入口 → C3 CI
P9  近期—中期 N2 能力契约（文档）→ N3 打通一个真能力 → N4 Sub 打通 → H4 构建胶水
            →（可选）H3 命名空间方案（先测包体积）
P10 中期    D1/D2 性能基线 → D3–D5 优化 →（可选）D6 升级演练
P11 远景    E 脚手架（依赖 A/B/C + H + I 的命令形态 + F；E8 只接线不实现）
            → E9 从既有 rabbita 项目迁移（= E × F 的收口，天然最后做）  ∥  F1 迁移动检（可提前，成本最低）
P12 近期—中期 I1 事件载荷（受控组件可用）→ I2 prop 清单 → I5/I3 同一条 `libgen` 命令的两个产物
            （生成物入库 + `--check`）→ I6/I7 样式与真机测量
            →（可选，看需求）I4 平台矩阵 ∥ 决策点 13(b) 的类型化程度 ∥ 决策点 15(b) 预生成发布
```

> 为什么 N1/H2 排在最前：它是**唯一的破坏性变更窗口** —— 越早做越便宜，且它同时解掉
> "持续型原生能力写不了"（N）与"接入要 70 行样板"（H）两个问题。
> H1/H6/H7 紧跟其后，因为**发出去的 npm 包就是对外承诺**，越晚定型，返工越贵。
> H3 降级为可选（见 §3.7 的 2026-09 修订），它不再卡任何东西。

| 里程碑 | 内容 |
|---|---|
| **M1** | 治理完成：目录与文档分层落地、CI 绿、README 与新读者对得上 |
| **M2** | 对外叙事到位：description/keywords/首屏改完，搜索能命中 |
| **M3** | demo 以"用户视角"跑通（远端包 + 真机） |
| **M4** | 性能基线 + 至少一项实质优化 |
| **M5** | `moobile create` 可用（**含 E8**：勾一个组件库 → 开箱能写 `@antd.button(...)`，且生成命令可重跑、`--check` 能 diff） |
| **M6** | 迁移动检报告可用（F1，**E9 的前置**，可提前单独做） |
| **M10** | **迁移入口可用（E9）**：真实 rabbita 项目（`interest/yi`）跑 `create --from-rabbita` → 动检报告**与人工清点零遗漏** + 生成项目 `moon check` 0 错误 + Web 宿主上跑得起来 + 报告里每项都有下一步指向（判据 S9-1…S9-5，见 `docs/design/SCAFFOLD.md` §3.7） |
| **M7** | 接入收敛达成：一个新 app 的非视图代码 = 1 行 MoonBit + 3 行 JS，宿主来自 `npm install moobile-host`（H 的轨道级判据） |
| **M8** | 原生能力打通：一个真能力在真机上可复现（N3），且持续流订阅可用（N4） |
| **M9** | **生态接入可用**：第三方组件库的组件在 MoonBit 视图里"**能用**"而不只是"能画" —— 受控组件（I1）在真浏览器里回填正确、props 清单由生成器产出（I2）、门里有断言（轨道级判据见 §3.8） |
