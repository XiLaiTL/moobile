# PLAN.md —— 剩余工作计划

> **终点**：让 `interest/yi`（《御纂周易折中》阅读器）用 moobile 在**真机**上跑通，
> 一套代码同时出 Web 与 Android。
>
> **接手前先读**：`README.md`（全部实测结论，尤其「R1 判决」）→ `DEV.md`（环境怎么跑）
> → `FORK.md`（对 rabbita 改了什么）。
>
> ✅ **`T0.0` / `T0.1` / `T0.3` 已完成**（2026-09）：代码与文档同处 `interest/moobile/`，
> 模块名 **`XiLaiTL/moobile`**，原 `moobile_demo/` 已不存在；`internal/style` 已提为
> 公开包 **`style/`**；调试脚手架已清掉；git 仓库已建。
> 验证：`moon check --target js` **0 错误**、`node _verify.js` **26 / 26**。
>
> 📌 从此**代码与文档同目录**：本文里形如 `demo/` `host/` `moobile/` `style/`
> `internal/` `_tools/` `_r1/` 的相对路径都相对 `interest/moobile/`。
>
> 每项任务都写了**完成判据**。做完一项就把 `[ ]` 改成 `[x]` 并记一句结论。

---

## 0. 现状（已完成，不要重做）

| | 内容 | 凭证 |
|---|---|---|
| ✅ | **R1 判决通过**：`@html` 的文本排版在 RN 上**可接受**（最长爻辞 2 行、小象行内流成立、`min-width`/grid→flex 降级精确吻合） | `README.md`「R1 判决」、`_r1/android_scroll_report.md` |
| ✅ | **真机验证能力**：Android 14 / x86_64 模拟器 + APK 构建 + 上机运行全部打通 | `DEV.md` §3.3 |
| ✅ | **样式层**：`StyleValue` 类型化，对 yi 的 198 条 CSS 差集**账目闭合**（0 未归类） | `_r1/style_gap.md` |
| ✅ | **DOM 缝隙普查**：`html/`+`svg/` 45 处 `@dom.` 逐条列明，13 个同类 panic 点统一策略化 | `_r1/dom_survey.txt`、`html/event_decoders.mbt` |
| ✅ | **标签表 42 条** + 未收录计数（可断言为 0） | `moobile/render.mbt` |
| ✅ | **验证脚本**：Web 端到端 26/26 | `node _verify.js` |
| ✅ | **fork 可跟版**：diff 清单 + 重放步骤 | `FORK.md` |
| ✅ | **T0.0 目录合并**：代码 + 文档同处 `interest/moobile/`，模块名 `XiLaiTL/moobile`，`style/` 已公开，原 `moobile_demo/` 不存在 | 本文件 T0.0 |
| ✅ | **T0.1 清诊断脚手架** / **T0.3 建仓**：`moon check` 0 错误、`node _verify.js` 26/26、`git log` 一条初始提交 `0021283` | 本文件 T0.1 / T0.3 |
| ❌ | **移植 yi 本身** | ← 剩下的主要工作 |

**一句话**：地基与验证都通了，**正题（把 yi 搬过来）还没开始**。

---

## 1. P0 — 清理与固化（预计半天 ~ 一天）

- [x] **T0.0 目录合并：把实现搬进 `interest/moobile/`，取消 `moobile_demo`** ✅ **已完成（2026-09）**

  **结论**：`interest/moobile_demo/` 已不存在，代码与文档同处 `interest/moobile/`；
  模块名 `XiLaiTL/moobile`；`internal/style/` 已提为公开包 `style/`，
  `demo/moon.pkg` 里已无任何 `internal/`；`_tools/*.py|*.ps1` 与 `_r1.js` / `_verify.js`
  的路径改成**从脚本位置推导**，不再写死盘符。
  实测：`moon check --target js` **0 错误 / 19 警告**；`node _verify.js` **26 / 26**。

  **★ style 提公开的效果有硬证据了**：新增 `_tools/check_external.sh`
  —— 它在一个临时 `moon.work` 工作区里编译一个**真正的外部模块** `probe/app`
  （`_tools/ext_probe/`），该模块依赖 `XiLaiTL/moobile/moobile` + `style` + `html` + `cmd`
  并写出完整的 模型/更新/视图 + `@moobile.mount(...)`，**0 错误通过**。
  （`demo/` 在模块内部，它编译得过证明不了这件事。）
  两个已知坑记在 `_tools/ext_probe/README.md`：① 库本体是 `XiLaiTL/moobile/moobile`，
  `XiLaiTL/moobile` 是模块根包；② `render_node` 的公开签名里含 `@vdom.VNode`（internal），
  实测不阻断外部使用者，但要等 `internal/vdom` 拆包才彻底干净。

  > 搬迁踩到的坑（下次搬目录可复用）：Metro/Gradle 守护进程会把**父目录**锁住，
  > 表现为 `mv: Permission denied`；`_tools/probe_cwd.ps1` 能直接列出
  > 「CWD 扎在该目录里的进程」（读 PEB 的 CurrentDirectory，含受保护进程之外的全体）。
  > 实在解不开时，可以**不动目录名本身**，把子项逐个 `mv` 进新目录
  > （子项可改名，父目录被锁也不影响）。

  ### 为什么

  `moobile_demo` 这个名字**是错的** —— 它里面装的是**库本体**（不只是一个 demo）。
  而且设计文档与代码分家会漂：事实上 `docs/DESIGN.md` 现在就需要修订
  （本次实测推翻了 §3.1 的 `Text` 草图、推翻了 §8 Q6 的结论、修正了 F3 的说法）。

  **📌 进度：全部搬完。** 现在的实际状态：

  | 目录 | 现在装着什么 |
  |---|---|
  | `interest/moobile/` | **文档 + 代码同在**：`README.md`(实现说明) + `PLAN.md` + `DEV.md` + `FORK.md` + `docs/{DESIGN,EVIDENCE,DESIGN-README}.md` + `moon.mod` + vendor fork + `moobile/` + `style/` + `demo/` + `host/` + `_tools/` + `_r1/` |
  | `interest/moobile_demo/` | **已删除** |

  ### 硬约束（决定"能怎么分"）

  `internal` 的可见性**按模块判**，实测报错原文：

  ```
  Cannot import internal package ... due to internal visibility rules
  ```

  所以 **vendor 的 rabbita fork 必须和库在同一个模块里**，不能拆成两个模块。
  （想拆得先分包，收益 0 字节 —— 论证见 `README.md` 的「第 (3) 项」一节。）

  ### ★ 顺带必须一起修：`style` 的可见性

  现在 `demo/moon.pkg` 里有：

  ```
  import {
    "moobile/moobile_demo/moobile" @moobile,
    "moobile/moobile_demo/internal/style",     ← ⚠ 外部模块拿不到
    "moobile/moobile_demo/internal/runtime",   ← ⚠ 只是诊断计数，T0.1 会删掉
    "moobile/moobile_demo/html",
    "moobile/moobile_demo/cmd",
  }
  ```

  **`style` 是使用者写视图的公开 API**（谁都要写 `@style.Style::new().font_size(16.0)`），
  可它躺在 `internal/` 里 —— 这意味着**现在这个库别的模块根本用不了**。

  目标是"跨端平台"，使用者必须能在自己的模块里依赖 moobile，所以这一步不能省：
  **`internal/style/` → 公开包 `style/`**，并更新所有引用：

  | 引用方 | 文件 |
  |---|---|
  | `internal/vdom` | `moon.pkg` + `vdom.mbt`（`@style.StyleValue`）、`diff.mbt`、`ssr.mbt` |
  | `html` | `moon.pkg` + `attrs.mbt`、`html_utils.mbt`、`event_decoders.mbt` |
  | `svg` | `moon.pkg` + `attrs.mbt` |
  | `moobile` | `moon.pkg` + `render.mbt` |
  | `demo` | `moon.pkg` + `ui.mbt`、`r1.mbt` |

  所以 **T0.1 里的"删 `internal/runtime` 诊断"和这一步是同一件事的两半**，可以合并做。

  ### 目标结构

  ```
  interest/moobile/                     ← 项目根 + git 仓库
  ├── README.md                         ← 实现说明（就是现在的 moobile_demo/README.md）
  ├── PLAN.md  DEV.md  FORK.md
  ├── docs/
  │   ├── DESIGN.md  EVIDENCE.md        ← 设计文档（原样搬入）
  │   └── DESIGN-README.md              ← 原 moobile/README.md（设计期导读，留档）
  ├── moon.mod                          ← 模块 XiLaiTL/moobile
  ├── moobile/                          ← 库：render / host / app / store / schedule
  ├── style/                            ← ★ 公开包（从 internal/style 提出）
  ├── internal/  html/  cmd/  sub/  dom/  svg/ …   ← vendor 的 rabbita + 库内部
  ├── demo/                             ← 演示应用（待办 + R1 样本）
  ├── host/                             ← Expo 宿主
  └── _tools/  _verify.js  _r1.js  _r1/  build.sh
  ```

  ### 步骤

  1. **停掉会锁文件的东西**：Metro（`npx expo start` 那个进程）。模拟器可以先留着。
  2. **搬文件**（同一分区内是 rename，很快）：
     ```bash
     cd /d/ai_project/interest
     mkdir -p moobile/docs
     # 📌 文档那一半已经搬完了（2026-09）——下面这些**不用再做**：
     #    moobile/README.md              ← 已是实现说明
     #    moobile/PLAN.md DEV.md FORK.md ← 已就位
     #    moobile/docs/DESIGN.md EVIDENCE.md DESIGN-README.md ← 已就位
     # 现在只需要搬**代码**（含隐藏文件）：
     cd /d/ai_project/interest
     shopt -s dotglob
     mv moobile_demo/* moobile/
     rmdir moobile_demo
     ```
     ⚠️ `moobile_demo/README.mbt.md` 是 **vendor 的 rabbita 自带的**（README 形式的测试），
     会跟着代码一起搬过去，别删也别改。`_tools/` 与 `_r1/` 也属于代码侧，一起搬。
     ⚠️ 搬之前先**停掉 Metro**（它锁着 `host/` 下的文件）。
  3. **改模块名**：`moon.mod` 里 `name = "moobile/moobile_demo"` → `name = "XiLaiTL/moobile"`，
     然后全局替换 import 里的模块名前缀：
     ```bash
     cd /d/ai_project/interest/moobile
     grep -rl 'moobile/moobile_demo' --include=moon.pkg --include=*.mbt . \
       | xargs -r sed -i 's|moobile/moobile_demo|XiLaiTL/moobile|g'
     ```
     ⚠️ **同时必须更新 `FORK.md` §1 的重放命令**（那里写的是旧模块名）——
     跟版脚本和新版 rabbita 重放都要用新名字。
     ⚠️ 根包别名要复查一次（改名前缀会改掉推导出的别名，见 `FORK.md` §1 第 5 步）。
  4. **`internal/style` → `style/`**：`git mv`/`mv` 目录，然后改上表那 5 个包的 `moon.pkg` 与源文件引用，
     并确认 `demo/moon.pkg` 里**不再出现任何 `internal/`**。
  5. **改硬编码路径**（搬完必漏的地方，逐个 grep）：
     ```bash
     grep -rn "moobile_demo" _tools/ *.js *.sh *.md | grep -v '^Binary'
     ```
     - `_tools/tap_r1.py`、`scroll_r1.py`：`ADB` 与 `OUT` 里的 `D:/ai_project/interest/moobile_demo/...`
     - `_tools/link_builddirs.ps1`：`$root = 'D:\ai_project\interest\moobile_demo\host'`
     - `_tools/migrate_c_to_e.ps1`：只涉及 C/E 盘，**不用改**
     - `_r1.js`：`OUT` 常量
     - `DEV.md` / `PLAN.md` / `README.md` / `FORK.md` 里的路径引用
  6. **验证**（见下"完成判据"）。
  7. **顺手做 T0.1 + T0.3**（删诊断脚手架、`git init` + 首次提交）。

  ### 完成判据

  - [x] `interest/moobile_demo/` **不存在** ✅
  - [x] `cd interest/moobile && moon check --target js` → **0 错误**（19 警告，都是既存的
        `unused_package` / `deprecated` 之类，非本次引入）✅
  - [x] `demo/moon.pkg` 里**没有任何 `internal/`** ✅（`moobile/moon.pkg` 仍 import
        `internal/vdom`、`internal/runtime` —— **这是应该的**：`moobile/` 就是库的实现本体，
        它在同一模块内当然可以用 internal。）
        **"外部使用者不需要 internal" 这一条另有硬证据**：`bash _tools/check_external.sh`
        在临时工作区里编译真外部模块 `probe/app`，**0 错误通过**。
        要不要分模块见下面「为什么现在不做"库与应用分模块"」。
  - [x] 从新路径起 Metro，`node _verify.js` → **26 / 26** ✅
  - [x] `bash _tools/android_env_setup.sh --check` → 全 ok ✅
  - [x] `_tools/android_env_setup.sh` 里若引用了绝对路径也已更新 ✅
        （复核结论：**它本来就全是相对路径**，`ROOT="$(cd "$(dirname "$0")/.." && pwd)"`，无需改）
  - [x] `grep -rn moobile_demo .` 只剩**历史叙述**，没有活路径 ✅
        残留全部落在 `PLAN.md` 自身（T0.0 的任务描述 + 本节结论）与 `README.md` 那一句
        「原 `moobile_demo/` 已不存在」；**代码 / 脚本 / `_tools/` / `host/` 里已是 0**。
        唯一例外是 `host/android/` 下的 Gradle/CMake 缓存（生成物，已删掉写死旧路径的
        `app/.cxx`；`host/android/` 整个是 gitignore 的，下次构建自动重建）。
  - [x] `git status` 干净，有一条初始提交 ✅ → 见 **T0.3**

  ### 搬迁会碰坏什么（都在这张表里）

  | 项 | 影响 |
  |---|---|
  | **目录联接**（10 个 build 目录 + SDK + AVD） | ✅ **不受影响**：联接的目标是 E 盘的绝对路径，链接节点随父目录一起移动 |
  | Metro / Expo dev server | ⚠️ 必须从新路径重启 |
  | 模拟器里正在跑的 app | ⚠️ reload 即可（JS 未变） |
  | Gradle 增量缓存 | ⚠️ 路径变了会重新配置，慢一次，无碍 |
  | `_tools/*.py` / `*.ps1` 的绝对路径 | ⚠️ 必须改，见步骤 5 |
  | 四份文档里的路径引用 | ⚠️ 必须改 |
  | `FORK.md` 的重放命令 | ⚠️ 必须改（模块名） |

  ### 别做

  - **不要在搬完后跑 `npx expo prebuild`** —— 它会覆盖 Android 配置（Gradle 版本会退回 9.3.1，
    构建必然失败）。真跑了就 `bash _tools/android_env_setup.sh` 修回来。
  - **不要试图把 fork 拆成独立模块** —— `internal` 按模块判，拆了库就 import 不到 `vdom`。

  ### 为什么现在不做"库与应用分模块"

  那是**终局形态**（别人能 `moon add` 然后用），但前提是公开 API 齐全 ——
  也就是上面第 4 步。**建议先按"一个模块"搬到位，同时把 `style` 提公开**，
  这样将来要分模块随时能走，而且不用再搬一次目录。

- [x] **T0.1 清掉调试脚手架** ✅ **已完成（2026-09）**
  删掉 `demo/main.mbt` 里的 `demo_ops` / `demo_updates` / `demo_handlers` 三个诊断导出、
  `demo/moon.pkg` 里对应的 exports、`host/App.js` 里的 `globalThis.__moobile*` 挂载、以及 `_diag.js`。
  ⚠️ 保留 `demo_unsupported` 与 `demo_unmapped`（验证脚本要用）。
  **判据**：`moon check --target js` 0 错误；`node _verify.js` 仍 26/26。
  **结论**：`_verify.js` 只用到 `Unsupported` / `Unmapped` / `UnmappedNames`，
  删掉那三个不影响它；实测 `moon check` 0 错误、`_verify.js` 26/26（0 错误）。
  顺带：`demo/moon.pkg` 里的 `internal/runtime` import 也随之消失，demo 侧已零 `internal/`。

- [ ] **T0.2 把 R1 的测量固化成安卓端断言脚本**
  现在 `_tools/tap_r1.py` / `scroll_r1.py` 只是"打印测量值"，没有断言。
  改成 `_tools/verify_android.py`：解析 `uiautomator dump`，对 `docs/FINDINGS.md`「R1 判决」那张表逐项断言
  （爻辞 2 行、小象 2 行、折叠箭头宽 ≈10dp、爻画列 ≈160dp、间距 ≈26dp），最后打印 `N/N 通过`。
  **判据**：`python3 _tools/verify_android.py` 输出 `通过 N / N`，退出码 0。

- [x] **T0.3 初始化 git 仓库** ✅ **已完成（2026-09）**
  仓库根 = 模块根 = `interest/moobile/`（`git init -b main`），一条初始提交，
  260 个文件入库（含 vendor 的 rabbita 源码与 `_r1/` 测量证据）。
  `.gitignore` 要点（都已在文件里写明理由）：
  `_build/`、`.mooncakes/`、`host/node_modules/`、`host/.expo/`、`host/dist/`、
  `host/android/`（prebuild 生成；已知良好副本 `_tools/android-config/` 是入库的）、
  `host/moobile.js`（构建产物）、`*.apk`/`*.aab`、`shot-*.png`（`_verify.js` 每次重截）。
  **判据**：`git status` 干净 ✅；`git log` 一条初始提交 ✅。
  **额外处理**：删掉了 `host/.git`（Expo 模板留下的一次性嵌套仓，只有一条 16 文件的初始提交，
  留着会让 `host/` 在父仓里变成 gitlink、源码反而不入库；工作区文件原样保留）。

---

## 2. P1 — 把 R1 样本扩成"整卦可浏览页"（预计 1–2 天）

目标：乾卦**一整卦**在真机上可完整浏览与交互。这一步刻意不碰罗盘。

- [ ] **T1.1 卦头**：卦名 / 卦画（六条爻线竖排）/ 卦辞 / 彖传 / 大象
  数据取自 `_r1/qian_yao.txt` 与 `reader_data.json` 的真实内容。

- [ ] **T1.2 六爻列表**：已有 `demo/r1.mbt` 的 `r1_yao()`，把它接到真实数据（现在是硬编码 6 条）

- [ ] **T1.3 折叠交互：`<details>/<summary>` → 受控组件**
  yi 用 `<details>`（RN 无此语义），但**开合状态本来就在 Model 里**（`is_open` / `xiao_open`），
  所以只需换成受控的 `Pressable` + 条件渲染。
  **判据**：真机上点击展开/折叠，`uiautomator` 断言文本出现/消失。

- [ ] **T1.4 用 / 文言 / 系辞引述区块**（`.m-weny-box` / `.m-cite` 样式已在样本里）

**P1 完成判据**：乾卦整卦在模拟器上可从头滚到尾，折叠可用，无裁切、无重叠、无 panic。

---

## 3. P2 — 样式层：把 6 个"结构性问题"落地（预计 2–3 天）

来源：`_r1/style_gap.md` 的「⚠️ 结构性问题」一节。这些**不是"加个属性"能解决的**。

- [ ] **T2.1 网格助手（yi 里 9 处）**
  CSS `display:grid; grid-template-columns: repeat(auto-fill, minmax(116px,1fr))` 在 RN 没有稳定对应。
  做 `Style::grid_row(...)` 之类的助手，内部降级成 flex + 等分/固定列宽。
  **判据**：`style_gap.md` 里 grid 项从「结构性问题」移入「已覆盖」。

- [ ] **T2.2 `transform` 通道（yi 里 3 处）**
  RN 要**结构化数组** `[{translateY:-1}]`，而当前样式通道是扁平 `(key, StyleValue)`，**装不下**。
  需要 `StyleValue::Transform(Array[(String, Double)])` 之类的新构造器（`variant` 也装不下数组）。
  **判据**：`Style::translate_y(-1.0)` 可用，真机上位移生效。

- [ ] **T2.3 `box-shadow` 复合助手（yi 里 3 处）**
  RN 拆成 `shadowColor/shadowOffset/shadowOpacity/shadowRadius` + Android 的 `elevation`（**非单值**）。
  做 `Style::shadow(...)`，内部展开成这几个属性。
  **判据**：两端都有阴影效果（Android 用 elevation）。

- [ ] **T2.4 伪元素 `content` → 真实组件（yi 里 4 处）**
  折叠箭头已经是文本方案（`▾`/`▸`），其余逐个改成真实子组件。

- [ ] **T2.5 `:hover` 19 处的决策**
  触屏**没有 hover**。两条路：(a) 用 `Pressable` 的 `onHoverIn/Out` + 状态（只在 Web/桌面有意义）；
  (b) 放弃。**这是个决策点，写清理由后记进 `README.md`。**

- [ ] **T2.6 `@media` 断点进 Model（yi 里 2 处：760px / 640px）**
  RN 没有 `@media`。用 `useWindowDimensions` 把宽度喂给 Model，断点变成**可测试的状态**。
  **判据**：窄/宽两种窗口尺寸下排版不同且都正确（Web 上改窗口宽度验证）。

- [ ] **T2.7 滚动边界普查**：确认所有可能超屏的区域都套了 `ScrollView`
  （R1 样本踩过一次：整页 1632dp 超出 844 视口，RN 的 `View` 不滚动）。

---

## 4. P3 — 罗盘：canvas → Skia + 手势（预计 3–5 天，**最难的一块**）

yi 的罗盘是 `<canvas>` 画出来的。RN 无 canvas。

- [ ] **T3.1 装 `@shopify/react-native-skia`**
  ⚠️ 这是原生依赖 → 要 `expo prebuild` + 重建 APK；**prebuild 之后必须重跑
  `bash _tools/android_env_setup.sh`**（否则 Gradle 版本会被改回 9.3.1，构建必挂）。

- [ ] **T3.2 设计 moobile 的"画布"通道**
  Skia 在 RN 里是**组件**（`<Canvas><Path/></Canvas>`），不是样式。所以需要一个新通道：
  要么给标签表加 `canvas`（但绘制指令无法用 props 表达），要么让 moobile 提供专门的组件映射。
  **这是本阶段的设计核心，先写方案再动手。**

- [ ] **T3.3 把 18 个 canvas 调用映射成 Skia 绘制**
  好消息：`EVIDENCE.md` D1 已量过，yi 的 canvas API 面**只有 18 个调用**，
  且**无渐变 / 无阴影 / 无虚线 / 无贝塞尔 / 无 `globalAlpha`**，文字宽度是估算而非测量。
  **判据**：罗盘在真机上正确绘制、旋转、点选卦象。

- [ ] **T3.4 手势：`on_mousedown/move/up` → RN 手势系统**
  ⚠️ **重要**：我们的事件解码透传表让 `Mouse`/`Keyboard`/`Scroll` 在 RN 上返回**零值**
  （见 `html/event_decoders.mbt` 的注释）—— 也就是说**读坐标的处理器在 RN 上拿不到真实数据**。
  正确做法不是修 `Mouse`，而是**给 moobile 加一条真正的手势通道**
  （直接用 `PanResponder` 或 `react-native-gesture-handler`），不复用 rabbita 的 `Mouse` 类型。
  **判据**：拖拽罗盘能连续跟手。

- [ ] **T3.5 坐标换算**：canvas 的 CSS 尺寸 → 屏幕 dp → `devicePixelRatio`。
  yi 里已有 `prepare_canvas` 处理 `devicePixelRatio` 的先例（`EVIDENCE.md` D6）。

---

## 5. P4 — 数据接入（预计 1–2 天）

- [ ] **T4.1 移植 `yi/shared`**（196 行纯 MoonBit 数据模型）
- [ ] **T4.2 `reader_data.json`（695KB）怎么进 app**
  两条路：(a) 运行时 `expo-asset` 读取 + MoonBit 解析；
  (b) **编译期转成 MoonBit 字面量/二进制**，运行时零解析。
  倾向 (b)：启动更快、无 JSON 依赖。**先量一下 (b) 的编译产物会有多大。**
  **判据**：真实数据在真机上正确显示，启动时间可接受。

---

## 6. P5 — 完整移植与验收（预计 3–5 天）

- [ ] **T5.1 逐块移植 `yi/frontend/main.mbt`（2363 行）的视图**
- [ ] **T5.2 198 条 CSS → 类型化样式**
  这是**最大的机械工作量**。考虑写个一次性转换脚本（CSS 规则 → `Style::...` 调用），
  把 `_r1/yi_yao_css.txt` 那种抽取结果喂进去。人工只处理那 6 个结构性问题。
- [ ] **T5.3 扩展验证脚本**：把关键交互都写成 `uiautomator` 断言，形成安卓端回归套件
- [ ] **T5.4 真手机验证**（不只模拟器）：Expo Go 扫码，或编 release APK 装机
- [ ] **T5.5 性能观察**：整树重建 + React 全树 diff 在**长列表**上的代价
  （DESIGN §4.3 判断"低更新频率没问题"，需要用真实卦例量一下并记录）

**P5 完成判据（= 总目标）**：yi 在真手机上可完整阅读 —— 卦列表、六爻、注疏、罗盘全部可用。

---

## 7. P6 — 工程化（预计 1–2 天）

- [ ] **T6.1 把 `FORK.md` 的重放步骤写成脚本**（拉新版 rabbita + 自动重放我们的 diff）
- [ ] **T6.2 上游化提案**：按 `FORK.md` §3 的顺序提给 rabbita（最小、可独立接受）
- [ ] **T6.3（可选）CI**：`moon check` + `node _verify.js`

---

## 8. P7 — 发布为库（对外可用，预计 1–2 天）

> **完整分析见 `docs/ARCHITECTURE.md`** —— 那一份有实测体检（`moon package --list` 的体积账、
> 外部模块 check/build 的通过记录）、三种发布形态的对比与全部待拍板项。这里只放任务清单。

**目标**：别人能 `moon add <ns>/moobile`，照文档接一个 30 行的宿主，就把界面跑起来。

- [x] **T7.1 发布卫生** ✅ **已完成（2026-09）**
  - `moon.mod` 补 `readme` / `repository`（`moon package` 现在会告警这两个字段）
  - 模块根补 `LICENSE`（我们自己的）+ `THIRD-PARTY-NOTICE`（rabbita 的 Apache-2.0 版权与许可原文，
    我们改了它，需按 Apache-2.0 §4 保留声明并说明修改 —— 改动清单就是 `FORK.md`）
  - 加 `.moonignore`：现在会发布 **262 个文件 / 867 KB**，其中 `host/` 就占 **41%**（741 KB，
    含 Expo 的 `package-lock.json` 与 6 张图标），还混进了 `_r1/`（测量证据）、`_tools/`、`docs/`、`demo/`、`_verify.js`
  - **判据**：`moon package --list` 只剩库文件（vendor + `moobile/` + `style/`），
    不再有 `readme`/`repository` 告警，zip 明显变小

- [x] **T7.2 形态 B：把库提到模块根** ✅ **已完成（2026-09）**
  改之前 `import { "XiLaiTL/moobile" @moobile }` 拿到的是 **rabbita 的主包**（`App`/`run`），
  调 `@moobile.mount` 会报 `Value mount not found in package 'moobile'`（实测踩过）。
  **做法**：vendor 根包（`top.mbt incremental.mbt deprecated.mbt tea.mbt render_test.mbt
  README.mbt.md` + 根 `moon.pkg`）挪进 `internal/rabbita/`；`moobile/*.mbt` 提到模块根；
  改 2 处引用（`html/moon.pkg` 的 `for "test"`、`server/moon.pkg`）。
  ⚠️ **`README.mbt.md` 与 `render_test.mbt` 必须跟着走** —— 它们是 vendor 的 README 测试与根包单测，
  留在模块根就会变成**我们库的**测试文件（里面的 `@rabbita` 引用编不过）。
  - **判据**：`moon check --target js` **0 错误** ✅；`node _verify.js` **26 / 26** ✅；
    `_tools/ext_probe/app` 用**裸模块名**导入后 `check_external.sh` **通过** ✅
  - **顺带**：模块名同时定为 `XiLaiTL/moobile`（mooncakes 账号 `XiLaiTL`），
    全仓 24 个源码文件 + 文档 + 探针的模块路径前缀已同步。

- [ ] **T7.3 对外契约写进 `README.md`**（半天）
  宿主 4 件套（`react` / `components` / `scheduleTask` / `scheduleFrame`）+ **必须提供的 5 个组件**
  （`View` `Text` `Pressable` `TextInput` `ScrollView`）+ 应用侧的链接导出四件套 +
  **事件载荷在 RN 上是零值**这件事 + 只支持 `js` target。
  - **判据**：README 里有可直接复制的 MoonBit/JS 两侧样板（`docs/ARCHITECTURE.md` §6 已拟好）

- [~] **T7.4 发布演练**：`--dry-run` ✅ 已过；**正式发布尚未执行**（等确认）。
  - **判据**：装回来的模块能 `moon check` 通过 —— 发布链路闭环（本地 `moon.work` 验证过的是编译面，
    注册表的下载/解包还没验过）

- [ ] **T7.5（可选）裁掉 vendor 死重**：`server/ http/ websocket/ nav/ url/ dialog/ clipboard/ svg/`
  对 RN 使用者没用（`svg` 连标签表都排除了；`moonback` 依赖只被 `server/` 用）。
  收益是体积与依赖，代价是 fork 的 diff 变大、跟版更麻烦。
  - **判据**：发布体积与依赖树都下降，且 `moon check` / `_verify.js` / `check_external.sh` 三绿

- [ ] **T7.6（可选）宿主脚手架**：`App.js` 模板或 `@<ns>/moobile-host` npm 包
  - **判据**：新项目 5 分钟能从零跑起来

---

## 9. 已知风险与决策点

| # | 风险 / 决策 | 说明 | 何时决定 |
|---|---|---|---|
| Q1 | **P3 会不会推高成本** | Skia + 手势是唯一"一张标签表搞定"不成立的地方。如果成本失控，需要重新评估 DESIGN §8 Q4（引入 RN 导航/手势库后状态如何与 TEA 共存） | P3 开始前 |
| Q2 | **`:hover` 与 `::before` 要不要保** | 触屏没有这两个概念。保 = 只在 Web 有意义；不保 = 触屏与 Web 表现一致 | P2 的 T2.4/T2.5 |
| Q3 | **上游化 vs 长期 fork** | 当前 diff 很小（`FORK.md` 有清单），越晚上游越贵 | P6 |
| Q4 | **样式改写能否脚本化** | 198 条 CSS 手工改是几天的工作量；脚本化可能省一半，也可能更慢 | P5 的 T5.2 开始前 |
| Q5 | **`Mouse` 载荷通道** | 见 T3.4。**不要试图"修好" `Mouse`** —— 那是在 RN 上模拟 DOM 事件，走反了 | P3 |
| Q6 | **发布成库的形态与命名** | 见 `docs/ARCHITECTURE.md`：模块名第一段必须是 mooncakes 账号名（`XiLaiTL/moobile` 未必发得出去）；形态 A/B/B′/C 选哪个；要不要裁掉 10 个死重包 | **P7 动手前**（发文前定名，否则路径就被别人依赖住了） |

---

## 9. 两条纪律（容易违反，写在这里）

1. **不实现渲染。** 凡是 React Native / RNW 已有的能力，moobile 只用不造。
   一旦开始写布局、文字排版、组件库、画布引擎 —— 立刻停手，改成"接 RN 生态"。
   （这是 DESIGN §10 原则 1；罗盘接 Skia 而不是自己画，就是这个意思。）

2. **先验证未知量，再动手。** 当前未知量已经是"工程成本"而不是"架构可行性"，
   所以每开一块新能力（Skia、手势、数据），**先写一个最小验证**再铺开。

---

## 10. 建议的执行顺序

```
T0.0 目录合并 ✅ 已完成      ← moobile_demo → moobile/，style 提为公开包
  ↓
P0 其余清理固化 —— T0.1 ✅ / T0.3 ✅ 已完成，剩下 T0.2（安卓端断言脚本）
  ↓
P1 整卦静态页（1–2天）  ← 不碰罗盘，最快能看到"像 yi 了"
  ↓
P2 样式结构性问题（2–3天）
  ↓
P4 数据接入（1–2天）    ← 可以和 P1/P2 并行，先把真实数据接上更好验证
  ↓
P3 罗盘 + 手势（3–5天）← 最难，放在样式层稳定之后
  ↓
P5 完整移植与验收（3–5天）
  ↓
P6 工程化（1–2天）
  ↓
P7 发布为库（1–2天）❖     ← 别人能 moon add 用上；分析见 docs/ARCHITECTURE.md
```

> ❖ P7 不依赖 P1–P6，**随时可以插队做**（它改的是元数据/目录名/契约文档，不碰渲染逻辑）。

**粗估 2–3 周**（不含真机调试的意外）。其中 P3 的不确定性最大。

**下一步入口**：`T0.2`（可选，半天内）→ 然后 `T1.1`（卦头）。
起环境看 `DEV.md` §3；改完 MoonBit 记得 `./build.sh`，验证用 `node _verify.js`。
