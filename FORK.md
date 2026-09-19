# FORK.md —— 我们对 rabbita 的改动清单

> **为什么有这个文件**：moobile 把 `moonbit-community/rabbita@0.15.4` fork 进本模块
> （原因见 `README.md` 的「原理」一节）。当前策略是 **vendor 跟版**，
> 所以必须有一份**精确、可重放**的改动清单 —— 否则 rabbita 一发版就得靠考古。
>
> 📌 **现在的真相不是本文的手抄步骤，而是 `_tools/patches/` 里的 15 个 patch。**
> 本文的作用是：解释每个 patch 在干什么、为什么，以及跟版/升级时怎么用。
> 机器可验证：`bash _tools/vendor_sync.sh --check`（断言「工作区 == 上游 + 这些 patch」）。
>
> 这份清单同时也是将来上游化的提案基础（见 §3）。
> 记录日期：2026-09（对应 rabbita 0.15.4）

---

## 0. vendor 方式（生成式：第三方代码不进仓）

| 项 | 做法 |
|---|---|
| 位置 | 铺在**模块根**（`html/` `cmd/` `dom/` `internal/` …），与我们自己的 `style/` `demo/` 平级 |
| 版本 | `_tools/vendor.lock` 里的 `RABBITA_VERSION=0.15.4`（**注册表制品**，不可变） |
| 改动 | `_tools/patches/*.patch`（**14 个**，按编号顺序 `patch -p1`；原 13 号随 `server/` 一起裁掉） |
| 生成器 | `_tools/vendor_sync.sh`（`--check` / `--apply` / `--capture` / `--from`） |
| 是否入库 | **否**。15 个第三方目录在 `.gitignore` 里；仓库只跟踪我们自己的代码 + patch + 脚本 |
| 有意裁掉的包 | `server/`（rabbita 的 SSR/HTTP）—— 见 §2.5 |
| 为什么必须在同一模块 | `internal` 包的可见性是**按包路径前缀**判的；只有同模块（且 `internal/` 直接在模块根下）才能 import `internal/vdom` |
| 为什么不能放 `vendor/` 子目录 | 实测：`vendor/rabbita/internal/*` 只对 `…/vendor/rabbita/**` 可见，模块根包 import 会报 `Cannot import internal package … due to internal visibility rules` |
| 为什么不用 git submodule | 上游 0.15.x **只有 `rabbita-v0.15.6` 一个 tag**，我们 vendor 的 0.15.4 没有 tag；能找到的最近提交跟注册表那份还差 49 处。**能精确钉住的只有注册表版本号** |
| fork 的根包去哪了 | `top.mbt` / `incremental.mbt` / `deprecated.mbt` / `tea.mbt` / `render_test.mbt` / `moon.pkg` / `README.mbt.md` → `internal/rabbita/`（这样模块根包 = moobile 库本体，见 `docs/ARCHITECTURE.md` §5「形态 B」） |

---

## 1. 日常怎么用

```bash
bash _tools/vendor_sync.sh --check      # 断言「工作区 == pristine + patch」；CI / 提交前跑
bash _tools/vendor_sync.sh --apply      # 铺开第三方代码（新克隆、或升级换版本后）
bash _tools/vendor_sync.sh --capture    # 把工作区里的改动回写成 patch
bash _tools/vendor_sync.sh --from 0.16.0   # 换基准版本（试升级），配合 --check 看冲突落在哪
```

⚠️ **第三方目录是 gitignore 的，`git status` 不会提醒你漏了 `--capture`** ——
所以：**改了 `html/`、`internal/vdom/` 这些地方的代码之后，提交前一定先 `--capture`，再 `--check`。**
改完顺手 `bash _tools/lf_normalize.sh` 统一行尾（CRLF 会把 patch 的上下文打乱）。

---

## 2. patch 系列（15 个，按应用顺序）

| # | patch | 触及 | 一句话 |
|---|---|---|---|
| 01 | `01-html-attrs-style-api` | `html/attrs.mbt` | 删 `Attrs::style(key, value)`，换成类型化的 `Attrs::styles(@style.Style)` |
| 02 | `02-html-attrs-event-decode-table` | `html/attrs_event.mbt` | 13 处事件解码改成**查表**（可替换策略），不再直接 `to_xxx_event().unwrap()` |
| 03 | `03-html-html-utils-form-value` | `html/html_utils.mbt` | 表单取值与 `prevent_default/target` 走同一张表 |
| 04 | `04-html-readme-doctest` | `html/README.mbt.md` | README 里的**文档测试**样例跟着 01 改（它是会参与编译的测试文件） |
| 05 | `05-html-moon-pkg` | `html/moon.pkg` | 加 `style`、`core/ref` 依赖；把 `event_decoders.mbt` 限定为 js |
| 06 | `06-svg-attrs-style-api` | `svg/attrs.mbt` | 与 01 同款：`Attrs::style` → `Attrs::styles` |
| 07 | `07-svg-moon-pkg` | `svg/moon.pkg` | 加 `style` 依赖 |
| **08** | **`08-vdom-event-decouple-props-widen`** | `internal/vdom/vdom.mbt` | **核心**：`Event` 与 `@dom.Event` 解耦 + `Props.styles` 类型化 + `Props` 补一组对外访问器（106+/7-） |
| 09 | `09-vdom-diff` | `internal/vdom/diff.mbt` | 事件监听与样式消费跟着 08 的类型走 |
| 10 | `10-vdom-ssr` | `internal/vdom/ssr.mbt` | `write_styles_attr` 的参数类型加宽 |
| 11 | `11-vdom-moon-pkg` | `internal/vdom/moon.pkg` | 加 `style` 依赖 |
| 12 | `12-runtime-moon-pkg` | `internal/runtime/moon.pkg` | 给 `react_host.mbt` 加 js 限定（与 15 配套） |
| ~~13~~ | ~~`13-server-moon-pkg-rabbita-root`~~ | — | **已随 `server/` 一起裁掉（2026-09）**，见 §2.5 |
| 14 | `14-new-html-event-decoders` | `html/event_decoders.mbt` | **新增文件**（122 行）：解码表 + `dom_decoders()` + `passthrough_decoders()` |
| 15 | `15-new-runtime-react-host` | `internal/runtime/react_host.mbt` | **新增文件**（224 行）：moobile 的 React 后端 |

### 2.5 有意裁掉的包：`server/`

`server/` 是 rabbita 的 SSR / HTTP 那一套。裁它的理由是审计出来的，不是感觉：

| 检查 | 结果 |
|---|---|
| 谁依赖 `server/` | **没有任何包**（连 fork 内部都没有）——它是叶子 |
| 谁用 `hackwaly/moonback` | **只有 `server/moon.pkg`** |
| 谁用 `moonbitlang/x` | **也只有 `server/moon.pkg`**（`x/path`） |
| 它被编译过吗 | **没有**：它声明 `supported_targets = "native+wasm"`，而我们只跑 js |

代价与收益：**裁掉一个包 = 去掉两个依赖（3 → 1）**，发布包少两个文件。
验证：`moon check` 0 错误、`_verify.js` 26/26、`check_external.sh` 通过、`vendor_sync.sh --check` 一致。
恢复办法：把 `server` 加回 `vendor_sync.sh` 的 `FORK_DIRS`、恢复 13 号 patch、把两个依赖加回 `moon.mod` 即可。

**不属于 patch 的三件事**（由脚本做，见 `_tools/vendor_sync.sh` 的铺开步骤）：

1. **模块名替换**（`moonbit-community/rabbita` → `XiLaiTL/moobile`，影响约 13 个 `moon.pkg` 与 1 处注释）——
   用 `sed` 而不是 patch，因为**上游将来新增的文件 patch 覆盖不到，sed 才能全覆盖**。
2. **布局搬家**（fork 的 7 个根文件 → `internal/rabbita/`）。
3. **删生成物**（`pkg.generated.mbti`，由 `moon info` 重新生成）。

**也不属于 fork diff 的东西**：`style/`（我们自己的公开包，直接入库）、
模块根包（`host.mbt` / `render.mbt` / `app.mbt` / `store.mbt` / `schedule.mbt`）、
`demo/`、`host/`、`_tools/`。

### 2.1 核心 patch 08 的细节（`internal/vdom/vdom.mbt`）

| # | 改动 | 说明 |
|---|---|---|
| A | `Props.styles` 类型：`Map[String, String]` → `Map[String, @style.StyleValue]` | 加宽成类型化值 —— 于是"样式值必须按 key 分类"这件事由**类型**保证，不再需要运行时白名单 |
| B | `Event` 类型：`#cfg(target="js") type Event = @dom.Event` → `#external pub type Event` | **解耦**：不再别名 `@dom.Event`，且对外可命名（不改这个，外部包**根本没法写 handler**） |
| C | 新增 `dom_event` / `pub as_dom_event` | 边界强转（`%identity`），DOM 侧用 |
| D | 新增 `Props::empty / styles / on / attr / prop / styles_map / attrs_map / props_map / each_handler` | `Props` 字段是私有的，外部包既读不到也注册不了事件；这组是必要的对外入口 |

### 2.2 patch 02/03/14：为什么是"一张表"而不是"逐个修"

普查（`_r1/dom_survey.txt`）显示 `html/` + `svg/` 里共 **45 处 `@dom.`**，
其中**同一形状的 panic 有 13 个**（mouse / keyboard / focus / drag / clipboard /
composition / wheel / input / submit / Mouse / Keyboard / Scroll …）。
只修 mouse 那一处等于把同样的雷留给其余 12 个 ——
而 **yi 的罗盘拖拽（`on_mousedown/move/up` 读 `Mouse` 坐标）正好踩在里面**。

**换来的语义要说清楚**：是"**不崩、可降级**"，不是"载荷等价"。
`Mouse`/`Keyboard`/`Scroll` 在 React 后端一律返回**零值**，
读取它们的处理器会拿到 0 —— 真实手势数据要接 RN 手势系统（设计文档 R2 / 旧计划 `docs/PLAN-2026Q3-yi-port.md` 的 T3.4）。

### 2.3 patch 15 的细节（`internal/runtime/react_host.mbt`）

约 224 行，照搬 `host_browser.mbt`，只把最后一跳从 `document.update(vnode)` 换成 `(self.frame)(output.read())`；
另加：可注入的 `schedule_task` / `schedule_frame`（RN 没有 `window`）、同步 `start()`、
`on_frame` 注册、诊断计数器。`internal/runtime/moon.pkg` 的 `options(targets:)` 把它限定为 js（patch 12）。

### 2.4 `moon.mod` 的依赖

**只剩一个**：`moonbitlang/async@0.21.0`（`cmd/`、`http/`、`internal/rabbita/`、`internal/runtime/` 都在用）。
原有的 `hackwaly/moonback` 与 `moonbitlang/x` 已随 `server/` 一起裁掉 —— 见 §2.5。

---

## 3. 上游化提案（将来用）

按"最小、可独立接受"的顺序：

1. **`Event` 不要别名 `@dom.Event`** —— 让 `vdom` 拥有一个不透明的 `Event`，DOM 侧在边界转。
   收益：`Props` 的公开签名不再含 `@dom`；外部包可以正常注册事件处理器。
   （我们实测：不改这个，外部包**根本没法写 handler**。）→ **就是 patch 08 的 B**
2. **几处 DOM 事件解码做成可替换策略**（`form_value_from_event` / `mouse_event_from_dom`）。
   `mouse` 那处现在在**任何非浏览器宿主上都会 panic**，不只是 RN。→ **patch 02/03/14**
3. **`Props` 补一组访问器/构造器**（`empty` / `style` / `on` / `attr` / `each_handler`），
   理由同上：字段私有导致非 DOM 后端无法使用这个类型。→ **patch 08 的 D**
4. **`internal/vdom` 拆成 `tree` + `dom` 两个包** —— 让树这一层彻底不依赖 `dom`。
   （我们**没做**：需要公开 `vdom` 的大量私有内部，收益 0 字节。上游做才对。）
5. `Props.styles` 加宽成类型化值 —— 这条上游不一定要接受，属设计取向。

---

## 4. 上游版本现状与升级（2026-09 实测）

| 项 | 数据 |
|---|---|
| 我们 vendor 的 | **0.15.4** |
| 注册表最新 | **0.16.0** |
| 上游仓库 tag | 只有 6 个；0.15.x 只有 `rabbita-v0.15.6` → **0.15.4 无 tag** |
| 上游仓库形态 | **monorepo**（库在 `rabbita/` 子目录，另有 `rui` / `warren` / `vite-plugin` / `website`） |
| 0.15.4 → 0.16.0 改动 | **72 / 220 个文件（33%）**，其中 44 个是"被重写/变短"；+3 / −3 文件 |
| 改动最重的目录 | `internal/` 16/36、`dom/` 20/79 |
| **与我们冲突的文件** | **5 个**：`internal/vdom/{vdom,diff,ssr}.mbt`、`html/html_utils.mbt`、`internal/runtime/moon.pkg`（另外 8 个我们改过的文件上游没动，patch 可直接重放） |
| 上游有没有采纳我们的提案 | **没有**：0.16.0 里 `Event` 仍别名 `@dom.Event`、`Props.styles` 仍是 `Map[String, String]` |
| 0.16.0 里的 breaking 改动 | `refactor(js)!: migrate to standard async Promise` —— `js/async.mbt` 从 `pub async fn suspend` 变成 `pub type Promise[T] = @js_async.Promise[T]`，`js/js.mbti` 被删，`internal/runtime/moon.pkg` 的依赖从 `moonbitlang/async/js_async` 换成 `rabbita/js` |
| 对我们有价值的 | 只有一条：`feat: add HTML memoization`（长列表性能，对应新 `PLAN.md` 的 D 轨道） |

**结论与触发条件**：现在**不升** —— 换来的东西（SSR 修复、dom 修复、依赖对齐）对我们几乎没用，
代价却是重做 5 处核心 patch + 一个 breaking 的 async 迁移 + 全套验证重跑。
升级时机：**P5（yi 在真机跑通）之后**，或者我们**具体需要** memoization 那类收益时。

**升级演练的做法（时间盒 + 回退）**：

```bash
git switch -c drill/rabbita-0.16.0
bash _tools/vendor_sync.sh --from 0.16.0 --check   # 先看冲突落在哪几个 patch
# 逐个 --capture 重做冲突的 patch，然后：
moon check --target js && bash _tools/check_external.sh && node _verify.js
# 判据全绿才算成功；超时/冲突爆炸就切回主分支 —— 回退只是一条 git 命令
```

---

## 5. 已知未验证项

- **`diff.mbt`（DOM 后端）只跑过 vendored 的 mock-DOM 单测**（4/4 通过），
  没有在真实浏览器里跑过完整的 rabbita Web 应用。
- `hydrate.mbt` / `ssr.mbt` 我们没碰，也未验证。
- `server/`（SSR/HTTP）**从未被编译过**：它声明 `native+wasm`，而我们只跑 js。
  它还是唯一在 main 代码里 import 模块根包的包 —— 死重清单见 `docs/ARCHITECTURE.md` §3.3。
