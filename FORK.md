# FORK.md —— 我们对 rabbita 的改动清单

> **为什么有这个文件**：moobile 把 `moonbit-community/rabbita@0.15.4` fork 进本模块
> （原因见 `README.md` 的「原理」一节）。当前策略是 **vendor 跟版**，
> 所以必须有一份**精确、可重放**的改动清单 —— 否则 rabbita 一发版就得靠考古。
>
> 📌 **现在的真相不是本文的手抄步骤，而是 `tools/patches/` 里的 33 个 patch。**
> 本文的作用是：解释每个 patch 在干什么、为什么，以及跟版/升级时怎么用。
> 机器可验证：`bash tools/vendor_sync.sh --check`（断言「工作区 == 上游 + 这些 patch」）。
>
> 这份清单同时也是将来上游化的提案基础（见 §3）。
> 记录日期：2026-09（对应 rabbita 0.15.4）

---

## 0. vendor 方式（生成式：第三方代码不进仓）

| 项 | 做法 |
|---|---|
| 位置 | **`vendor/rabbita/`**（一个目录），与我们自己的 `style/` `sqlite/` 平级 |
| 版本 | `tools/vendor.lock` 里的 `RABBITA_VERSION=0.15.4`（**注册表制品**，不可变） |
| 改动 | `tools/patches/*.patch`（**14 个**，按编号顺序 `patch -p1`；原 13 号随 `server/` 一起裁掉）。⚠️ patch 里的路径是**搬家前**的布局（`internal/vdom/…`、`html/…`），见 §0.1 |
| 生成器 | `tools/vendor_sync.sh`（`--check` / `--apply` / `--capture` / `--from`）+ `tools/vendor_relocate.py`（布局搬家） |
| 是否入库 | **否**。整个 `vendor/` 在 `.gitignore` 里；仓库只跟踪我们自己的代码 + patch + 脚本 |
| 有意裁掉的包 | `server/`（rabbita 的 SSR/HTTP）—— 见 §2.5 |
| 为什么不用 git submodule | 上游 0.15.x **只有 `rabbita-v0.15.6` 一个 tag**，我们 vendor 的 0.15.4 没有 tag；能找到的最近提交跟注册表那份还差 49 处。**能精确钉住的只有注册表版本号** |
| fork 的根包去哪了 | `top.mbt` / `incremental.mbt` / `deprecated.mbt` / `tea.mbt` / `render_test.mbt` / `moon.pkg` / `README.mbt.md` → `vendor/rabbita/rabbita/`（这样模块根包 = moobile 库本体，见 `docs/ARCHITECTURE.md` §5「形态 B」） |

### 0.1 布局：`internal/*` 被**摊平**（`internal` 的可见性规则）

> ⚠️ 这一节推翻了本文件此前的说法（"fork 必须铺在模块根"）。**前半句对，结论错**。
> 完整实验记录见 [`docs/FINDINGS.md`](docs/FINDINGS.md) 的 **R3**。

| 问题 | 实测结果 |
|---|---|
| `internal` 的可见性怎么判 | **只认路径段恰好等于 `internal`**（`…/internal_vdom/` 不受限，`…/internal/vdom/` 受限） |
| 铺在模块根时根包能 import 吗 | ✅ 能（根就在前缀里）—— 所以旧的"必须铺在根"当年确实能跑通 |
| 放 `vendor/rabbita/internal/vdom` 呢 | ❌ `Cannot import internal package … due to internal visibility rules` |
| 加一层"公开再导出包"绕过？ | ❌ **不通**：类型只能被**命名**、不能被**使用** —— 变体匹配报 `is an alias to a type in …, which is not imported`、结构体构造报 `Value X not found`、字段访问报 `… type and not a struct`、方法报 `Cannot define method for foreign type` |
| 正确做法 | **摊平**：`internal/vdom` → `vendor/rabbita/vdom`、`internal/rabbita` → `vendor/rabbita/rabbita`（丢掉 `internal` 这一段），再把所有 `moon.pkg` 的 import 路径跟着改写 |

映射与两个方向都在 `tools/vendor_relocate.py`：`--apply`/`--check` 用「旧布局 → vendor」，
`--capture` 用「vendor → 旧布局」（否则回写出的 patch 打不上 pristine）。
`vendor_sync.sh` 在**打完 patch 之后**才调用它 —— patch 的 `+++ b/路径` 是按旧布局写的，顺序不能反。

---

## 1. 日常怎么用

```bash
bash tools/vendor_sync.sh --check      # 断言「工作区 == pristine + patch」；CI / 提交前跑
bash tools/vendor_sync.sh --apply      # 铺开第三方代码（新克隆、或升级换版本后）
bash tools/vendor_sync.sh --capture    # 把工作区里的改动回写成 patch
bash tools/vendor_sync.sh --from 0.16.0   # 换基准版本（试升级），配合 --check 看冲突落在哪
```

⚠️ **第三方目录是 gitignore 的，`git status` 不会提醒你漏了 `--capture`** ——
所以：**改了 `vendor/rabbita/html/`、`vendor/rabbita/vdom/` 这些地方的代码之后，提交前一定先 `--capture`，再 `--check`。**
改完顺手 `bash tools/lf_normalize.sh` 统一行尾（CRLF 会把 patch 的上下文打乱）。

---

## 2. patch 系列（33 个，按应用顺序）

> ⚠️ **条数只是 `ls | wc -l` 的结果，判据永远是 `--check`。** 2026-10-02 的 `--capture` 把
> 6 个**此前没有独立 patch 的既有 fork 文件**按路径拆成了 `28`~`33` —— 那是等价重构，不是补漏
> （capture 前后 `--check` 都通过，且结果逐文件相同）。

| # | patch | 触及 | 一句话 |
|---|---|---|---|
| 01 | `01-html-attrs-style-api` | `html/attrs.mbt` | 删 `Attrs::style(key, value)`，换成类型化的 `Attrs::styles(@style.Style)`；**2026-09 追加**：新增 `prop_str/prop_bool/prop_int/prop_num/prop_json` 五个公开方法 —— `attribute`/`property` 此前是包内私有，于是**外部组件库的 props 一个都传不进去**（见 [`docs/design/DESIGN-COMPONENT-LIBRARY.md`](docs/design/DESIGN-COMPONENT-LIBRARY.md) N3） |
| 02 | `02-html-attrs-event-decode-table` | `html/attrs_event.mbt` | 13 处事件解码改成**查表**（可替换策略），不再直接 `to_xxx_event().unwrap()` |
| 03 | `03-html-html-utils-form-value` | `html/html_utils.mbt` | 表单取值与 `prevent_default/target` 走同一张表 |
| 04 | `04-html-readme-doctest` | `html/README.mbt.md` | README 里的**文档测试**样例跟着 01 改（它是会参与编译的测试文件） |
| 05 | `05-html-moon-pkg` | `html/moon.pkg` | 加 `style`、`core/ref` 依赖；把 `event_decoders.mbt` 限定为 js |
| 06 | `06-svg-attrs-style-api` | `svg/attrs.mbt` | 与 01 同款：`Attrs::style` → `Attrs::styles` |
| 07 | `07-svg-moon-pkg` | `svg/moon.pkg` | 加 `style` 依赖 |
| **08** | **`08-vdom-event-decouple-props-widen`** | `internal/vdom/vdom.mbt` | **核心**：`Event` 与 `@dom.Event` 解耦 + `Props.styles` 类型化 + `Props` 补一组对外访问器（106+/7-）。**2026-10-02 追加**：`Props` 的四张表由可变 `Map` 改成 **`PropsTable[V]`（包 core 的 `immut/hashmap`）** ⇒ `Props::copy()` 从"逐条重插四张表"变成 **O(1) 指针拷贝** —— 那是**每元素每帧**都在跑的一段，实测 **−32.4%（N=1000）/ −29.3%（N=5000）**。**语义与契约零变化**（复制这个动作保留）。⚠️ 上游 0.16 **没有**这一改动（它仍是 `copy_map` + `Map`）⇒ 这是**我们的分歧**，跟版时要重放 |
| 09 | `09-vdom-diff` | `internal/vdom/diff.mbt` | 事件监听与样式消费跟着 08 的类型走 |
| 10 | `10-vdom-ssr` | `internal/vdom/ssr.mbt` | `write_styles_attr` 的参数类型加宽 |
| 11 | `11-vdom-moon-pkg` | `internal/vdom/moon.pkg` | 加 `style` 依赖；**2026-10-02 追加**：加 `moonbitlang/core/immut/hashmap`（patch 08 的 `PropsTable` 用它） |
| 12 | `12-runtime-moon-pkg` | `internal/runtime/moon.pkg` | 给 `react_host.mbt` 加 js 限定（与 15 配套）；**2026-10-03 追加**：把 `moonbitlang/async/js_async` **显式加回来** —— 上游 0.16 把它换成了 `rabbita/js`，但我们 fork 的 `react_host.mbt` 仍用 `@js_async.Promise::from_async`（上游 runtime 里**没有**这个文件） |
| ~~13~~ | ~~`13-server-moon-pkg-rabbita-root`~~ | — | **已随 `server/` 一起裁掉（2026-09）**，见 §2.5 |
| 14 | `14-new-html-event-decoders` | `html/event_decoders.mbt` | **新增文件**（122 行）：解码表 + `dom_decoders()` + `passthrough_decoders()` |
| 15 | `15-new-runtime-react-host` | `internal/runtime/react_host.mbt` | **新增文件**（224 行）：moobile 的 React 后端 |
| 16–26 | `16-new-clipboard-moon.pkg` … `26-new-websocket-moon.pkg` | 11 个包的 `moon.pkg` | **搬迁补录**（2026-09）：`XiLaiTL/moobile/<pkg>` → `XiLaiTL/moobile/vendor/rabbita/<pkg>` 的 import 改写，覆盖 R3 搬迁时漏记的那些包（`clipboard` `cmd` `dialog` `dom` `html/canvas` `http` `internal/duplix` `internal/rabbita` `nav` `sub` `websocket`）。**是机械改写、无语义变化** —— 落盘前它们一直是"未捕获的工作区改动"，`vendor_sync --check` 因此不可能绿 |
| **27** | **`27-new-html-payload.mbt`** | `html/payload.mbt`（**新增文件**）+ `html/moon.pkg` 的一行 `targets` | **事件载荷通道**：`Attrs::on_raw(event, f : (Payload) -> Cmd)` + `Payload::text/json/num/bool/field`。原有的 `on_*` 载荷在 React 后端是**零值**（`event_decoders.mbt` 的透传表），于是 `Input`/`Select` 这类受控组件"能画、能点、不能用"；这条通道把**真实值**交回应用。⚠️ 旧的 `on_*` 签名**一个都没动**（它们是对 DOM 的承诺）—— 这是**平行**通道。设计见 [`docs/design/DESIGN-COMPONENT-LIBRARY.md`](docs/design/DESIGN-COMPONENT-LIBRARY.md) §5 T1 |
| 28–33 | `28-new-sub-sub.mbt` … `33-new-sub-sub_url_wbtest.mbt` | `sub/sub.mbt` · `cmd/host_native{,_wbtest}.mbt` · `sub/sub_{visibility,resize,url}_wbtest.mbt` | **搬迁/拆分补录**（2026-10-02 `--capture` 重新分组时按路径拆出）：都是**既有** fork 文件，此前被别的 patch 连带覆盖或未单独成条。**无语义变化**（capture 前后 `--check` 都通过） |
| **34** | **`34-new-internal-vdom-ssr_wbtest.mbt`** | `internal/vdom/ssr_wbtest.mbt` | patch 08 的**配套**（2026-10-02）：白盒测试里 `Props::new({}, {}, {}, {})` → `Props::empty()`（四张表换成 `PropsTable` 之后空表要这么造） |

### 2.5 有意裁掉的包：`server/`

`server/` 是 rabbita 的 SSR / HTTP 那一套。裁它的理由是审计出来的，不是感觉：

| 检查 | 结果 |
|---|---|
| 谁依赖 `server/` | **没有任何包**（连 fork 内部都没有）——它是叶子 |
| 谁用 `hackwaly/moonback` | **只有 `server/moon.pkg`** |
| 谁用 `moonbitlang/x` | **也只有 `server/moon.pkg`**（`x/path`） |
| 它被编译过吗 | **没有**：它声明 `supported_targets = "native+wasm"`，而我们只跑 js |

代价与收益：**裁掉一个包 = 去掉两个依赖（3 → 1）**，发布包少两个文件。
验证：`moon check` 0 错误、`tools/verify_web.js` 26/26、`check_external.sh` 通过、`vendor_sync.sh --check` 一致。
恢复办法：把 `server` 加回 `vendor_sync.sh` 的 `FORK_DIRS`、恢复 13 号 patch、把两个依赖加回 `moon.mod` 即可。

**不属于 patch 的三件事**（由脚本做，见 `tools/vendor_sync.sh` 的铺开步骤）：

1. **模块名替换**（`moonbit-community/rabbita` → `XiLaiTL/moobile`，影响约 13 个 `moon.pkg` 与 1 处注释）——
   用 `sed` 而不是 patch，因为**上游将来新增的文件 patch 覆盖不到，sed 才能全覆盖**。
2. **布局搬家**（fork 的 7 个根文件 → `internal/rabbita/`）。
3. **删生成物**（`pkg.generated.mbti`，由 `moon info` 重新生成）。

**也不属于 fork diff 的东西**：`style/`（我们自己的公开包，直接入库）、
模块根包（`host.mbt` / `render.mbt` / `app.mbt` / `store.mbt` / `schedule.mbt`）、
`examples/apps/todo-app/`、`examples/apps/todo-app/host/`、`tools/`。

### 2.1 核心 patch 08 的细节（`internal/vdom/vdom.mbt`）

| # | 改动 | 说明 |
|---|---|---|
| A | `Props.styles` 类型：`Map[String, String]` → `Map[String, @style.StyleValue]` | 加宽成类型化值 —— 于是"样式值必须按 key 分类"这件事由**类型**保证，不再需要运行时白名单 |
| B | `Event` 类型：`#cfg(target="js") type Event = @dom.Event` → `#external pub type Event` | **解耦**：不再别名 `@dom.Event`，且对外可命名（不改这个，外部包**根本没法写 handler**） |
| C | 新增 `dom_event` / `pub as_dom_event` | 边界强转（`%identity`），DOM 侧用 |
| D | 新增 `Props::empty / styles / on / attr / prop / styles_map / attrs_map / props_map / each_handler` | `Props` 字段是私有的，外部包既读不到也注册不了事件；这组是必要的对外入口 |
| **E** | **（2026-10-02）新增 `PropsTable[V]`，并把 `Props` 的四张表换成它** | **性能**：四张表原本在**每个元素每帧**被 `Props::copy()` 整份复制（逐条重插）—— `resolve_attrs` 要给每个元素一份"私有草稿纸"写它自己的 `class`/`style`/`on_click`。换成**不可变**表之后这次复制退化成 **O(1) 指针拷贝**，实测 **−32.4%/−29.3%**，而**契约与语义零变化**。<br>⚠️ **为什么是包装类型而不是直接换字段类型**：`PropsTable` 提供 `#alias("_[_]=_")` 等一小撮方法，于是上游 `html/`+`svg/` 里 **~200 处 `self.0.attrs["x"] = v` 与成百处 `.get/.contains/for…in` 一个字都不用改**；换字段类型则要动它们全部（且漏一处是**静默 bug**，而换类型漏一处是**编译错误**）。<br>⚠️ **`Props::copy()` 的语义没变**：不可变结构共享是安全的 —— "改副本"等于把那一格换成一张新表，原件不受影响。<br>⚠️ **上游 0.16 没有这一改动**（仍是可变 `Map` + `copy_map`）⇒ 跟版时**必须重放本 patch** |

### 2.2 patch 02/03/14：为什么是"一张表"而不是"逐个修"

普查（`docs/evidence/r1/dom_survey.txt`）显示 `html/` + `svg/` 里共 **45 处 `@dom.`**，
其中**同一形状的 panic 有 13 个**（mouse / keyboard / focus / drag / clipboard /
composition / wheel / input / submit / Mouse / Keyboard / Scroll …）。
只修 mouse 那一处等于把同样的雷留给其余 12 个 ——
而 **yi 的罗盘拖拽（`on_mousedown/move/up` 读 `Mouse` 坐标）正好踩在里面**。

**换来的语义要说清楚**：是"**不崩、可降级**"，不是"载荷等价"。
`Mouse`/`Keyboard`/`Scroll` 在 React 后端一律返回**零值**，
读取它们的处理器会拿到 0 —— 真实手势数据要接 RN 手势系统（设计文档 R2 / 旧计划 `docs/plan/PLAN-2026Q3-yi-port.md` 的 T3.4）。

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

## 4. 上游版本现状与升级

### 4.1 **已完成：0.15.4 → 0.16.3**（2026-10-03，分支 `drill/rabbita-0.16.0`）

分两步落：**0.15.4 → 0.16.0**（先做，拿到一个已知可用的落点）→ **0.16.0 → 0.16.3**（上到最新）。

| 项 | 值 |
|---|---|
| 现在 vendor 的 | **0.16.3**（`tools/vendor.lock`） |
| 落地的判据 | `moon check --target js` **0 错误** · `tools/verify_all.sh` **24 / 24** · 基准**不回归**（见下表） |
| **P1（`PropsTable` 那张不可变表）** | ✅ **两步都保住了**（0.16.3 的 `vdom.mbt` 里 24 处；见 §2.1 的 E 行） |
| 第一步 0.15.4 → 0.16.0 要手工重做 | **4 个** patch：`04`(html/README) · `08`(vdom.mbt) · `09`(diff.mbt) · `28`(sub.mbt)；其余 29 个直接重放 |
| 第二步 0.16.0 → 0.16.3 要手工重做 | **只有 1 个**：`04`（`html/README.mbt.md` 的文档测试）—— 其余 **32 个直接重放**，而且**一行代码都不用改** |
| 冲突的性质 | 几乎全是**尾逗号格式位移**（上游跑过格式化），加三条真 API 变更（见 4.2） |
| 可重建性 | 33 个 patch 在**干净**的 0.16.3 基树上 **33/33** 打得上（每步都先 `patch --dry-run` 验收） |
| ⚠️ **预判 vs 实测** | 按"文件级 diff"估出来的冲突清单**两次都不准**：第一步预测 5 个文件、实测 4 个且**名单不同**；第二步预测 3 个额外路径、**实测只有 1 个** ⇒ **判冲突必须实跑重放**（见本节末的两条硬规矩） |

**基准（`tools/perf_bench.mjs`，同会话交错，各 9 次 `min` 统计量）**：

| N | 0.15.4 + P1（旧工具链） | 0.16.0（旧工具链） | **0.16.3（新工具链）** |
|---|---|---|---|
| 1000 | 7.40 / 7.22 ms | 7.36 ms | **7.50 ms** |
| 5000 | 46.62 / 46.70 ms | 47.52 ms | **47.61 ms** |

（"0.15.4 + P1" 那列有两个数，是因为跨了两次会话 —— 每次都按**各自会话内**的对照读。）

⇒ **整套升级既没变快也没变慢**：0.16.0 那一刀 −0.6% / +1.9%，0.16.3 那一刀 +3.9% / +2.0%（按 `min` 统计量），
但按 `min` 中位是 −0.6% / −0.4% —— **两种统计量符号相反、区间都重叠** ⇒ 差异在噪声内。
⚠️ **口径**：0.16.3 那一次**同时动了两个变量**（工具链 + 上游版本），所以它只回答"整套有没有变慢"，
**不回答各自的贡献**。

**换来的东西**：`memo` / `memo_by` / `VNode::thunk`（⚠️ **要应用自己调**，不是自动记忆化）
以及"不再落后两个小版本"。

⚠️ **但这把刀原本在我们这条通道上是空转的**（2026-10-03 实测）：`VNode::Thunk` 的哈希在
`render.mbt` 里被直接丢掉（`Thunk(_, f) => render_node(f(), sched)`）⇒ 开不开 `memo` 一模一样。
**已接通**（`MCtx`：按孩子序号路径定位、惰性建、命中就复用旧元素）：
`dom` 档 **14.29 → 0.43 ms（−97%）**、每帧新建元素 **7007 → 7**（区间不重叠；全量门 24/24）。
⚠️ 那是"每帧只改表头"这个访问模式的上界。全部数字、证据与边界见 `docs/PERF.md` §11。
⚠️ **代价**：不用 `memo` 的应用付 `translate` +2.0%（区间重叠）/ `dom` +0.4%（每节点一次路径记账）。

⚠️ **键给错的后果是"画旧内容"**（这是 `memo` 自己的契约：键相同必须蕴含 HTML 与 handler 等价）。
位置键（`by = 行号`）在列表头部插入一行之后就会错配 —— 用它之前先读上游 `html.mbt` 的文档。

### 4.2 换底撞到的三条真 API 变更（都会溅到应用层）

| 变更 | 上游改了什么 | 我们要做什么 |
|---|---|---|
| `@js.Promise` | 变成 `Promise[T]`（`js/async.mbt` 从 `suspend` 变成类型别名） | `sqlite/` 的三个 FFI 填 `[Unit]` / `[String]`，并去掉多余的 `.cast()` |
| `@common.Viewport` | `width` / `height` 由 **`Int` 变 `Double`**（`Window::inner_width/inner_height` 同改） | 库侧"宿主载荷"那条显式 `.to_double()`；`todo-app` 与 `zhouyi-reader` 的载荷显式 `.to_int()`（**在边界转，不改两端的松紧**） |
| `internal/runtime/moon.pkg` 的依赖 | `moonbitlang/async/js_async` → `rabbita/js` | ⚠️ **我们 fork 的 `react_host.mbt` 仍需要 `@js_async`**（上游的 runtime 里**没有**这个文件）⇒ patch 12 把它**显式加回来**（原文见 §2.1 / patch 12） |

### 4.3 上最新（0.16.3）：**工具链已升级**（2026-10-03），拦路虎已消失

**为什么必须升工具链**：0.16.3 把 `cmd/operation.mbt` 的 `pub(all) extenum Extension {}` 改成
**不写体的** `pub extenum Extension`，而当时本机的 `moon 0.1.20260827` / `moonc v0.10.11`
**解析不了**（最小探针实测 `Error [3002] missing '{'`；0.16.0 用带 `{}` 的旧写法，所以不受影响）。

**已经升完**（本机）：

| 组件 | 原来 | 现在 |
|---|---|---|
| `moon` | `0.1.20260827 (d0aaa07)` | **`0.1.20260920 (914d7da)`** |
| `moonc` | `v0.10.11+8f8e8db1e` | **`v0.10.14+7d59c7ec9`** |
| `core` | `0.10.11+6ff76a5f9` | **`0.10.14+7d59c7ec9`** |

**验过的判据**：`moon check` 0 错误 · `verify_all.sh` **24 / 24**（在 0.16.0 那棵树上；
⚠️ 警告数 **89 → 391**，新 lint 更严，但没有把任何一条门弄红）·
**不写体的 `extenum` 现在编得过**（带对照探针实测）⇒ **0.16.3 已可达**。

**怎么升的（照这个来，坑都在里面）**：
1. `moon upgrade` **要 TTY**（非交互 shell 下连 `-f` 都报 `IO error: not a terminal`）⇒ 别走它。
2. 走官方归档：`https://cli.moonbitlang.cn/binaries/latest/moonbit-windows-x86_64.zip`（**带 `.sha256`，先校验**）。
   ⚠️ 版本化 URL（`binaries/0.1.20260920/…`）**不存在** —— 服务器只发 `latest` ⇒ 想钉版本只能自己存归档。
3. **归档不含 `lib/core`**：另下 `https://cli.moonbitlang.cn/cores/core-latest.tar.gz` 解到 `~/.moon/lib/`。
   ⚠️ **core 必须与工具链配套** —— 只换 `bin/` 会得到 `BytesView has no method unsafe_read_uint32_le`
   这类**看起来像代码问题**的报错（旧 core + 新 moonc）。
4. **还要跑官方脚本里那一步**：`moon -C ~/.moon/lib/core bundle --warn-list -a --all`
   （外加 `--target wasm-gc`）。漏了就是 `_build/…/bundle/*.mi: No such file or directory`。
5. ⚠️ Windows 上 `moon.exe` 可能**被占用**（本轮是我自己那次卡住的 `moon upgrade` 占着）⇒ `cp` 报
   `Device or resource busy`；**改名绕开**即可（Windows 允许重命名运行中的 exe），别硬删。
6. 先备份 `cp -r ~/.moon/{bin,lib}`（约 350 MB）—— 那是**唯一**的回退路径（工具链不在 git 里）。

**0.16.3 已完成**（同日）：实际**只有 1 个** patch 要重做（`04` = `html/README.mbt.md` 的文档测试，
两块都取我们那侧），其余 **32 个直接重放**，而且**一行代码都不用改**。
⇒ 上到最新这一步的代价比预判**小得多**（预判"3 个额外冲突路径"，实测 1 个）。判据见 §4.1 的表。

<details>
<summary>2026-09 的演练预案（当时的预测，保留以便对照）</summary>

| 项 | 当时的数据 / 判断 |
|---|---|
| 注册表最新 | 0.16.0 |
| 上游仓库 tag | 只有 6 个；0.15.x 只有 `rabbita-v0.15.6` → 0.15.4 无 tag。⚠️ 后来实测：**`rabbita-v0.16.0` 也没有 tag**（所以 GitHub compare API 按 tag 取不到那一段） |
| 上游仓库形态 | monorepo（库在 `rabbita/` 子目录，另有 `rui` / `warren` / `vite-plugin` / `website`） |
| 0.15.4 → 0.16.0 改动 | 72 / 220 个文件（33%），其中 44 个"被重写 / 变短" |
| **预测的冲突文件** | **5 个**：`vdom{vdom,diff,ssr}.mbt`、`html_utils.mbt`、`runtime/moon.pkg` —— ⚠️ **实测是 4 个 patch，而且名单不完全一样**（`ssr` / `html_utils` / `runtime` 这三个其实被 `patch` 的上下文吸收掉了；真正失败的是 `04`/`08`/`09`/`28`）。**"文件被改过" ≠ "patch 打不上"** —— 要判冲突得**实跑重放**，不能按文件级 diff 估 |
| 上游有没有采纳我们的提案 | **没有**（`Event` 仍别名 `@dom.Event`、`Props.styles` 仍是 `Map[String, String]`） |
| 当时的结论 | "现在不升"，触发条件 = **我们具体需要 memoization 那类收益时** ⇒ D 轨道就是这个时机 |

</details>

**演练 / 升级的做法（时间盒 + 回退）**：

```bash
git switch -c drill/rabbita-0.16.0
bash tools/vendor_sync.sh --from 0.16.0 --check   # 先看冲突落在哪几个 patch
# 逐个重做冲突的 patch（手法见下），然后：
moon check --target js && bash tools/verify_all.sh && node tools/perf_bench.mjs ...
```

**重做冲突 patch 的正确手法**（这轮踩过坑，照这个来）——**三方合并，别手改 patch 文本**：

```bash
# 三棵树（每棵都要先验干净：无 *.rej/*.orig、无"我们加的东西"）
#   base=旧版 BASE   ours=base+全部 patch   theirs=新版 BASE
git merge-file -p ours/<f> base/<f> theirs/<f> > merged/<f>     # 解冲突，看语义
diff -u --label a/<f> --label b/<f> theirs_base/<f> merged/<f> > tools/patches/<n>-....patch
```

⚠️ **两条硬规矩**（本轮各栽过一次）：

1. **拿来做基准的树必须是 pristine 的独立目录**。在一棵树里跑过 patch 重放之后又拿它当"上游"，
   会把**我们自己的改动**当成"上游已有的" ⇒ 于是**悄无声息地丢掉我们加的东西**
   （本轮 `sub/sub.mbt` 的两个 helper 就这么丢过一次，症状是"编译过了但标识符 unbound"）。
2. **patch 的上下文行不能靠 `patch` 的 fuzz 侥幸通过**。上游改了我们 patch 的上下文行时，
   fuzz 会把那一行**丢掉并报告成功** —— 本轮 `runtime/moon.pkg` 的 `js_async` 依赖就是这么没的。
   ⇒ **`--check` 全绿不构成"改动完整"的证据**，必须单独核对"我们加的东西还在不在"
   （本轮的做法：`grep -c PropsTable`、`grep viewport_of_payload` 这类**点名断言**）。

### 4.4 回退（0.16.0 → 0.15.4）

```bash
git switch main && git checkout tools/patches tools/vendor.lock   # 回到升级前那份 patch 系列
bash tools/vendor_sync.sh --apply                                  # 按 0.15.4 + patch 系列重建 vendor
```

⚠️ **`vendor/` 不在 git 里 ⇒ "切分支"保护不了它**。升级前必须自己备份：
`tar -czf vendor-backup.tgz vendor/` + `tar -czf patches.tgz tools/patches/`（本轮就是这么做的，
另外还单独存了未提交 patch 的差分）。

---

## 5. 已知未验证项

- **`diff.mbt`（DOM 后端）只跑过 vendored 的 mock-DOM 单测**（4/4 通过），
  没有在真实浏览器里跑过完整的 rabbita Web 应用。
- `hydrate.mbt` / `ssr.mbt` 我们没碰，也未验证。
- `server/`（SSR/HTTP）**从未被编译过**：它声明 `native+wasm`，而我们只跑 js。
  它还是唯一在 main 代码里 import 模块根包的包 —— 死重清单见 `docs/ARCHITECTURE.md` §3.3。
