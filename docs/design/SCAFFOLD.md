# SCAFFOLD —— moobile 脚手架设计

> 状态：**设计稿（待决策项已标出）**。本文只回答一件事：
> **一个从没接触过 moobile 的人，怎么在最短时间内得到一个能跑的项目，而且全程不需要装 Python。**
>
> 背景见 [`../../PLAN.md`](../../PLAN.md) 的 E 轨道（脚手架）、H 轨道（接入收敛，**已完成**）。
> 本文是 E 轨道的落地设计，并补上 PLAN 里没写的那半：**工具用什么语言写、按什么原则分**。

---

## 1. 目标与验收判据

### 1.1 目标（一句话）

> **一台只有 `moon` 和 `node` 的机器，三条命令之内跑起来一个 Todo；任何一步都不提示装 Python。**

三条命令指：

```bash
npx create-moobile-app my-app     # 或 npx moobile-host init my-app（见 §4 决策 D1）
cd my-app && npm install
npm run web                       # 或 npm run android
```

### 1.2 验收判据（每条都要能跑出一条命令来证明）

| # | 判据 | 怎么验 |
|---|---|---|
| **S1** | 干净机器能跑通：只装 moon + node | 在一次性的干净环境里按 §1.1 走完，页面渲染出内容 |
| **S2** | **全流程零 Python** | 在同一次干净环境里跑完整流程；对生成的工程与工具链 grep `python`，命中的只能是"说明性文字"，不能是执行路径 |
| **S3** | 环境缺什么，报错要**直接说装什么** | 缺 moon / 缺 node / 版本过低 / 缺 adb → `doctor` 与各命令都给出可照抄的修复命令（不是抛栈） |
| **S4** | 生成的项目就是我们验过的那条链路 | 模板是唯一真源、demo 由它派生（见 §3.4）；`verify_all.sh` 的 T1 按 `deltas` 清单发现清单外漂移 |
| **S5** | 生成后立刻能做开发闭环 | 改一行 `view` → 重新构建 → 页面变；`npx moobile-host regen` 在加能力后仍然一致 |
| **S6** | 契约不匹配时**当场**失败并说清版本 | 库 `handles.contract` 与宿主 `CONTRACT` 不等 → 报出两个版本号（**已有**，见 §5.2） |

**S2 是这次设计的核心动机**：现在的仓库工具里有 **8 个** Python 脚本（见 §4.4），它们不是"消费者的依赖"，
但一旦写进文档、CI、脚手架，就变成了事实上的依赖。**"不需要 Python"必须是可执行的判据，而不是口号。**

---

## 2. 现状盘点（哪些已经是真的）

| 能力 | 现状 | 证据 |
|---|---|---|
| 库（MoonBit 侧） | 已发布 `XiLaiTL/moobile@0.2.2`，应用侧**一个导出** | [`../../README.md`](../../README.md) §1.1 |
| 宿主（JS 侧） | 已发布 npm 包 `moobile-host@0.2.0`：实现 `MOBILE_HOST` 契约、组件表、调度钩子、后端地址 | `npm/moobile-host/index.js` |
| 契约版本比对 | ✅ `CONTRACT = 1`，不符即报两个版本号 | `index.js` 的 `checkContract` |
| 能力注册表 | ✅ `npx moobile-host regen` 读应用 `package.json` → `registry.generated.js`（`--check` 可比对） | `npm/moobile-host/bin/cli.js` |
| 参考实现 | ✅ `examples/apps/todo-app/`：本地库 + 网络同步 + 多页面 + MoonBit 后端，四道门全过 | [`../FINDINGS.md`](../FINDINGS.md) R2 |
| 消费者手写代码量 | **4 行 `App.js`** + 一个 `moon.pkg` 的 import 块 | `examples/apps/todo-app/host/App.js` |
| 模板工程 | ⏳ **纸面**：`examples/apps/template/` 尚不存在 —— 它就是**最小工程本身**（§3.4）。2026-09 **推翻"参数化 demo"为"模板是独立真源、demo 是派生用例"**。⚠️ `tools/template/` 是**生成器的配置与说明**，不是模板的住处 | —— |

**缺的是"把上面这些拼成一个新项目"的那一层**（E 轨道），以及"环境自检"与"升级路径"。
**`examples/apps/template/`、生成器、`doctor`、T1/T3、`postadd` 钩子这五项目前一行代码都没有** ——
本文是设计稿，不是进度报告。

---

## 3. 生成物设计

### 3.1 目录结构（生成出来的样子）

```
my-app/
├── moon.mod                  ← 独立 module（**不是**库模块里的包）
├── moon.pkg                  ← 5 条 import（库本体 / style / html / cmd / sub）
├── app.mbt                   ← Model / Msg / init / update / view / subscriptions
├── App.js                    ← 宿主侧全部手写代码（4 行）
├── index.js                  ← registerRootComponent(App)，Expo 的入口约定
├── registry.generated.js     ← 生成物（regen 产出，入库）
├── package.json              ← 依赖：moobile-host、expo（由 --host 决定）
├── metro.config.js           ← 让 Metro 认 MoonBit 的 ESM 产物
├── app.json                  ← Expo 配置（由 --host 决定）
├── .gitignore                ← 含 `moobile.js`（构建产物）与 `_build/`
└── README.md                 ← 三条命令 + 环境要求（moon + node）
```

**生成物是平铺的，没有 `host/` 这一层**（demo 真身是 `examples/apps/todo-app/host/`）。
`host/` 是 Expo 的 `create-expo-app` 强加的定位，我们的生成器没有理由复刻它 ——
这个差异因此必须进 T1 的 `deltas` 清单（见 §3.4），不能靠"逐文件比对"自然对上。

`moon.pkg` 那 5 条 import 是**模板的下限**。demo 真身是 **7 条**（多出 `sqlite` 与 `http`，
对应网络同步与本地库），差异同样进 `deltas` 清单。

**为什么应用是独立 module**：`moon.mod` 的 import 是模块粒度且随包发布 ——
应用若塞进库模块，应用的依赖就变成**所有使用者的下载量**（实测记载见 [`../FINDINGS.md`](../FINDINGS.md) R3）。
生成物必须是独立模块，这一条没有选择余地。

### 3.2 生成物的"唯一手写面"

生成完之后，开发者真正要写的是：

| 文件 | 手写量 | 说明 |
|---|---|---|
| `app.mbt` | 全部业务代码 | `view` 用 `@html`，样式用 `@style` |
| `App.js` | **4 行** | `mountApp(app, { registry })`，不手写契约 |
| 其余 | **0 行** | 生成即用 |

这条线是 H 轨道挣来的：宿主胶水从 ~40 行降到 0，应用样板从 ~30 行降到 1 个导出。

### 3.3 可配置维度：**宿主**，不是平台

PLAN §1.2 已定的结论，这里只落地：**支持一个新平台 = 换一个宿主 npm 包**，不是改库。

```
--host expo      (默认)   Expo 宿主：android / ios / web 三端一次到位
--host webview   (后续)   PWA / Tauri / Electron 外壳，复用同一份 Web 产物
--host rn-bare   (后续)   不带 Expo 的裸 RN 宿主（桌面/版本冲突时用）
```

脚手架**只**负责：选宿主 → 装对应 npm 依赖 → 写对应 `App.js`/`package.json`/`app.json`。
MoonBit 侧（`moon.mod` / `moon.pkg` / `app.mbt`）在任何宿主下**完全一样** ——
这是"宿主是可替换件"的可执行证明。

### 3.4 模板机制：**模板是真源，demo 是它的最大测试用例**

moon **没有**模板机制（`moon new` 只生成内置脚手架，无 `--template`，实测见 PLAN §1.1），
所以模板得我们自己实现。**关键设计决定：真源是模板本身，不是 demo。**

> ⚠️ 这一节在 2026-09 被**推翻重写过一次**。原方案是"参数化 `examples/apps/todo-app/`"，
> 即 demo 当真源、模板从它派生。推翻的理由是实测出来的三条硬差异（见下），
> 以及一个方向性错误：**让 demo 当真源，等于让 demo 的演进方向变成所有生成项目的演进方向。**

原方案的两条理由本身都对 —— **两份手写的同类文件必然漂移**，漂移只会以"用户拿到一个跑不起来的
项目"的形式暴露。但它们推出的是"**一份真源 + 一条闸门**"，**没有推出"这份真源必须是 demo"**。
把真源放在模板侧，两条理由照样成立，方向反了而已：

```
examples/apps/template/          ← 唯一真源：一个**真的能编译、能跑**的最小工程
        │  生成器按清单替换字面量（{{APP_NAME}} / {{HOST}} / {{MOBILE_VERSION}}）
        │
        ├──────────────────► npx create-moobile-app my-app     （消费者拿到的）
        │
        └── 生成 + deltas 清单内的差异 ──► examples/apps/todo-app/ （我们自己的用例）
```

### 3.4.1 三个目录，三件不同的事（2026-09 补：这是最容易被绕晕的一处）

**"模板"和"生成器"是两样东西，必须分开住。** 混在一个名字里过，绕晕过一次：

| 目录 | 装什么 | 谁看它 | **不**装什么 |
|---|---|---|---|
| **`examples/apps/template/`** | **最小工程本身**：`moon.mod` / `moon.pkg` / `app.mbt` / `host/**` / `.gitignore` / `README.md`。能 `moon check`、能跑起来、进 `verify_all` | 使用者（生成物的 README 就是它那份）；维护者跑它 | —— |
| **`tools/template/`** | **生成器的配置与说明**：占位符清单、`deltas.txt`、维护者怎么跑生成器 | 只给维护者 | ❌ **任何工程文件**（`app.mbt` / `App.js` / `package.json`…）。放进来就是第二份真源 |
| **`npm/moobile-host/bin/cli.js`** | `init` 子命令的**实现代码**（真正干活的） | —— | —— |

**工程只有一份，住在 `examples/` 下。** 这不是新发明 —— 这个仓库已经这么干过两次：

| 先例 | 是什么 | 怎么被用 |
|---|---|---|
| `tools/pub_probe/`（3 文件 84 行） | 一个最小 MoonBit 模块 | `check_published.sh` 把它 `cp` 到临时目录，**充当"真实的空应用"** 来验发布产物 |
| `tools/ext_probe/` | 同上，验外部模块可依赖 | `check_external.sh` |

> ⚠️ 这两个先例住在 `tools/` 里是因为它们**只为一条门存在、不打算给人跑**。
> 脚手架模板不一样：**它本身要能给使用者跑**，所以它属于 `examples/apps/`。
> 这也意味着它应该像 `todo-app` / `antd-spike` 一样 **进 `moon.work` 与 `verify_all`**。

**为什么模板必须在 `examples/apps/` 而不是 `tools/`**：

1. 它要**给使用者跑**（生成物的 `README` 就是它那份）；`pub_probe` / `ext_probe` 只为门存在、不打算给人跑。
2. 它要进 `verify_all` 的编译检查 —— 而**"能不能被编译到"这件事在这里是反直觉的**（见下）。

> ⚠️ **一条容易搞反的事实**（来自 `tools/pub_probe/moon.mod` 的注释，那里踩过）：
> MoonBit 会把**没有自己 `moon.mod` 的子目录**当成父模块的一个包 —— 于是它会被库的
> `moon check` 一起编译（多出没必要的警告），**甚至可能被 `moon package` 打进发布产物**。
> `examples/services/todo-server/` 踩过同一个坑（FINDINGS R2）。
>
> 所以隔离**靠"自己带 `moon.mod`"**，不靠 `.moonignore`（后者是**发布**过滤，不是编译隔离；
> 它列了 `/tools/`，那是"不发工具链"的意思）。模板工程**本来就**有自己的 `moon.mod`（§3.1），
> 所以它是独立 module、天然隔离 —— 但**别往 `tools/template/` 里放任何 MoonBit 源码**，
> 那里没有 `moon.mod` 挡着。

**为什么不要 `examples/services/template/`**：模板**不带后端**（§7 要最小），所以无服务可配。
而且 `services/` 的模块是 `+native`（要 MSVC 工具链）、**刻意不在 `moon.work` 里**——
把模板放进去会立刻让默认 `moon check` 依赖 MSVC。后端那个坑留给 demo
（`todo-app` + `todo-server`），不复制到模板。

### 3.4.2 模板用**真字面量**，不用占位符（2026-09 定）

模板里写的是**真值**，不是 `{{APP_NAME}}`：

```moonbit
// examples/apps/template/moon.mod —— 真名，不是 {{MODULE_NAME}}
name = "XiLaiTL/moobile-template"
```

对比：带占位符的话，这一行会变成 `name = "{{MODULE_NAME}}"`，**那就不是合法的 moon.mod 了**。

| | 用 `{{占位符}}` | 用**真字面量** + 生成器替换 |
|---|---|---|
| 模板能不能编译 | ❌ 不能（占位符不是合法标识符） | ✅ 能 |
| 能不能进 `verify_all` | ❌ 不能 —— 于是**模板本身从未被验证** | ✅ 能 |
| 忘了参数化的后果 | 不会发生（全被替换器扫过） | ⚠️ 会：demo 的名字漏进生成物 |
| 谁来兜底 | —— | **一条门**：生成后不许残留 `template` / `XiLaiTL/moobile-template` 这类字面量 |

**取舍的理由**：第一条权重最大 —— 一个**编译不过的模板**等于"我们从未验证过用户会拿到什么"，
正好违反 §3.4 的初衷。而"漏参数化"是**可检测**的（生成物 grep），代价比"模板不可验"小得多。

因此生成器要做两件事：按 `placeholders` 清单**替换**，以及**断言替换干净**（白名单之外的字面量残留即红）。

### 3.4.3 那个 `moon build` 步骤：必须在 npm script 里（2026-09 查实）

`App.js` 第 3 行 `import { app } from './moobile.js'` —— 这个文件是 `moon build --target js` 的产物
（demo 里 1.3 MB），**而 `host/package.json` 的 scripts 里没有任何一步生成它**（实测：只有
`start`/`android`/`ios`/`web`，无 `build`、无 pre/post 钩子）。demo 靠仓库内脚本：

```bash
bash tools/build.sh      # moon build --target js → cp 到 host/moobile.js
```

**这条路对使用者不可移植**：`tools/build.sh` 写死了 demo 的模块名与仓库布局，还要靠 `moon.work`。

**关键区分**（决定"要不要拷"的不是风格，是**消费者是谁**）：

| 谁在消费产物 | 怎么拿 | 为什么 |
|---|---|---|
| `antd-spike/host/verify.mjs`（跑在 **node** 里） | **直接 import `_build/js/.../<module>.js`，不拷** | node 解析任意路径。其代码注释专门写了"刻意不拷，因为拷了旧的那份是踩过的坑" |
| `todo-app/host/App.js`（跑在 **Metro** 里） | 必须先 `cp` 到宿主目录 | **Metro 只解析宿主目录内的路径** —— bundler 的约束 |

**给使用者的模板只能走 Metro 那条路**，所以搬运步骤必须变成一条 npm script
（如 `"build": "moon build --target js && node <搬运>"`），否则照 §1.1 的三条命令走完，
`npm run web` 会在 `./moobile.js` 上当场解析失败 —— **而 S1/S2/S3 全是"干净机器上跑"，这个洞正落在核心判据上**。

> 待定：搬运那一步的**最优形态**（写死路径的 `cp` 还是由 `moobile-host build` 去**发现**产物）
> 取决于"全新空目录里 `moon build` 的产物落在哪、路径可不可预测"。**这是脚手架动工前的第一个实验**，
> 它决定脚手架的形状（详见 §3.4.4）。

### 3.4.4 动工前先做的实验（顺序建议）

**先有 v0，再谈同源。** 现在是反的：`SCAFFOLD.md` 里"模板同源"的争论很细，但 `deltas` 清单
**长度其实是 0** —— 因为它比对的另一方（模板）还不存在。

建议顺序：

1. **在空目录里手动搭最小工程**（`moon.mod` + `app.mbt` + 4 行 `App.js` + `package.json`），
   把 `moon build → Metro` 这一段亲手跑通 → 回答"产物路径可不可预测"。
2. 通了，把它**搬成 `examples/apps/template/`**，加进 `moon.work` 与 `verify_all`（它就开始被验证了）。
3. 再写生成器（替换 + 残留断言）与 T1。
4. 最后才谈 §3.4 的 `deltas` 清单——那时候清单里该有几行是**量出来的**，不是猜的。

demo 于是从"真源"降级为"**模板最狠的那个测试用例**"：它自带 R1 排版样本、网络同步、本地库，
正好是把模板所有占位符压满的那一份。**加实验能力时改 demo，不必再动模板** ——
"模板同源会限制 demo 演进"这个风险从根上消失。

**为什么原方向行不通（实测，不是推理）**：

| # | demo 的真身 | 生成物必须长成 | 后果 |
|---|---|---|---|
| 1 | `host/package.json` 里 `"moobile-host": "file:../../../../npm/moobile-host"` | semver `^0.2.0` | 「逐文件比对、忽略版本占位符」**当场红** |
| 2 | `ui.mbt` 479 行里带 `R1` 变体 + `r1_screen()`，连着 334 行 `r1.mbt`（爻辞排版样本） | §7 要求"最小可跑，砍掉没被验证过的能力示范" | 要**条件语法**才能剔 |
| 3 | demo 是 `host/` 子目录 + Expo 生成物（`android/` `.expo/` `dist/` `package-lock.json`） | 平铺、干净（§3.1） | 要一份"只比哪些文件"的白名单 |

第 2 条是**耦合**而不是"删文件"：`R1` 是 `Msg` 的一个变体 + 页面 enum 的一个成员 + `ui.mbt` 里的
一条分发臂，与 `Model` / `Msg` / 路由咬在一起。想在模板里"按需剔除"，占位符就得长出 `{{#if}}`
—— **那是在把 `{{APP_NAME}}` 升级成一门模板语言**，而 §7 明说不做这种大而全。

因此替换只需**纯字符串替换**（不需要模板引擎）；而"模板里写什么字面量"见 §3.4.2。

**配套的 T1（重写，取代原"逐文件比对"）**：

> 用模板生成一个临时项目 → 与 `examples/apps/todo-app/` 比对，**只比 `deltas` 清单内的文件**，
> 且差异必须命中清单里**显式列出的允许项**。**清单之外的任何差异 = 红。**

`deltas` 清单是 `tools/template/deltas.txt`，起步 8 条，必须短到**能被人一眼审完**
（⚠️ 这 8 条是**现在的推测**，按 §3.4.4，正确的做法是等模板存在后**量出来**）：

| 允许的差异 | 为什么 |
|---|---|
| `host/` 子目录（demo 在子目录里，生成物平铺） | §3.1 末段 |
| `package.json`：`file:` 本地路径 → semver | demo 连本地库开发，生成物连 registry |
| `package.json`：`name` / demo 专属的 `private: true` 等字段 | 参数化维度之外 |
| demo 专属文件：`r1.mbt`、`todo_api.mbt`、`todo_db.mbt`（网络同步 + 本地库） | 模板只带最小 Todo |
| demo 专属 `Msg` / 页面 enum 成员（`R1`、同步相关） | 上面那条耦合的另一半 |
| 构建产物 / 锁文件：`package-lock.json`、`android/`、`.expo/`、`dist/`、`moobile.js` | 生成物不入库也不比对 |
| `app.json` 的 `name` / `slug` / `android.package` | 参数化 |
| `README.md` 正文 | 模板的 README 是给消费者的，demo 的是给我们的 |

**清单一旦长到几十条，说明反向依赖没做成，只是把漂移藏进了清单里** ——
那时候应该老实回到"两份真源 + 一条独立闸门"，而不是继续往清单里加行。

### 3.5 环境自检：`doctor`

```
npx moobile-host doctor
```

输出一张表，每行"检查项 / 现状 / 不满足时给的可照抄命令"：

| 检查 | 为什么 |
|---|---|
| `moon` 存在且版本 ≥ 某个下限 | 库是 MoonBit 写的，没它编不出 `moobile.js` |
| `node` 版本 ≥ 某个下限 | Metro / Expo / 宿主包 |
| `package.json` 里 `moobile-host` 版本与 `moon.mod` 里库版本**配套** | 见 §5.1（版本矩阵） |
| `registry.generated.js` 与 `package.json` 一致 | 已有：`regen --check` |
| 契约版本一致 | 已有：运行时 `checkContract`；`doctor` 提前到"开发时"发现 |
| `adb`（只在要跑 Android 时） | 跑真机/模拟器才需要，缺失时给出安装指引而不是报错 |

**原则（与本库已有的 `sqlite.ensure()` 一致）**：缺能力时 **fail-fast 并说清怎么装**，
而不是让用户对着 `Cannot read properties of undefined` 猜。

### 3.6 上手与迁移的"钩子"：`moon add` 之后自动提示

PLAN §1.1 记了一条还没用起来的机制：`moon.mod` 支持
`options(scripts: { "postadd": "…" })`，`moon add` 后自动执行。
用途：用户 `moon add XiLaiTL/moobile@x.y.z` 之后，**自动打印**接下来三步
（装宿主 / 写 `App.js` / 跑 `regen`）并给出当前版本的迁移清单。
比"让人去翻 README"可靠，也比"README 里那段话永远最新"现实。

### 3.7 第三类输入：**一个既有的 rabbita 项目**（远期，PLAN 的 E9）

`create` 现在的输入是一个**空目录**。这一节补另一类输入：**一个已经用 rabbita 写好、跑在浏览器里的项目**。
这不是"顺便支持一下"，而是本项目的**起点本身** —— `interest/yi` 就是那个项目（见 PLAN §6）。

#### 3.7.1 为什么这件事在我们的处境下格外可行

**moobile 不是另一个框架，它是 rabbita 的"换后端" fork**：TEA 状态机、`@html` DSL、
`Cmd` / `Sub` 语义**同构**。所以迁移**不是重写视图**，而是改四处"边界" ——
入口/宿主、样式、能力、构建目标。这与"从 React 迁到 Vue"不是一个量级。

#### 3.7.2 一条硬约束：迁移是**换依赖**，不是两个 rabbita 并存

| 事实 | 后果 |
|---|---|
| 既有项目依赖 `moonbit-community/rabbita`；moobile 项目依赖 `XiLaiTL/moobile`（内含 fork） | 两者的 `Html` / `VNode` / `Attrs` 是**不同包的不同类型**，混用编不过 |
| 同一个 `@html` 短路径由两个来源各自提供 | 不能同时 import；讨论"渐进迁移、两边共存"要先把这条摆平 |

**判据**：迁移产物的 `moon.mod` 里只剩 `XiLaiTL/moobile` 一条 rabbita 来源；
`moon tree` 不出现 `moonbit-community/rabbita`。

#### 3.7.3 迁移矩阵：哪些照搬、哪些必须改（**这一节就是设计本身**）

| 层面 | rabbita（Web / DOM） | moobile | 迁移动作 | 自动化程度 |
|---|---|---|---|---|
| TEA：`Model` / `Msg` / `update` / `view` | 同 | 同 | **不动** | 照搬 |
| 视图 DSL `@html.*` | 同（同一份 fork 血统） | 同 | 不动（除样式相关那几行） | 照搬 |
| **入口 / 宿主** | `App::new` + `run` + 自己写 HTML/JS 引导 | `@moobile.handlers(...)` + npm 宿主 + 契约版本 | 换入口（约 10 行）+ 生成宿主 | 半自动 |
| **样式** | `class=` + CSS 文件（含伪类 / 媒体查询 / 后代选择器） | 类型化 `Attrs::styles(Style)`，**封闭属性集** | CSS → `Style` 调用 | 半自动（F2），**必然有损** |
| **标签** | 116 个标签里的任意一个 | 42 条有映射，12 条**明确排除**（`img`/`video`/`canvas`/`svg`/`table`/`select`/`details`/`dialog`…） | 接第三方组件库（**I 轨道**）或改写 | **不自动**，必须人决定（动检点名） |
| **事件载荷** | 真实 DOM 事件（坐标、输入值） | 现在零值/不透明（**I1 未做**） | 读坐标/读值的代码要重写 | **不自动**（动检点名） |
| **浏览器能力** | `@dom` 直连、`fetch`、`localStorage` | 能力注册表（宿主注入 `MOBILE_HOST.db` 等） | 换成能力包（**N 轨道**） | 半自动 |
| **构建目标** | 常见 `wasm-gc` / `js` | **只支持 `js`**（传递性 js 锁） | 改 `preferred_target` / `supported_targets` | 自动 |
| **平台承诺** | 只有浏览器 | Web + Android + iOS（iOS 未实测） | 无动作，但排版要重新验（R1 行内流那条） | —— |

⚠️ 这张表怎么读：**"照搬"的两行是绝大多数代码量**（视图与 TEA），
**"必须改"的那些行才是迁移的成本**，而其中只有样式与构建目标能半自动。

#### 3.7.4 产出形态：**三件东西**，不是一个"魔法改写器"

```
npx moobile-host create --from-rabbita <既有项目路径> my-app
        │
        ├─① 迁移报告（F1 动检）：会**静默失效**的项逐条点名 ——
        │     class=/style= 的数量、标签表外的标签、读坐标的事件、
        │     :hover/@media、@dom 直连、wasm-gc 目标
        ├─② 新项目（就是 §3.1 那个生成物）：宿主 + moon.mod/moon.work + 改过的依赖与导出，
        │     视图文件**尽量原样搬运** —— 哪怕先编不过，也要让人看见 diff
        └─③ TODO 清单：报告里每一类各自的下一步，指向 F2（样式）/ F3（指南）/ I 轨道（组件库）/ 人工决策
```

**明确不做**（负面清单，与 §7 同规矩）：

- **不重写业务逻辑**、不猜 CSS 的意图、不动用户的 `update` / `view` 结构；
- **不"顺手删掉"迁移不过去的代码** —— 编不过就留 `TODO` 注释让它编不过，把决定权留在人手上；
- **不承诺"迁移后效果一致"**：RN 的排版与浏览器不同（R1 行内流），效果要重新验。

> **判据是"报告零遗漏"，不是"自动改对了多少"。**
> 这条是刻意的：自动改写猜错的代价，是把 bug 埋进用户的代码里，而他不会知道。

#### 3.7.5 依赖与顺序：E9 = **E × F 的收口**，天然最后做

```
F1 迁移动检（可提前，成本最低）→ I 轨道（接住 img / canvas / table 这类无等价物标签）
        → C 宿主能跑起来 → E9 把它串成一条命令
```

**所以 E9 今天就能定形态与判据，但不该现在实现。** 顺序反过来会出问题：
先做 E9 而 F1 不存在时，"哪些会静默失效"这个问题没有答案，迁移器只能瞎猜。

#### 3.7.6 判据（每条都能跑出命令来）

| # | 判据 | 怎么验 |
|---|---|---|
| **S9-1** | 拿**真实** rabbita 项目跑一次（`interest/yi`，或 rabbita 仓库自己的 example） | 跑 `create --from-rabbita <路径>`，产出报告 + 项目 |
| **S9-2** | 动检报告里"会静默失效"的项与**人工清点零遗漏** | 与 F1 同一条判据（复用），逐类对照 |
| **S9-3** | 生成的项目 `moon check` **0 错误**（动不了的部分以 `TODO` 标出，而不是删掉） | `moon check --target js` |
| **S9-4** | 迁移后的项目在 Web 宿主上**跑起来**（至少"静态页可读"这一档） | 走 `tools/verify_web.js` 那类门 |
| **S9-5** | 报告里**每一项都有下一步指向**（F2 / F3 / I / 人工），**没有"未知"这一类** | 报告结构自身可断言 |

> **为什么把它写进脚手架、而不是做成独立工具**：迁移的**终点**永远是"一个 moobile 项目"——
> 也就是脚手架的生成物。独立工具就得再造一套宿主 / 模板 / 版本配套（§5）。
> 接在脚手架里则天然复用 §3.4 的模板真源与 §5.1 的三个版本号。
> **一句话：E9 的产物 = `create` 的产物 + 一份报告 + 一支 TODO。**

---

## 4. 工具用什么语言写（本文的第二件事）

### 4.1 判据

> **① 工具的语言 = 该工具的"使用者环境里必然存在"的东西。**
> **② 工具本身跑在谁的进程边界上。**

第 ② 条是 2026-09 补的。第 ① 条单独用会漏掉一类情况：**工具的宿主环境与它的使用者环境不是同一个东西**。
脚手架就是这样的工具 —— 它服务 MoonBit 使用者，但它自己跑在 npm/node 里。两条合起来才判得准。

先把事实摆平（都是实测）：

| 谁 | 必然有 | 不保证有 |
|---|---|---|
| 用 moobile 写 app 的人 | **Node**（Expo / RN / Metro 就是 Node 工具链）、**moon**（要把 MoonBit 编成 JS） | Python |
| 库维护者（本仓库） | moon、**node（硬依赖，不是"顺带"）**、bash | Python |
| —— | —— | **Python 没有任何一层能保证** ← 所以它必须消失 |

> 维护者那一格原本写的是"moon、node"，语气像"顺带也有"。**node 是硬依赖**：
> `tools/mb.sh` 最后一行就是 `exec moon run --target js`，产出的 `.js` 必须由 node 执行；
> `verify_all.sh --with-e2e` 的三项又全是 node。**"换成 node 会引入新依赖"这个顾虑不成立** ——
> 依赖早就在了，只是没人这么写。

### 4.2 分工

| 工具 | 住哪 | 语言 | 为什么 |
|---|---|---|---|
| 脚手架 `create-moobile-app` / `moobile-host init` | npm | **`.mjs`** | 它跑在**消费者的 JS 项目**里、读写 `package.json`/`metro.config.js`/`App.js`，还要调 `npm install`；**npm 包只能发 JS**。为生成一个 JS 文件而要求装 MoonBit 工具链，是错误耦合。 |
| `doctor` / `regen` / 契约校验 | npm 包 `moobile-host` | **`.mjs`** | 同上；`regen` 读的就是 `package.json`。**已实现**。 |
| 库仓库的**纯文件扫描与改写**（`verify_all`、`lf_normalize`、`check_links`、`check_public_leaks`、`gen_forwarders`、`vendor_relocate`） | 仓库 `tools/` | **MoonBit**（`.mbtx` 单文件） | 没有进程编排、不碰 JS 生态 —— 是 `.mbtx` 的甜区；这些人必然有 moon；审核者读的就是 MoonBit。 |
| **要 spawn 进程 / 要 node 模块解析 / 要读别人输出判成败**（`verify_web.js`、`db_probe`、`sync_probe`、`readme_probe`、`verify_android`、`scroll_r1`、`tap_r1`） | 仓库 `tools/` | **`.mjs`** | 它们的活就是 CDP / adb / uiautomator / `moon check` 的子进程编排与输出解析 —— node 的强项；换 MoonBit 只会多一层 FFI。**`readme_probe` 原本判给 MoonBit，是错的**：它 spawn `moon check` 并读编译输出判成败。 |

**一句话**：**判据是进程边界，不是仓库内外。** 纯文件变换 → MoonBit；跨进程/跨生态 → `.mjs`。
Python 两边都不占 —— 这才是"换语言"的真正理由，而**不是**性能（实测二者同量级，详见 §4.3）。

> 原版这里写的是"对外的（npm 分发、在用户项目里跑）用 `.mjs`；对内的（在 MoonBit 仓库里跑）用 MoonBit"。
> 那根轴**在 `readme_probe` 上就判错了** —— 它在仓库内，但它的活是驱动 `moon` 并解析输出。
> 换轴之后这一行的去向自动翻面，不用额外论证。

**顺带：为什么不能把仓库工具全统一成 `.mjs`**（这是个会被问到的诱惑）——
`lf_normalize` 这类纯函数式的文件扫描，`.mbtx` 写出来更短、审起来更贴库代码；
反过来把 `readme_probe` 这类编排类工具塞进 `.mbtx`，就得在 `extern "js"` 里手搓 `child_process`，
而那正是**已经还过债**的地方（`mb.sh` 的 `MBTOOLS_CWD`、`js_exit` 都是这么来的）。
两个方向都别统一，按边界分。

### 4.3 `.mbtx` 的实测边界（写死进文档，免得重踩）

| 事实 | 数字 / 现象 |
|---|---|
| 单文件脚本，**无需** `moon.mod` / `moon.pkg`，import 写在文件头 | `moon run --target js tools/x.mbtx` |
| 传参正常 | `args = [node, single.js, ...用户参数]`（`@env.args()`） |
| 单次调用成本 | **~160ms**（与"模块 + `moon run`"同量级；等价的 `.mjs` 约 80ms） |
| ⚠️ **必须带 `--target js`** | 不带会走 wasm 后端去找本机不存在的 `~/.moon/lib/core/_build/wasm/.../prelude.mi` → **编译器 ICE**，报的是 "This is a bug in the compiler"，看不出真因 |
| `fn main` 要 `raise` | 调用 `@fs` 这类会抛错的 API 时，`fn main raise` |

因此：**任何 `.mbtx` 都经一层 wrapper**（当前是 `tools/mb.sh`），把 `--target js`、cwd 处理、
以及"缓存/输出"的约定固定在一处。

### 4.3.1 `moon install` 这条路（实测：走不通，别重踩）

原计划里 §8 D3 考虑过"`moon install` 一个 MoonBit CLI 当全局命令"。**实测结论：它与本仓库
既有的工具形态互斥**，因此不是"暂不做"，而是"这条路封了"。证据（本机实测）：

```
$ moon install --path tools/mbtools/src
  extern "js" fn js_exit(code : Int) -> Unit = "(code) => { process.exit(code) }"
  ╰── extern "js" is unsupported in native backend.
Error: No packages were successfully installed
```

| 事实 | 后果 |
|---|---|
| `moon install` **默认走 native 后端**，产出 `~/.moon/bin/*.exe` | 一条 CLI 不能同时"是 native 全局二进制"又"用 `extern "js"` 干脏活" |
| 仓库工具全是 `--target js` 形态（`mb.sh`、`js_exit`、`MBTOOLS_CWD`） | 改 native 就要 MSVC / gcc / clang —— **要求消费者装 C 工具链，比 Python 更重** |
| `SOURCE` 要指向**包目录**（`--path tools/mbtools/src`），指模块根报 `is-main: true required` | 一次额外的踩坑；且库本体是**根包**，`moon install XiLaiTL/moobile` 装不出东西 |

因此：**需要分发给消费者的 CLI 一律走 npm（`.mjs`），不指望 `moon install`。**
这也把 §4.2 里"npm 包只能发 JS"从"一个说法"升级成"唯一可行项"。

### 4.4 当前 Python 余量与去向

按 §4.2 的**进程边界**轴重排（不是按"仓库内外"）：

| 现存 | 去向 | 依据 | 状态 |
|---|---|---|---|
| `cr_scan.py` | 已迁 `.mbtx`（`mbtools` 的 `cr-scan` 子命令） | 纯文件扫描 | ✅ 已退役 Python 版 |
| `check_links.py`、`check_public_leaks.py` | → MoonBit `.mbtx` | 纯文件扫描（前者只读 Markdown 解析链接，后者只扫路径与凭据） | 待做 |
| `gen_forwarders.py` | → MoonBit `.mbtx` | 读 `.mbti` 生成转发包；`moon ide doc "@pkg"` 可替掉手解 `.mbti` | 待做 |
| `vendor_relocate.py` | → MoonBit `.mbtx` | 复制 + 改写，纯文件；**但它住在 `vendor_sync.sh` 里，改语言收益最低，可以最后做** | 待做 |
| `readme_probe.py` | → **`.mjs`**（原判 MoonBit，**翻面**） | 它 spawn `moon check` 并**读编译输出判成败** —— 进程编排，正是 `.mbtx` 的弱点 | 待做 |
| `verify_android.py`、`scroll_r1.py`、`tap_r1.py` | → `.mjs` | adb / uiautomator 子进程编排与 dump 解析；且只给维护者用、不进库 | 待做 |

**净结果：Python 归零，但"退役"分两站 —— 4 个进 `.mbtx`，4 个进 `.mjs`。**
语言净增数为 0：node 早就是硬依赖（§4.1），`.mjs` 不是"新引入的一套工具链"。

> 数字要能对得上：`ls tools/*.py | wc -l` = **8**（`cr_scan.py` 退役后）。
> 本文写成时的清点：`check_links` `check_public_leaks` `gen_forwarders` `readme_probe`
> `scroll_r1` `tap_r1` `vendor_relocate` `verify_android`。
> （`scroll_r1` / `tap_r1` 是 R1 排版判决那批 adb 工具，容易被漏记 —— 第一版本文里就漏了它们。）
>
> ⚠️ **迁移未完成前，其余文档里的 `.py` 文件名不要提前改**：`AGENTS.md`、`CONTRIBUTING.md`、
> `DEV.md`、`CHANGELOG.md`、`docs/README.md` 写的都是**当前**命令，改早一步就是新的文档谎言
> （R7 那次事故的形状）。**表里的"待做"变成"✅"时，同一次改动里再更新那几份文档。**

---

## 5. 版本、契约与升级

### 5.1 三个版本号，一张配套表

生成的项目里有三个版本，**必须配套**，否则会出现"编得过、跑起来才炸"：

| 版本 | 在哪 | 谁负责 |
|---|---|---|
| `XiLaiTL/moobile@x.y.z` | 应用 `moon.mod` | 库（MoonBit 侧） |
| `moobile-host@a.b.c` | 应用 `package.json` | 宿主（JS 侧） |
| `CONTRACT = n` | 库的 `handles.contract` ↔ 宿主的 `CONTRACT` | 两者的共同约束 |

**发布时的硬要求**：库的次版本变动若动了接入形态，`moobile-host` 必须同批发版，
并在 `README.md` 的兼容表里写清"库版本 ↔ 宿主版本"。`mooncakes` 与 `npm` 各自独立发布，
**没有任何自动机制会替我们记住这件事** —— 所以它必须是发布清单上的一条（见 §6）。

### 5.2 运行时兜底（已有）

`CONTRACT` 不等时，宿主**当场**报错并说出两个版本号，而不是让页面上出现一个空白屏。
`doctor` 把同一个检查**提前到开发时**。

### 5.3 升级路径

```
npx moobile-host upgrade      # 后续：读 moon.mod + package.json，列出要改的版本与需要人工处理的破坏性变更
```

在此之前，最低限度：`CHANGELOG.md` 的每个破坏性条目必须写"用户要改什么"，
`README.md` 的快速上手必须与**当前发布的版本**一致 —— 这一条已经由
`tools/readme_probe.py` 把文档与产物拴在一起，见 [`../FINDINGS.md`](../FINDINGS.md) R7
（按 §4.4 它迁 `.mjs`：它要 spawn `moon check` 并读输出，不是纯文件扫描）。

---

## 6. 验收怎么跑（进 CI 的形态）

| 门 | 做什么 | 归属 |
|---|---|---|
| **T1 模板同源** | `tools/template/deltas.txt` 是**允许差异的唯一清单**：生成临时项目 → 比对 `examples/apps/todo-app/`，**清单外的任何差异 = 红**（§3.4） | `verify_all.sh`（离线） |
| **T1b 替换干净** | 生成后 grep 白名单之外的字面量残留（`template` / `XiLaiTL/moobile-template` / `{{`）→ 有残留即红（§3.4.2）。这条兜住"漏参数化"（模板用真字面量的代价） | `verify_all.sh`（离线） |
| **T1c 模板自身可验** | `examples/apps/template/` 进 `moon check` 与 `moon.work`；再跑一遍"生成出来的那个"能起来（§3.4.1） | `verify_all.sh`（离线） |
| **T2 零 Python** | 干净环境跑完整流程；grep 执行路径里不得出现 `python` | CI（Linux 容器最干净） |
| **T3 生成物可编译** | 在生成的临时项目里 `moon check --target js` 通过 | `verify_all.sh`（离线） |
| **T4 README 契约** | 已有：从 README 解析 import 路径并按示例代码编一遍 | `verify_all.sh`（已有） |
| **T5 发版配套** | 发布清单里加一条：库次版本变动 → 宿主同批发布 + 兼容表更新 | `CONTRIBUTING.md` §3 |

T1/T1b/T1c/T3 是纯离线检查，**必须进 `verify_all.sh`**（它现在 **9** 项、仍在 10 秒内，
加这几项仍然很轻；T1c 多一次 `moon check` 是其中最贵的一项）。

### 6.1 缺口：npm 那一半从来没有"发布后验一遍"（2026-09 查实）

§6 的 T1–T5 全在验**生成器与模板**，但没有一条验"**我们发布的宿主包本身可用**"。后果已经发生过一次：

| 事实 | 证据 |
|---|---|
| 线上 `moobile-host@0.2.0` 的 `regen` 会生成**解析不了的 import** | `npm pack moobile-host@0.2.0` 解包后 `bin/cli.js` 的 `from:` 是旧仓库路径 `moobile-examples/…` |
| 因为 host npm 包**从来没有** registry 侧验证 | `tools/check_published.sh` 全文**没有一处** `npm` / `host` 字样 —— 它只验 mooncakes |
| demo 也验不到它，因为 demo 吃的是本地副本 | `host/package.json` 写 `file:…`，不是发布产物 |

`check_published.sh` 的存在理由（文件开头）对 npm 包**一字不差地同样成立**：
*"发布包是过滤后的产物，跟工作区不是同一份东西……只有从 registry 装下来编译过，才算这一版对外可用。"*
**这半扇门是缺的，不是某次疏忽。**

**推论（与 D6 是同一件事）**：demo 若改吃远端宿主，npm 侧就第一次有了"发布后验一遍"的真实对象；
而 `file:` 形态还把 §5.1 的"三号版本配套"里 **npm 那一号整个隐藏掉**了 ——
`file:` 没有版本对账这回事，切远端之后它才第一次变成被真正检验的东西。

> **本轮已做的两处临时加固**（在 D6 落地前先用着，D6 落地后前者改向、后者作废）：
> · `verify_all.sh` 的 `regen --check` 改成**跑源码**而不是 `npx`（原来跑的是 `node_modules` 副本 → 验不到源码）；
> · 新增 `tools/check_npm_fresh.mjs`：副本必须是源码的复制品。
> 两者都做过证伪：把坏常量塞回源码，旧写法 `exit 0`（漏检）、新写法 `exit 1`（抓住）。

---

## 7. 不做什么（负面清单）

- **不做 bundler**：打包交给 Metro / Expo，我们不碰。
- **不做 dev server**：`npm run web` 就是 `expo start`，不套一层。
- **不做"一键 prebuild 原生"**：原生工程由 Expo 生成，我们不代替它。
- **不在消费者侧引入 Python**（S2 是硬判据）。
- **不生成"大而全"样板**：生成物是**最小可跑**（Todo 一条链路），砍掉一切没被验证过的能力示范。
- **不让模板成为第二份手写真源**（§3.4 的约束）。
  ⚠️ 2026-09 修正两次：原文写的是"不许模板成为第二份真源"，方向是"demo 当真源、模板派生"；
  **现在是反的：`examples/apps/template/` 就是真源，demo 是派生用例**。
  真正要防的有两条：① **往 `deltas.txt` 里不断加行**来掩盖漂移（判据是**清单的长度**）；
  ② **在 `tools/template/` 里放工程文件**（`app.mbt` / `App.js`…）—— 那就是第二份真源（§3.4.1）。
- **模板里不写 `{{占位符}}`**：模板必须是能编译、能进门的**真工程**（§3.4.2）。
- **不把脚手架做成库模块的一部分**：它是 npm 包，库的 `moon.mod` 一个依赖都不许加。

---

## 8. 待决策项

| # | 问题 | 选项 | 倾向 |
|---|---|---|---|
| **D1** | 脚手架怎么分发 | ① 独立 npm 包 `create-moobile-app`（`npm create moobile-app`）；② 作为 `moobile-host` 的子命令（`npx moobile-host init`） | **② 起步**（少一个包的版本要同步），做成后再拆出独立名 |
| **D2** | 模板放哪 | ① 随 npm 包分发；② 随仓库（用户 clone）；③ 两者 | **①**，npm 是消费者唯一 guaranteed 的入口。⚠️ 但模板真源在 `tools/template/`（§3.4），所以 npm 包里那份是**构建时拷进去的副本** —— 这多出一个漂移点，**必须配一条"副本新鲜度"闸门**（比对包内模板与 `tools/template/` 的哈希，不一致就红），否则又是一次 R7 形状的事故 |
| **D3** | 要不要 `moon install` 一个 MoonBit CLI | ~~`moon install` 支持 registry 包路径，能得到全局命令~~ | **❌ 实测封路**（§4.3.1）：`moon install` 默认 native 后端，与仓库工具的 `extern "js"` 形态互斥；改 native 要求消费者装 C 工具链，比 Python 更重。**不做**，且不再是"暂不做" |
| **D4** | iOS 怎么办 | 本机（Windows）无法构建验证 | **生成工程 + 文档标注"未实测"**，不承诺 |
| **D5** | 生成物要不要带 Todo | 带（可跑闭环）vs 空壳 | **带**：S5 要求"生成后立刻能做开发闭环"，空壳证明不了。2026-09 补：**模板 = 最小 Todo**（本地库一条链路，不带同步/多页面），**demo = 长满了的那一份**（R1 样本 + 网络同步 + 本地库）。两者不再是同一份东西，所以这条不再是二选一 |
| **D6** | demo（`examples/apps/todo-app/host/`）要不要改成引用**远端** `moobile-host` | ① 保持 `file:` 本地副本；② 改 semver 远端 | **② 远端**（2026-09 定）。现在 demo 与 README 口径不一致、且 npm 侧缺"发布后验一遍"那半扇门（§6.1）。⚠️ **顺序不能反**：先发修好的宿主版本 → 再切（当前线上 0.2.0 是坏的，切了 demo 立刻起不来）。**未动手，记待办** |
| **D7** | `moon.work` 要不要把 demo 从工作区摘掉（MoonBit 侧也吃远端） | ① 保留工作区（改库即时生效）；② 摘掉，demo 两边都吃远端 | **② 两边都吃远端**（2026-09 定）：demo = 真实用户路径，值得为此付"改库要发版才能在 demo 里看到"的代价。**未动手，记待办**；须与 D6 **同批**做，否则留下"远端宿主 + 本地库"的中间态（那不是任何真实用户的组合） |
| **D8** | 迁移（§3.7）的野心到哪一档 | ① **只做"新项目 + 报告 + TODO"**（一行用户代码都不改写）；② 在 ① 之上加**样式层的机械映射**（F2）；③ 连视图/逻辑一起自动改写 | **① 起步，② 作为 ① 之后的增量**。理由：迁移的价值在**把"静默失效"变成显式清单**，不在替用户猜意图；③ 猜错的代价是把 bug 埋进用户代码，而用户不会知道。**②** 的边界要写死：机械映射得到的 `Style` 与原 CSS **不等价**（伪类/媒体查询/后代选择器无对应物），必须逐条标出"有损" |
| **D9** | 迁移的**验收项目**用哪个 | ① `interest/yi`（真实、够复杂，含 canvas/罗盘）；② rabbita 仓库自带的 example（干净、但太简单）；③ 两个都跑 | **① 为主**（它才是"真实压力"），**② 用来隔离"迁移器自身的 bug"与"项目本身的复杂度"** |

---

## 9. 与其它文档的关系

| 文档 | 关系 |
|---|---|
| [`../../PLAN.md`](../../PLAN.md) | E 轨道（脚手架，含 **E9 从 rabbita 项目迁移**）、H 轨道（接入收敛，已完成）、F 轨道（迁移工具，**E9 的前置**）、I 轨道（第三方组件库，接住 `img`/`canvas`/`table` 这类无等价物标签） |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | 分层与宿主契约；本文的 §3.3 是它的推论 3 的落地 |
| [`../FINDINGS.md`](../FINDINGS.md) | R2（真应用跑通）、R7（README 与产物不符的事故）、R8（工具链语言与实测） |
| [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) | 发版清单（§6 的 T5 要并进去） |
| [`../../npm/moobile-host/README.md`](../../npm/moobile-host/README.md) | 宿主包自己的 README（契约表、regen 用法） |
