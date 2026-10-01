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
| **S4** | 生成的项目就是我们验过的那条链路 | 模板与 `examples/apps/todo-app/` **同源**（见 §3.4），`verify_all.sh` 能发现漂移 |
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

**缺的是"把上面这些拼成一个新项目"的那一层**（E 轨道），以及"环境自检"与"升级路径"。

---

## 3. 生成物设计

### 3.1 目录结构（生成出来的样子）

```
my-app/
├── moon.mod                  ← 独立 module（**不是**库模块里的包）
├── moon.pkg                  ← 5 条 import（库本体 / style / html / cmd / sub）
├── app.mbt                   ← Model / Msg / init / update / view / subscriptions
├── App.js                    ← 宿主侧全部手写代码（4 行）
├── registry.generated.js     ← 生成物（regen 产出，入库）
├── package.json              ← 依赖：moobile-host、expo（由 --host 决定）
├── metro.config.js           ← 让 Metro 认 MoonBit 的 ESM 产物
├── app.json                  ← Expo 配置（由 --host 决定）
├── .gitignore                ← 含 `moobile.js`（构建产物）与 `_build/`
└── README.md                 ← 三条命令 + 环境要求（moon + node）
```

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

### 3.4 模板机制：**同源**，不是另抄一份

moon **没有**模板机制（`moon new` 只生成内置脚手架，无 `--template`，实测见 PLAN §1.1），
所以模板得我们自己实现。**关键设计决定：模板不从零手写，而是参数化 `examples/apps/todo-app/`。**

理由是这个仓库一贯的理由：**两份手写的同类文件必然漂移**，而漂移只会以"用户拿到一个跑不起来的项目"的形式暴露。
做法：

```
examples/apps/todo-app/         ← 唯一真源（我们真实在跑、真有四道门）
        │  参数化：{{APP_NAME}} / {{HOST}} / {{MOBILE_VERSION}}
        ▼
tools/template/                 ← 生成器 + 占位符清单
        │
        ▼
npx create-moobile-app my-app   ← 消费者拿到的东西
```

配套的**反漂移检查**（进 `verify_all.sh`）：用模板生成一个临时项目 → 与 `examples/apps/todo-app/`
逐文件比对（忽略名字与版本占位符）。若模板被手改而与真源脱节，这条检查就红。

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

---

## 4. 工具用什么语言写（本文的第二件事）

### 4.1 判据

> **工具的语言 = 该工具的"使用者环境里必然存在"的东西。**

先把事实摆平（都是实测）：

| 谁 | 必然有 | 不保证有 |
|---|---|---|
| 用 moobile 写 app 的人 | **Node**（Expo / RN / Metro 就是 Node 工具链）、**moon**（要把 MoonBit 编成 JS） | Python |
| 库维护者（本仓库） | moon、node | Python |
| —— | —— | **Python 没有任何一层能保证** ← 所以它必须消失 |

### 4.2 分工

| 工具 | 住哪 | 语言 | 为什么 |
|---|---|---|---|
| 脚手架 `create-moobile-app` / `moobile-host init` | npm | **`.mjs`** | 它跑在**消费者的 JS 项目**里、读写 `package.json`/`metro.config.js`/`App.js`，还要调 `npm install`；**npm 包只能发 JS**。为生成一个 JS 文件而要求装 MoonBit 工具链，是错误耦合。 |
| `doctor` / `regen` / 契约校验 | npm 包 `moobile-host` | **`.mjs`** | 同上；`regen` 读的就是 `package.json`。**已实现**。 |
| 库仓库门禁 / 生成 / 搬运（`verify_all`、`vendor_sync`、`gen_forwarders`、`readme_probe`、链接与泄漏检查） | 仓库 `tools/` | **MoonBit**（`.mbtx` 单文件） | 这些人必然有 moon；一个仓库一种语言；审核者读的就是 MoonBit。 |
| 驱动 JS 生态的验证（`verify_web.js` / `db_probe` / `sync_probe`，CDP + 无头 Chrome） | 仓库 `tools/` | **`.mjs`** | 它们本来就跑在 node 里操作 puppeteer/CDP；换 MoonBit 只会多一层 FFI。 |

一句话：**对外的（npm 分发、在用户项目里跑）用 `.mjs`；对内的（在 MoonBit 仓库里跑）用 MoonBit。**
Python 两边都不占 —— 这就是"换语言"的真正理由，而**不是**性能（实测二者同量级，详见 §4.3）。

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

### 4.4 当前 Python 余量与去向

| 现存 | 去向 | 状态 |
|---|---|---|
| `cr_scan.py` | 已迁 `.mbtx`（`mbtools` 的 `cr-scan` 子命令） | ✅ 已退役 Python 版 |
| `check_links.py`、`check_public_leaks.py` | → MoonBit `.mbtx`（纯文件扫描） | 待做 |
| `gen_forwarders.py`、`readme_probe.py` | → MoonBit `.mbtx`（MoonBit 相关；`moon ide doc "@pkg"` 可替掉手解 `.mbti`） | 待做 |
| `vendor_relocate.py` | → MoonBit `.mbtx` | 待做 |
| `verify_android.py`、`scroll_r1.py`、`tap_r1.py` | **留 `.mjs`**（这三个都是 adb/uiautomator 子进程编排 —— node 的强项；且只给维护者用、不进库） | 待做 |

> 数字要能对得上：`ls tools/*.py | wc -l` = **8**（`cr_scan.py` 退役后）。
> 本文写成时的清点：`check_links` `check_public_leaks` `gen_forwarders` `readme_probe`
> `scroll_r1` `tap_r1` `vendor_relocate` `verify_android`。
> （`scroll_r1` / `tap_r1` 是 R1 排版判决那批 adb 工具，容易被漏记 —— 第一版本文里就漏了它们。）

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
`README.md` 的快速上手必须与**当前发布的版本**一致（这一条已经由
`tools/readme_probe.py` 把文档与产物拴在一起，见 [`../FINDINGS.md`](../FINDINGS.md) R7）。

---

## 6. 验收怎么跑（进 CI 的形态）

| 门 | 做什么 | 归属 |
|---|---|---|
| **T1 模板同源** | 用模板生成临时项目 → 与 `examples/apps/todo-app/` 逐文件比对 | `verify_all.sh`（离线） |
| **T2 零 Python** | 干净环境跑完整流程；grep 执行路径里不得出现 `python` | CI（Linux 容器最干净） |
| **T3 生成物可编译** | 在生成的临时项目里 `moon check --target js` 通过 | `verify_all.sh`（离线） |
| **T4 README 契约** | 已有：从 README 解析 import 路径并按示例代码编一遍 | `verify_all.sh`（已有） |
| **T5 发版配套** | 发布清单里加一条：库次版本变动 → 宿主同批发布 + 兼容表更新 | `CONTRIBUTING.md` §3 |

T1/T3 是纯离线检查，**必须进 `verify_all.sh`**（它现在 8 项、8 秒，加这两项仍然很轻）。

---

## 7. 不做什么（负面清单）

- **不做 bundler**：打包交给 Metro / Expo，我们不碰。
- **不做 dev server**：`npm run web` 就是 `expo start`，不套一层。
- **不做"一键 prebuild 原生"**：原生工程由 Expo 生成，我们不代替它。
- **不在消费者侧引入 Python**（S2 是硬判据）。
- **不生成"大而全"样板**：生成物是**最小可跑**（Todo 一条链路），砍掉一切没被验证过的能力示范。
- **不让模板成为第二份手写真源**（§3.4 的同源约束）。
- **不把脚手架做成库模块的一部分**：它是 npm 包，库的 `moon.mod` 一个依赖都不许加。

---

## 8. 待决策项

| # | 问题 | 选项 | 倾向 |
|---|---|---|---|
| **D1** | 脚手架怎么分发 | ① 独立 npm 包 `create-moobile-app`（`npm create moobile-app`）；② 作为 `moobile-host` 的子命令（`npx moobile-host init`） | **② 起步**（少一个包的版本要同步），做成后再拆出独立名 |
| **D2** | 模板放哪 | ① 随 npm 包分发；② 随仓库（用户 clone）；③ 两者 | **①**，npm 是消费者唯一 guaranteed 的入口 |
| **D3** | 要不要 `moon install` 一个 MoonBit CLI | `moon install` 支持 registry 包路径，能得到全局命令 | **暂不做**：与 D1-② 重复，先看 `doctor` 够不够 |
| **D4** | iOS 怎么办 | 本机（Windows）无法构建验证 | **生成工程 + 文档标注"未实测"**，不承诺 |
| **D5** | 生成物要不要带 Todo | 带（可跑闭环）vs 空壳 | **带**：S5 要求"生成后立刻能做开发闭环"，空壳证明不了 |

---

## 9. 与其它文档的关系

| 文档 | 关系 |
|---|---|
| [`../../PLAN.md`](../../PLAN.md) | E 轨道（脚手架）、H 轨道（接入收敛，已完成）、F 轨道（迁移工具） |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | 分层与宿主契约；本文的 §3.3 是它的推论 3 的落地 |
| [`../FINDINGS.md`](../FINDINGS.md) | R2（真应用跑通）、R7（README 与产物不符的事故）、R8（工具链语言与实测） |
| [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) | 发版清单（§6 的 T5 要并进去） |
| [`../../npm/moobile-host/README.md`](../../npm/moobile-host/README.md) | 宿主包自己的 README（契约表、regen 用法） |
