# FINDINGS.md —— 实现侧的实测结论（原 README）

> 这份文档是**研究与实测记录**：R1 排版判决、样式差集、DOM 缝隙普查、
> fork 配方、S1/F2–F7/N1– 等逐条发现。想快速了解这个项目，看仓库根的
> [`README.md`](../README.md)；想看"当初为什么这么定"，看这里。

---

# moobile

> **用 MoonBit 写一次 UI，交给 React / React Native 渲染。**
>
> **R1 已判决：可接受 ✅** —— `docs/design/DESIGN.md` §6 说它是
> 「**唯一可能"做完了发现效果不可接受"的地方**」。已在 **Android 14 真模拟器**上用
> 真实文本引擎量过：最长的爻辞正确换行成 2 行、小象的行内流成立、
> `min-width` 与 grid→flex 降级都精确吻合。**详见文末「R1 判决」**。
>
> **状态**：地基（vendor fork / 类型化样式层 / 翻译层 / 真机验证 / R1 判决）都通了；
> **正题（把 `interest/yi` 搬过来）还没开始**。五项目标里 (1)(2)(4)(5) 完成，
> (3) 完成 `Event` 解耦这一半（另一半经论证不做，见文末）。
>
> ✅ **代码与文档已同在一处**（2026-09 完成 `PLAN.md` 的 T0.0）：
> 项目根 = `interest/moobile/`，模块名 **`XiLaiTL/moobile`**，
> 原 `moobile_demo/` 已不存在。

---

## 文档

| 文档 | 内容 | 什么时候看 |
|---|---|---|
| **`PLAN.md`** | **剩余工作计划** —— 分阶段待办、每项**完成判据**、风险与决策点、建议顺序 | **接手第一件事** |
| **`DEV.md`** | **环境与运行手册** —— 工具链版本、磁盘布局与目录联接、怎么起 Web / 安卓、验证脚本、排错表、**禁区** | **动手前必读** |
| `FORK.md` | **对 rabbita 的 diff 清单** —— 跟版重放步骤 + 上游化提案 | 要动 vendor 代码时 |
| **`docs/ARCHITECTURE.md`** | **架构总览 + 「发布成 MoonBit 库」可行性** —— 分层与契约、包依赖闭包、发布体检（体积账/元数据/许可证/命名空间）、四种发布形态 | 想让**别人用上**这个库时 |
| `docs/design/DESIGN.md` | **设计文档（主）** —— 定位、架构、路线图、风险、未决问题 | 想查设计意图时 |
| `docs/design/DESIGN-FEASIBILITY.md` | **可行性验证记录** —— 全部实测数据、复现方式、已否决方案的论证链 | 想查依据时 |
| `docs/design/DESIGN-README.md` | 设计期的项目导读（留档） | 考古时 |
| 本文件 | **实现侧的实测结论** —— R1 判决、样式差集、DOM 缝隙普查 | 想查依据时 |

**代码侧的目录**（就在本目录下）：

| 目录 | 是什么 |
|---|---|
| `moon.mod` | 模块定义（模块名 `XiLaiTL/moobile`） |
| **模块根包**（`host.mbt` `render.mbt` `app.mbt` `store.mbt` `schedule.mbt`） | **库本体** —— `import { "XiLaiTL/moobile" @moobile }` 拿到的就是它 |
| `style/` | **公开包**：类型化样式层（使用者写视图的入口） |
| `internal/rabbita/` | vendor 的 rabbita **主包**（`App` / `run` / `Val` / `elmish`），2026-09 从模块根挪进去 |
| `internal/vdom/` `html/` `cmd/` `dom/` … | vendor 的 rabbita（改动清单见 `FORK.md`） |
| `examples/apps/todo-app/` | 演示应用：`ui.mbt`（待办）+ `r1.mbt`（R1 样本） |
| `examples/apps/todo-app/host/` | Expo 宿主（`App.js` 只有一个根组件） |
| `tools/` | 环境脚本（`android_env_setup.sh` 等） |
| `docs/evidence/r1/` | R1 的测量产出与原始数据 |

---

## 跑起来

```bash
./tools/build.sh                                  # moon build --target js → examples/apps/todo-app/host/moobile.js
cd host && npm run web                      # Expo web，http://localhost:8081

node tools/verify_web.js                             # 另开一个终端；需 dev server 已在 8081
```

`tools/verify_web.js` 用无头 Chrome（390×844 / DPR 2）真实加载页面，用**真实鼠标与键盘事件**走一遍
点击过滤 / 勾选 / 输入 / 添加 / 删除，并对每一步断言状态与 DOM，最后截图 + 做布局审计。

```
通过 26 / 26
布局审计 = {"overflowRight":[],"overflowBottom":[],"zeroSize":[],"docHeight":844,"nodes":46}
```

手机上看真机效果：`cd host && npx expo start`，用 Expo Go 扫码。

---

## 结构

```
moon.mod
moobile/              ← 库：moobile 本体（目标无关）
  vnode.mbt              VNode（4 构造器）+ Props（4 通道，styles 是核心）★ 复刻，非真包
  html.mbt               Html 包装 + 最小 DSL                     ★ 手写，非 rabbita/html
  render.mbt             ★ 4 分支递归 + 标签表 + 事件映射 + 样式键白名单
  host.mbt               ★ 与 JS 宿主对话的唯一一层（extern "js"）
  store.mbt              极简 Val：版本号 + 订阅/退订              ★ 玩具，非 rabbita 的 Val
examples/apps/todo-app/                 ← 应用：全新的小应用（待办清单，TEA）
  app.mbt                Model / Msg / update / view
  main.mbt               dispatch（带相等性判断）+ 三个导出给 JS 的入口
examples/apps/todo-app/host/                 ← 宿主：Expo（React + React Native + react-native-web）
  App.js                 一个根组件 + useSyncExternalStore，仅此而已
  moobile.js             ← tools/build.sh 生成的产物，不要手改
tools/verify_web.js            ← 端到端验证
shot-*.png            ← 验证时的截图
```

---

## 验证了什么 / 没验证什么

**这一节是本文档最重要的部分。** 上一版 README 把「我按设计文档重写了一遍设计文档」说成了「设计文档成立」，
这是错的。账要分明：

### ✅ 真的验证了

| # | 结论 | 为什么可信 |
|---|---|---|
| V1 | **MoonBit JS 产物能被 Metro 消费**：`options("link": {"js": {"format":"esm","exports":[...]}})` 产出的 ESM 直接 `import` 进 Expo，227 modules 打包成功 | 之前只是 EVIDENCE 里的记载，这次是真跑通 |
| V2 | **闭包可以双向穿越 JS 边界**：MoonBit handler 传进 React；React 的订阅回调传进 MoonBit；MoonBit 再把**退订闭包**返回给 JS | 三个方向都实测可用（`store.mbt` + `demo_subscribe`） |
| V3 | **`useSyncExternalStore` 的契约 MoonBit 能满足** → 设计文档 §4.2 的形状成立 | `snapshot` 返回 Int 版本号 + 订阅返回退订，一趟跑通 |
| V4 | **目标侧（RN）的四条硬约束** —— 见「目标侧发现」。**这四条是 RN 的性质，与源侧是谁无关**，换真实 RabiTa 树一样成立 | 这是本次唯一「可迁移」的资产 |
| V5 | 一个 4 分支递归确实很小（`render.mbt` ~40 行） | ⚠️ 但这是**自证**：树是我自己定义的。见 S1 |

### ❌ 没验证

| # | 设计文档的依赖 | demo 实际用的 | 状态 |
|---|---|---|---|
| S1 | `rabbita/internal/vdom` 的 `VNode` | 我**照文档复刻**的同形状类型 | **实测：外部模块拿不到**（见下） |
| S2 | `rabbita/html` 的 DSL、116 个标签 | 我手写的 9 个标签 | 没碰 |
| S3 | **`respo_css`（`RespoStyle` / `Css*` 枚举）** | 我直接塞字符串键值 | **完全没碰** |
| S4 | RabiTa 的 `Val` / `elmish` | 我写的玩具 `Store` | 没碰 |
| S5 | `tiye/react` 的 `create_element` | 我自己写的同类 extern | 只验了机制，没验那个包 |
| S6 | 真 Yoga 布局 + 平台文字栈 | react-native-web（浏览器 CSS flexbox） | 没碰 —— **而这是 R1 的未知量** |

**一句话：这个 demo 验证的是「目标侧那一半」，而设计文档的风险恰恰集中在没碰的「源侧那一半」。**

---

## 源侧发现：S1 是**阻断性**的（实测）

设计文档 §7 阶段 1 把「拆包」描述成：
> *唯一需要动 RabiTa 的地方，且是**包结构拆分，不是 API 改动***

实测下来这个描述**偏轻**。三条实验：

**实验 1 — 直接 import `internal/vdom`：编译器拒绝**

```
Error: Cannot import internal package moonbit-community/rabbita/internal/vdom@0.15.4
       in probe/rprobe/a@0.1.0 due to internal visibility rules
```

`internal` 是**编译器强制**的可见性规则，不是命名约定。

**实验 2 — 只 import `rabbita/html`，想给类型起名：名字不存在**

`rabbita/html` 的**公开接口文件**里到处是 `@vdom.*`：

```moonbit
pub(all) struct Html(@vdom.VNode) derive(Eq)
pub fn Html::from_vnode(@vdom.VNode) -> Self
pub fn Html::to_virtual_dom(Self) -> @vdom.VNode
```

但 **html 不转出类型名**：

```
Error: The type @html.VNode is undefined.
```

**实验 3 — 能拿到值，但只能当不透明值拿着**

```moonbit
let v = h.to_virtual_dom()          // ✅ 编过（类型靠推断）
let v : @html.VNode = h.to_virtual_dom()   // ❌ @html.VNode undefined
fn[T] smuggle(v : T) -> Opaque = "%identity"
smuggle(h.to_virtual_dom())         // ✅ 编过 —— 值能"走私"成不透明值
```

`rabbita/html` 的公开接口里也**没有任何遍历 / fold / map 类 API**，只有一堆元素构造器。

### 结论

> **外部模块能拿到真实 RabiTa 的 `VNode` 值，但既不能给它起名，也不能 `match` 它的构造器。**
> **因此那"4 分支递归"目前在 MoonBit 侧写不出来。**

走私路径技术上存在，但那意味着要拿 JS 去反射 MoonBit 的**内部值表示**来遍历 —— 那不是设计，是依赖编译器实现细节的 hack，编译器一升级就碎。

**这动摇了整个方案的立足点（§3.1「翻译函数是一个 4 分支递归」）。
demo 里那 40 行递归之所以成立，只因为树是我自己定义的。**

### 上游需要什么（比"拆包"更准确的说法）

不是「把包拆开」，而是 **让 `VNode` / `Props` / `Children` 变得可命名**。最小改法二选一：

1. `vdom` 移出 `internal/`（变成 `rabbita/vdom`），或
2. `rabbita/html` 公开转出类型名

**都不需要改任何行为** —— 这一点设计文档说对了，但「只是包结构拆分」低估了它，
因为公开签名已经被 `@vdom.*` 渗透，等于要求 RabiTa 承认 `VNode` 是其公开 API 的一部分。

---

## fork 配方（已实测）

### 关键事实：`internal` 的可见性**按模块**判

所以**只要 fork 进我们自己的模块，`internal/vdom` 自动对我们可见，`vdom` 源码一行都不用改。
不需要上游配合。** 实验（干净复现，0 错误）：

```
# 模块 probe/fork
internal/vdom/         ← 包
app/moon.pkg  import { "probe/fork/internal/vdom" }   ← ✅ 编过
```

对照：`vendor/internal/vdom`（嵌在子目录里的 `internal`）**仍然被拒**。
→ 规则是 **`internal` 必须直接在模块根下**。fork 时布局要保持这个形状。

### fork 的真实代价（量过）

| 项 | 数量 |
|---|---|
| 要改的 import 路径（`moonbit-community/rabbita*` 前缀） | **67 处**（全在 `moon.pkg`） |
| `.mbti` 里的引用 | 53 处 —— 但那是 `pkg.generated.mbti`，**删掉重生成即可** |
| `vdom` 本体 | 6 文件 1766 行，**不用改** |
| 可裁掉的包 | `dom` 7862 行 + `js` 1495 行 + `diff/hydrate/ssr` 1442 行 ≈ **1.1 万行** |

**结论：一次 sed + 删生成物 + 丢掉不用的包。机械活，不是项目。**

### 但要分两档，别混在一起算

| 档 | 内容 | 成本 | 破坏性 |
|---|---|---|---|
| **档一** | vendor 进自己模块，改 import 前缀 → `internal/vdom` 可达 | ~1 小时，机械 | **零** |
| **档二** | `styles` 通道加宽成类型化；`Event`/`@dom` 解耦 | 真设计 | 见下（一半零破坏） |

---

## 架构级改造的空间（实测依据）

`Attrs::style(key : String, value : String)` 收纯字符串这件事，**不只是"缝很窄"，
而是证明整个样式层可以重新设计**。三条证据：

**证据 1 — 缝是单点且窄的。** 一个写入函数、一个字段 `Props.styles`、每后端一处消费
（DOM 侧是 `diff.mbt` 里往 CSSOM `set_property` 塞）。爆炸半径可完整枚举。

**证据 2 — 没有任何既有类型化样式 API 要对齐。** 所以对 `StyleValue` 长什么样**毫无约束**，
可以直接把它定义成「可移植子集」本身。

**证据 3（决定性）— 没有人用这个通道。** `interest/yi` 实测：

| 项 | 数量 |
|---|---|
| `class=` 引用 | **136** |
| `style=` 内联 | **0** |
| `Attrs::style(...)` 调用 | **0** |
| `attrs=` 调用 | **1**（`main.mbt:1203`，是 canvas 的 `width`/`height` + 鼠标事件，**与样式无关**） |

**唯一的真实应用一次都没用过结构化样式通道。** 通常"改接口形状"的代价在既有调用点，
而这里**调用点是 0** —— 加宽 `styles` **不破坏任何代码**，迁移成本不是"低"，是**没有**。

> 顺带更正 DESIGN §7 阶段 5 的「样式改用可移植子集重写（198 条 → 90 个组件的样式属性）」：
> 那不是一次**移植**，而是**第一次把这些样式写进新通道**。既然无论如何都是新写，就该一次写对。

### 由此能做一件设计文档想做但做不到的事

```moonbit
pub enum StyleValue {
  Px(Int)
  Percent(Double)
  Color(String)
  Keyword(Kw)
  // 故意没有 Grid / Sticky / PseudoBefore
}
```

枚举里**根本没有**那些构造器，于是「Web 能跑、移动端不能」**在编译期就不可能发生**。
这把 DESIGN 原则 3（可移植子集优先于表达力）和 §8 Q3（样式子集的边界画在哪）
从**运行时降级策略问题**变成了**类型系统问题**。

**前提恰好是两个：拥有 fork + 没有历史包袱。** 现在两个都有。

### 三条约束（别高估）

1. **样式缝便宜 ≠ fork 便宜。** 另一处耦合是 `Event`：
   ```moonbit
   #cfg(target="js")      type Event = @dom.Event
   #cfg(not(target="js")) type Event = Unit
   ```
   **RN 也是 `target="js"`** —— 编译器分不清浏览器和 RN。RN 上你会拿到一个不存在的 DOM 事件类型，
   还得把 7862 行 `dom` 一起编进去。修它要让 `Event` 按后端参数化 ——
   **这是真正的 API 形状改动，字符串变类型救不了。**
   这是 DESIGN §7 阶段 1「只是包结构拆分，不是 API 改动」**第二处、更实在的偏轻**。
2. ~~**Web 后端若保留**（§8 Q6 建议保留），fork 必须**新增** `StyleValue → CSS 字符串` 序列化。~~
   **已推翻，见下节 —— 根本不该保留 Web 后端。**
3. **两边的键名不一样。** DOM 路径走 CSSOM（CSS 语法 `background-color`），RN 要 `backgroundColor`。
   类型化通道必须一并定下命名约定 —— 放进类型里正好一起解决。

### 顺带发现：应用层直接摸 DOM

`yi` 那唯一一处 `Attrs::build()` 里直接调了 `@dom.document()` / `get_bounding_client_rect()` ——
**罗盘拖拽是应用层直接调 DOM API**。这层耦合比框架层的更难处理（对应 R2 事件模型 / R3 罗盘）。

---

## 只用 RNW：一份后端吃两个平台（推翻 §8 Q6）

**命题**：不要做"翻译到 web"这回事。把样式层做成 **RN 的形状**，
于是 **react-native-web 本身就是那个翻译** —— 一个后端同时服务 Web 和移动端。

### 为什么这比我上一版说的更好

| 项 | 结论 |
|---|---|
| `StyleValue → CSS` 序列化器 | **不需要写了** —— RNW 就是它 |
| `interest/yi` 有没有 SSR | **没有**（实测：无 `render_to_string` / `hydrate`，backend 只有 `index.html` + 静态服务） |
| 于是能白删的 | `dom` 7862 + `js` 1495 + `diff` 766 + `hydrate` 449 + `ssr` 227 ≈ **1.1 万行** |
| 样式层数量 | **一份**，不是两份 |

### 一个精炼：不需要"从 respo_css 推导子集"

**RN 的 style 词汇表本身就已经是被策展过的可移植子集** —— 它是 flexbox + 一个刻意的有限属性集，
而且刻意排除了 grid / sticky / 伪元素。

所以 DESIGN §7 阶段 2 的工作量比文档看起来**小得多**：不是"求 CSS ∩ RN 的交集"，
而是**把 RN 的 style props 做成 MoonBit 类型**。这是有边界、有官方文档可查的目录工作。
`respo_css` 在这条路上退化成**命名与序列化参考**（当抄本用）。

### 包体积实测（同口径 gzip）

| | raw | gzip |
|---|---|---|
| RNW 生产包（本 demo 应用） | 389 KB | **111 KB** |
| `yi` 现在的 MoonBit JS release 产物 | 1383 KB | 149 KB |
| `yi` 的手写 CSS（RNW 会把它并进 JS） | 21.7 KB | 4.4 KB |

**RNW 的平台底噪（111 KB gzip）与 `yi` 现在整个应用（149 + 4.4 KB gzip）是同一量级** ——
不是数量级退化。搬到 RNW 会比现在大一些，但不是"为跨平台付十倍代价"。

> 口径说明：demo 应用本身极小，这里比的是**平台底噪**，不是完整应用对完整应用。

### 代价转移了，但没有消失

以下都是 **RN 的天花板，与后端选谁无关**。数据来自 `yi` 的 CSS 实测：

| 特性 | yi 用量 | RN 有吗 | RNW 有吗 |
|---|---|---|---|
| `display: grid` | **17 处** | ❌（Yoga 的 grid PR 未 stable） | ❌ |
| `:hover` | **16 处** | ❌（触屏无 hover） | 只能靠 `onHoverIn/Out` + 状态 |
| `::before` | **4 处** | ❌ | ❌ |
| `position: sticky` | **2 处** | ❌ | ❌ |
| `@media` | **2 处**（760px / 640px） | ❌ | ❌ |

反正移动端也要丢这些，所以**新增的损失其实是「web 端体验降级为移动端体验」**，而不是"多丢了一遍"。

两条具体的迁移含义：

1. **响应式断点要搬进 MoonBit 状态**（RN 没有 `@media`）。用 `useWindowDimensions` 把宽度喂给 model。
   这未必是坏事 —— 断点变成了可测试的、可序列化的状态。
2. **语义化 HTML 丢失**：`h1` → `Text` → `div`，`ul`/`li` → `View`。
   RNW 的 `Text` 有 `accessibilityRole` 可补，但比不上真标签。**阅读器类应用值得掂量 SEO/可访问性。**

### 结论

**DESIGN §8 Q6「是否支持 Web 也走 React 后端？—— 无必要（DOM 后端 + CSS 更优），建议否」应当推翻。**
在"一份后端吃两平台"的前提下，Q6 的答案变成：**是，而且它是唯一后端。**

这同时解掉 §6 R4 的「裁掉三分之二」张力 —— 不是"裁"，是**整个 DOM 后端都不需要了**。

---

## 目标侧发现（RN 的约束，与源侧无关，可迁移）

这四条是**目标平台的性质**——不管喂进来的是我的 `VNode` 还是真 RabiTa 的，都会撞上。

### F2. ⚠️ `VNode::Text` 不能直接返回字符串 —— **§3.1 的 JS 草图是错的**

草图画的是：

```js
case 'Text': return v.text
```

**照抄会在 RN 上直接报错**：RN / RNW 不允许裸字符串作为 `View` 的子节点
（`Text strings must be rendered within a <Text> component`）。必须统一包一层：

```moonbit
Text(s) => js_create_element(js_host_component("Text"), js_obj_new(), [js_str(s)])
```

**这条约束会一路漏到应用层**：文字与盒子必须显式区分，没有中间态。这正是 R1 的同一条根因。

### F3. ⚠️ 样式值必须按 key 分类，而**类型信息在到达树之前就丢了**

RN 里尺寸要数字、`fontWeight` 要**字符串**。统一 `Number()` 强转会把 `"700"` 变成数字 `700` 而**静默非法**。
所以必须有一份键白名单：

```moonbit
fn is_numeric_style(key : String) -> Bool { match key { "flex" | "width" | "padding" | ... => true; _ => false } }
```

**⚠️ 关于这条，我前后写过两个互相矛盾的版本，正确的说法是：**

- 第一版：「白名单是正确性前提」—— **对**。只要样式值走 `Map[String, String]`，这个分类就躲不掉。
- 第二版（我"更正"成）：「若走 `respo_css` 的类型化枚举，问题会自动消失」—— **错**。

错在哪：`Props.styles` 的类型是 `Map[String, String]`，写入入口是

```moonbit
pub fn Attrs::style(self : Attrs, key : String, value : String) -> Attrs
```

**收的就是纯字符串。** `respo_css` 的 `RespoStyle` 本身也只是 `Array[(String, String)]`。
所以无论应用层是否用类型化枚举来**构造**这些字符串，**类型在进入 `Props.styles` 之前就已经被抹掉了** ——
`respo_css` 救不了这条。

**真正能修它的地方只有一个：把 `styles` 通道本身加宽成携带类型化值**
（`Map[String, StyleValue]`）。而那需要动 `vdom` —— 也就是**只能在 fork 里做**。
这是除"让 `VNode` 可命名"之外，**fork 的第二个、且更实质的理由**。

### F4. ⚠️ 事件映射必须知道**目标标签**，不能只看事件名 —— 修正 §7 阶段 3

| 源事件 | 目标组件 | 目标事件名 | 回调收到什么 |
|---|---|---|---|
| `click` | `Pressable`（`<button>`） | `onPress` | **合成事件对象** |
| `input` | `TextInput`（`<input>`） | `onChangeText` | **文本** |

同一个 `click` 落到不同组件上名字可能不同，参数形态也不同 →
映射必须是 `map_event(tag, event)`。设计文档 §7 阶段 3 只说"事件映射（`on_click` → `onPress` 等）"，
没点出这个二元依赖。

### F5. ⚠️ 还需要一层"事件适配器" —— 设计文档里没有这一层

handler 类型是 `(String) -> Unit`，但 `onPress` 递过来的是**对象**。
不处理的话 MoonBit 会把它当 `String` 用。所以按事件种类选适配器：

```moonbit
enum EventKind { Fired; Typed }        // 丢参数 / 透传文本
```

**这是"事件映射"下面还藏着的一层**，不加会在运行时炸。

### F7. ⚠️ 没有滚动容器是个真问题

RN 的 `View` **不滚动**；web 那边 Expo 的 reset 又把 `body { overflow: hidden }`。
本次 4 条待办的内容高度**恰好 844px = 视口高度**，再多一条就会被裁。
→ 列表必须进 `ScrollView` / `FlatList`，且**根节点必须显式给出滚动边界**。

---

## 机制侧发现

- **§4.2 的状态桥接成立**，而且比预想省事：退订闭包从 MoonBit 返回给 JS 可用；回调从 JS 传进 MoonBit 可用；
  "状态变了整棵树重建 → React 全树 diff"（§4.3 的取舍）在这个规模完全无感
- **工具链两个坑**：

| 现象 | 真相 |
|---|---|
| `fn f() -> T = expr` 报 "Inline wasm syntax error" | 该 MoonBit 版本（`0.1.20260827`）**不支持表达式简写体**，`=` 只会被当 extern 内联体。全部函数必须写 `{ }` |
| `#export_name` 要求 `pkgtype(kind: "foreign_library")` | 那是给 **C ABI** 的。**JS 模块导出走** `options("link": { "js": { "format": "esm", "exports": [...] } })` |

---

## 关于 R1（内联文本流）

**没有回答 R1**，而且本次是**用 react-native-web 跑的，不是真 Yoga**（见 S6）。
RNW 忠实还原 RN 的**样式语义与 flexbox 子集**，但在**文字度量与换行**上失真
（DOM inline 布局比 RN 的 `Text` 更强），而那正是 R1 的关切点。

要判定 R1，仍需按设计文档阶段 0 的原计划：拿 `.m-yao` 样本、上真机。

---

## 已知限制

- 标签表只覆盖本次用到的一小撮（`span`/`p`/`h1`/`button`/`input`）；通用子集 ~30 个属于阶段 3
- 只在 react-native-web 上验证过；真 Yoga 布局与平台文字栈**未验证**
- 样式值解析只做"带 px 的数字 → 数字"，没有单位换算、没有白名单校验
- 无导航、无手势、无 canvas
- **`RabiTa` / `respo_css` / `tiye/react` 三个真实依赖全部未接入**（S1–S5）

## 杂项

- `examples/apps/todo-app/host/` 里有 create-expo-app 留下的独立 `.git`（只有模板初始提交）。要做整体仓库的话建议先 `rm -rf examples/apps/todo-app/host/.git`

---

# 第二轮：接入真实 RabiTa

第一轮的结论是「demo 验证了目标侧，源侧一条没验」。这一轮把源侧接上了。

**结果：25 / 25 通过，跑的是真实 rabbita 类型。**

## 做成了什么

| 目标 | 状态 |
|---|---|
| vendor fork，解除 `internal/vdom` 阻断 | ✅ 已实测可达 |
| 类型化 RN 形状的样式层，加宽 `Props.styles` | ✅ **字符串入口已删除** |
| demo 走真实 `VNode` / `Props` / `Children` / `Html` | ✅ |
| 端到端验证 | ✅ 25 / 25 |
| `Event` / `@dom` 解耦 | ⚠️ 只做了「集中化」，没做解耦（见缺口） |
| `Cmd` / `Emit` / TEA 运行时 | ❌ 未接（见缺口） |

生产 web 包：**389 KB → 392 KB**。fork 的净成本约 3 KB。

## 关键成果：F3 的运行时白名单被类型系统取代了

第一轮我加了一份「哪些样式键是数字」的运行时白名单（因为字符串通道区分不了
`fontSize` 与 `fontWeight`）。**现在这份白名单不存在了。**

```moonbit
pub(all) enum StyleValue { Unitless(Double); Px(Double); Pct(Double); Auto; Str(String) }
```

- 写入侧：`Style::font_size(16.0)` / `Style::font_weight(FontWeight::W700)`
  —— **值类型由方法签名钉死**，写不出"数字塞给 fontWeight"
- 属性集**封闭**：没有 `display:grid`、`position:sticky`、伪元素的构造器
  —— 「Web 能跑、移动端不能」**编译期不可能发生**
- 读取侧：RN 产出数字/字符串由 `match` 决定；CSS 侧 `to_css()` 补 `px` 并转 kebab-case

**这就是「架构级改造」的落点，而且它是零破坏的**（第一轮实测：唯一真实应用从未用过结构化样式）。

## 新增发现

### N1. `pub enum` 的构造器对外**只读** —— 必须 `pub(all) enum`

跨包构造枚举值时报 `Cannot create values of the read-only type: Row`。
`pub enum` 只公开类型，**构造器对外只读**；要能构造必须写 `pub(all) enum`。
（`pub struct` 的字段同理。这是本轮最大的时间黑洞。）

### N2. `Props` 的字段是私有的，`Event` 更不是 pub —— 外部包**根本注册不了事件**

这比「让 `vdom` 可见」严重：

```moonbit
pub struct Props { handlers : ...; attrs : ...; props : ...; styles : ... }  // 字段全私有
#cfg(target="js") type Event = @dom.Event    // 非 pub，外部无法命名
```

所以在 fork 里补了这组 API（**这才是「改造 rabbita 类型支持」的真正内容**）：

```moonbit
pub fn Props::styles(self, s : @style.Style) -> Props
pub fn Props::on(self, event : String, f : (Event, &Scheduler) -> Unit) -> Props
pub fn Props::attr / Props::prop
pub fn Props::styles_map / attrs_map / props_map
pub fn Props::each_handler(self, scheduler, f : (String, (@js.Value) -> Unit) -> Unit)
```

`each_handler` 是关键：它把每个处理器**预先适配成"只吃一个 JS 值"**。
`Event` 藏在签名里，调用方靠类型推断即可用，不必命名它。

**顺带修正第一轮的 F5**：我原以为需要两个事件适配器（丢参数 / 透传文本）。
`each_handler` 归一化之后**这一层消失了** —— React 给 `onPress` 和 `onChangeText`
都恰好递一个参数，`(@js.Value) -> Unit` 两边通吃。
（`map_event(tag, event)` 的**名字映射**仍然必需。）

### N3. `Children` 有三个构造器，复刻版漏了两个

```moonbit
pub(all) enum Children[T] { Array(Array[T]); Map(Map[String, T]); RawHtml(String) }
```

- `Map` —— **rabbita 本来就维护着 key**。我们把它交给 React 的 `key`
  （`cloneElement(el, {key})`），于是 §4.3 担心的"全树 diff"实际上没那么贵
- `RawHtml` —— **RN 上没有等价物，这是真正的可移植性缺口**。
  moobile **丢弃并计数**，验证脚本断言它为 0（`unsupported=0`）：
  把缺口变成可测量的东西，而不是嘴上说说

### N4. 🎉 `dom` 包**一行都没进产物** —— DOM 耦合是编译期的事

fork 之后 `moobile` 传递依赖 `dom`（7826 行 js-only 绑定），本以为是负担。实测：

```
add_event_listener 0 · querySelector 0 · get_bounding_client_rect 0 · createElementNS 0
```

**MoonBit 的 JS 后端做了死代码消除。** 没被调用的 `extern "js"` 完全不产出。

**这条改变了「档二」的性质**：`Event` / `@dom` 解耦是**架构整洁性**问题
（让 moobile 不假装自己是浏览器），**不是**体积或运行时问题。优先级随之下降。

### N5. `Event` 现在是"统一的不透明槽位"

`onPress` 递事件对象、`onChangeText` 递文本，两者都塞进同一个 `@js.Value`，
由一个 `%identity`（`payload_as_string`）在**唯一一处**解释成 `String`。
位置集中在 `moobile/dsl.mbt` 的 `text_input`，已标注为缺口的一部分。

## 仍未接上的缺口（诚实清单）

### G1. `@html` 的标签助手用不了 —— 事件参数是 `Cmd`

这是本轮**最实质的偏差**。设计目标是"`yi` 的视图代码基本不动"，但：

```moonbit
// yi 的写法：
div(class="m-yao", on_click=emit(ToggleBian(i)), [...])
//                        ^^^^ Emit[Msg] = (Msg) -> Cmd
```

`emit(Msg)` 产出 `Cmd`，而**执行 `Cmd` 需要 rabbita 的运行时**
（`App` / Host 的抽干循环 + slotmap + `internal/runtime`）。

所以本轮 moobile **自己构造 `Props`**、把处理器直接接进自己的 TEA 循环
（`moobile/dsl.mbt`），没能用上 `@html` 的 116 个标签助手。

**好消息**：树、属性、样式、子节点**全部是真实 rabbita 类型**，
翻译层面对的是真实数据模型。差的只是"谁来构造 `Props`"。

**要接上需要**：把 `internal/runtime` 的 Host（或自写一个）接进 React 的根组件，
让 `Cmd` 有地方执行。这是下一个明确工作项。

### G2. 空 Scheduler

`moobile/sched.mbt` 里的 `NoopScheduler` 只接收命令、不执行。
与 G1 是同一件事的两面。

### G3. 仍未回答 R1

依然只在 react-native-web 上验证过。真 Yoga / 平台文字栈**未验证**。
（RNW 忠实还原 RN 的样式语义与 flexbox 子集，但在**文字度量与换行**上失真 —— 那正是 R1 的关切点。）

---

# 第三轮：接上 rabbita 的运行时（G1 / G2 关闭）

**结果：25 / 25 通过，而且这次跑的是真实 `@html` DSL + 真实 `emit(Msg)`。**

```moonbit
// examples/apps/todo-app/ui.mbt —— 与 yi 的写法一致，不再是 moobile 自造的 DSL
@html.button(attrs=attrs(...), on_click=emit(Toggle(t.id)), [ ... ])
@html.input(value=model.draft, on_input=emit.map(s => SetDraft(s)), attrs=attrs(...))
```

## 最重要的发现：rabbita 的运行时**本来就是可插拔的**

`internal/runtime/ambient.mbt` 里：

```moonbit
pub let ambient_host : Ref[&Host] = Ref(DummyHost::{ stores: SlotMap() })
pub trait Host: Scheduler { fn flush(Self) -> Unit; fn cleanup(Self) -> Unit; fn get_stores(Self) -> SlotMap[Store] }
```

对比 `BrowserHost` 与我们的 `ReactHost`，**唯一实质差别是最后一跳**：

```moonbit
// BrowserHost
@dom.window().request_animation_frame(fn(_) { document.update(vnode, self) })
// ReactHost（~140 行，其余照搬）
(self.schedule_frame)(() => { ambient_host.protect(self, () => (self.frame)(output.read())) })
```

命令队列、微任务抽干、`handle_message`、`SlotMap` stores、duplix scope **全部复用 rabbita 自己的实现**。

> **这比 DESIGN 说的还要强。** 设计文档说"渲染可以整体外包"，
> 实际是：**连 TEA 的抽干循环都不用改写，只换挂载层。** moobile 没有重写状态机。

`@runtime.create_state_machine` 是官方公开 API，给出真实的 `Emit[Msg]` ——
所以 `Cmd` / `Emit` / 订阅 / 异步 effect 全部由 rabbita 执行。

## 三处 DOM 硬编码的缝（fork 的第二批实质改动）

rabbita 的 HTML 助手会**伸手进 DOM 事件对象**。逐条列出来，这是可移植性的真实清单：

| 位置 | 原写法 | RN 上的后果 | 改法 |
|---|---|---|---|
| `push_input` / `push_change` | `event.target.value` | RN 的 `onChangeText` 直接给字符串，没有事件对象 | `form_value_from_event` 可替换策略 |
| `on_mouse_event` | `event.to_mouse_event().unwrap()` | RNW 的合成 press 事件**不是** DOM MouseEvent → `None` → **直接 panic** | `mouse_event_from_dom` 可替换策略 |
| `push_scroll` | `event.target().to_element().unwrap()` | 同类问题（本轮未用到） | 同样的模式 |

**换掉这两个函数，`on_click=emit(Msg)` 与 `on_input=emit.map(f)` 就在 RN 上原样工作** ——
也就是 yi 那种视图代码不需要改（样式除外）。

使用 MouseEvent **载荷**的处理器（yi 的罗盘拖拽）仍然要换手势系统 —— 那是设计文档的 R2。

## 一个静默失败，值得单记

第一版把 `render_props` 里的调度器传成了 stub：

```moonbit
let sched = scheduler()          // ← NoopScheduler
props.each_handler(sched, ...)
```

后果是**最难查的一类 bug**：界面照常渲染、点击不报任何错、控制台干净、
但状态永远不变 —— 因为处理器里的 `scheduler.add(cmd)` 变成了 no-op。

排查靠的是两个计数器（现在留在 `react_host.mbt` 里，验证脚本可读）：

```
BEFORE ops= 0 messages= 0 handlers= 22     ← 处理器注册了 22 个
AFTER  ops= 0 messages= 0                  ← 但没有一个命令被执行
```

**教训：交给事件处理器的调度器必须是真正在跑的那个 host。**

## 一次误判（如实记录）

中途我把 `create_state_machine` 换成了自己写的 `create_react_state`，
理由是"官方那版把模型裹进 `Option` 再 unwrap，跨 protect 边界会失手"。

**这是误判。** 真正的 panic 从头到尾都是上面那个 `to_mouse_event().unwrap()`。
修掉之后回头验证：**官方 `create_state_machine` 也 25/25**，
于是删掉了我多余的那份，回到官方实现。

（诊断时看到的 `$PanicError at Option::unwrap` 我一开始读成了 `Option[Model]`，
实际符号是 `Option[@dom.MouseEvent]`。**读错误符号要读全。**）

## 第 (3) 项：解耦 `Event`/`@dom` —— **做了一半，另一半经论证不做**

### ✅ 已完成的一半：`Event` 与 `@dom` 解耦

`internal/vdom/vdom.mbt` 原来是：

```moonbit
#cfg(target="js")      type Event = @dom.Event      // ← 别名
#cfg(not(target="js")) type Event = Unit
```

现在是 **vdom 自己拥有的、公开的、后端无关的不透明类型**：

```moonbit
#external
pub type Event
```

**为什么这一半值得做**：别名让 `@dom` 漏进了 `Props.handlers` 的**公开签名**，
而 `@dom` 是 js-only 的 DOM 绑定包。后果就是外部包既命名不了 `Event`、
也换不掉它 —— 这正是当初不得不造出 `Props::each_handler` + `cast_js_value` 的原因。
现在 `Event` 可命名了，`each_handler` 也简化回了直接调用。

边界转换只有两处，都很明确：

```moonbit
fn dom_event(value : @dom.Event) -> Event = "%identity"    // DOM 监听器入口
pub fn as_dom_event(value : Event) -> @dom.Event = "%identity"  // DOM 侧辅助函数用
```

`diff.mbt` 在 2 个 `add_event_listener` 处转一次；
`html` 里 8 个 DOM 解码器（mouse / keyboard / focus / drag / clipboard /
composition / wheel / input）在闭包入口转一次。

**验证**：

| 检查 | 结果 |
|---|---|
| `moon check` | 0 错误 |
| vendored `internal/vdom` 单测（含 **mock DOM 的 `diff_children` 测试**） | **4 / 4** ← 这条覆盖了我改动的 DOM 后端 |
| 端到端浏览器验证 | **25 / 25** |

### ❌ 没做的一半：去掉"依赖 DOM 包"这条 import 边

`vdom` / `html` / `runtime` **三个包都还 import `dom`**。去掉它需要一次真正的三方拆包：

| 包 | 拖住它的东西 |
|---|---|
| `internal/vdom` | `diff.mbt`(766) + `hydrate.mbt`(449) 与 `vdom.mbt`(148) **在同一个包里** |
| `html` | `attrs_event.mbt` / `html_utils.mbt` 里的 DOM 解码器，以及公开 API 中的 `MouseEvent`/`KeyboardEvent` 别名 |
| `internal/runtime` | `host_browser.mbt` + `host_hydration.mbt` |

**而 `diff.mbt` / `hydrate.mbt` 依赖 `vdom` 的私有内部**
（`Props` 的私有字段、`INode`、`IProps`、`VDom`、`VScheduler`）。
把它们挪出去，就必须**把这些内部全部公开** —— 也就是说，
这条 import 边是**用框架的封装性换来的**。

**性价比判断**：

- 实测收益 **0 字节**（上面已经证明产物里 DOM 代码是 0）
- 运行时路径**已经与 DOM 无关**（`Event` 已解耦，两处行为依赖已策略化）
- 代价是 `vdom` 的封装性变差

所以这一半**按 DESIGN 的原则（先验证未知量、再动手）显式不做**，
排在 R1 之后。若将来真的需要（例如要出一个 DOM-free 的发行包），
正确的做法是**上游化**：让 rabbita 自己把 `vdom` 拆成 `tree` + `dom` 两个包，
而不是我们 fork 出一份封装被破坏的版本。

---

# ★ R1 判决：**可接受**

> 这是整个项目的门。DESIGN §6 R1 写的是「**唯一可能"做完了发现效果不可接受"的地方**」，
> 判定标准是「内联文字混排 + 折叠交互在 RN 上是否达到**可接受**，而非像素一致」。

## 怎么判的

**不是看截图，是量行数。** 在两个目标上各跑一遍同一份样本（`.m-yao` 系列，
数据是乾卦六爻的真实内容，样式逐条移植自 yi 的真实 CSS）：

| | 环境 | 测量手段 |
|---|---|---|
| Web | react-native-web，390×844 | `Range.getClientRects()` + computed style |
| **Android** | **真模拟器：Android 14 / x86_64 / 390dp 宽 @440dpi** | `uiautomator dump` 拿每个原生 `TextView` 的 bounds |

Android 侧的关键换算：density 440 → **2.75×**，所有 px 除以 2.75 得 dp。
（⚠️ 顺带记一个坑：`wm size 390x844` + `wm density 440` 得到的是 **142dp 宽**的逻辑屏，
不是 390dp。390dp 宽的真机尺寸应该是 **1073×2321 @440dpi**。）

## 结果：**两边都过**，而且数值对得上

| 检查项 | Web (RNW) | **Android 真机** | 判读 |
|---|---|---|---|
| 爻辞·初九「潜龙勿用。」 | 1 行 | **1 行**（23.6dp） | ✅ |
| 爻辞·九三「君子终日乾乾，夕惕若厉，无咎。」（最长） | 2 行 | **2 行**（46.5dp） | ✅ **换行正确** |
| 小象「小象　潜龙勿用，阳在下也。」 | 2 行 | **2 行**（40.0dp） | ✅ **行内流成立**（标签与文一起流动换行） |
| 6 条小象 | — | **全部 2 行** | ✅ 一致 |
| 折叠箭头 `min-width:10px` | 宽 10 | **宽 10.2dp** | ✅ flex item 上的 minWidth 生效 |
| 爻画列（CSS Grid `160px`） | 160 | **159.9dp** | ✅ **grid→flex 降级精确** |
| 爻画↔文字间距（CSS `gap:26px`） | 26 | **26.2dp** | ✅ |
| 注疏盒（逐边 `border-left:2px` + `border-top:1px dashed`） | 生效 | **生效**（含 4–7 行换行） | ✅ |

**结论：R1 的最坏情形没有出现。** 那"内联元素 + 盒属性"的担心（`.m-fold { min-width:10px }`）
在 Android 上是**可行的** —— 因为它是 flex item 而不是嵌套文本。
真正的限制只剩「**嵌套 `<Text>` 上的盒属性**」（`.xlab { margin-right:7px }`），
而它有一个干净的对策：改用真实组件或空格，不必改写排版。

## 还剩什么（R1 之外，不是 R1 的失败）

| 项 | 状态 |
|---|---|
| `display:grid` | **必须手工改 flex**（yi 里 9 处）—— 已验证降级可行（160dp 列精确） |
| `linear-gradient`（阴爻） | RN 无，用"两段 View"等价替代 ✓（样本里已用） |
| `em` 单位 | 样式层已支持（`letter_spacing_em`），换算结果与手工一致 ✓ |
| 嵌套 `<Text>` 的盒属性 | 会丢；用真实组件/空格替代 |
| 滚动容器 | RN 的 `View` 不滚动 —— 必须显式套 `ScrollView`（已验证可滚到第 6 爻） |

## 真机验证能力（这一步本身是目标 1 的产出）

这台机器上原本没有安卓验证能力。现在有了，而且**全部落在 E 盘**（C/D 盘都很紧张）：

| | |
|---|---|
| SDK | `E:\Android\Sdk`（9G，原 `C:\Users\...\AppData\Local\Android\Sdk` 留了目录联接，路径照旧可用） |
| AVD 数据 | `E:\Android\dot-android`（同样留联接） |
| 构建产物 | `E:\moobile-build`（10 个目录联接，Gradle 无感） |
| Gradle 缓存 | `~/.gradle` → `E:\BACKUP\.gradle`（**用户原有的符号链接，我一开始误当故障，其实是故意的**） |

设备：`moobile64` = **Android 14 / x86_64 / 390dp @440dpi**。

## 踩过的环境坑（都记下来，免得重来）

| 现象 | 真因 | 解法 |
|---|---|---|
| Web 页整片空白 | PowerShell 无关；是 Metro 卡死 | 重启 Metro |
| `settings.gradle.kts`：`Unresolved reference 'plugins'` | **Expo 模板默认 Gradle 9.3.1 与 RN 0.86 自带的 gradle-plugin 不兼容** | **换 Gradle 8.14.3**（AGP 8.12 本来就要求 ≥8.13） |
| `Command 'cmd' finished with non-zero exit value 1` | **我自己造成的**：给 `node_modules/expo-modules-autolinking/build` 建了目录联接，但那不是构建产物、而是该 npm 包自带的 CLI 代码 | 从 npm tarball 解出恢复；脚本里加了"只列 Gradle 生成的目录"的警告 |
| `~/.gradle` 写不进去 | 符号链接指向的 `E:\BACKUP\.gradle` 不存在 | 建上那个目录（恢复用户原意） |
| Gradle / npm 下载卡死 | `services.gradle.org`、Expo CDN 不通 | Gradle 走腾讯镜像、Maven 走阿里云镜像 |
| Kotlin daemon 卡死在 `compileKotlin` | GraalVM 当 JDK | 换纯 `jdk-17.0.5` |
| 构建报"磁盘空间不足" | C 盘 392K / D 盘 2.6G | 见上表的目录联接方案 |

---

# R2 —— 把"真应用"跑起来之后（2026-09：N1 / H 轨道）

R1 验的是**排版**。R2 验的是**一个真应用能不能活**：本地库 + 网络同步 + 多页面 + 后端。
做的是一个前后端俱全的 Todo（`examples/apps/todo-app/` 前端、`examples/services/todo-server/` 后端），四道门都过了：

| 门 | 脚本 | 结果 |
|---|---|---|
| UI 全链路（Web） | `node tools/verify_web.js` | **26 / 26** |
| 本地库（Web，含刷新后仍在） | `node tools/db_probe.js` | **8 / 8** |
| 同步链路（Web，推拉 + 换 id） | `node tools/sync_probe.js` | **14 / 14** |
| 真机（Android 14 / x86_64） | `python3 tools/verify_android.py` | **13 / 13** |

## N1：`mount` 之前**缺了半条 TEA**

`app.mbt` 里的 `mount` 把两处硬编码成 `@cmd.none`，签名是 `(Model, Msg) -> Model`，
而且**没有** `subscriptions?` —— 而它上面那句注释写着"签名与 `rabbita.elmish` 对齐"。

上游（`internal/rabbita/top.mbt:33`）是这样的：

```moonbit
pub fn[Model : Eq, Msg] elmish(
  update~ : (Model, Msg, Emit[Msg]) -> (Model, Cmd),
  subscriptions? : (Model, Emit[Msg]) -> @sub.Sub,
)
```

**代价很具体，不是风格问题**：

- `update` 里发起不了副作用 → "点一下按钮改状态、然后顺便读个本地库"这条**写不了**；
- 没有 `subscriptions` → 持续数据流（传感器 / 定位 / 网络状态 / 返回键）**一个都接不上**。

0.2.0 补齐：`mount` 现按上游形状收 `update~ : (Model, Msg, Emit[Msg]) -> (Model, Cmd)`
与 `subscriptions?`，另外加了 `mount_with_init`（对齐 `create_state_with_init`）——
**首帧之前要做的事**（读本地库）终于有地方放了。

> 教训：注释里的"已对齐"要有测试兜着。这句假注释存在了很久，而它是**迁移者最先读到的字**。

## H2：MoonBit 构造的 JS 对象**能**穿过 Metro（原来唯一的未知量）

0.1.0 里应用必须自己写 4 个导出（`start/snapshot/subscribe/element`），理由是
"`mount` 对 `Model`/`Msg` 泛型，导出的函数必须单态"。

但 `Mount` 本身是**非泛型**的具体类型 —— 泛型只存在于**构造那一刻**。于是库可以替应用把
这四个入口包进**一张句柄表**（`Mount::handles`），应用侧只剩一行：

```moonbit
pub fn app() -> @moobile.JsValue { @moobile.handlers_with_init(init=init_app, update~, view~) }
```

**实测结论**：MoonBit 构造的 JS 对象里放 4~7 个闭包，经 Metro 打包、交给 React 调用，
**完全可用**（`tools/verify_web.js` 26/26 就是走这条路）。`examples/apps/todo-app/moon.pkg` 的导出从 **7 个降到 1 个**。

两条必须记住的实现细节：

1. 每个闭包都要**显式**包成 JS 箭头函数（`host.mbt` 的 `js_closure0/int/value/string/sub`）——
   与 `js_as_handler` 同一个理由：函数值经过泛型 `%identity` 不一定以 JS 认得的形态到达；
2. 卸载/诊断钩子也一并放进句柄表（`unsupported` / `unmapped` / `unmapped_names`），
   于是验证脚本不再需要单独 import 三个导出。

## H1 / H6：宿主抽成 npm 包 `moobile-host` —— 踩到的两件事

宿主侧的 40 行（`MOBILE_HOST` 四件套 + 根组件 + 组件表 + 后端地址）抽成 npm 包后，
应用的 `App.js` 只剩：

```js
import { mountApp } from 'moobile-host';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';

export default mountApp(app, { registry });
```

**坑 1：`npm install file:...` 在 Windows 上是"拷贝"而不是"符号链接"。**
改了 `npm/moobile-examples/apps/todo-app/host/index.js` 之后，`examples/apps/todo-app/host/node_modules/moobile-host` 里还是旧副本 ——
表现是"我明明加了 `__moobileApp`，浏览器里就是 undefined"。
解法：改完包**重跑一次 `npm install file:../npm/moobile-host`**（或者用 `npm link`）。

**坑 2：新增 npm 依赖之后必须重启 Metro。**
不重启的表现极其误导：**页面整片空白、控制台一条错都没有**（脚本请求发了、bundle 也 200，
但就是不执行）。重启后立刻看到真正的报错。
→ 顺带产出 `tools/console_dump.js`：白屏时先跑它，它会把 console / exception /
network-loadingFailed 三类事件原样打出来。

**坑 3（自己写出来的）**：`App.js` 里 `import { app } from './moobile.js'`，
而 MoonBit 侧导出名当时叫 `demo_app` → `TypeError: app is not a function`。
**导出名对不上不会在打包期报错**，只在运行时炸。

## H7：能力注册表 —— 生成，不手写

`npx moobile-host regen` 读应用 `package.json` 的依赖，产出 `registry.generated.js`
（**静态 import**：Metro 不能靠运行时拼字符串 import），并在注释里列出
"识别了什么 / 哪些没装"。运行期再核对一遍：注册表声明了 `db`，但装完
`MOBILE_HOST.db` 还是空的 → 报错**点名**能力与提供它的包。

MoonBit 侧同样 fail-fast（`sqlite/sqlite.mbt` 的 `ensure()`）：缺能力时打印
"怎么装、在哪注册"，而不是让你对着 `Cannot read properties of undefined` 猜。

## expo-sqlite 在两端的实测

| 事实 | 值 |
|---|---|
| SDK 57 统一版本号 | `expo-sqlite` 是 **~57.0.3**（不是记忆里的 ~15/~16），依据 `examples/apps/todo-app/host/node_modules/expo/bundledModules.json` |
| Android 侧负担 | **无** —— 预编译 AAR + Gradle 期 autolink，**不需要重跑 `expo prebuild`**，`./gradlew assembleDebug` 即可 |
| Web 侧 | 官方标注 **alpha**；`metro.config.js` 要加 `assetExts: wasm` 与 COOP/COEP |
| **COOP/COEP 实测只作用在 bundle 路由上** | `curl -D -` 看 `/index.bundle` 有头，看 `/`（文档本身）**没有** → `crossOriginIsolated === false` |
| **但异步 API 照样能用** | 6/6 + 8/8 全过。这与代码一致：只有**同步** API 才构造 `SharedArrayBuffer`（`invokeWorkerSync`），异步走 postMessage |
| 布尔 | SQLite 没有布尔：绑定前转 0/1，读回来是数字 → MoonBit 侧用 `Int` 接，别用 `Bool`（`derive(FromJson)` 不做转换） |
| 刷新后仍在 | OPFS 持久化实测有效（db_probe 的"刷新后清单仍在"） |

## 后端：MoonBit 的 native HTTP 服务端（`examples/services/todo-server/`）

- `@http.Server(@socket.Addr::parse("127.0.0.1:8787"))` + `server.run_forever() <| ((request, body, conn) => ...)`；
- 读 body：`body.read_all().json()`；回响应：`conn.send_response(...)..write(bytes).end_response()`；
- **CORS 得自己写**（async 只给裸 HTTP 原语，没有中间件）——Web 端在另一个端口，必然跨域，
  且带 `Content-Type: application/json` 的 POST/PATCH 会先发**预检**，OPTIONS 必须处理；
- 存储用 JSON 文件 + 写临时文件再 `@fs.rename`（原子替换），重启后状态还在（实测）；
- Windows 上原生构建**需要 MSVC**：moon 自己用 `vswhere.exe` 找到 VS 2022 BuildTools，
  **不用手动 vcvars**；`moon run --target native` **必须带包路径**（`moon run --target native .`）；
- ⚠️ **`println` 是块缓冲的**：stdout 被重定向时日志会"消失"，要用 `@stdio.stdout.write`；
- ⚠️ 嵌套模块（`examples/services/todo-server/`）必须**有自己的 `moon.mod`**，否则会被当成父模块（`+js`）的包而编不出 native。

## 这一轮踩到的 MoonBit 语法/API 坑（都实际报过错）

| 现象 | 真因 | 解法 |
|---|---|---|
| `` `init` function must have no arguments and no return value `` | **`init` 是保留形状**（模块初始化） | 改名（我们用 `init_app`，与 yi 一致） |
| `Constr Type Mismatch: has type Msg, wanted Cmd` | `@cmd.perform` 的 `msg` 参数要返回 **`Cmd`**，不是 `Msg` | `@cmd.perform(r => emit(...), ...)` |
| `This expression has type (Model, Cmd), cannot be implicitly ignored` | 上一条的连带错（函数体被当成语句块） | 同上 |
| `Array[Todo] has no method find_first` | 这个版本没有它 | 自己写 `for` 循环找一个 |
| `Package "time" not found` | 没有 `core/time` 这个包 | 用 `@env.now()`（毫秒） |
| `Using constructors as higher order function directly is forbidden` | `emit.map(SetEditing)` | `emit.map(s => SetEditing(s))` |
| `the labels old~, new~ are required by this function` | `String::replace` 是带标签的 | 改用绑定参数，别拼 SQL |
| `Lexing error: (unterminated string literal)` | MoonBit 字符串字面量**不能裸换行** | 拆成多条语句 |
| `Type _/0 has no method map` | 泛型推断顺序：`@cmd.perform` 的 msg 先推 | 给闭包参数标类型 |
| 未使用的泛型函数**不进产物** | JS 后端的单态化 | 找刷新标记别用它（例如 `mount_with_init` 在没人调用前不存在于 bundle 里） |

## 同步设计里一个真的 bug（值得记）

本地新建的条目用**负数 id** 表示"服务器还不知道"。第一版 SQL 是 `MIN(id) - 1`（**没限负数**），
当库里只有服务器来的 `6, 7` 时，新条目 id 算成 **5（正数）** → 同步时被当成"服务器已有的行"去
`PATCH` → 服务器 404 → 整轮同步失败。

**修法**：`SELECT COALESCE(MIN(id), 0) - 1 FROM todo WHERE id < 0`。
这个 bug 是 `sync_probe` 的"新条目是负 id 且标记为 dirty"这条断言抓出来的 ——
**断言写得具体，才抓得住设计错**。

## Android 验证的坑

| 现象 | 真因 | 解法 |
|---|---|---|
| `INSTALL_FAILED_NO_MATCHING_ABIS` | 默认 AVD `moobile` 是 **Android 10 / x86（32 位）**，而 APK 按 `reactNativeArchitectures=x86_64` 只打了 64 位 | 用 `moobile64`（Android 14 / x86_64），它在 `ANDROID_AVD_HOME=E:\avd` 下 —— **不设这个变量 `emulator -list-avds` 根本看不到它** |
| `adb shell ... /data/local/tmp/ui.xml` 报路径不存在 | **Git Bash 把 `/data/...` 转成了 `C:/Files/Git/data/...`** | 用 Python 脚本调 adb（不经 MSYS 转换），或 `MSYS_NO_PATHCONV=1` |
| `adb shell input text 'android-local-add'` 输入成了 `andr-ldd` | `input text` 会吞字符 | 断言里**别依赖输入文本**（我们改成只断言"条数 +1、且先只落在本地"） |
| Gradle 报 `SDK location not found` | 新 shell 没设 `ANDROID_HOME` | 现在有 `tools/env.sh`（`source` 一下） |

## N4（前半）：`subscriptions?` 真的通了 —— 心跳

N1 给 `mount` 补上了 `subscriptions?`，但**补完不等于通了** —— 在有人真的用它之前，
这条线一直是"写了、没验过"。所以加了一个最小的订阅做验收：

```moonbit
pub fn subscriptions(_model : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.every(5000, emit(Tick))     // 运行时每 5 秒推一个 Tick
}
```

界面把计数显示出来（`… · 心跳 N`），于是断言变成"**这个数字自己会涨**"：

| 端 | 断言 | 结果 |
|---|---|---|
| Web | `tools/verify_web.js`：「订阅（Sub）在跑：心跳计数自动增长」 | 心跳 19 → 22 ✅ |
| 真机 Android 14 | `verify_android.py`：同一条 | 心跳 0 → 3 ✅ |

这条断言的价值在于它区分了两种东西：**用户点出来的变化**（几乎所有别的断言都是这个）
和**运行时主动推进的变化**（只有订阅能产生）。

### 为什么是 5 秒而不是 1 秒（被工具逼出来的）

一开始是 1 秒一跳，结果**安卓验证整片失败**，而且失败得很误导。链条是：

1. `uiautomator dump` 要等界面进入 **idle**；
2. 一秒一次重绘 → 永远等不到 idle → 报 `ERROR: could not get idle state.`；
3. **dump 失败时不会清掉上一次的 xml** —— 脚本 `cat` 到的是**上一次运行的陈旧 UI**；
4. 于是脚本拿着旧界面，得出一堆莫名其妙的结论（"同步状态已是已与服务器同步"、
   条数对不上……），而真因完全在别处。

改成 **5 秒**一跳后 dump 就正常了（两次 tick 之间有足够长的安静窗口）。
同时给 `dump()` 加了两道保险：**先 `rm` 掉旧 xml**，并**检查 dump 真的报了成功**。

> 教训（两次都是同一个形状）：**验证工具本身会骗你**。`uiautomator` 留下陈旧文件、
> Metro 留下失效的模块图 —— 都会让"失败"指向错误的地方。所以脚本要能识别
> "我拿到的东西是不是这次的"，而不是无条件相信。

### 另一个坑：`pm clear` 之后启动要等更久

`pm clear` 会把 **dev bundle 的缓存**一起清掉，冷启动要先从 Metro 下 3MB 的包
（实测 20s+，加首帧更久）。固定 `sleep 25` 不够 → 改成**轮询**：
dump 到我们的标题才算起来，dump 失败就当没起来、重试，最长等 150 秒。

### 真机覆盖到 ⑦ 的全部五项（21 项断言）

`tools/verify_android.py` 现在对**新增 / 完成 / 删除 / 离线落库 / 同步**都成对断言：

| 操作 | 成对的断言 |
|---|---|
| 新增 | 先只落本地库（服务器 2 条不变、界面 3 条）→ 同步后服务器 3 条（POST） |
| **完成**（勾选） | 界面未完成数 -1 → 服务器上那条 `done` **仍是 false** → 同步后变 **true**（PATCH） |
| **删除**（✕） | 界面条数 -1 → 服务器**还有**那条 → 同步后没了（墓碑推出 DELETE） |

这个"先只落本地"的中间态断言是关键：它把**离线优先**这件事变成了可失败的检查，
而不是靠"最后结果对了"来推断。

写这套脚本时又踩了两个坑，都值得记：

| 现象 | 真因 | 解法 |
|---|---|---|
| 整轮验证报"app 在 150 秒内没起来" | **dev 客户端偶发在拉 bundle 的过程中整个进程消失**（本轮撞到两次）。`wait_for_app` 只是干等，等不到就放弃 | 轮询时用 `pidof` 看进程在不在，不在就**重新拉起**（带 20 秒节流），最多多等一会儿 |
| 删除断言把条目认成了「改」 | UI dump 里「条目文本」与「改」（编辑按钮标签）**在同一 y 上**，按"第一个文本节点"取会取错 | 以 **✕ 为锚点**（每行恰好一个），再在同一 y 上取**最左**的文本节点作为条目文本 | 

### 发布之后：`tools/check_published.sh`（验"registry 上那一版"）

新增的第四类检查，与既有三个的分工：

| 脚本 | 验什么 |
|---|---|
| `check_external.sh` | **本地工作区**能被外部模块依赖并编译（改本库时跑） |
| `check_published.sh` | **registry 上那一版**能被别人装下来并编译（发版后跑） |

**为什么必须分开**：发布包是 `.moonignore` **过滤后的产物**，跟工作区不是同一份东西 ——
本仓库就出过"把截图、安卓构建配置、计划书一起发出去"的事（262 个文件里 41% 是垃圾）。
只有从 registry 装下来编译过，才算"这一版对外可用"。

实测（2026-09，`XiLaiTL/moobile@0.2.0`）：

| 步骤 | 结果 |
|---|---|
| 在空模块里 `moon add XiLaiTL/moobile@0.2.0` | 装上 |
| 模板按 **0.2 的公开 API** 写（单导出 `handlers_with_init`、`update` 返回 `Cmd`、`subscriptions?` + `@sub.every`、能力包 `sqlite`） | `moon check --target js` **0 errors** |
| 发布产物里有 `sqlite/` | ✓ |

这一步同时把 **N1/H2 的公开 API 形状**在"外部使用者"视角下钉住了 —— 我们自己仓库里
能编，不代表别人拿到的包能编。

三个坑，都值得记：

| 现象 | 真因 | 解法 |
|---|---|---|
| `moon add XiLaiTL/moobile@0.2.0` 报 `no version satisfies requirement 0.2.0`，看着像"包没发出去" | 本机 `git config --global http.proxy = 127.0.0.1:7890`，而**代理没开** → `moon update` 拉 registry 索引（走 git）失败，用的是**陈旧索引** | 绕过代理：`GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=http.proxy GIT_CONFIG_VALUE_0= … moon update`（脚本里已内置"失败就绕过重试"） |
| `moon add` 说成功，但 `.mooncakes/` 里什么都没有 | 依赖**已经**写在 `moon.mod` 里时，`moon add` 打印 "already exists, will not update it" 并且**不下载** | 下载发生在 **`moon check`**；脚本站位按真实用户流程排：空 `moon.mod` → `moon add` → `moon check` |
| 装完目录位置和预期不一致 | 上面的顺序问题会让人以为是路径写错了 | 顺序对了，`.mooncakes/<module>/` 就在那儿 |

### 发布前把"打包出来的那份"也验一遍（tarball 视角）

发版前做的一件事：**把 `npm pack` 出来的 tarball 装进宿主工程，再跑四道门**。

为什么值得单独做：我们此前只验过 `file:../npm/moobile-host` 这种**源码拷贝**形态，
而 `npm publish` 上传的是 **`files` 白名单过滤后的 tarball** —— 两者不是同一份东西。
少一个目录（比如 `capabilities/` 被漏掉），发出去就是一个"装得上、跑不起来"的坏包，
而 npm **不能撤回**。

实测（2026-09）：

```bash
cd npm/moobile-host && npm pack          # → moobile-host-0.2.0.tgz（10.9 KB，6 个文件）
cd ../../host && npm install ../npm/moobile-examples/apps/todo-app/host/moobile-host-0.2.0.tgz
# 依赖变了 → 按经验重启 Metro（--clear），再跑四道门
```

| 门 | 结果 |
|---|---|
| Web UI（`tools/verify_web.js`） | **27 / 27** |
| 本地库（`db_probe.js`） | **8 / 8** |
| 同步（`sync_probe.js`） | **14 / 14** |
| 真机 Android 14（`verify_android.py`） | **21 / 21** |
| `npx moobile-host regen --check`（走 tarball 里的 bin） | 一致 ✓ |

tarball 内容正好是预期的那 6 个：

```
package/LICENSE  package/README.md  package/bin/cli.js
package/capabilities/db.js  package/index.js  package/package.json
```

顺手把这条经验固化成**发布脚本里的自检**：`npm/moobile-examples/apps/todo-app/host/publish.sh` 在发布前
先 `npm pack --dry-run`，并断言"入口 / 能力目录 / CLI / README / LICENSE"都在 ——
缺任何一个就直接**拒绝发布**（而不是发出去之后再发现）。

验证完把宿主工程**改回 `file:`**（开发时改包里的代码不用重新打包；代价是
`npm install file:` 是拷贝而非符号链接，改完要重装一次 —— 见上面 H1/H6 那一节）。

---

# R3 —— 仓库治理：fork 从模块根搬进 `vendor/rabbita/`（2026-09）

## 被推翻的旧结论

`tools/vendor_sync.sh` 的头注释里长期写着：

> 「MoonBit 的 `internal` 可见性按**包路径前缀**判，所以 fork 必须铺在模块根
> （放 `vendor/` 子目录的话，`vendor/rabbita/internal/*` 对模块根包不可见）」

**前半句对，结论错了。** 真相是：可见性只认**路径段恰好等于 `internal`**。
把 `internal/*` **摊平**（丢掉那一段）之后，模块根包照样能 import 并使用它们。

## 五个实验（都在 `_scratch/layout_probe/` 里跑过，可复现）

| # | 试的是什么 | 结果 |
|---|---|---|
| 1 | 根包 import `vendor/rabbita/internal/vdom` | ❌ `Cannot import internal package … due to internal visibility rules` |
| 2 | 根包只 import 同前缀下的**公开**包做中转，fork 包之间互相 import internal | ✅ 通过 |
| 3 | 在公开包上**再定义** internal 类型的方法 | ❌ `Cannot define method tag for foreign type` |
| 4 | 用 `pub using @vdom {type VNode}` 再导出，根包**使用**它（变体匹配 / 构造 / 字段） | ❌ 全挂：<br>`is an alias to a type in …internal/vdom, which is not imported`（变体匹配）<br>`Value ReactHost not found in package api`（结构体构造）<br>`…type and not a struct`（字段访问） |
| 5 | 路径段改成 `internal_vdom` / `_internal2`（**不是**恰好 `internal`），根包直接 import | ✅ **通过**（变体匹配 + 构造都行） |

**结论**：`internal` 是**精确的路径段匹配**。于是搬家的方式只有一种 —— **摊平改名**，
不是"加一层再导出"（实验 2~4 说明那条路只能"命名"、不能"使用"）。

> 顺带一条方法论：实验 4 我一开始把 match 的**模式**写在了主语位置上，报的错看着像可见性问题，
> 其实是语法错。**报错的第一行不一定是真因**，要连着上下文看。

## 搬完的样子

```
vendor/rabbita/            ← 1 个目录，代替原来铺在根的 16 个
├── vdom/ runtime/          ← 原 internal/vdom、internal/runtime
├── rabbita/                ← 原 internal/rabbita（fork 的主包：App / elmish / Val）
├── any/ duplix/ key/ slotmap/   ← 原 internal/ 下其余子包
└── html/ cmd/ dom/ common/ js/ sub/ variant/ svg/ url/ nav/ dialog/ clipboard/ websocket/ http/
```

**根目录：44 项 → 24 项**（其中 16 项是 fork；`)` 待续治理见 PLAN 的 A 轨道）。

实现方式：`tools/vendor_relocate.py`（`to-vendor` / `to-legacy` 两个方向）+
`vendor_sync.sh` 新增步骤 3.5。两个方向都要，因为：

- **`--apply`/`--check`** 要"旧布局 → vendor"：patch 的 `+++ b/路径` 是按旧布局写的，所以
  **先打 patch、后搬家**；
- **`--capture`** 要"vendor → 旧布局"：不然回写出来的 patch 打不上 pristine。

不变量仍然成立：`vendor_sync.sh --check` → **197 个文件 / 197 个，[OK] 一致**。

## 这一趟踩到的三个坑

| 现象 | 真因 | 解法 |
|---|---|---|
| 搬家后编译报 `Cannot find import 'XiLaiTL/moobile/internal/key'` | 我的映射表把 internal 子包写成了 `<模块>/key → <模块>/vendor/rabbita/key`，而**源路径带 `internal/` 前缀**（`<模块>/internal/key`） | 映射改成 `<模块>/internal/<x> → <模块>/vendor/rabbita/<x>`；`internal` 本身**不能**进通用表（否则会生成 `vendor/rabbita/internal/…` 这种错映射） |
| `git mv _tools tools` 之后变成 `tools/_tools/` | 我先 `mkdir -p tools`（为了建别的目录），于是 `git mv` 把 `_tools` **塞进了已存在的 `tools/`** | 移动前别预建目标目录；或者用 `mv _tools/* tools/` 确认后再删空壳 |
| `mv host …` 报 `Device or resource busy` / `Permission denied` | Gradle/Kotlin **daemon** 还在握着 `host/android/**` 的文件（之前那次 `assembleDebug` 留下的） | 先 `gradlew --stop`（必要时停掉残留 daemon 进程）再搬 |

## 治理后的两项机制性收益

1. **发布包更干净**：`moon package --list` → 212 个文件，只有库本体
   （根包 + `style/` + `sqlite/` + `vendor/rabbita/` + 三个声明文件）；
   `examples/`、`npm/`、`tools/`、`docs/`、`moon.work`、根上的截图**全部排除**。
   ⚠️ 重写 `.moonignore` 时我把 `/*.png` 弄丢过，三张 70KB 的截图当场混进发布包 —— 这次是
   `moon package --list` 抓出来的（**发版前一定要看一眼这个清单**）。
2. **demo 变成独立模块**：库的依赖闭包永远只有 `moonbitlang/async` 一个，
   demo 想加什么（比如 ORM）都不会牵连使用者。依据是实测：
   `moon.mod` 里声明了但**没人 import** 的依赖，照样会被消费者拉下来
   （`moonorm` + `moondb` = **11 MB**，而库自己的发布包才 ~200 KB）。

---

# R4 —— 文档与工程化治理（2026-09）

## 先立工具，再动文件

文档一挪目录，相对链接就**静默失效**（GitHub 上点进去 404，本地看不出来）。
所以这一轮**先写检查器**再搬文件：`tools/check_links.py`。

它第一次跑就抓出 **14 处断链**，其中 **12 处是我自己刚写的 `docs/README.md`** ——
文档在 `docs/` 下，链接却按仓库根写的（`DEV.md` 而不是 `../DEV.md`）。
另外 2 处是**误报**：文档里有 `` `struct Val[A](@duplix.Node[A])` `` 这种行内代码，
长得像 Markdown 链接。修法是**先剥掉围栏代码块与行内代码再扫**。

现在 `tools/verify_all.sh` 里它是第 3 项 —— 链接失效再也不会悄悄溜进去。

## `docs/` 按**读者**分家

原来的问题是"职责重叠"（`docs/EVIDENCE.md` 与 `docs/FINDINGS.md` 都记实测、
`docs/DESIGN-README.md` 是设计期的重复 README）。现在：

```
docs/
├── README.md                       ← 索引：三类读者三条路线
├── ARCHITECTURE.md                 ← 给贡献者：分层与契约
├── FINDINGS.md                     ← 实测记录（R1–R4）
├── design/                         ← 给维护者：设计期的东西
│   ├── DESIGN.md                   设计文档（草案/待验证，保留原始判断）
│   ├── DESIGN-FEASIBILITY.md       写代码之前的可行性实测（原 EVIDENCE.md）
│   └── DESIGN-README.md            设计期草案 README（已加"过时"抬头 + 指路）
├── plan/PLAN-2026Q3-yi-port.md     ← 归档的旧计划
└── evidence/r1/                    ← 测量数据与截图
```

命名冲突（`EVIDENCE.md` vs `evidence/`）随之消失：设计期实测叫
`DESIGN-FEASIBILITY.md`，实现期实测叫 `FINDINGS.md`。

> 顺带把根上的"大项目标准件"补齐：`CONTRIBUTING.md`、`CHANGELOG.md`、`AGENTS.md`、
> `.editorconfig`、`.github/{workflows/ci.yml, PULL_REQUEST_TEMPLATE.md, ISSUE_TEMPLATE/*}`。
> `.editorconfig` 在这里不是装饰：fork 是用 patch 维护的，**CRLF 会打乱 patch 上下文**，
> 而 `lf_normalize.sh` 要等到跑检查才发现，编辑器级约定更早。

## 又踩到一个"直接跑通过、放进脚本就失败"

`tools/verify_all.sh` 里那一项 `check_links` 报了 FAIL，而**同样一条命令手敲却是通过的**。真因：

> Windows 上 Python 的输出编码跟随 locale（GBK）。脚本会把 stdout **重定向到文件**，
> 这时打印中文里的 `✓` 直接抛 `UnicodeEncodeError` → 非零退出 → 被记成"检查失败"。

修法：给所有会打印中文的 Python 工具加一段兜底

```python
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
```

已经加在 `check_links.py` / `vendor_relocate.py` / `verify_android.py` 上。
**这类"环境差异导致的假失败"最消耗人**：如果当时只看汇总，会去查链接，而真因在编码。

## 一条纪律：发布前看清单

这轮加完根上的元数据文件后，我又跑了一次 `moon package --list` —— 仍是 **212 个文件、
只有库本体**（`AGENTS.md` / `CONTRIBUTING.md` / `.editorconfig` / `.github/` 都没进去：
`*.md` 规则覆盖了前者，点文件与点目录 moon 默认不带）。
上一轮就是这条纪律抓出了混进包里的 `moon.work` 与三张 70 KB 截图。

---

# R5 —— 出版卫生：本机路径真的发出去过（2026-09）

## 事实

`README.md` 里那段"本地工作区"示例写着维护者机器的绝对路径：

```
members = [ "D:/ai_project/interest/moobile", ... ]
```

而 **README 是随发布包一起发出去的**（`.moonignore` 只放行 `README.md` / `FORK.md` /
`THIRD-PARTY-NOTICE.md` 三个 md）。所以 **mooncakes 上已发布的 0.1.0 与 0.2.0 里都带着它**：

```
$ python3 tools/check_public_leaks.py --zip _build/publish/XiLaiTL-moobile-0.2.0.zip
LEAK（必须改）2 处：
  XiLaiTL-moobile-0.2.0.zip::README.md:35  [本机绝对路径]  D:/ai_project
```

只能靠**发新版本**补救（`moon` CLI **没有** yank/unpublish 子命令 —— 实测 `moon --help`
里只有 `publish`；registry 的 manifest 里有 `yanked` 字段，但网页端能不能撤没验证）。

## 做成了什么

`tools/check_public_leaks.py`：扫**本机绝对路径 / 家目录用户名 / 凭据**，仓库与**产物**
（zip 与 tgz 都支持）都能扫。分级：**LEAK**（必须改）与 **WARN**（本机信息，多在开发文档里）。

- 接进 `tools/verify_all.sh`（第 4 项）→ 想再犯也过不了检查；
- 接进 `npm/moobile-host/publish.sh` → 发布前是**闸门**，不是提醒；
- `tools/env.sh` 的 JDK / AVD 路径改成可被环境变量覆盖；
- 维护者本机专用的两个磁盘迁移脚本（`link_builddirs.ps1` / `migrate_c_to_e.ps1`）
  移到 `tools/local/` 并写明"换机器未必适用"。

## 扫描器本身踩的两个坑（都是"噪声淹掉真信号"）

1. **盘符正则太松**：`[A-Za-z]:[\/]…` 把 `https://` 里的 `s:` 当盘符，一次报出 **590 处**
   "泄漏" —— 真信号（README 那条）完全被淹没。修法是加 lookbehind，要求盘符是 token 开头。
2. **测试夹具里的示例邮箱**：上游 MoonBit core 的 `js/value_test.mbt` 里有
   `burtdominguez@geekwagon.com` 之类的假数据。它进了包但不是我们的泄漏，
   所以对 `vendor/**` 与 `*_test.mbt` 里的邮箱降级成 WARN。
3. （又一次）**忘了给新的 Python 工具加编码兜底** → `verify_all.sh` 里报"检查失败"而手敲通过。
   这已经是这个坑第二次咬人，所以现在四个工具都加了 `sys.stdout.reconfigure(encoding="utf-8")`。

> 教训：**检查工具本身要有人看它报的东西是否可信**。一个 590 处噪声的检查，等于没有检查。

---

# R6 —— 验证闸门提速：9 分钟 → 24 秒，以及一次"改快改瞎"（2026-09）

## 起因：verify_all 为什么这么慢

`bash tools/verify_all.sh` 全程 **≈ 9 分钟**。逐步计时（同一台机器，各步单跑）：

| 步骤 | 耗时 |
|---|---|
| `moon check --target js` | 2s |
| **`lf_normalize.sh --check`** | **262s** ← |
| `check_links.py` | 1s |
| `check_public_leaks.py` | 1s |
| **`vendor_sync.sh --check`** | **267s**（其中 ~262s 是它**内部又调了一次 lf_normalize**） |
| `check_external.sh` | 5s |

**没有任何 sleep**：慢的是 `lf_normalize.sh` 里的 CR 判定写法 ——

```bash
has_cr() { [ "$(tr -cd '\r' < "$1" 2>/dev/null | wc -c)" -gt 0 ]; }
```

它对**每个**候选文件起两个进程（`tr` + `wc`）。本仓有 **2500 上下**个候选文本文件
（这个数会浮动：`.scratch/` 里是探路用的第三方缓存。复现用 `bash tools/py.sh tools/cr_scan.py --root . --mode check`）
（这个数是用 `find` + 同一份白名单独立数出来的）≈ **5000 次进程启动**，
而 Windows 上每次 spawn 是几十毫秒 → 单这一项 260 秒。翻倍是因为
`vendor_sync.sh --check` 为了"先查行尾"**又调了一次同一个脚本**。

> 顺带修正一句长期不成立的注释：`verify_all.sh` 头注释写着"一起跑也就几十秒"。
> 那句话在写下时就不成立（实际 9 分钟）—— 又是"注释里的已对齐没有测试兜着"。

## 第一次改法是错的：快，但是瞎

把逐文件 fork 换成一次 `grep`：

```bash
printf '%s\0' "${cands[@]}" | xargs -0 -r grep -lIUZ -- $'\r'
```

跑下来 **0.19 秒**，看起来完美。**但它是错的**：对同一个仓库它报出 **2537 个"带 CR"**，
而真值是 **0**。真因是本机 Git Bash（MSYS）**会把命令行参数里的裸 CR 弄坏**。
用一个亲手造的已知 CRLF 文件校准四种判据：

| 判据 | 已知 CRLF 文件 | 本仓真值 |
|---|---|---|
| `tr -cd '\r' \| wc -c` | 2 ✅ | 0 |
| `grep -c $'\r'` | **0** ❌ | — |
| `grep -Uc $'\r'` | — | **2537（几乎全是假阳性）** ❌ |
| Python `b"\r" in open(p,"rb").read()` | 2 ✅ | **0** ✅ |

**它"快"是因为它几乎匹配了所有文件** —— 一个永远说"有问题"的检查，和永远说"通过"的检查
一样没用。这次是 `verify_all.sh` 汇总里的 `FAIL`（rc=1）把它暴露出来的；
如果当时只单独跑那条 grep 看速度，就会带着一个坏检查去发版。

## 最终的改法：一次进程，按字节读

新增 `tools/cr_scan.py`（白名单与排除目录都搬进去，单一实现），`lf_normalize.sh` 只做 CLI 包装：

- 判据是 `b"\r" in data` —— 不经过文本模式、不经过 argv 编码，因此不受 MSYS 影响；
- 一次进程扫完全部候选：**1 秒**（比原来快 ~260 倍）；
- 输出里**带上候选文件数**（`候选 2338 个文本文件，带 CR 的 0 个`）：
  一个"什么都没查"的检查同样会报通过，所以这个数字本身就是"检查有效"的证据。

## 改完必须做的一件事：证伪

换了实现，就必须证明它还**抓得住**问题（否则就是上面那个坏 grep 的重演）：

| 场景 | 期望 | 实测 |
|---|---|---|
| 正常仓库 | rc=0 | `候选 2338 … 带 CR 的 0 个` → rc=0 ✅ |
| 塞诱饵 `printf 'x\r\ny\r\n' > tools/_crlf_bait.md` | rc≠0 且**点名**该文件 | `[CR] tools/_crlf_bait.md` → rc=1 ✅ |
| `bash tools/lf_normalize.sh`（apply） | 真修掉 | `已转 LF: tools/_crlf_bait.md`，`od -c` 得 `x \n y \n` ✅ |
| 删掉诱饵 | 回到 rc=0 | ✅ |

## 结果

```
通过 7  失败 0  跳过 0        # 总耗时 24s（原 ≈9 分钟）
```

7 项与提速前完全一致（`moon check` / 行尾 / 链接 / 泄漏 / vendor / 外部模块 / 注册表），
**没有放宽任何断言** —— 只是把同一条断言的实现从 ~5000 次 spawn 换成 1 次进程。

> 这一轮与 R2 的 `uiautomator dump` 陈旧文件、R5 的 590 处噪声是**同一个形状**：
> **验证工具本身会骗你**（第三次了）。区别是这次骗的方向是"快"：
> 一个 0.19 秒的检查让人想立刻收工，而它其实什么都没查。


---

# R7 —— 0.2.1 发布之后：README 与产物不符，以及「转发包到底行不行」（2026-09）

## 事故：照 README 写的第一行就编不过

0.2.1 发出去之后，跑「发版后验一遍」的闸门，顺手拿 README 的快速上手编了一次 0.2.1：

```
Cannot find import 'XiLaiTL/moobile/html' in probe/readmepaths@0.1.0
```

README（**随包发布**，也是 mooncakes 的落地页）写着：

```moonbit
import {
  "XiLaiTL/moobile/style",
  "XiLaiTL/moobile/html",      // ← 0.2.1 的包里根本没有这个包
  "XiLaiTL/moobile/cmd",       // ← 也没有
}
```

而 0.2.1 包里只有 `vendor/rabbita/html`、`vendor/rabbita/cmd`。

## 真因：搬家的**后半段**没通知使用者

R3 把整个 fork 从模块根搬进 `vendor/rabbita/`。当时 CHANGELOG 0.2.0 记的是
「仓库结构（**对使用者无影响，导入路径不变**）」—— 这句话对**已经发出去的 0.2.0** 是成立的
（实测：装下来的 0.2.0 包里就是扁平的 `html/`、`cmd/`，它的 README 也那么写）。
但**搬家之后的工作区/0.2.1** 把它变成了假话：

| 版本 | 包里有什么 | 消费者该写什么 | 编得过吗 |
|---|---|---|---|
| 0.2.0（已发布） | `html/ cmd/ dom/ …`（扁平） | `XiLaiTL/moobile/html` | ✅ |
| 0.2.1（本文这次） | `vendor/rabbita/html` | `XiLaiTL/moobile/html`（照 README） | ❌ |
| 0.2.2（本次修复） | 两者都有（扁平那层是**转发包**） | `XiLaiTL/moobile/html` | ✅ |

## 为什么闸门没拦住

`tools/check_published.sh`（"发版后从用户视角验一遍"）里那行是**写死的**：

```bash
TARGET="${1:-XiLaiTL/moobile@0.2.0}"      # ← 发了 0.2.1 之后它还在验 0.2.0
```

于是它一直验的是**上一个版本**，而"正发的这一版"从来没被这样验过。
另外那时**没有任何检查把「文档」和「产物」对起来** —— `check_external.sh` 用的是
`tools/ext_probe` 里手写的 import（早就改成 vendor 路径了），所以它一直是绿的。

> 这是本项目第 N 次同一个形状：**检查的目标写死了 → 检查退化成仪式**。修法两条，
> 都已落地：默认目标改成跟随 `moon.mod` 的版本；新增"README 快速上手"检查（见下）。

## ★ 更正 R3 的一条结论（它误导了人）

R3 实验 4 的结论被写成了「加一层公开再导出包就能绕过 internal → ❌ **类型只能被命名、不能被使用**」，
`AGENTS.md` / `FORK.md` 也照抄了。这个说法**过宽**：它把"某一方不能使用"讲成了"谁都不能使用"。
2026-09 用两个最小模块重测（`pub using @real {type Color, type Box, red, make_box, describe}`）：

| 谁用转发来的类型 | 命名 | 调函数 | 字段访问 | 变体匹配 | 构造 struct |
|---|---|---|---|---|---|
| **消费者**（import 转发包） | ✅ | ✅ | ✅ | ✅ | ✅ |
| **转发包自己** | ✅ | ✅ | ✅ | ✅ | ❌ `Cannot create values of the read-only type` |

源包放在 `internal/` 路径段下，结论**一样**（消费者那 5 列全 ✅）。

**关键是语法和位置**，这两条当时都没摸对：

- `pub using` 要写在 **`.mbt`** 里，写进 `moon.pkg` 直接 `UnexpectedToken("pub")`；
- 名字**不带 `fn` 关键字**：`pub using @cmd {none, batch, type Cmd}`（上游 rabbita 的 `top.mbt` 就这么写），
  加上 `fn` 会报 `Missing type annotation for the return value` / `you may expect {`。

**所以"加转发就行"是对的** —— 当时被证伪的是另一个更窄的情形。真正的不便是这两条：

1. `pub using` **没有通配写法**（`{*}` / `{...}` / 裸包名 `/ 全试过，全不支持）；
2. 于是 `html` 要逐个列 **400+ 个名字**（125 个值 + 10 类型 + `Attrs::*` 方法/1 trait）。

## 解法：根上放**生成**的转发包

`tools/gen_forwarders.py` 在模块根生成 `html/`、`cmd/`、`sub/`、`http/` 四个纯转发包，
名字清单从 `vendor/rabbita/<pkg>/pkg.generated.mbti`（`moon info` 的产物 = 公开 API 的权威清单）抽出来。
于是：

- 消费者继续写 `XiLaiTL/moobile/html`（README 不用改，0.2.0 用户的代码也不用改）；
- 模块根只多 4 项（不是把 14 个 fork 目录搬回去），R3 的"根目录变干净"保住了；
- 生成物入库 → `--check` 能 diff 出漂移，接进 `verify_all.sh`（第 7 项）。

`moon.mod` 里那个 description 也一起改了 —— 原来那句「moobile：MoonBit 写 UI，交给 React Native
渲染 —— 跨端 UI 层（内含 rabbita vendor fork）」给 registry 看是**三处不合规**：重复包名、
纯中文、把内部实现（vendor fork）摆在最前。对照上游 rabbita 的 `functional Web UI framework for
MoonBit` 改成：

```
MoonBit UI for mobile: Android, iOS and Web from one rabbita (TEA) app, rendered by React Native
keywords = [ moonbit, mobile, android, ios, web, cross-platform, react-native, rabbita, UI, TEA ]
```

## 这一趟踩的坑（都报过错）

| 现象 | 真因 | 解法 |
|---|---|---|
| 转发包只转出 23 个名字（`html` 有 362 个公开函数） | 泛型子句在 **`fn` 和名字之间**：`pub fn[C : IsChildren] div(...)`，我的正则把它当成 `fn div` 了 | 正则改为先吃掉 `\[[^\]]*\]` 再取名字；拿 `pub fn 总数 − 方法数` 对账（362−240=122，加 3 个 `pub let` = 125 ✓） |
| `Emit` / `Request` / `RequestWithBody` 编译报 `Alias for the type … should be created via using {type X}` / `declared twice` | **方法声明也可能带泛型**（`pub fn[A, B] Emit::map(…)`），没被"方法"分支吃掉 → 名字落进了"值"列表 | 方法正则加泛型子句；并加护栏：同名既在类型又在值里时以类型为准 |
| `@html.Attrs` / `@cmd.Cmd` / `@sub.Sub` 都找不到 | **不透明类型**在 `.mbti` 里是**不带 `pub` 的裸 `type Attrs`**（写在 "Types and methods" 段），而我只认 `pub(struct\|enum)` | 增加裸 `type NAME` 规则。**这条是"README 探针"抓出来的** —— 光验路径存在是抓不到的 |
| `moon info` 之后 `vendor_sync --check` 报"工作区多出 22 个" | `.mbti` 是构建产物，而 vendor 的不变量是"**197 个源文件** == pristine + patch" | 生成器自己管这个依赖：缺就 `moon info`，用完**只删自己新建的**那些 `.mbti`（实测 30 个，跑完归零，不变量回到 197/197） |
| 探针报 `UnicodeDecodeError: 'gbk' codec can't decode byte 0xad`，随后 `proc.stdout is None` | `subprocess` 的 `text=True` 用**本机 locale**（GBK）解码 moon 的 UTF-8 输出，异常在读取线程里抛出 | 显式 `encoding="utf-8", errors="replace"`。**这是本仓记过的同一个坑的解码侧**（编码侧早就在三个 Python 工具里加了兜底） |
| `moon.work` 报 `Lexing error at 14..46`，看不出跟路径有关 | 生成的 `moon.work` 用了 Windows 反斜杠路径，被词法器当成转义 | 一律写**正斜杠** |

## 新闸门（两个，都做了证伪测试）

| 工具 | 判据 | 证伪怎么做的 |
|---|---|---|
| `tools/readme_probe.py` | 从 README 里**解析** import 路径，并按 README 的 `view` / `app` 示例编一遍（workspace 与 registry 两种目标） | 改前：`Cannot find import 'XiLaiTL/moobile/html'` → ❌；把路径改成 vendor → ✅；修完（转发包）→ ✅ |
| `tools/gen_forwarders.py --check` | 生成的转发包与 `.mbti` 是否一致 | 塞一行 `pub using @vendor {totally_bogus_name}` → `[异] html\forward.generated.mbt` 且 rc=1；还原 → 一致 ✓ |

两条都接进了 `verify_all.sh`（现在是**离线 8 项**）。

> 结论：**README 是契约**。它是随包发出去的东西，也是使用者的第一屏 ——
> 所以"文档说的"和"包里有的"必须由一条**能失败**的检查拴在一起，
> 而不是靠维护者记得同步。

## 补记：`--zip` 模式与一次**假证伪**

发现这个缺陷之后，第一反应是"拿 0.2.1 的 zip 跑一遍新探针，看它是不是真的会红"。跑出来是 **✅ 通过** ——
差点得出"探针没用"的结论。真因是：`_build/publish/` 里的 `XiLaiTL-moobile-0.2.1.zip`
**被后面的 `moon package` 重新打过**（当时工作区已经有转发包了，而文件名里的版本号还取自改名前的
`moon.mod`），所以那是一份"名字叫 0.2.1、内容是新版"的混合体。

拿**真发出去的那份**（registry 缓存 `~/.moon/registry/cache/XiLaiTL/moobile/0.2.1.zip`）再跑，才是红的：

```
Cannot find import 'XiLaiTL/moobile/html' in probe/readmepaths@0.1.0     # exit 1
```

于是 `--zip` 模式加了一句自我提醒，并且把发版顺序钉死：**`moon package --list`（重打）→ 立刻 `--zip` 那一份**。

> 又是同一个形状（R2 的 `uiautomator` 陈旧 xml、R5 的噪声、R6 的假通过）：**先问"我手上这份是不是这次的"**。
> 这次差点把"检查有效"验成"检查无效"。

## 补记：Python 工具"慢"的真因是 **pyenv shim**，不是 Python

有人反馈"跑 Python 脚本都要好久"。实测下来这话对了一半 —— **慢的是调用方式，不是脚本**：

| 命令 | 耗时 |
|---|---|
| `python3 -c pass`（PATH 上那个 = **pyenv-win 的 shim**） | **~630ms** |
| 真解释器 `~/.pyenv/pyenv-win/versions/3.11.9/python3.exe -c pass` | **~60ms** |
| `python3 tools/cr_scan.py`（真活 ~350ms） | ~980ms |
| 同一个脚本，直接叫真解释器 | ~420ms |

`shims/python3` 每次调用都要重新解析版本、再转发一次进程 —— 本仓有 6 处 `python3` 调用，
`verify_all.sh` 因此白花 **3~4 秒**，而且**每个工具单跑都"卡一下"**，让人误以为是脚本慢。

修法：`tools/py.sh` —— 解析出一个不经 shim 的解释器并 `exec` 它（`$PYTHON` 优先；
PATH 上是 shim 就问一次 `pyenv which python3`，结果缓存到 `_build/.python-path`，
因为 `pyenv which` 自己也要 ~440ms）。所有 shell 工具改走它：

| 步骤 | 改前 | 改后 |
|---|---|---|
| `check_links` | 728ms | **205ms** |
| `check_public_leaks` | 939ms | **434ms** |
| `lf_normalize --check` | 1016ms | **560ms** |
| `verify_all.sh` 全程 | ~25s | **~21s** |

### 顺带回答了"要不要用 MoonBit 重写这些工具"

量了 `moon run --target js`（已构建、缓存命中）：**~80ms** —— 与真 Python 解释器（~60ms）
**同一量级**，而且还要多一层"编译产物是否最新"的检查；走 native 则要 MSVC 工具链 + 构建步骤。
而 `verify_all.sh` 里剩下的两个大头是 **`vendor_sync --check` ~10s** 与
**`check_external` ~6s**（各自内部的 `moon add` / 两次 `moon check`）—— **与脚本语言无关**。

> 结论：**换语言在速度上基本是白换**。要再快，该动的是"重复劳动"（基准包重放、重复的 moon check），
> 不是换语言。若出于"一个仓库一种语言"（dogfooding）而想改，那是另一个理由，与性能无关。

---

# R8 —— 工具链改用 MoonBit 写（2026-09）

## 为什么动这件事

上一轮（R6 补记）量过：`verify_all.sh` 里 Python 那几项慢，**根因是 pyenv shim**（630ms/次），
不是脚本本身；换成 MoonBit 在**速度上基本是白换**。但"一个仓库一种语言"本身是理由 ——
本项目就是 MoonBit 写的，工具却全是 Python，改库的人得同时伺候两套工具链。
所以这一轮按"**逐个迁移 + 每个都证明等价**"的方式做，先从最简单的 `cr-scan` 开始。

## 形态

```
tools/mbtools/            ← **独立（嵌套）module**：不污染库的 moon.mod（库的依赖随包发布）
├── moon.mod              name = "XiLaiTL/moobile-tools"，目标 js，依赖只有 moonbitlang/x
└── src/
    ├── moon.pkg          pkgtype(kind: "executable")
    ├── main.mbt          子命令分发
    └── cr_scan.mbt       cr-scan 的实现
tools/mb.sh               ← 调用包装（`moon run` 必须在模块目录里跑）
```

- 目标是 **js**：`moon run --target js`（已构建）实测 **155–182ms**；native 要多一套 MSVC + 构建步骤。
- **不需要** `exit` 的 core API：`extern "js" fn js_exit(code : Int) = "(code) => process.exit(code)"`。
- 相对路径：`moon run` 改掉了进程 cwd，所以 `tools/mb.sh` 把调用者的 cwd 放进 `MBTOOLS_CWD`，
  工具侧用它解析相对 `--root`。

## 等价性怎么证明的（不是"看起来一样"）

给两边都加了 `--mode list`（把候选文件**原样列出来**），然后逐行 diff：

```
Python  : 候选 166 个文本文件，带 CR 的 0 个
MoonBit : 候选 166 个文本文件，带 CR 的 0 个
候选清单逐行相同（166 个文件）      # diff 无输出
```

计时（同一份工作，都经各自的包装脚本）：

| 实现 | 耗时 |
|---|---|
| Python（`tools/py.sh` 绕开 shim） | 246ms |
| **MoonBit**（`tools/mb.sh` + `moon run`） | **299ms** |

**MoonBit 略慢一点点** —— 诚实记下来：`moon run` 每次要确认构建是否最新。
若哪天想抠掉这 ~50ms，可以把包装改成 `moon build` 一次 + 直接 `node` 跑产物，
代价是"产物可能过期"这类经典坑。现在**不换**：永远自动重建更值。

## 迁移过程中挖出的两个真问题

### 1. 排除规则只认精确路径 → 嵌套构建产物被当成源码

新建的 `tools/mbtools/_build/` 里有 **192 个构建产物**被算进了候选（候选数 2338 → 2531）。
真因：排除表里写的是 `_build` 这个**精确相对路径**（对应早先 bash 的 `-path "$ROOT/_build"`），
匹配不到 `tools/mbtools/_build`。

**规则本来就该只覆盖"我们自己的文件"**：`--mode fix` 去改构建产物毫无意义，
而第三方缓存里的 CRLF 也不是我们的问题。于是改成两条规则：

| 规则 | 内容 | 为什么 |
|---|---|---|
| 按**路径段**（任意深度） | `.git` `_build` `target` `.mooncakes` `node_modules` | 版本控制 / 构建产物 / 第三方缓存 / 依赖 |
| 按**精确相对路径** | `vendor/`、Expo 宿主下的 `android/dist/.expo` | fork 由 `vendor_sync.sh` 自己规范行尾；其余是宿主生成物 |

效果：候选 **2531 → 166**（砍掉的 2364 个全是产物与第三方）。两个实现同步改，diff 仍为空。

> **2026-10-01 追加一条**：路径段表后来又加了 **`.scratch`**。
> 它是 gitignore 的**本地草稿区**（`.gitignore:30`），放什么都不会进发布包 —— **但它会红**。
> 当时为了诊断 CI（见本文件末尾的 CI 补记），在里面写了两份 CRLF 文本，
> `lf_normalize --check` 与 `vendor_sync --check` **同时**变红，点名的是
> `.scratch/ci/anns.txt` 这种**永远发不出去**的文件 —— 又是"红的是自己的草稿，不是被测物"。
>
> 证伪是**成对**做的（缺一不可）：草稿区里塞一个 CRLF 文件 → 候选 **320** / 带 CR **0** / exit 0；
> 把同一个文件放到区外 → 候选 **321** / 带 CR **1** / **点名** `.scratch_decoy.txt` / exit 1。

> **2026-10-01 同一天又踩了一次，但这次是"门立了功"**：抬版本号时我用 Python 批量改文件，
> `pathlib.Path.write_text()` 在 Windows 上**默认做换行翻译**（`\n` → `\r\n`）——
> 一次改了 **13 个文件**（`CHANGELOG.md`、7 个 `moon.mod`、模板的 `package.json` …），
> 全部变成 CRLF，而**编辑器里看不出来**。`verify_all.sh` 当场红了三条门
> （行尾 / vendor 一致 / 副本新鲜度），点名 13 个文件。
> 修法就是仓库自己的工具：`bash tools/lf_normalize.sh`（不带 `--check`）—— 修完 0 个带 CR。
>
> **教益**：脚本化批量编辑**必须显式写 `newline="\n"`**（或写完就跑一次行尾门）。
> 这条坑不是"文件多"，是**沉默的**：CRLF 在 Windows 的编辑器里与 LF 长得一模一样，
> 只有门看得见它 —— 而它打乱的是 `vendor_sync` 的 patch 上下文（那才是真正会藏 bug 的地方）。

### 2. `--mode fix` 修完却返回 1（Python 版就有，一直没暴露）

退出码原来两种模式共用"有没有找到 CR"，于是 `lf_normalize.sh` 的 apply 路径
（`… || exit 1`）**在成功修复之后反而报失败**。之所以没被发现：我当时的验证命令走了管道
（`bash tools/lf_normalize.sh | tail -3`），**退出码被 `tail` 吃掉了** —— 又一次"验证工具骗了我"。

修法：按模式分语义 —— `check` 有 CR → 1；`fix` 干完活 → **0**。

## 顺带发现：`moon ide`（官方 agent CLI）

写这个工具时我一直在 `grep ~/.moon/lib/core` 猜 API（`String::rev_find`、`Bytes::from_array`、
`StringBuilder` 的方法全是试出来的）。官方有专门的语义级 CLI：

```bash
moon ide doc "String::*rev*"     # 精确列出方法签名（比 grep core 快且准）
moon ide outline src             # 包/文件的结构骨架
moon ide peek-def <symbol>       # 定义位置 + 上下文
moon ide find-references <sym>   # 所有引用
```

后面写 MoonBit 代码**先用 `moon ide doc` 查 API**，别再 grep 标准库。

## 补记：把"重复劳动"压掉（21s → 8s），以及一次读错输出

`verify_all.sh` 的 21 秒里约 20 秒是 moon 子命令在干活。三处都是**同一件事做两遍/每次重做**，
与脚本语言无关：

| 改动 | 手段 | 效果 |
|---|---|---|
| `vendor_sync --check` | 期望树按输入哈希缓存（`vendor.lock` + 全部 patch + 搬家参数 + 基准版本）；**只缓存期望树，工作区永远重新比** | 10.1s → **1.1s** |
| `check_external` | 两个探针（手写 ext_probe + README 生成的那份）放进**同一个工作区**，只跑一次 `moon check` | 6.1s → **3.3s** |
| `gen_forwarders --check` | 同样按输入哈希缓存"期望内容"，常见情况下**一次 `moon info` 都不用跑** | 2.0s → **0.27s** |

**每一个都做了证伪**（缓存最危险的失效模式是"跳过检查还报通过"）：

- 篡改缓存里的期望树 → 必须报漂移（实测 rc=1）✓
- `touch` patch（内容不变）→ 仍命中（证明键是内容哈希，不是时间戳）✓
- 改 patch 内容 → 键变、重建 ✓；还原 → 回到旧键 ✓
- 改 vendor 源码 → 缓存失效、报漂移 ✓；还原后 vendor 不变量与转发包都恢复一致 ✓

顺带记两个小事实：

- **moon 失败时返回 127**（不是 1）。判断一律用 `-ne 0`；对外归一化成 1（127 在 shell 里是
  "command not found" 的约定，容易误导）。
- **`.mbtx` 脚本模式在本机必须带 `--target js`**：不带会走 wasm 后端去找
  `~/.moon/lib/core/_build/wasm/.../prelude.mi`，而本机只备了 js 产物 → **编译器 ICE**
  （报的是 "This is a bug in the compiler"，看不出真因是缺 wasm std 产物）。

### 一次读错输出（值得记）

我测 `.mbtx` 的参数传递时，用了 `... 2>&1 | head -2`，头两行是 node 的
`MODULE_TYPELESS_PACKAGE_JSON` 警告，于是我**得出了"脚本收不到参数"的错误结论**。
换成 `2>/dev/null` 再看，`args 4 条：[node, single.js, hello, world]` —— 参数一直是通的。

> 又是同一个形状：**先确认"我看的是不是那一行"**。这次是我把 stderr 的噪声当成了 stdout 的结论。

---

## 补记（I1 事件载荷）：生成式 vendor 的 patch 对**文件末尾换行**敏感

给 `html/` 加事件载荷通道时新增了 `vendor/rabbita/html/payload.mbt`，写完 `tools/vendor_sync.sh --capture`
一切正常，但 `--check` 直接红：

```
patch unexpectedly ends in middle of line
patch: **** malformed patch at line 174:
ERROR: patch 打不上：27-new-html-payload.mbt.patch
```

**真因**：那个文件**末尾没有换行**（`0x0A`）。我用一次编辑把它删掉了 —— 而 `patch` 要求每个 hunk 的
上下文行以换行结尾，最后一行缺换行就成了"畸形 patch"。**报错完全没提"换行"**，看起来像 patch 生成器的 bug。

**解法**：`printf '\n' >> <file>` 再重跑 `--capture`；并且把"新文件必须有末尾换行"加进自查清单：

```bash
for f in $(git status --porcelain | awk '{print $2}'); do
  [ "$(tail -c 1 "$f" | xxd -p)" = "0a" ] || echo "缺末尾换行: $f"
done
```

**为什么值得记**：这条错的形状与 R7/R8 同一类 —— *报错信息指向的地方（patch 生成器）不是真因所在
（文件末尾换行）*。而且它只在"新增文件 + 生成式 vendor"这个组合下出现，正常改代码不会碰到。

---

## 补记（E 轨道脚手架）：产物路径不是模块名的函数，以及"残留检查近乎同义反复"

2026-09-20 动手做脚手架时实测到的五件事，都是"只在别人的机器上才暴露"的那一类。

### 1. `moon build` 的 JS 产物路径，取决于模块在**构建根里的身份**

同一个模块，两种布局（都是实测，不是推理）：

| 场合 | 产物 |
|---|---|
| **工作区成员**（仓库 `moon.work` 里，或临时 `moon.work` 里带 `.`） | `_build/js/<profile>/build/<作者>/<模块>/<模块>.js` |
| **独立模块**（空目录里 `moon new` + `moon add`，没有 `moon.work`） | `_build/js/<profile>/build/<模块>.js`（平铺） |

后果：`tools/build.sh` 原本写死的那条嵌套路径，**在用户的机器上一定不存在**。
所以搬运这一步从"`cp` 一个已知路径"改成"**发现产物**"（`npm/moobile-host/lib/build.js`）：
先按预测路径找，不中就在 `_build/js/<profile>/build/` 下按文件名唯一命中，
**匹配到多个就报错并列出候选**（歧义是要人看一眼的信号，不是可以猜的）。

判据是可执行的：`tools/template_check.mjs` 两种布局各验一遍（成员形态走预测路径，独立形态走扫描）。

### 2. `@sub.every` 在 node 里需要一个 `window`

无头跑模板时第一下就炸（不是编译错，是运行时）：

```
ReferenceError: window is not defined
    at _M0FP…rabbita3dom6window (...)
    at …builtin__sub__loader (...)
    at …diff__subs (...)
```

`@sub.every` 底下读的是 **`window.setInterval`**（订阅加载器先取 `window`）。浏览器与 RN 里它天然存在，
node 里没有 —— 无头验证补了一个最小的同名对象（`tools/verify_headless.mjs` 里有说明，写明这是
环境补齐而不是绕过）。**换成 `setTimeout` 并不解决**：真因是"这个能力由平台给"。

顺带一个同源的小坑：补上 `window` 之后，验证脚本**跑完不退出** —— `setInterval` 是真的，
事件循环一直挂着。第一次被自己坑了 120 秒（`timeout` 才收场），现在末尾显式 `process.exit`。

### 3. npm **永远不把 `.gitignore` 打进 tarball**

实测：`package.json` 的 `files` 里写了 `"template/"`，`npm pack --dry-run` 的 Tarball Contents 里
**没有** `template/.gitignore`；单独列一条 `"template/.gitignore"` 之后才出现。

后果正好落在"我们这边永远复现不出来"的那一格：`init` 从**包内模板**生成项目时，
用户拿到的工程会没有 `.gitignore` —— 于是他的 `moobile.js`（1 MB 的产物）与 `_build/` 会被提交进仓库。
所以 `publish.sh` 的 REQUIRED 自检里钉住了 `template/.gitignore`（发版自检是唯一能拦住它的地方）。

> ⚠️ **2026-09-21 修正一半 —— 别把这一节当成完整的机制**（旧结论留在这里不删，按 `docs/README.md`
> 第 2 条约定）。上面测的两件事**仍然成立**（`files` 里不列它 → tarball 里没有 ✓ 当天复验过）。
> 但"列进 `files`"**不充分**：`npm install` 解包时会把包里的 `.gitignore` **改名成 `.npmignore`**，
> 于是用户的项目里**还是**没有 `.gitignore`（只是换了个错法）。三份样本、"我们这边为什么看不见"
> 与修复见下面**「补记（不发版先本地跑一遍，2026-09-21）」**。

### 4. 门里用 `spawnSync(..., { shell: true })` 会被 `D:\Program Files\...` 打败

`template_check.mjs` 第一次跑就红在这种形状上：

```
'D:\Program' is not recognized as an internal or external command
```

`shell: true` 把 `process.execPath`（`D:\Program Files\nodejs\node.exe`）按空格切开了。
解法：**不用 shell**，node 一律走 `process.execPath` 的绝对路径，`moon` 交给 PATH（`moon.exe`）。

### 5. "残留检查"差点写成同义反复 —— 补了两条真正会红的断言

设计稿 §3.4.2 的取舍是"模板写真字面量，生成器替换 + **断言替换干净**"。第一版实现只查
`placeholders` 清单里那几个字面量有没有残留 —— 而 `apply()` 一定会把它们替换掉，
**所以那一半永远不会红**（第一次想证伪它时才发现：我往模板里塞 `moobile-template`，
它被正常替换成了新名字，绿得很合理）。

真正会漏的是另外两种，各补一条：

| 补的断言 | 抓的是什么 | 证伪测试（都做过了） |
|---|---|---|
| **派生写法**：`moobile_template` / `moobileTemplate` / `MoobileTemplate` / `moobiletemplate` | 模板里出现了清单**没登记**的写法（snake 标识符、Android 包名那种紧凑写法） | 往 `App.js` 塞一行含 `moobile_template` 的注释 → 红，且**一个文件都没落盘** |
| **身份锚点**：生成后 `moon.mod` 的 `name` / `package.json` 的 `name` / `app.json` 的 `name\|slug\|android.package` 必须**正好**是请求的名字 | "模板改了名而清单没跟着改" —— 那种情况下旧字面量根本没被匹配到，生成物里躺着的是**第三个名字** | 把模板的 `moon.mod` 改成 `XiLaiTL/moobile-template-v2` → 红：`模块名是 fals2-v2，应当是 fals2` |

两条都在**落盘之前**判：失败时**不留半个项目**（半成品项目比报错更难查 —— 使用者会以为
那个名字是正常的，然后把别人的名字提交进自己的仓库）。

---

## 补记（I2/I3 组件库生成器）：八个"形状对不上却给了结果"的坑

> 背景：`libgen`（`PLAN.md` §3.8 的 I2/I3/I5）要从 `node_modules/antd/**/*.d.ts` 抽出
> 「组件 → prop 名 + 类别」。它是**浅解析 + 小解析器**（不起 TypeScript），所以最有价值的
> 记录不是"哪条语法没支持"，而是**那些不报错、只是悄悄少一批 prop 的退化** ——
> 少一个可选参数，编译器一句话都不会说。

### 1. 别名右值存成了 `{text, end}` 对象 → 每个 type 别名都变成 `[object Object]`

`readTypeRhs()` 返回 `{text, end}`（文本 + 结束位置），而 `parseDts` 把**整个对象**塞进了
`aliases[].rhs`。于是求值 `ButtonType` 时拿到的是字符串 `"[object Object]"` ——
它以 `[` 开头、`]` 结尾，**正好撞上"元组"那条判据**。
症状：`Button` 的 `type` / `color` / `variant` / `shape` / `size` 全被判成 `json`。
**真因与症状隔了整整一层抽象**，而它不报错，只是"分类结果看起来怪"。

解法：`aliases.push({ …, rhs: rhs.text })`。教训：**返回结构体的函数，取值时别漏字段**；
凡是"字符串化之后恰好符合另一条判据"的地方，都值得加一条形状断言。

### 2. `interface X extends A, B {` 集体解析不出来（零宽 lookahead 没吃掉空格）

解析 extends 用的是 `/^\s*(?:extends\s+([\s\S]*?))?(?=\s*\{)/` —— lookahead 是**零宽**的，
所以 `m[0]` 停在 `{` 之前的空格上，而代码紧接着检查 `src[i] === '{'` → 不成立 → `continue`。
偏偏**没有 extends 的接口能过**（`m[0]` 是空串）。于是症状是精确的：
**所有带继承的接口一起消失**，而那正好是 antd 里最常用的那批（`ButtonProps` / `CardProps`…）。
第一版量到的"372 个 interface"里有 199 个是这么丢的。

解法：匹配之后再吃掉空白。**零宽断言不消费字符**这件事在"匹配完还要看下一个字符"的代码里
是经典陷阱。

### 3. `import { type X } from '…'` 里的内联 `type` 没剥掉 → 整条 import 被丢

TypeScript 4.5+ 的常见写法（`@rc-component/picker` 就用）。正则按 `Name as Alias` 匹配，
`type PickerProps` 匹配不上 → 那条 import 被整条忽略 → `RcPickerProps` 查不到 →
`DatePicker` 只有 11 个 prop。
**"少 prop"是静默的**，所以这类退化特别值得防：它不是失败，是清单变小。

### 4. `export * from './X'` 不认 → 那个包里所有名字都查不到

`@rc-component/image/es/index.d.ts` 全文就三行：`import Image from './Image'; export * from './Image'; export default Image;`。
只认 `export { … } from '…'` 的话，这个包等于空的 —— `RcImageProps` 解不开，`Image` 只剩 3 个 prop
（连 `src` 都没有）。

### 5. antd 6.6.4 的枚举全是 `(typeof _X)[number]`

```ts
declare const _ButtonTypes: readonly ["default", "primary", "dashed", "link", "text"];
export type ButtonType = (typeof _ButtonTypes)[number];
```

不认这个写法就等于**把枚举整体丢掉**（64 个 prop 落进 `unsupported`）。
解法：解析 `const` 值声明（注解式与初始化器式两种），并让求值器支持
`typeof X` / `(typeof X)[number]` / `T['k']`。**这三样都是"结构上可求值"的**，
和 `keyof` / `infer`（真要求值就得上编译器）不是一回事 —— 分开处理。

### 6. React 属性面表写成了"平铺"，而真实类型是**继承链** → `Input.onChange` 消失

`@types/react` 里是 `InputHTMLAttributes<T> extends HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T>`。
我们自备的那张兜底表第一版把每个接口写成"只有自己那几条"，于是
`React.InputHTMLAttributes` 里**没有 `onChange`** —— 而 rc-input 的 props 正是
`Omit<React.InputHTMLAttributes<…>, …>`。
症状坏在"这是 I1 的招牌用例"：**受控输入在生成物里根本没有 `on_change` 这个参数**，
编译报错是"这个函数没有 on_change 标签"，离真因（我漏了继承）隔了三层。

顺带一条同源的事实：`children` 声明在 `DOMAttributes` 里 —— 所以"转发 DOM 属性的组件都有 children"。
只在组件自己的 Props 接口里找 `children`，会得出"`Tag` / `Image` / `Statistic` / `Divider` / `Avatar`
都不能有 children"的错误结论。

### 7. React 具名事件类型没有参数表 → 被判成"信号"，受控输入当场失效

`React.ChangeEventHandler` 是个**接口名**，浅解析不会去展开它的调用签名，
于是"看不到参数" → 判成 `@cmd.Cmd`（信号）→ `Input.on_change` 收不到值。
**家族够用**：`Change` / `Input` 两族就是"带值"，其余（Mouse/Keyboard/Focus/Pointer/…）是信号。
解法：按名字里的家族判，而不是按"有没有参数表"判。

### 8. 复合子组件的 `jsonProps` 键写成了裸名 → `Radio.Group.options` 没被 parse

汇总时把子组件写成 `jsonProps["Group"]` 而不是 `jsonProps["Radio.Group"]`，
而宿主注册表用的是 `antd:Radio.Group`。后果：`options` 以字符串身份交给 antd，
报错是 antd 内部的 `options.map is not a function` —— 离"键写错了"隔了一整个组件。
**教训**：跨边界的键必须**逐字对账**，而"两侧同源于一份 manifest"这条设计正是为了这个；
实现时任何一处拼接不一致，都会以最远端的形态爆出来。

### 另外两个（不是解析问题，但同样静默）

- **联合里的"不可达分支"会污染分类**：`Table.rowKey?: string | ((record) => string)`
  含函数分支 → 被算成"最宽 = json" → 调用点必须写 JSON 文本，而它 99% 的用法就是普通字符串。
  函数分支对我们**不可达**（回调进不了 prop 通道），不该参与"最宽类别"的判断。
- **`unused_mut` 在本仓库是错误**：生成的 DSL 里"只有 `attrs?` 的组件"一次都不改 `a`，
  于是 `let mut a` 直接编译失败。生成器必须按"有没有参数"决定写不写 `mut`。

### 工具链层面（留给下一个写生成器的人）

- **Windows 上 `open(path, 'w')` 会把 `\n` 翻译成 `\r\n`**。我用脚本批量改文件时踩到，
  被仓库的 `lf_normalize --check` 逮住（一次 19 个文件）。解法：`open(..., newline='\n')`，
  或者干脆用带写入能力的工具而不是脚本。
- **在 Git Bash 的 heredoc 里写 JS 正则，反斜杠会被吃掉一层**：
  `.replace(/\/g, '/')` 落到文件里变成 `.replace(/\/g, '/')` —— 正则未闭合，
  而报错是 `Private field '#materializeFields' must be declared in an enclosing class`
  （因为语法树从那句起就崩了）。**同一个坑我踩了两次**，解法是能不用转义反斜杠就不用
  （`path.sep` 代替 `\`）。

---

## 补记（计划文档整理，2026-09-20）：三处互相矛盾的分数，以及"线上那一对"到底自不自洽

整理 `PLAN.md` / `SCAFFOLD.md` / `DESIGN-COMPONENT-LIBRARY.md` 时实查到的东西。
**没有一条是"读文档发现的"，每条都跑过命令** —— 这也是为什么它们值得记。

### 1. 同一份 `PLAN.md` 里，同一个数字有三个版本

| 事实 | 文档里同时写着 | 实测 |
|---|---|---|
| 离线门项数 | 5 项（§3.4 C2）· 6 项（A5 与 `ci.yml` 注释）· 7 项（顶部快照）· 9 项（SCAFFOLD §6） | **12 项**（`bash tools/verify_all.sh`） |
| Web 端到端 | 26/26 与 27/27，**同一份文件的两段** | 27/27（加了订阅心跳那条之后没回头改前面） |
| 真机 | 21/21 与 14/14，同一份文件的两段 | 21 项（`AGENTS.md` 记的也是 21） |
| 已发布什么 | 顶部停在 `0.1.0` | 月亮包 **`0.2.2`**、npm 宿主 **`0.2.0`** |

**真因不是"忘了改"，而是"同一件事有多处落点"**：PLAN 顶部一段"进度快照"、各轨道小节里各写一次、
设计文档顶部再来一张状态表 —— 每次有新数字就顺手写进当下正在改的那一处。
**解法（已经落地）**：新增 [`docs/STATUS.md`](STATUS.md) 作为**唯一来源**，
其他文档一律只留一句链接；`ci.yml` 的注释里明写"别抄这个数"。

### 2. "线上那一对"自不自洽 —— 靠拉 tarball 才敢下结论

契约从 `1` 升到了 `2`（`app.mbt:13` 与 `npm/moobile-host/core.js:24`），
而线上是**更早发出去的**两个包 —— 那就有一个真问题：**线上库和线上宿主对得上吗？**
光看源码回答不了（源码是两边都 `2`）。**做法：把发出去的那一份拉下来看**。

```bash
npm view moobile-host@0.2.0 dist.tarball      # → .../moobile-host-0.2.0.tgz
curl -sL <tarball> | tar -tzf - | sort        # 清单：LICENSE / README.md / bin/cli.js /
                                              #        capabilities/db.js / index.js / package.json
tar -xzOf <tarball> package/index.js | grep CONTRACT   # → CONTRACT = 1
curl -s https://mooncakes.io/api/v0/modules/XiLaiTL/moobile | head -c 200   # → "version":"0.2.2"
```

结论两条，都反直觉：

- **线上那一对是自洽的**（`1` ↔ `1`）—— 因为契约 `1 → 2` 这一批**还没发**。这属于"运气好"，
  只要当时先发了月亮包再想起 npm 包，线上就会错配（启动即抛），而这在本地**永远复现不出来**。
- **线上包里连 `core.js` 都没有**（更别说 `lib/init`、`libgen`）—— "工作区里的包"比"线上的包"多一整套脚手架。
  所以 `PLAN` 里 S1「干净机器三条命令跑起来」这条判据**当前不成立**，不是"没验"，是"验不了"。

**顺带修掉一个文档里说过头的结论**："demo 已经改用远端包"（§3.1 的目标）——
`examples/apps/todo-app/moon.mod` 里确实写着 `XiLaiTL/moobile@0.2.2`，但**它同时是 `moon.work` 的成员**，
工作区会让这个名字解析到本地源码。也就是说那半条判据是"声明 + 编译级冒烟"，不是"跑起来"。
（`moon.work` 会覆盖版本这条，以前没写下来过。）

### 3. 两个"抄来的数字"都错了，而且错法不一样

| 文档里 | 实测 | 错法 |
|---|---|---|
| `components.generated.mbt` **10931** 行 | **12062** 行 | 生成物长大之后没人回头改（复合子组件那一批加进来时长的） |
| manifest **9318** 个 prop | **9317** | 差一 —— 这种不会被任何人发现，除非跑一遍数出来 |
| 无头门"12 项" | **10 通过 + 2 SKIP** | 把 SKIP 也算成了"项" |

**教训**：`wc -l` 和 `counts.props` 这种**一次就出**的数字，也应该由文档引用"当场跑一遍"，
而不是从上一版文档里复制。生成物头部自己写着 `组件 71 个｜生成的参数 4965 个｜未生成 4352 个`
（4965 + 4352 = 9317），**生成物自己就是最好的旁证** —— 文档该抄它，而不是抄彼此。

---

## 补记（T1 同源门，2026-09-21）：手量的清单是错的，以及门自己也会瞎

装 SCAFFOLD §6 的 T1（生成物 vs demo 的同源比对器，`tools/template_compare.mjs`）时实查到的东西。
**这一节的共同主题是："机器算出来的集合"打败"人记得的差异"。**

### 1. 手量出来的清单：漏登 3 处、多登 1 处

`tools/template/deltas.txt` 是 2026-09-20 **手量**的（当时记的是"66 行、24 条差异"）。2026-09-21
把判据写进代码之后，第一件事就是让它自己算一遍 —— **清单本身是错的**：

| # | 清单里怎么写的 | 实际 | 错法 |
|---|---|---|---|
| 1 | `app.json:icon / adaptiveIcon / plugins` | 还差 **`expo.web.favicon`** | 漏登（它属于同一类"assets 差异"，人脑归完档就停手了） |
| 2 | （没有这一条） | 生成物**显式**写 `"newArchEnabled": true`，demo 没写 | 漏登（**后加的**字段） |
| 3 | `moon.pkg` 只登记了 `import` 与 `注释` | `exports` 数组的**排版**也不同（`[ "app" ]` vs 三行） | 漏登（同一个值的两种写法 —— 人眼扫过去觉得"一样"） |
| 4 | `package.json:private`（why 写"生成物是 `private: true`"） | **两边都是 `true`** | **多登**：它根本不是差异 |

**真因**：手量差异靠的是"**我记得哪里不一样**"，而不是"**程序算出来的集合**"。于是漏的恰好是两类
——**后加的字段**（第 2 条）和**看起来一样的差异**（第 1、3 条）。多登的那条更隐蔽：它读起来像一条
**事实**（"生成物是 private: true"，这句是真的），而清单要的是**差异** —— 把两侧都打出来才发现
"事实为真"和"它构成差异"是两回事。

**解法**（三条，方向都是"别让它再靠印象"）：

- 第 3 条**没有**写进清单，而是**把模板改成与 demo 同一个排版**（模板是真源，改它 = 改用户拿到的东西；
  这次动的纯粹是排版，`moon check` 0 错误）。**判据：能用改代码消掉的差异，就不要变成清单里的一行** ——
  清单越短，剩下的每一行才越有人看。
- 第 1、2 条补进清单（它们是真实存在、需要人理解的差异）。
- 第 4 条删掉，并顺手把它变成门的**一个功能**：**死条目**检查。登记着、而实际上早就不是差异的行会被
  点名（但**不弄红** —— 见下）。

### 2. 门要有"判决之后"的一层，否则清单会变成漂移的藏身处

"清单之外的差异 = 红"这句话，反过来读就是：**只要往清单里加一行，任何差异都能变合法**。
而 SCAFFOLD §7 明确说这条正是要防的（"往 `deltas.txt` 里不断加行来掩盖漂移"）。

所以门做了三层，而不是一层：

| 层 | 判据 | 抓的是 |
|---|---|---|
| 文件级 | 只在 demo / 只在生成物里的文件必须登记 | 新增/删掉一个文件（最容易发现，也最容易被忽略） |
| **字段级** | 声明的字段**删掉之后，剩下的部分必须一模一样**（JSON 按键、文本按"去掉注释后逐字比"） | **漂移**藏进了已登记的文件里 |
| **死条目**（不弄红，只点名） | 登记着、实际已不存在的差异 | **清单在腐烂** |

几个具体决定，理由都不是"更严格"，而是"报错要能指向真因"：

- **JSON 走"删掉已声明路径再比"**：这样"没登记的键变了、少了、多了"都会红。清单里因此把
  `dependencies` 拆成了**逐个键**（`dependencies.moobile-host` 等）—— 粒度粗到"整个 dependencies 对象"，
  就等于把漂移的入口开在那里。
- **`import` 只做单向子集检查**（生成物的每一条都必须也在 demo 里）：理由是"demo = 模板 + 能力，
  只许多、不许少"。这样**不用把能力名字抄进比对器**（抄了就会漂），而"模板偷偷多一条能力依赖"照样红。
- **`注释` 走"去掉注释后逐字比"**：它把清单里"代码完全相同，只有注释不同"那句断言**变成可执行的**，
  而不是留给人相信。
- **不写字段的条目 = 整份文件允许不同**：这是最弱的一档，只给了 3 个"两份本来就各写各的"文件
  （`registry.generated.js` / `metro.config.js` / `.gitignore`）。门的输出里**明写**"整份文件允许不同
  （清单未细化到字段）"—— 免得有人把它当成一条强检查。
- **死条目不弄红**：红的意思是"有清单外的漂移"；而"清单该删一行"是另一件事。把后者也弄红，会诱人
  为了绿去删清单里的**真**条目 —— 那才是灾难。

### 3. 装门时踩的三个自己的 bug（三个都"红得不像真因"）

| 现象 | 真因 |
|---|---|
| 4 个文件同时红，报的都是"清单漏登"，可清单里明明写了 | `contentRules` 用**文件**当 Map 的键 → 同一文件的第 2、3 条把第 1 条**覆盖**了（`package.json` 有 5 条、`app.json` 有 3 条） |
| `package.json:name` 明明登记了，删掉之后还是不同 | 顶层键的删除走了 `getPath(obj, "")` → `"".split(".")` 得到 `[""]` → 找到 `obj[""]` → **静默什么都没删** |
| 删掉 `web.favicon` 之后两侧还是不同 | 删空的 `web: {}` 与"根本没有 `web` 键"被判成不同 → 一处已登记的差异被算成**两处** |

三条的**报错信息都在指别处**（"清单没登记" / "有一处差异清单里没有"），真因却都在比对器自己身上 ——
AGENTS.md 那句"**报错的第一行不一定是真因**"的又一次现场。所以工具里补了三条对价：
删单段路径单独分支、比较前 `prune()` 掉空对象、失败时打印"**哪一侧、哪个文件、去掉已声明部分之后
还剩哪一行/哪一个键不同**"。

### 4. 证伪（`tools/template_compare_falsify.sh`，8 例全过）

| # | 往哪塞 | 期望 | 实测 |
|---|---|---|---|
| 0 | （什么都不塞） | 绿 | ✅ 绿 |
| 1 | demo 多一个未登记的文件 | 红 | ✅ 点名那个文件 |
| 2 | 模板改了**共享依赖**的版本（`react-native`，没登记的键） | 红 | ✅ 报 `dependencies.react-native` |
| 3 | 模板多一条 demo 没有的 `import` | 红 | ✅ 报 demo 缺哪一条 |
| 4 | 模板改了 `App.js` 的**代码**（清单说这里只有注释不同） | 红 | ✅ |
| 5 | 模板改了 `app.json` 的未登记字段（`orientation`） | 红 | ✅ |
| 6 | demo 改 `.gitignore`（清单里是"整份文件允许不同"） | **绿** | ✅ 绿（这一档是**有意**放过的，写下来免得下次当成漏洞） |
| 7 | 往清单里塞一条根本不存在的条目 | **绿 + 点名** | ✅ 绿，且出现在"死条目"里 |

⚠️ **第一版证伪脚本是"假证伪"**：`sed` 的模式写漏了一个前缀，探针**根本没塞进去**，而报出来的结论是
"**门没有红**" —— 看着像门坏了。所以脚本里加了一道：探针必须先在文件里出现（`grep`），否则报的是
"探针没塞进去（脚本的错）"，而不是"门没红"。这与 R7 补记里那次假证伪（拿错的 zip 跑出了 ✅）是
**同一类错误：验证者自己没被验证**。

同样地，脚本跑完会**逐文件 `cmp`** 校验"确实还原了"（它会临时改工作区里真实的文件），并且 `trap` 到
`EXIT/INT/TERM` —— 被 Ctrl-C 打断也会还原。这也是它**不进 `verify_all.sh`** 的原因：
一条"每次跑都改源码"的门不适合放进日常入口。

### 5. 这条门现在的位置

`node tools/template_compare.mjs` 约 1 秒（只读文件、跑一次 `init`），已进 `verify_all.sh`
**并发那一组**（和模板门、探针门一起）。清单条数与死条目由它自己打印 ——
**别抄进文档**，抄一份就会漂一份（这正是上一节第 3 条的教训，也是 `docs/STATUS.md` 顶部那条规矩的由来）。

---

## 补记（C0 换宿主，2026-09-21）：同一份产物挂到"零 Expo"的裸 RN 宿主上

`PLAN.md` §3.4 的 C0 要回答的是 §1.2 那句**断言**：「宿主是可替换件 —— 库与具体 RN 版本无关，
也与 Expo 无关」。它在那之前只有**读代码 + 间接证据**：全文搜 `AppRegistry` 只搜得到
「注释里说换成它会怎样」。落地物是 `examples/apps/host-swap-spike/`，判据是它自己的
`verify.mjs`（**27 项，全过**）：

```bash
cd examples/apps/host-swap-spike && npm install
node verify.mjs        # 编产物 → 搬产物 → esbuild 打包 → node 静态服务 → 真 Chrome（CDP）断言
```

**结论**：同一份 `moobile.js`（模板应用，sha256 逐字节对得上）在**零 Expo、零 Metro** 的
宿主下渲染出「待办 / 还有 0 件」，并且 输入 / 添加 / 勾选 / 删除 四条交互都回到了 MoonBit 的
`update`。**换宿主改的只有两处**：入口那 3 行（`registerRootComponent` → `AppRegistry`）
和一行 resolver 映射（`react-native` → `react-native-web`）；库、产物、`App.js`（4 行）一个字节没动。

### 边界（别把结论读大）

- 验的是**web 目标**上的裸 RN 宿主（`react-native-web` = RN API 的 web 实现）——
  **不是**"裸 native RN（gradle + 真机）也验过了"，那条路成本高、这一轮没做。
- 挂的是**模板应用**（零能力），不是 `todo-app`。理由见下第 1 条。

### 边界不是"产物"，是"能力注册表"（实测，不是推理）

"`todo-app` 挂不上裸宿主"这句如果不验，就又是一句读代码的断言。把它跑了一遍（临时把
spike 的 `App.js` 指向 demo 的产物，跑完即还原，`cmp` 校验过）：

| 尝试 | 结果 | 说明 |
|---|---|---|
| demo 产物 + **demo 自己的注册表** | ❌ **连打包都过不去**：`Could not resolve "expo-asset"`（来自 `todo-app/host/node_modules/expo-sqlite/build/hooks.js`） | 注册表 `registry.generated.js` → `moobile-host/capabilities/db` → `expo-sqlite` → `expo-asset`。**把平台拉进来的是注册表那一环**，不是产物 |
| demo 产物 + **空注册表**（只为让包能打出来） | ⚠️ 包能打（零 Expo ✓，2.7 MB），但页面**全空** | 启动那条 db 命令在 MoonBit 侧直接 abort。栈：`$panic ← abort ← XiLaiTL/moobile/sqlite::ensure ← sqlite::exec ← todo_app::open_and_read` |

**所以 §1.2 推论 1 那句话是准的**：换平台 = **写一个新宿主**（含能力的适配），产物本身是干净的。

⚠️ 顺带记一条**没做好的地方**：`sqlite/ensure` 的 panic 消息里**写着**"怎么装"（`npx expo install
expo-sqlite` + 怎么注册，源码 `sqlite/*.mbt` 里看得到），但在上面这条路径上，**控制台里只有一条
未捕获的 `$PanicError` + 栈**（CDP 抓到的控制台输出只有 React DevTools 的 info 行），
页面又全空 —— 也就是"报错要说清装什么"这条（判据 S3）在**新宿主**上没兑现。
这与 `registry.generated.js` 注释里"用到时会 fail-fast **并说明怎么装**"有落差，
值得 N/I 轨道复核（要么让 abort 走 console.error，要么宿主侧注册表在挂载时先自检并打出来）。

### 三个真问题（都是"看着已经做对了"的那种）

| # | 现象 | 真因 | 处置 |
|---|---|---|---|
| 1 | 想直接挂 `todo-app` 的产物，但它的 `init_app = (initial(), load_cmd(emit))` —— **启动就发 db 命令**，而 db 能力现在是 `expo-sqlite` 实现的 | 能力实现本来就是**宿主侧**的东西（§1.2 推论 1）。把它混进来，"宿主能不能换"就被"有没有 sqlite"盖住了 | 这一轮挂**模板应用**（零能力）：**只换一个变量**。带能力的宿主（换一个 db 实现）是下一步，不是这一轮的结论 |
| 2 | 从仓库根跑 `node examples/apps/host-swap-spike/verify.mjs` 红在 `Could not resolve "react-native-web"`，而 `cd` 进去跑是绿的 | **esbuild 的 `alias` 值按 cwd 解析**，不是按 import 它的那个文件 | 加 `absWorkingDir: HERE`。⚠️ 这类"只有从某个目录跑才对"的检查特别危险 —— `verify_all.sh` 正是从仓库根调的，第一次接进去就红了 |
| 3 | `npm install` 报成功，`verify.mjs` 却说 esbuild 没装 | 本机 npm 的**生效配置是 `omit=["dev"]`**（`npm config ls -l` 里看得到），devDependencies 被**静默跳过** | esbuild 放进 `dependencies`（spike 没有发布/生产的区分，宁可一条命令到位）。⚠️ 与仓库记过的「`.gitignore` 不进 tarball」是同一类：**配置里写了 ≠ 会发生**，得有一处证明它真的发生了（那条后来还被**修正了一半**：不是"没打进去"，而是"**装的时候被改了名**" —— 见本文 2026-09-21 的补记） |

### 两个 RNW 的 DOM 事实（写断言时踩的）

- **RNW 把 `<Text>` 渲染成两层**：外层 `div` + 内层 `span`。所以按"文本最内层元素"定位时，
  它的 `parentElement` 是**文本自己那一层**，不是行 —— 行要再往上一层。
  （稳定的走法：从最内层往上找"最近的、同时包含这一行另一个标记（这里是「删」）的祖先"。）
- **RNW 这一版没给 `Pressable` 加 `role="button"`**：靠 `[role=button]` 找按钮会**静默扑空**，
  然后点在一个不可点的元素上、界面毫无变化 —— 报出来的是"交互没生效"，真因是"没找到按钮"。
  所以那条断言现在**同时报元素尺寸**（找到的是 22×22 的勾选块，还是 150×20 的文本行，一眼可辨）。

### 一条值得复用的做法：**新鲜度注入**

"页面渲染出来了"只说明**某个** bundle 跑通了，说明不了跑的是**这一次**编的产物 —— 而本仓库在
别处正好踩过"读到陈旧产物"的坑（`uiautomator dump` 失败时留下上一次的 xml）。
这里的做法：`verify.mjs` 在**打包那一刻**算 `moobile.js` 的 sha256，用 esbuild 的 `define`
注入成 `__ARTIFACT_SHA__`，页面上读回来的值必须与磁盘一致，否则红。

> 同样地，`verify.mjs` 把"环境不够"（没 Chrome / 没装 esbuild）用**退出码 2** 报出来，
> 由 `verify_all.sh` 记成 **SKIP** 而不是 PASS —— 判据的全部价值就是"真浏览器里渲染出来了"，
> 拿不到浏览器时**悄悄给个绿**等于把判据作废。

---

## 补记（不发版先本地跑一遍，2026-09-21）：S1 链路两段都通了，以及 npm 解包会**改文件名**

`docs/STATUS.md` §1 那三条推论里最硬的一条是"**不发布，S1「干净机器三条命令」就不成立**"
（线上 `moobile-host@0.2.0` 里没有 `init`）。发版要 2FA、只能由账号持有人做 ——
但**那条链路本身可以在本地先验**。于是照着"用户会遇到的两种形态"各跑了一遍：

| 形态 | 怎么造出来的 | 结果 |
|---|---|---|
| 从**仓库布局**生成 | `node npm/moobile-host/bin/cli.js init my-app` | `npm install`（488 包）→ `npm run build`（moon 34 任务 0 错误，418 KB 产物）→ `npm run web` → 真 Chrome **9/9**：首屏「待办 / 还有 0 件」、输入回灌、点「添加」→ 计数 1、条目出现、输入框清空、全程无 console 错误 |
| 从**打包形态**生成 | `publish.sh --dry-run` 全过之后手工 `npm pack` → `npm install <tarball>` → 用**装好的那份 CLI** `init clean-app` | 同上 **9/9**（宿主包确认来自 tarball：`package-lock.json` 里 resolved = `file:../../moobile-host-0.2.0.tgz`） |

那 9 条断言的脚本（`probe-web.mjs`）是为这次实验写的一次性工具，住在仓库外的
`s1-local-run/`，**没有**进 `tools/`。

### 抓到的东西：`npm install` 解包时会把 `.gitignore` **改名成 `.npmignore`**

第二段一开始就不对：从**打包形态**生成出来的项目里是 **`.npmignore`，没有 `.gitignore`**。
三份样本（都是实测）：

| 样本 | `template/.gitignore` 在不在 |
|---|---|
| `npm pack --dry-run --json` 的条目清单 / `tar -tzf <tgz>` | ✅ 在（`files` 白名单那一行没白写） |
| 手写 `tar -xzf <tgz>` 解出来 | ✅ 还是 `.gitignore` |
| **`npm install <tgz>` 装进 `node_modules` 之后** | ❌ **变成了 `.npmignore`** |

**后果**：用户 `init` 出来的项目**没有 `.gitignore`** → 他会把 `moobile.js`（1 MB 产物）与
`_build/` 提交进自己的仓库。**而这在我们这边永远复现不出来** —— 仓库里所有脚手架门
（`template_check` / `scaffold_probe` / T1）都是**从仓库布局的模板**生成的，
只有"真打包 + 真安装 + 用装好的 CLI 生成"这一步看得见。

⚠️ 这一条把仓库里原先那句**修正了一半**（旧说法与推翻过程都留在原处，见下面
「补记（E 轨道脚手架）」第 3 条）：`files` 里那一行**仍然必要**——不列它，tarball 里
**一个 ignore 文件都没有**（2026-09-21 复验过：把 `"template/.gitignore"` 那一行去掉，
`template/` 还在白名单里也没用）——但它**不充分**：名字能不能到用户手里，最后取决于 `init`。

### 处置（三件，都做了证伪）

| # | 做了什么 | 证伪 |
|---|---|---|
| 1 | `lib/init.js`：**永远写出 `.gitignore`**（模板里是 `.npmignore` 就把这个名字还原）；模板里两个都没有 → **当场报错**、不生成残缺项目（"半成品项目比报错更难查"，与它旁边两条断言同一个处置） | 把还原那一行关掉 → 下面两条门都红（见下） |
| 2 | **新门** `tools/package_check.mjs`：真打 tarball → 真 `npm install` → 用**装好的 CLI** `init` → 断言生成物里有 `.gitignore`、没有 `.npmignore`、文件集合与包内模板逐一对得上。挂在 `publish.sh` 里（**发布前必跑**，不过就不许发） | 关掉修复 → **10 项里红 2 项** |
| 3 | `tools/template_check.mjs` 加一条**离线代理**（14 → 15 项）：把模板副本里的 `.gitignore` 改名成 `.npmignore`（npm 干的就是这件事），用 `MOBILE_TEMPLATE_DIR` 指过去再生成一遍 | 关掉修复 → 该条红 ✓ |

修完重打 tarball → `clean-app` 生成出来是 `.gitignore` ✓，而且它照样在真浏览器里 9/9 通过。

### 顺带两条实测事实

- **`file:` 装的包里没有 `template/`**（那是 `publish.sh` 发包时才拷进去的）—— 所以从 `file:`
  依赖的安装形态跑 `npx moobile-host init` 会**直接失败**（报错会把找过的路径一条条列出来 ✓）。
  也就是说 `init` 只在**仓库布局**或**打包形态**下工作。这与"demo 吃 `file:` 依赖"不矛盾：
  demo 不调 `init`。
- 两条路上 `moon build → moobile-host build` 都**命中预测路径**（独立模块形态：
  `_build/js/debug/build/<模块名>/<模块名>.js`），与仓库成员形态的
  `<作者>/<模块>/<模块>.js` 不同 —— 这条早就有记载，这次是两条路各复现了一次。

## 补记（N2 宿主能力通道，2026-09-21）：`#cfg(target="js")` 分不开 Web 与 RN

### 真因：裁线的维度错了，不是粒度错了

一直默认"用 `#cfg(target="js")` 就能把浏览器专有的东西裁掉"。**这条对 RN 不成立**：
RN 走的也是 js 目标（`moobile-host/lib/build.js` 就是 `moon build --target js`），
**Web 与 RN 是同一个 target**。

后果不是"降级"，而是**直接抛**：`@dom.document()` 编出来是 `() => document`，
Node / RN 里 `document` 是 `undefined` → 调 `.as_event_target()` 立刻 TypeError。
证据：`moon test --target js` 跑在 Node（`typeof document === 'undefined'`），
所以 `sub` 的 visibility 测试**必须先 mock 一个 `document` 才能跑**。

含义：**"这是不是浏览器"只能由宿主声明，不能由编译目标推断。** 这才是 `MOBILE_HOST.native`
存在的理由 —— 不是"多一层配置"，是唯一能表达这件事的维度。

### 量出来的 dom 引用分布（11 个包，199 处）

| 类 | 处数 | 判据 |
|---|---|---|
| **死代码** | **88（44%）** | `vdom/diff.mbt`(35) + `vdom/hydrate.mbt`(39) 是**整套 DOM 渲染器**；`VDom::initialize` 全仓只有 3 个调用者 —— `host_browser.mbt` / `host_hydration.mbt` / `host_ssr.mbt`，**全是原版浏览器/SSR 宿主**。`react_host.mbt` 对 `@dom` 零引用 |
| 活类型 | 65 | 事件类型别名、WebSocket/Sub 签名 |
| 活运行时 | 46 | 能力包里的 `window.` / `document.` 调用 |

`sub/sub.mbt` 那 26 处还要再分三类，**不能一刀切**：
`every` / `on_animation_frame` 用的是标准 JS 全局（`setInterval` / `requestAnimationFrame`），
**RN 上本来就有** —— 这正是 `@sub.every` 真机验过的原因；要接替代物的只有 `on_resize` /
`on_scroll` / `on_url_changed` 那一档。

### 踩到的坑：新增文件没进 `files` 白名单

给 `moobile-host` 加 `native-rn.js` 时忘了改 `package.json` 的 `files`。真因：`npm pack`
**只打白名单里的东西**，新增文件不会自动进去 —— 表现会是"发布出去的 `index.js`
`import './native-rn.js'`，而那个文件不在包里"。

三道防线里**哪道先响**值得记下来：

| 检查 | 什么时候响 | 局限 |
|---|---|---|
| `git status` | **不响** | `npm/moobile-host/` 在白名单外的新文件本来是 untracked，看得见；但**发布形态**它验不了 |
| `check_npm_fresh` | 副本陈旧时响 ✓（本轮就红了：`内容不同 index.js` / `副本里缺 native-rn.js`） | 它比的是**仓库里的 `file:` 副本**，所以要先刷新副本才能复绿 —— 顺序是"改 `files` → 重装副本 → 门复绿" |
| `npm pack --dry-run` | **最直接** ✓ | 手动跑，不在门禁里 |

处置：`files` 加 `native-rn.js`，重装 `examples/apps/todo-app/host/node_modules/moobile-host`
（`check_npm_fresh` 复绿：一致 20 个文件），并用 `npm pack --dry-run` 直接确认
`native-rn.js 3.1kB` 在 tarball 里。

### 一条设计取舍：`native` 与 `capabilities/` **策略相反，不能合并**

| | 键 | 谁提供 | 缺失时 |
|---|---|---|---|
| 应用声明的能力 | `MOBILE_HOST.<name>`（`db`） | `capabilities/<name>.js`，`regen` 按依赖生成 | **抛错**（应用要了却没装） |
| 平台替代物 | `MOBILE_HOST.native.<name>`（`visibility`） | 宿主预设（RN 在 `native-rn.js`；Web **不装**） | **回退 DOM**（Web 本来就该走 DOM） |

两者都想"用同一个注册表"，但缺失时的正确行为**正好相反** —— 合并会让注册表无法区分该用哪种策略。

### 判据分了两层，别读混

- ✅ **逻辑层**：`tools/native_rn_check.mjs`（10 项，已进离线门禁）用 stub 的 `react-native`
  真 import、真调 `subscribe`、真断言载荷映射与退订。`native-rn.js` 此前是**纯盲区**：
  `import 'react-native'` 而那个包本仓没装，`moon check` 与其它离线门都编译不到它。
- ❌ **真机层**：`AppState` 在真机上**何时**发 `change`、发出来的 state 是不是那三个字符串 ——
  **仍未验**，要 `tools/verify_android.py` 的形状（按 Home 键 → 回前台）。

## 补记（N2 真机层，2026-09-21）：通道通了，但三次"对照实验"白跑

### 结论先说

`@sub.on_visibility_change` 在**真 Android 上真的走通了**宿主能力通道 ——
`verify_android.py` 里新加的 3 条断言全过：界面上的 `可见` 计数按 Home 后 `1 → 3`，
回前台后最近一次是 `显`（载荷方向对）。这不是"编译过"，是"事件到了、方向也对"。

### 真机上"删除"是挂的，而且**一直都在挂**

同一次运行里 `删除在真机上生效` 与 `同步后服务器上那条也没了` **稳定失败**（跑了两遍），
而新增 / 勾选 / 同步 / 拉取全过。`docs/STATUS.md` 记的"真机 21/21"**已经不准**。

**判定"不是这次改动引入的"用了可信对照**（这一步值得单独记，因为它差点做成假的）：

| 做法 | 结果 |
|---|---|
| 把 app 改动 `git checkout` 回 HEAD、重编、跑 | ❌ **无效** —— 见下面两条坑，跑的还是新代码 |
| 同上，但**先 curl 出 Metro 实际服务的 bundle、grep 出 UI 字面量**再跑 | ✅ 有效：`· 可见 ` 0 次 → 基线；删除仍然失败 → **既有问题** |

### 坑一：`CI=1` 会让 Metro **关掉文件监听**

日志原文：`Metro is running in CI mode, reloads are disabled.`
后果：`--clear` 只在**启动那一刻**清缓存；之后重编源码，Metro 根本不重读 ——
于是"改了源码 → 重跑"看到的还是旧行为。**离线门禁里用 `CI=1` 是对的**（只 bundle 一次），
**做 A/B 对照时必须去掉它**。

### 坑二：Metro 按**查询参数**缓存 bundle 变体

app 请求的 URL 带一串参数（`minify` / `modulesOnly` / `runModule` / `app` …），
而 `curl 'index.bundle?platform=android&dev=true'` 是**另一组参数 = 另一个缓存键**。
后果：curl 出来的是新代码，app 拿到的却可能是旧变体 —— **"我看到的是新的"与"设备拿到的是新的"是两件事**。

### 坑三：我用了一个**无效的标记**去判断"服务的是哪份产物"

第一次判断"Metro 在服务缓存"时，我 grep 的是 `可见` 二字。它在 bundle 里出现 2 次，
于是判成"服务的是我的代码"。**但那 2 次来自 `native-rn.js` 的注释**（host 包被 `index.js` import，
注释一起进了 dev bundle），跟 UI 文本无关。
**正确的标记是 UI 的稳定字面量**（`· 可见 ` / `vis_events`），不是一个可能出现在别处的词。

> **三条合起来是一条规矩**：做"改前 vs 改后"的对照之前，**先证明"被服务的那份产物"是哪个**，
> 再跑。否则对照的要么是自己的两次副本，要么是缓存 —— 而结论看起来完全正常。

### 环境坑：AVD 名与 ABI 都对不上

- 文档（`verify_android.py` 头注释）写的是 AVD `moobile64`、**x86_64**；
  这台机器上只有 `moobile`，而且镜像目录里只有 `google_apis/**x86**`（32 位）。
- 而 APK 只打 `lib/x86_64/*`（`unzip -l` 实测）→ 装上去必 `INSTALL_FAILED_NO_MATCHING_ABIS`。
- 处置：`sdkmanager "system-images;android-30;google_apis;x86_64"` + `avdmanager create avd -n moobile64`
  （同款 320x640 档，RAM 从 96M 提到 2048M）。**现在文档与现实一致了。**

### 一处**没证明**的事（别当已验）

真机断言**自身**的证伪（把 `native-rn.js` 的 `state !== 'active'` 写成 `===` 再跑）试了**两次**，
两次都**没有得到有效结果**：第一次因为坑二（app 拿到旧变体），
第二次因为 `--clear` 重启后 app 没渲染起来（屏上文本为空 → 断言读到 `None`，那是"没找到"而不是"方向反了"）。
所以「这条真机断言能抓住映射写反」**没有被证明**。
映射写反本身由逻辑层的 `tools/native_rn_check.mjs` 抓住（证伪过：10 项红 1 项，退出码 1）。

## 补记（N5b 适配器形状 + 一个纯属自找的坑，2026-09-21）

### 适配器形状：跟随已有约定，不另发明

`HostCapability` 原来只有 `subscribe_bool`。加 B 类能力时面临"通用 JSON 还是逐个窄适配器"。
选了**通用 + JSON 字符串**，理由不是省事，是**仓库里已经有这个约定**：
`sqlite/` 就是"边界上只传 JSON 字符串，MoonBit 侧 `@json` 解，避免把 JS 对象逐个字段打字"。

⚠️ 但 JSON 补了一个洞：**形状错在编译期看不见**。所以解码**必须严格** ——
`viewport_of_payload` 缺字段给 `None`，调用方**当场 `abort`**，**绝不取默认值 0**。
取 0 恰好复现了这条通道要消灭的"静默给错值"。这一点写进了 `abort_bad_viewport` 的错误消息本身。

### 顺带定位了"静默失效"到底长什么样（反直觉）

按 RN 自己的 `Libraries/Core/setUpGlobals.js`（它 `global.window = global`，**但从不定义 `document`**）：

| 依赖 | RN 上 | 表现 |
|---|---|---|
| `document.*` | 未定义 | **抛** `ReferenceError` |
| `window.location` / `.history` | 属性不存在 | **抛** `TypeError` |
| `window.innerWidth` / `scrollY` | `undefined` | **不抛、静默给 0** ← 最难发现 |

**所以"最该先修"的不是"C 类无替代物"（那会抛），而是 B 类里"静默给 0"的那两条。**
`tools/cap_platform.mjs` 现在会把这一类**单独列出来报**（修完 `on_resize` 后剩 6 条）。
先修的是 `on_resize`（`native.geometry` ← `Dimensions`）。

### 自找的坑：`#|` 块里的注释折了行

现象：`moon test` 编得过，**跑测试时 node 直接 `SyntaxError: Invalid or unexpected token`**，
测试进程根本没起来（不是某条断言红）。

**排查过程值得记，因为它差点写成错原因**：先怀疑中文注释 → 但 `sub_visibility_wbtest.mbt`
里本来就有中文注释且一直是绿的；再怀疑制表符 → 塞进去仍然 7/7 全过；再怀疑全角括号 → 也全过。
三次定点复现把三个嫌疑都排除了。

**真因**：我把一句中文注释**折成了两行，只有第一行带 `//`**。`#|` 每个行都是 JS 的一行，
`//` 只吃到行尾 —— 第二行就成了**裸代码**；它以全角 `）` 结尾，全角括号不是合法 JS token
→ **加载期**语法错。最后一次复现用它逐字对上了原报错。

> 教训两条：**`#|` 块里一行一条完整语句/注释，别折行**；
> 以及**排除法要留下"排除过什么"的记录** —— 否则很容易停在一个"看起来像真因"的说法上。

## 补记（N5b 二轮：一个原语，一次改判，2026-09-21）

### 新原语：`host_capability` 与 `host_has_dom()` 是**两个问题**

| | 问题 | 谁来答 |
|---|---|---|
| `host_capability(name)` | 这个能力你有替代实现吗？ | **宿主登记** |
| `host_has_dom()` | 浏览器到底在不在？ | **运行时事实，不需要谁声明** |

只靠能力注册表解不了 `on_url_changed`：它的宿主机制（`Scheduler` 注入器）**本来就在**，
RN 上缺的不是"另一个实现"，而是"**不该去碰 DOM**"。老代码无条件挂了 `popstate`：

```moonbit
@dom.window().to_event_target().add_event_listener("popstate", listener)
```

RN 上 `window` **存在**（`global.window = global`）而 `addEventListener` 不存在
→ `TypeError`，**这条订阅在原生端连装载都过不去**（不是"不工作"，是直接抛）。

判据查的是 `typeof document !== "undefined" && typeof document.addEventListener === "function"`
—— 只查"有没有 `document`"不够：有些非浏览器环境会挂一个残缺的 `document` 壳。
（这条有测试兜着：残缺壳必须判成 `false`。）

### 一次改判：`on_scroll` 的替代物不在宿主能力通道

原本把它标成"🟡 待接（→ `ScrollView` 的 `onScroll` 载荷）"。看了两件事之后改判：

1. Web 的 `on_scroll` 报的是**文档级**滚动（`window.scrollY` + `html` 的 scrollHeight）；
2. RN **没有文档级滚动** —— 滚动发生在每个 `ScrollView` **内部**，事件是那个组件的
   `onScroll` prop，**不是全局可订阅的东西**。

所以它的替代物在**组件通道**（I 轨道），不在宿主能力通道 —— **宿主能力换的是"某个能力的
平台实现"，换不掉"一个不存在的语义"**。处置：status 从 `todo` 改成 `web-only`，
并且装载时 `abort` 报错 + 给出替代做法（老行为是静默给 0）。

> 这一条值得单独记，因为它是**目标里写着的做法被实测推翻**的那种情况 ——
> 把"待接"改成"不成立"比硬凑一个宿主能力实现诚实，也更省后来人的时间。

### 结果

平台矩阵报出的「RN 上静默给错值」从 **8 → 4** 条（`on_resize`、`on_scroll` 各去掉两条）。
剩下 4 条**全在 `nav/`** —— 而 `nav/` 在根上没有转发包、消费者 import 不到，
它的处置卡在 `PLAN.md` §7 的**决策点 17**（要不要暴露）。

## 补记（真机验 `subscribe_json`，2026-09-21）：连挂两轮的断言，真因在测试前提

### 现象

`on_resize` 的真机断言第一版是**照"转屏幕"写的**：`adb shell settings put system user_rotation 1`
→ 期望 `Dimensions` 发 change。结果**连挂两轮**，界面读到的始终是 `None`。

查了三层才定位：

| 检查 | 结果 |
|---|---|
| `user_rotation` 真的变了吗 | **变了**（0 → 1）——所以不是"命令没生效" |
| 界面有尺寸 token 吗 | **没有** —— 所以事件确实没到 |
| `app.json` 的 orientation | **`"portrait"`** ← 真因 |

**app 锁了竖屏，旋转永远不会发生** —— 那条断言**从写下的那一刻就不可能通过**。
不是 `native.geometry` 没工作，是**测试前提错了**。

### 处置：换一个与方向无关的触发源

`adb shell wm size 400x800` 改的是**窗口尺寸**，锁竖屏照样生效，而且比旋转更好：
**能断言精确数值**。

```
PASS  改尺寸之前界面上没有尺寸 token       实得 None      ← 顺带证了"不补发初始值"
PASS  改尺寸后收到载荷，且数值精确          实得 (400, 800, 1)
PASS  还原后又收到一次（计数 +1）           实得 (320, 640, 2)
```

**值与被设的逐位相同** —— 这条断言不是"事件到了"级别的弱断言：
只有 `Dimensions → subscribe_json → JSON 解 → Model → 界面` 整条链都对才会是这个数。
`on_resize` 原来在 RN 上是**静默给 0**（`window.innerWidth` 是 `undefined` 却不抛），
这条断言正好卡在那个失败模式上。

> 教训：**断言连续失败时，先查断言自己的前提**（"这个前提在当前配置下成立吗"），
> 再查被测对象。这次三轮里有两轮花在了一条不可能通过的断言上；
> 而 `user_rotation` 那个 setting 明明生效了，恰恰是它把注意力引偏了
> —— "命令成功了"不等于"我以为的那件事发生了"。

---

## 补记（canvas 通道 spike：四个映射坑 + 一条关于断言粒度的教训，2026-09-21）

试金石在 `examples/apps/canvas-spike/`（设计 + 26 项判据 + PNG 证据）。
这里只记**结论与坑**，细节在它的 `README.md`。起因：`PLAN.md` §3.6 的诚实标注把 `canvas`
列为 12 个排除标签之一，而 T3.2 那句"先写方案再动手"的方案**从来没写过**。

### 结论：canvas 不需要新通道

`<canvas>` 就是**组件通道 + `prop_json` + 宿主侧一个 Skia 适配组件** —— 与 antd 的
`Table.columns/dataSource` 走的是同一条通道（"结构化值走 JSON 文本"）。所以当年把它想成
"要设计一条新通道"是**高估了**：真正要设计的只是**有界指令集**（实测 18 条，见下）。

**否掉"给标签表加 canvas"这条路的理由**（文档里已有，这里只是复核）：`DESIGN-COMPONENT-LIBRARY.md` §391
—— 42 条标签表是"两端都有等价物"的可移植子集，混进平台相关的名字就毁了它的诊断价值。
canvas 是平台相关的（Web 原生 / RN 要 Skia）。

### 词汇表是"量出来的"，不是拍的

`interest/yi/zhouyi_reader/frontend/{colorring,main}.mbt` 全量统计 → **18 种**调用，
一条不多。所以这套映射是**有界**的活，不是无底洞。六十四卦那一档的载荷实测
**5335 条 op / 181 KB**（紧凑数组）—— 这是"op 用短标签数组而不是对象"的理由（省 31%）。

### 坑一：`arc(…, 0, 2π)` 是整圆，**SVG 的 `A` 画不出来**

`A` 是"两点之间的弧"，起点终点相同 → **什么都不画**。罗盘画纬线和外圈用的就是整圆。
解法：拆成两段半圆。
**定位性证据**：同起终点的单条 `A`，包围盒宽 **0**；拆两段宽 **600**。

### 坑二：没有当前点时，`arc()` **要自己补一个起点**（第一版真踩了）

canvas 里 `arc()` 在**没有当前点**时会新开一条子路径（等价 `moveTo(弧起点)`）。
漏了这条，产出的 SVG 路径就**以 `A` 开头** —— 没有起点，Skia/浏览器把起点当 `(0,0)`，
于是整圆被画到一个完全错误的位置。

**这个坑是"全覆盖像素断言"抓出来的，不是读代码读出来的**：第一版只采 18 个点，**全中**；
改成 384 个点（64 扇区 × 6 环）后立刻红了 10 个 —— 被画歪的纬线圈恰好穿过那几个扇区的环带。

> **教训（这条比坑本身值钱）**：**采样点的选择也是一种断言强度**。
> 18 个点全中只证明"我挑的地方对"，384 个点全中才证明"没有系统性错位"。
> 与 AGENTS.md §4 那条"断言粒度要能抓住设计错误"是同一件事，但这次是**在像素上**踩到的：
> 三个坑（整圆、隐式起点、隐式连线）都属于**同一条语义边界**，而稀疏采样正好从它们中间穿过去。

### 坑三：有当前点但不在弧起点上 → 要补一条直线

canvas 的隐式连线语义。罗盘的每个扇区都自己算了圆弧起点（`move_to(isx,isy)`），
所以**本样本不触发**它 —— 但桥必须实现，否则换个调用序就画出多余或缺失的边。
（"样本没触发"不等于"不用实现"，这一条是读语义读出来的，不是跑出来的。）

### 坑四：`fill()` **不吃掉**路径

紧随其后的 `stroke()` 描的是**同一条**路径。所以适配器要产出**两个**元素（同一条 `d`、各带一种 paint），
而不是"一个元素带 fill + stroke 两个属性"。

### Skia 会带进**两个额外原生依赖**（文档里没有，实测 `npm view`）

```
@shopify/react-native-skia@2.12.0 peerDependencies:
  react >=19            ✅（宿主 19.2.3）
  react-native >=0.78   ✅（宿主 0.86.3）
  react-native-worklets >=0.7.0     ← 新增
  react-native-reanimated >=4.0.0   ← 新增
```

这正是 P3 当初挂的 Q1 风险（"如果成本失控，要重新评估状态模型与 RN 导航/手势库如何共存"）。
好消息：它自带 `canvaskit-wasm@0.41.0`，所以**本机就能用真 Skia 验绘制语义**（不必先上真机）。

### 诱饵自己也要被验证

证伪测试第一版按"扇区 7 = 卦 7"翻数据 —— 而扇区号 ≠ 卦号（先天圆图那套顺序里扇区 7 是**卦 25 无妄**）。
翻错了卦 → 画面当然没变 → 看起来像"断言抓不住错"。
**诱饵翻错，会把"测试写错了"误读成"实现是对的"。** 所以证伪前先断言"诱饵确实落在被测点上"
（`verify.mjs` 的 `6a-pre`）。

### 库侧落地（2026-09-21 二轮）：契约两端各一份实现，靠**对账**钉住

库侧落地后，同一份契约有了两个实现：**MoonBit 的编码器**（`canvas/` 包）与
**宿主包的解码器 + 翻译器**（`npm/moobile-host/canvas-ops.js`）。
"两份实现就是等着漂"是这个仓库的老毛病（`tools/check_npm_fresh.mjs` 记的那次事故就是副本漂了），
所以对账做成了机器判据 —— `examples/apps/canvas-spike/` 的第 ⑦ 组：

1. 同一段程序**两边各写一遍**（`spike.mbt` 的 `probe_into` ↔ `host/probe_program.mjs`），
   都由 yi 的真实图元组成（环带扇区 + 整圆 + 切向文字）；
2. JS 侧把 MoonBit 编出来的载荷**解码**，逐条比 tag 与数值（容差 `1e-9`）；
3. 两份载荷各自过翻译器 + **真 Skia** 出图，比像素。

**结果**：57 条 op 逐条相同，而且——

> 两边载荷**逐字节相同**（所以文本 diff 也能当对账手段）；
> 两份载荷出图 **40000 个像素 0 个不同**。

逐字节相同这件事**不是设计出来的，是量出来的**：MoonBit 的 `Double::to_string`
（`360.0 → "360"`）与 JS 的 `JSON.stringify` 在样本上写法一致。所以判据用的是
**语义比较（容差 1e-9）而不是文本相等** —— 契约是"JSON 数字"，不是"某一种数字写法"；
哪天某个值写法不同了，语义比较仍然绿（那是正确的），而"逐字节相同"降级成一条**观察**而不是断言。

**证伪**：把 MoonBit 载荷里一条 `arc` 的半径 +0.5 → 逐条对账**红**，像素差 **146 个点**
（两者必须同时红：只红一个说明另一条判据是摆设）。

### 又一条：`DrawOp` 忘了 `derive(Debug, Eq)`

`canvas` 包的测试一开始编译不过：`assert_eq` 要求 `Debug` + `Eq`，而枚举没 derive。
这不是测试的毛病 —— **绘制指令本来就该能比较、能打印**（测试、去重、"这一帧与上一帧一样吗"）。
补上就过了；记在这里是因为它容易被当成"测试写法问题"糊过去。

---

## 补记（F1 迁移动检：工具自己的三个坑 + 一次文档漂移，2026-09-21）

`tools/mbtools/src/migrate_scan.mbt`（`bash tools/mb.sh migrate-scan --root <项目>`）——
PLAN §5.1 的 F1：扫一个既有的 rabbita 项目，把会**静默失效**的东西逐条点名。
第一次拿真实项目（`interest/yi`）跑，撞出三件事，其中一件**不在 yi 里，在我们自己的文档里**。

### 坑一：`.repos/` 没剪 → 报告被标准库淹没

第一版数出 **881 个候选文件 / 219886 行**。查下去：**700+ 个来自
`.repos/moonbitlang/core/…`** —— `interest/yi` 里有一份 MoonBit 标准库的**源码检出**。
它不是"要迁移的项目代码"，但它的 `.mbt` 全被当成候选。

处置：剪枝表加 `.repos`（连带 `dist` / `.expo` / `.cache`）。修完是 **6 个文件 / 3139 行**。

> 教训：**"扫一个别人的项目"会撞见我们仓库里根本不存在的东西**（标准库检出、
> 桌面打包产物、编辑器缓存）。所以这一层的剪枝表**刻意不与 `cr-scan` 共用** ——
> 两者扫的对象不同，共用一张表等于假设"别人的项目长我们这样"。

### 坑二：`name(` 不等于"用了这个标签"

第一版按裸子串数标签，结果 `tag.outside` 报出 **27 处**（而 yi 只用了 8 个标签）。
真因：`arr.map(…)` 里的 `map`、`x.time(…)` 里的 `time`、`data.slot(…)` 里的 `slot`
**都是 HTML 标签名**（`<map>` `<time>` `<slot>`）—— 于是 `Array::map(` 被数成了"用了 `<map>` 标签"。

处置：判据从"子串出现"改成"**调用点前面是分隔符位置**"（行首 / 空白 / `(` / `,` / `[` / `=` / `>`），
或显式前缀 `@html.`。`x.map(` 前面是 `.` → 排除。修完 `tag.outside` 归零、`tag.excluded` **7 处全中**。

> 教训：**"报告里全是噪声"和"报告漏了东西"一样致命** —— 前者会让人干脆不看。
> 而且这个假阳性**只在真项目上才暴露**：拿我们自己写的样例跑永远不会撞上 `arr.map(`。

### 坑三：我们自己文档里的标签表条数**一直是错的**

工具解析 `render.mbt` 数出 **44 条**映射（不是文档里到处写的 42）。
核对：`git show 4c3ec2d:render.mbt` 里**也是 44** —— 也就是说这个数字**从写下那天起就不对**，
而它同时躺在 `README.md`、`docs/ARCHITECTURE.md`（两处）、`docs/design/SCAFFOLD.md`、
`docs/design/DESIGN-COMPONENT-LIBRARY.md`（六处）里。

处置：全部改成 44；`docs/FINDINGS.md` 里我自己那句引用**去掉硬数字**（改成"标签表"，
附一句为什么不留数字）；归档的 `PLAN-2026Q3` 是事实陈述，改准。

> 这条不是"又有文档漂了"，而是**工具的价值证明**：F1 **解析真源**（`render.mbt`）而不是抄一份清单，
> 于是它顺手把我们自己的错数了出来。**同一份报告，既扫别人的项目，也照出我们的账本不对。**

### 判据达成：机器清点 vs 人工清点，**逐项一致**

F1 的判据是"与人工清点**零遗漏**"（SCAFFOLD §3.7.6 的 S9-2）。第一次对账（`interest/yi`，
候选 6 个文件 / 3139 行）—— 人工那边用 `grep | wc -l` 独立数，**逐项相等**：

| 项 | 机器 | 人工 | | 项 | 机器 | 人工 |
|---|---|---|---|---|---|---|
| `style.class` | 122 | 122 | | `css.var` | 166 | 166 |
| `dom.direct` | 15 | 15 | | `:hover` | 16 | 16 |
| `gesture.mouse` | 4 | 4 | | `@media` | 2 | 2 |
| `gesture.dpr` | 2 | 2 | | `display: grid` | 5 | 5 |
| `input.controlled` | 1 | 1 | | `sticky` | 2 | 2 |
| `net.http` | 1 | 1 | | `dep.rabbita` | 1 | 1 |
| `canvas.api` | 11 | 11 | | `target.build` | 2 | 2 |
| `tag.excluded` | 7 | 7 | | `getBoundingClientRect` | 0 | 0 |

⚠️ 但要说清这条判据的**边界**：它是"**在这一个项目上**、对这 15 类、逐项相等"。
换一个项目若有新的失效形态（比如 `@dom` 之外的 `localStorage`），这一类**不在表里**，
两边都会是 0 —— **"零遗漏"是相对于规则表说的**，不是"什么都能发现"。规则表本身要随新项目长。

### 坑四（2026-10-01）：**报告里的"下一步"自己会过期**

上面三条都是**判据**的坑。第四条在**说辞**上：`migrate_scan.mbt` 里 `next:` 那几句话，
10-01 再跑 yi 时已经**在骗人**了 ——

| 类别 | 报告当时说 | 事实（10-01） |
|---|---|---|
| `gesture.mouse` | "手势通道（**尚未实现**，见 PLAN §8.2 ⑦ 与 T3.4）" | 手势通道**已落地**：`@gesture.attrs(on_pan=…)` / `@gesture.pan(attrs, msg)`，宿主默认装载、零新依赖，web 40/40 + 真机 18/18 |
| `gesture.coord` | "手势通道 + 坐标换算（T3.5）" | 量原点这件事**已经收进通道**（`Gesture.x/y` 就是元素内坐标，真机验过 `深 起=130,50`）；只剩画布侧的 `devicePixelRatio`（T3.5，未验） |
| `canvas.api` | "**真机未验**、手势未做" | 画布真机**已验**（`canvas-spike` 7/7、`canvas-demo` 12/12）；仍差**文字字形**（`makeFont`）与 `devicePixelRatio` 换算 |

**为什么这算缺陷、而不是"文档旧了"**：这份报告的价值**全在"下一步"那一栏** ——
"这个类会怎么坏"是判据，"接下来你该做什么"是**指路**。指错路的代价是
**让人去实现一条已经存在的通道**。同一个工具**照出过我们文档里的错数（42 vs 44）**，
这次轮到了它自己：**解析真源的那半不会漂，"下一步"这半是手写的**。

处置：三条 `next:` 改成事实（含判据分数与仍然缺的那两条），并在代码里留了一条注释说明为什么改。
**判据数没动**（重跑仍是 6 文件 / 3139 行、44 映射 / 12 排除，与 09-21 逐项一致）——
所以这次改动**只说了话，没动判据**，也就没有"改被测物"的嫌疑。

> 教益：这类"建议文本"没有门看着它。**要么给它一条门，要么承认它会漂** ——
> 现在选的是后者，把它记在这里。哪天 F1 变成对用户的产品面，就该有一条
> "报告里提到的通道是否真的存在"的检查。

---

## 补记（手势试金石：RNGH 能不能用、`translationX` 的一个坑，2026-09-21）

试金石在 `examples/apps/gesture-spike/`（15 项判据 + 三盒对照）。起因是 PLAN §7 的**决策点 19**：
手势通道该用 `PanResponder`（RN 内置、零依赖）还是 `react-native-gesture-handler`（RNGH）。
**两条都不能靠读文档定**，所以搭了个最小实验，在我们的 **RNW(web) 宿主**上真拖。

### 结论一：RNGH **能**在 react-native-web 宿主上跑 —— 但要打包器给两个全局

RNGH 包里有 **275 个 `.web.js`**（`GestureHandlerRootView.web.js` / `GestureComponents.web.js` …）。
两个坑都是**裸 esbuild** 才撞得到（Metro / Expo 自带，真实宿主不受影响）：

| 坑 | 症状 | 处置 |
|---|---|---|
| `.web.js` 没优先解析 | esbuild 挑到**原生实现** → 装载就摸 `NativeModules` | `resolveExtensions: ['.web.js', …]` |
| `__DEV__` / `global` 没定义 | `ReferenceError: __DEV__ is not defined`，接着 `global is not defined`（RNGH 的 web 实现里有 Node 风格的 `global`） | banner 里 `var __DEV__ = true; var global = globalThis;` |

> ⚠️ 注意"`define` 里写了 `__DEV__: 'true'`"**不够**：`define` 只替换**标识符表达式**，
> 这两处是**自由变量查找** —— 所以必须写成 bundle 外层的 `var`（IIFE 闭包能看见）。

### 结论二（更值钱）：RNGH 的 `translationX` **不是"按下即起算"**

实测（鼠标横向拖 40px，6 步）：

```
kind          x       tx    absoluteX         ← 起点 absoluteX=72，终点应为 112
begin         48      0     72
update        68      0     92                ← 已经移动 20px，tx 还是 0！
update        74.67   6.67  99
update        88      20    112               ← tx 只有 20，而指针走了 40
end           0       20    112
```

**`tx` 从"激活点"起算**（默认 Pan 有激活阈值，跨过它之前恒为 0），所以它比真实位移**少一截**。
把 yi 的 `e.offset.x` 天真地换成 `e.translationX` → **罗盘一上手就跳**。

**处置（实测有效）**：显式 `Gesture.Pan().minDistance(0)` → `tx` 精确等于 40。
**所以这条要写进契约**：如果采用 RNGH，`minDistance(0)` 是**硬性配置**；
更稳的做法是**契约里把 `dx/dy` 定义为"从按下起算"，由宿主算** —— 应用不该知道底下是哪个实现。

对比：**`PanResponder` 的 `locationX/Y`（元素内）与 `pageX`（屏幕）都精确**，
零新依赖，同一份代码在两个宿主上跑。但它跑 **JS 线程**（RNGH 可跑 UI 线程）—— 这条**没测**。

### 教训：判据要挑**语义**，别挑**实现字段**

第一版我拿 `end.translationX` 当"跟手"判据 → RNGH 报 26.67 而断言期望 40，看着像**实现坏了**，
其实是**我拿错了字段**（那个字段的语义本来就不是"按下起算"）。

> **判据应该问"位置有没有跟着指针走"（`absoluteX`），而不是"某个字段等不等于位移"。**
> 这与 N5b 那条"断言粒度"是同一类错误的两面：那边是采样点太少，这边是**字段语义没搞清**。
> 一次实测（把字段全打出来对照）就分清了"实现不对"和"判据不对"。

### 顺带：`restore` 之外还有一处同类陷阱（记下来备查）

RNGH 的 `end` 事件里 **`x` 是 0**（不是终点坐标），终点在 `absoluteX`。也就是说
"同一个手势的不同阶段，同一个字段的可用性不同" —— 写适配器时必须**逐阶段**确认字段，
不能假设"事件对象形状一致"。

---

## 补记（真机验证画布通道：四个"装得上 ≠ 用得了"的坑，2026-09-21）

为回答"`<canvas>` 在**真机**上到底画不画得出来"（`STATUS.md` §4 第 7 条那个未验项），
走了完整一遍"装依赖 → prebuild → 构建 APK → 装真机"。四个坑里有**三个对任何使用者都成立**，
所以记在这里而不是只写在 spike 里。

### 坑一：`npx expo install` 在**镜像源**上会因为 audit 端点 404 而报失败

```
npm ERR! ... 404 Not Found - POST https://registry.npmmirror.com/-/npm/v1/security/audits/quick
              - [NOT_IMPLEMENTED] /-/npm/v1/security/* not implemented yet
```

**包其实装上了**，但 npm 退 1 → `expo install` 判失败。用 `--no-audit` 或
`npm config set audit false` 就过（实测：`npm install --no-audit` 16 秒装完 25 个包）。

> 这条**不是我们仓库的怪癖**：任何用 npmmirror 的用户都会撞上，而且报错信息指向的
> 是一个跟"装包"无关的接口 —— **症状与原因离得很远**，值得写进用户文档。

### 坑二：SDK 57 **不需要** `babel.config.js`（我加了一个，然后删了）

宿主目录的 `AGENTS.md` 写着"先读版本化文档"，照做之后发现两条**直接否掉直觉**的话：

- `babel.config.js` 那页：**"There is no need to create a babel.config.js file unless you need to customize the Babel configuration."**
- Reanimated 那页：**"No additional configuration is required. Reanimated Babel plugin is automatically configured in `babel-preset-expo` when you install the library."**

我原本按"reanimated 要 worklets babel 插件"的老经验建了一个 —— **那是多余且可能重复应用插件**。
删掉即正确。

> 教训：**"某个库要配 babel 插件"这类知识是会过期的**，而它过期的方式很隐蔽
> （手动配了通常也能跑，于是永远不会有人发现它是多余的）。
> 文档还说：`https://docs.expo.dev/versions/<ver>/<page>.md` **加 `.md` 就是给 AI 读的纯文本** ——
> 比抓渲染后的 HTML 靠谱得多（这次第一次抓 HTML 只拿到导航栏）。

### 坑三：`expo prebuild` 会把 4 处本机配置打回默认（`android_env_setup.sh` 就是为它写的）

实测 `--check` 报 4 处 `[need]`：Gradle wrapper 版本（→9.3.1，**必然构建失败**）、
覆盖块（jvmargs / ABI / JDK 路径）、`build.gradle` 与 `settings.gradle` 的镜像。
跑一次 `bash tools/android_env_setup.sh` 修好，`--check` 归零。

### 坑四（**架构级**，比上面三条都重要）：可选特性**不能**往 demo/template 这一对里塞

想验画布，第一反应是"给 todo-app 加一个画布节点"。结果 **T1 同源门立刻红了**：

```
FAIL  模板同源 T1（生成物 vs demo，清单外差异即红）
```

因为**模板是真源、demo 是它的产物**（`SCAFFOLD.md` §3.4）—— 给 demo 加依赖，
就等于要求模板也加，而模板是**每个使用者拿到的东西**。

> **结论**：画布是**可选特性**（要原生依赖、要 prebuild），它不该进模板；
> 它该有自己的**示例应用**（先例：`antd-demo` 就是给"可选特性"准备的）。
> 本轮的处置：在 demo 上**临时**接线做真机验证 → 验完回滚 → 特性验证留证据，
> 示例应用另立（这正是"库优先"该有的形状：模板保持最小，特性各有示例）。

> 顺带一条：[`examples/apps/todo-app/host/AGENTS.md`](../examples/apps/todo-app/host/AGENTS.md)
> 那句"Expo HAS CHANGED，先读版本化文档"**是有回报的** —— 这次它直接省掉了一个多余的 babel 配置。

---

## 补记（画布通道**真机验证**：两个真 bug + 一条"设备上看不见错误"的技术，2026-09-21/10-01）

结论先行：**`<canvas>` 在 Android 模拟器上真的画出来了** ——
`画布 ops=9` token + 截图里 **品红 4016 px / 绿 1600 px** + 切到无画布那屏 **0/0**（证伪），
7 项判据全过（`examples/apps/canvas-spike/host/device_check.mjs`）。
`docs/STATUS.md` §4 第 7 条那个"真机未验"从此划掉**一半**（挂载与绘制验了；手势仍未验）。

过程中撞出**两个我们自己的真 bug**，都只在真机上才暴露。

### 真 bug 一：`installHost` 号称幂等，其实会把已注册的组件全冲掉

文档（`npm/moobile-host/index.js` 的注释）写着"**mountApp 再装一次是幂等的（同参数）**"，
推荐写法是：

```js
installHost();                                  // ① 先装
registerLibrary({ namespace: 'antd', … });      // ② 再注册组件库
export default mountApp(app);                   // ③ mountApp 内部**又装一次**
```

而 `installHostCore` 的实现是 `globalThis.MOBILE_HOST = { … }` —— **整个对象被替换**，
②注册的组件全丢。真机上的表现是：

```
ReactNativeJS: registerSkiaCanvas ok: ["moobile:Canvas"]      ← ② 明明成功了
ReactNativeJS: fatal=true moobile: 宿主没有注册组件 "moobile:Canvas"
```

**为什么本机测不到**：生成路径（`mountApp(app, { registry })`）的注册发生在 install **之后**，
所以 antd 那条路一直是对的；只有"**手写 registerLibrary**"这一条会踩 —— 而 `canvas-skia` 正是手写的。
**没有任何本机判据覆盖"先注册、后 mount"这个顺序。**

处置：`installHostCore` 改成**真幂等**（合并到既有 `MOBILE_HOST`，保留 `components` / `events` / `wrapRoot`）。

### 真 bug 二：`registerLibrary` 的 `components` 只认数组，传对象的报错毫无帮助

```js
registerLibrary({ namespace: 'moobile', components: { Canvas: MyCanvas } })   // 手写组件的自然写法
// → TypeError: iterator method is not callable     （栈里只有 registerLibrary，看不出是形状不对）
```

Hermes 的报错完全指不到"`components` 应该是名字数组"。处置两条：
① 两种形状都收（对象=实现映射，数组+`module`=按名字挑）；② 形状真不对时给**说得出两种合法写法**的错误。

> 教训：**"使用者会怎么写"决定的 API 形状，不能只按我们自己的调用点设计**。
> 这两条都是"库要好用"的具体形态 —— 而它们是被**真机**、不是被本机测试逼出来的。

### 技术：真机上的 JS 错误**默认看不见**（这条值得长期留着）

- **LogBox（红屏）的正文读不到**：`uiautomator dump` 只给得出 `DISMISS` / `RELOAD` 两个按钮，
  正文那个文本节点在 dump 里是空的（偶发能读到 `[runtime not ready]` 那类早期错误，运行时错误读不到）。
- **`adb logcat` 里也没有**：只有原生侧的软异常（`Tried to access onWindowFocusChange while context is not ready`），
  JS 的异常栈不在里面。于是"为什么白屏"在设备上**几乎无法回答**（实测卡了很久）。

处置（这次靠它定位）：在入口装一个**带标记的全局兜底**，把错误变成一条 `console.error` ——
RN 的 console 会进 logcat：

```js
globalThis.ErrorUtils?.setGlobalHandler?.((e, isFatal) => {
  console.error(`MOOBILE_JS_ERROR fatal=${isFatal} ${e?.message}\n${e?.stack}`);
});
// 然后：adb logcat -d | grep MOOBILE_JS_ERROR
```

⚠️ 它是**诊断脚手架**，查完就撤（本轮验完已从 `App.js` 撤掉）。

### 环境坑：磁盘满 + 联接（这一组也值得记）

D: 盘 **238G 用满（只剩几百 MB）**，而原生构建（Skia / reanimated / worklets）要几个 GB。踩了一串：

| 现象 | 真因 | 处置 |
|---|---|---|
| `fatal error: error in backend: IO failure on output stream: No space left on device` | 磁盘满 | 产物挪到 E: |
| `ninja: error: manifest 'build.ninja' still dirty after 100 tries` | **同一个磁盘满**（CMake 写不出自己的输出 → 反复"重新生成"）。**完全不像磁盘问题** | 同上 |
| `FileNotFoundException: …/hash_key.txt` | 只清了 `.cxx` 的**内容**、联接还在 → AGP 记账文件没了 | **拆掉联接**再重建 |
| `this and base files have different roots: E:\… 和 D:\…` | node 解析 realpath → E:，Gradle 给的是联接路径 D: → RN codegen 的相对路径跨根 | `NODE_OPTIONS=--preserve-symlinks` |
| `Process 'node' finished with non-zero exit value 1` | 真目录被改名成 `node_modules_todoapp` → **node 的祖先链里不再有 `node_modules` 段**，嵌套 `require.resolve(…, {paths})` 失败 | 真目录**必须叫 `node_modules`** |
| `robocopy` 报"无效参数 #3: `D:/Program Files/Git/MOVE`" | **MSYS 把 `/MOVE` 当成路径改写了**（与 `/sdcard/ui.xml` 同一个坑） | `MSYS_NO_PATHCONV=1` |
| 链接类包（npm 的 `file:` 依赖）搬完就不见了 | `robocopy /XJ` 跳过链接，而 `/MOVE` **仍删源** | 别用 `/XJ`；搬完 `npm install` 复验 |

> **两条通用教训**：
> ① **"磁盘满"的报错长什么样是不确定的**（backend IO / ninja manifest / CMake 循环…），
>    所以 `tools/link_builddirs.ps1` 现在会**主动打印工作盘剩余空间**并在 <5G 时提示 ——
>    把真因提前暴露，比事后猜便宜得多。
> ② **联接（junction）会改变工具看到的路径**，而很多工具（node 的解析、RN codegen 的相对路径）**对路径敏感**。
>    用联接腾空间之前先想清楚"谁会因此看到两个不同的路径"。

### 还有一条小坑：`.ps1` 里别写中文（我自己踩了两次）

Windows PowerShell 5.1 按**系统 ANSI 代码页（本机 GBK）**读 `.ps1`，除非文件带 UTF-8 BOM。
不带 BOM 的 UTF-8 中文会被误解码，而**误解码产生的字节里可能冒出引号** —— 于是字符串提前结束、
报错指向别处（`Unexpected token 'ok]'`）。`tools/link_builddirs.ps1` 因此**保持纯 ASCII**。

### 判据上的两条（沿用本仓库的老规矩，这次又验证了一遍）

- **轮询，不要固定 sleep**：debug 包要等 Metro 现打 bundle（带 Skia 首次 **52 秒**）；
  Skia 出第一帧也有延迟 —— 同一份代码，固定等待有时截到画面、有时截到空白。
- **只认错误级的日志**：应用自己的诊断标记（`MOOBILE_JS_ERROR … ok`）会被宽泛的 `/Error/` 撞成假阳性。

---

## 补记（canvas-demo 真机：两条通道闭环，外加三个"版本/配置/参照系"的坑，2026-10-01）

`examples/apps/canvas-demo/` 是**可选特性自己的示例**（画布 + 手势）。
真机 **12 / 12**：`画布 ops=13` · 品红圆环 3798px / 绿方块 324px / 蓝指针 424px ·
横滑 80px → `dx=80 dy=0 n=9` · 蓝指针质心移动 74.5px · 点按 0→1 · 证伪屏 token 全不变。
最后一条判据同时压住了 **手势 → Msg → Model → 绘制指令 → Skia** 整条链（分开测任何一段都测不出它）。

三个坑里前两个**对任何使用者都成立**。

### 坑一：原生依赖装成了**比 SDK 期望更新**的版本，报错完全指不到版本

用 `npm install <native-lib>` 会拿到最新版，而 Expo 的自动链接会以这种方式炸：

```
Failed to apply plugin 'expo-autolinking'.
> A problem occurred configuring project ':expo-modules-core'.
   > Task with name 'mergeDebugNativeLibs' not found in project ':react-native-worklets'.
```

实测（SDK 57）：`skia@2.13.1 / reanimated@4.7.0 / worklets@0.13.0` **必挂**；
换成 SDK 期望的 `skia@2.6.2 / reanimated@4.5.1 / worklets@0.10.1` **立刻成功**。

**正确姿势**是 `npx expo install <pkg>`（它按 SDK 挑版本）+ `npx expo install --check`（核对）。
⚠️ 而本机 `npx expo install` 会因 **npmmirror 的 audit 端点 404** 报失败（见上一条补记）——
于是人很容易退回 `npm install` 并装错版本。**两条坑叠在一起**才是真陷阱。

### 坑二：**必须**有 `babel.config.js`（Expo 文档说不用）

Reanimated 那页写 "No additional configuration is required. Reanimated Babel plugin is
automatically configured in `babel-preset-expo`"。实测在 **SDK 57 + `babel-preset-expo@57.0.13`**
这个组合下**不成立**：原生侧 `libreanimated.so`/`libworklets.so` 都进了 APK，
JS 侧加载时报 —— 而且 **Skia 把真因吞了**（`catch (e) { throw new OptionalDependencyNotInstalledError(...) }`，
`ModuleProxy.js`），只剩一句：

```
Error: react-native-reanimated is not installed!
```

补 `babel.config.js`（`presets: ['babel-preset-expo']` + `plugins: ['react-native-worklets/plugin']`，插件放最后）即好。

> **怎么定位的**：临时改 `node_modules/@shopify/react-native-skia/.../ReanimatedProxy.js`
> 把 catch 到的 `e` 打出来（`console.error` 会进 logcat）。**库把错误吞掉时，就自己去把它挖出来** ——
> 这比读文档猜快得多。

> 另一条同类的：**改完配置不清缓存会白排查一轮**。`babel.config.js` 加好后我没有 `--clear`
> 重启 Metro，跑的还是旧 bundle，症状与"配置没生效"一模一样。改了 `node_modules` 里的代码
> 或 babel 配置之后，`npx expo start --clear`。

### 坑三（真机独有）：`locationX/locationY` 的参照系会**中途换**

第一版包装器用 `locationX` 的差值算位移：

```js
dx: n.locationX - start.current.x      // ← 错
```

真机上实测（横滑 80px，拖动区里放了一行文字）：

```
GRANT: {"x":64,"y":9}      ← 相对**内层 Text**（文本从 x=95 开始，95+64=159=触点）
MOVE : {"x":67} → {"x":77} …
拖动结果：dx=155 dy=51      ← 而真实位移是 dx=80 dy=0
```

`locationX` 的参照系是"**最深的被触摸 view**"：手指滑出那行文字的范围后 RN 换了参照系
（从 Text 变成父 View）→ 位移**凭空多出"两套坐标原点之差"**。

**处置**（也正是这条通道设计时定的原则 —— "`dx/dy` 由宿主算"）：
- `dx/dy` 用**屏幕坐标**算：`n.pageX - start.pageX`（参照系永远稳定）；
- `x/y` 保留事件自带的 `locationX/Y`，并在契约里写清"它只表示当下位置，参照系由 RN 决定"。

> **教训**：`locationX` 与"元素内坐标"**看着是一回事，其实不是**。这条只在真机上出现
> （web 宿主上一切正常），所以"web 验过"不能代替"真机验过"。
> 顺带一条**断言教训**：这条 bug 第一版没被抓住，因为我的判据是 `|dx| >= 40`
> （太松，155 也"通过"）。收紧成"**约等于真实滑动距离 ±15**"之后才暴露 ——
> **阈值松的断言 = 没有断言**。

### 工作方式上的一条（值得写进 DEV.md 级别）

停 Metro **不要**用 `Get-Process node | Stop-Process -Force`：它会把**宿主的 harness 自己**
（DSH 也是 node，监听 3081）一起杀掉，表现是"我这边的会话掉线"。正确做法：
`job_kill <job_id>`，或按端口找 PID —— `netstat -ano | findstr :8081` → `taskkill /PID <pid> /T /F`。
⚠️ Git Bash 里还要 `MSYS_NO_PATHCONV=1`，否则 `/PID` 会被改写成路径（同一个 MSYS 坑）。

## 补记（手势**边界**：三条真机才暴露的实现错误 + 一条**推翻了前面结论**的更正，2026-10-01）

这一轮做的是"边界"：凡是**应用真的会撞上、而契约必须表态**的情况，先写成期望，
再让探针去证伪。web 侧在 `gesture-spike` 第五节（40 项），真机侧新起了
`gesture-edges`（18 项）—— 因为其中四条**在浏览器里压根不成立**。

### 一（最贵的一条）：`onPanResponderGrant` 在 Android 上**不是"你拿到了"的信号**

**症状**：内外两层都挂 `on_pan` 时，**外盒收到 6 次 `start`、零 move**（`序外=ssssss`），
而内盒收到完整的一条。也就是说：应用在父元素上写的手势会拿到一次**根本没发生**的手势开始。

**真因**（读 `ReactFabric-dev.js` 的 `setResponderAndExtractTransfer` 定的）：
RN 先把 `responderGrant` **池化并直接派发给候选者**（`executeDirectDispatch`），
拿它的**布尔返回值**当"要不要挡住原生响应者"的判断，**然后**才去问当前响应者
`responderTerminationRequest` 让不让。让 → 补一个 `responderTerminate`；
**不让 → 候选者拿一个 `responderReject` 就完了，可那个 `grant` 已经跑过了。**

而 **RNW 只在允许转移时才调 `grant`**（`ResponderSystem.attemptTransfer` 里写在
`if (allowTransfer)` 分支内）—— 所以**这个坑在 web 上完全看不见**。
web 侧那一套 40 项全绿，一条都抓不到它。

**处置**：`start` 改成"**确认真的拿到响应者之后才吐**"——用 `onPanResponderStart`
（两端都只派发给**真正的**响应者：Android 派发给 `changeResponder` 之后的 `responderInst`，
RNW 派发给 `currentResponder`），并用 grant 那一刻的**数值快照**发出去
（这样"起点 = 按下点、`dx=0`"不受影响 —— 确认事件与 grant 是同一个 DOWN）；
`onPanResponderReject` 负责把待定清掉。

### 二：**更正前面的结论** —— `x/y` 在原生上**不是**元素内坐标

本文件上面「坑三」当时的结论是"`x/y` 保留事件自带的 `locationX/Y`，契约里写清
'参照系由 RN 决定'就完了"。**那句话是错的**，现在收回：

真机实测（从子元素上按下、右滑 40px，`深xs` 是每个事件的 `x`）：

```
深xs = [6, 7, 79, 89, 98, 99, 108, 109]      ← 契约要的是 130 → 170
```

头两个 `6,7` 是那个 `子` **字自身**的局部坐标，从第三个起才变成子元素坐标系 ——
与「坑三」记的 `dx=155` 是**同一个病的同一半**：参照系会**随手指移动而换**
（因为它是"手指底下**最深**那个 view"）。当时只修了 `dx/dy`（改用 `pageX/pageY`），
`x/y` 没有人问过它"相对谁"，而契约里白纸黑字写着"元素内坐标"。

**处置**：原生侧**自己量元素原点**（`measure` 给的 `pageX/pageY` 与触摸 `pageX/pageY`
同为"相对根视图"），用 `pageX/pageY − 原点` 算 `x/y`；`start` 要等量测落地才吐
（量不出来就退回 `locationX`，宁可坐标系退化也不能把事件吞掉）。
修完 `深xs = [130, 131, 139, …, 169]`，`末 − 起 = (40, 0)`。

⚠️ **web 侧反而不能这么改**：RNW 的 `measure`/`measureInWindow` 给的是
`getBoundingClientRect()` 的**视口**坐标，而触摸的 `pageX/pageY` 是 **DOM 的文档**坐标 ——
页面一滚两者差一个 `scrollY`。也就是说"统一用 measure"会**造出一个只在滚动过的页面上
才出现的 bug**，而现在的验证页面不滚，测不出来。所以这里是**有意的平台分支**，
判据是两端各自的实测，不是"哪个写法好看"。

### 三：Android 上"不让别人抢"要**两处都让**才作数

**症状**：只挂 `on_tap` 的块放进 `scroll` 容器，竖滑**内容一点都不动**
（旁边一个没有任何手势的块滑得动 —— 这条**正对照**是第一次红了之后才补的，
因为当时**分不清**是"手势挡了滚动"还是"这个容器本来就滚不动 / 我的滑动姿势不对"）。

**真因**：`PanResponder` 把 `onShouldBlockNativeResponder` 的返回值当作
`onResponderGrant` 的返回值交回 RN，而 RN 用它决定**要不要挡住原生组件**；
**不写这个回调时默认是 `true`** —— 原生 `ScrollView` 因此收不到这次触摸。
光让 `onPanResponderTerminationRequest` 返回 `true`（JS 侧的协商）**不够**。

**处置**：`onShouldBlockNativeResponder: () => hasPan` —— 与终止权**同一套策略**：
挂了 `on_pan` 就挡（我们要这次拖动），只挂 `on_tap` 就让（列表里的可点行不能锁死滚动）。

### 四（工具）：`check_npm_fresh` 只守**一份**副本

原来那份门把路径写死成 todo-app 一处。实测仓库里同时有 **6 份** `moobile-host` 副本，
门只看 1 份 —— 另外 5 份里有两份早就漂了（`antd-demo` 20 个文件、`antd-spike` 7 个，
都缺后来的 `gesture-rn.js` / `canvas-*.js`），门却一直是绿的。

**已经吃到代价**：`gesture-spike` 那份副本是旧的，于是"边界"第一轮探测
**测的是老实现**，得出了三条关于旧代码的结论。发现得晚，是因为
**E1 两次跑出来一模一样** —— 一模一样本身就该是线索。
⇒ 门改成**发现式**：有几份查几份，一份都没有才算失败；并实测刷新了 5 份。

### 五（验证脚本自身的三个坑，都出在这一轮）

1. **按坐标发事件之前必须证明"命中的是它自己"**：把第二行的 7 列挤在一行里之后，
   元素互相压住，于是"拖 A 盒子"实际拖到了压在上面的 B 盒子 —— 日志是**空的**，
   而**空日志与"功能没实现"长得一模一样**，一次跑出三个假结论（连"正对照"都是假的）。
   ⇒ 加了 `window.__hitAt` 命中自检门（11 个按下点）。
2. **触摸仿真会污染后续的鼠标事件**：`Emulation.setTouchEmulationEnabled` 开着的时候，
   后面的鼠标拖动**一条事件都收不到**。所以那一节放最后、用完立刻关掉。
3. **验证脚本跑完全绿也要显式 `process.exit`**：静态服务与 Chrome 都还活着，事件循环不会自己空。
   第一版"跑完了但进程不退"，被上层超时杀掉；而**被杀的进程不执行清理**，
   于是 8098 端口与一个无头 Chrome 留在机器上，下一次报 `EADDRINUSE`
   （看着像端口冲突，其实是上次没收尾）。

### 六（连带收获）：**陈旧副本掩盖了一条门的假通过** —— `installHostCore` 没有"干净宿主"

刷新 `antd-spike` 那份陈旧副本之后，它的负例 (b) 立刻由绿转红：
「宿主不给事件覆盖时，点 antd 按钮应当**无效**」实测**生效了**（条数 3 → 4）。

**先做的第一件事是证伪"是不是我刚改的"**：把 `gesture-rn.js` 还原成 HEAD、再刷新副本，
跑出来**同样 25/26** —— 不是这轮改的。（这一步很值：不然会去修一个自己没碰过的地方。）

**真因**（在 `npm/moobile-host/core.js`）：`installHostCore` 是**合并进全局 `MOBILE_HOST`** 的
（那是为了修另一个真 bug：`mountApp` 会再调一次 `installHost`，整体替换会把先注册的组件冲掉，
表现为 `宿主没有注册组件 "moobile:Canvas"`）。合并是**全局且不可撤销**的，于是
**"装一个没有事件覆盖的宿主"这件事根本表达不出来** —— 前面用例装进去的
`"*": { click: "onClick" }` 一直留着，(b) 却以为自己装的是空表。

而旧副本（`antd-spike` 里那份 7 个文件的）是**整体替换**语义，天然干净 ——
所以这条假通过**被一份陈旧的副本掩盖了很久**。两个问题叠在一起：
门只守一份副本 + 宿主没有 reset 手段。

**处置**：`installHostCore({ reset: true })` —— 从干净宿主开始。
语义上它就该存在：**应用**要"重复调用别冲掉已注册的"，**测试**要"每次从干净状态开始"，
两个诉求方向相反，用一个开关分开才是诚实的。修完 (b) 名副其实（26/26），
而且控制台终于出现了 React 那句 `Unknown event handler property 'onPress'. It will be ignored.`
—— 那正是默认表按 RN 语义产出 `onPress` 的直接证据，之前那条警告被掩盖时也一起没了。

### 七（工具/环境）：全局 `http.proxy` 指向一个**没在跑**的本地代理 → `git push` 看着像断网

**症状**：`git push` 失败，报的是连不上远端 —— 而 `curl https://github.com` **直连 200**。

**真因**：`~/.gitconfig` 里写着 `http.proxy = https.proxy = 127.0.0.1:7890`，
而那个本地代理**当时没开**（`curl -x http://127.0.0.1:7890` 返回 `000`）。
git 于是把**所有**远程操作都往一个死端口上送 —— 与 `AGENTS.md` 记的那条
"`moon update` 报 `no version satisfies requirement`"是同一个根：
**代理没开，而错误信息指向别处**。

**当时可用的绕法**（本机直连 GitHub 是通的）：

```bash
git -c http.proxy= -c https.proxy= push origin main
```

先干跑一次更稳（不改远端，但会把认证与快进关系都验掉）：
`git -c http.proxy= -c https.proxy= push --dry-run origin main`

⚠️ 这是**绕**不是**治**：配置在全局，换一个仓库、换一天还会再撞。
根治要么删掉那两行全局配置（本机能直连时它们本来就没用），
要么把代理真正跑起来 —— 别让"死代理 + 看起来像断网的报错"再骗一次。

## 补记（CI：它为什么从落地起就不可能绿，2026-10-01）

**症状**：CI（`.github/workflows/ci.yml`，PLAN 的 C3）从 13:52 就躺在仓库里、计划上标着
"✅ 已落地" —— 但**从未运行过**：那些提交一直没推出去，而 GitHub 只在工作流文件进了远端
才会跑它。第一次推上去，两次运行都是 `failure`；而本机同一个命令全绿。

**为什么本机看不出来（这条最值钱）**：CI 每一次运行都是**一个新鲜克隆** —— 没有 `vendor/`、
没有任何应用的 `node_modules`、没有 `_build`。所以"本机绿"**根本不构成**"CI 会绿"的证据。
CI 的判据是"**新鲜克隆 + 按文档的配方**"，不是"我这台机器上能跑"。

### 一：它漏了"新克隆"的第一步 —— 于是 8 条门连锁红

`vendor/` 是 **gitignore 的生成物**（rabbita fork：`tools/vendor.lock` 的版本 + `tools/patches/*.patch`
→ `tools/vendor_sync.sh` 生成）。新鲜克隆里没有它 → `moon check` 报

```
Cannot find import 'XiLaiTL/moobile/vendor/rabbita/vdom' in XiLaiTL/moobile@0.2.2
```

→ 行尾 / vendor 一致 / 转发包 / 能力矩阵 / 脚手架三条门**连锁全红**。
`CONTRIBUTING.md` §1 明明写着这一步（"重建第三方（新克隆 / 换版本）"），而 CI 没做。
**实测**：新鲜克隆 **4 通过 / 8 失败**；补上 `vendor_sync --apply` 后 **14 / 0 / 1、exit 0**。

### 二：`continue-on-error` 把"装挂了"吞掉了

npm 安装那一步写着 `continue-on-error: true` —— 装失败也报 success。
而模板那三条门要从**已安装**的 node_modules 里取 `react` 与 `moobile-host`
（`tools/verify_headless.mjs` 的 `pickNodeModules`）。于是"装挂了"与"门红了"之间的
线索被抹平，只剩一个红叉。⇒ 去掉它：装了失败就是要红。

### 三：顺带一个**对使用者成立**的坑（比 CI 更早咬人）

`examples/apps/todo-app/host/package-lock.json` 里有**两条 404 的 `resolved` URL** ——
镜像源把包名写成了畸形路径：

```
expo-server        →  .../expo-examples/services/todo-server/-/expo-server-57.0.3.tgz
@expo/router-server →  .../@expo/router-examples/services/todo-server/-/router-server-57.0.10.tgz
```

**任何新鲜克隆的 `npm install` 都会挂在它们上面**（本机没感觉，是因为 node_modules 早装好了、
npm 不必再取那两个 tarball）。修法**验证过**：把真 tarball 下下来算 sha512，与 lockfile 的
`integrity` **逐字一致**（两条都比过）⇒ 只是 URL 错、制品没变，所以**只改 URL、不动 integrity**。

顺带立了一条门：`tools/check_lockfile_urls.mjs` —— 纯结构判据（URL 尾巴必须是
`<registry>/<包名>/-/<末段>-<版本>.tgz`）、**不联网**、8 份 lockfile 2088 个 URL 几十毫秒，
**已用诱饵证伪过**（塞回一条坏 URL → 点名 + exit 1）。

### 四：修完 vendor 与 npm 之后**仍有 4 条门红**（**未解决 —— 交接项**）

四条**全是"要 moon 编译"的门**：`moon check --target js`、`gen_forwarders --check`、
脚手架模板、脚手架承载真应用；其余 11 条全绿。这个形状本身在指路。

**已有的证据链**：

- CI 的 `moon check` 日志里出现 `Warning (implicit_impl_as_method)` 与 `Warning: [0079]`
  （`vendor/rabbita/websocket/types.mbt:89` 那个 `impl Show for Snapshot`），
  而**本机同一条命令不出现** ⇒ **CI 的 moon 比本机新**。
- 本机 `moon version` = `0.1.20260827 (d0aaa07 2026-08-27)`，而 **`DEV.md` 记录的正是这个版本** ——
  也就是说**仓库自己声明了期望的工具链**，而 CI 装的是安装脚本的默认值 `latest`。
- `[0079]` 是 E0079（`implicit_impl_as_method`），按[官方文档](https://docs.moonbitlang.com/en/stable/_sources/language/error_codes/E0079.md)
  它是**默认开启的警告**，所以它**未必**是让 `moon check` 失败的那一行 ——
  **真正的 error 文本还没读到**（见下）。

**为什么读不到（也记下来，免得下一个人重踩）**：公开仓库的 **job log 走 REST API 要认证**
（`GET /actions/runs/<id>/logs` → **403**），运行页又是 JS 渲染的、curl 取不到内容。
出路是 **annotation 不需要认证** —— CI 里已经加了"失败时把门名与日志尾巴打成 annotation"，
读它用 `python3 tools/ci_status.py <sha>`。⚠️ 但**大 payload 会被 GitHub 丢掉**：
试过把整份输出（12000 字符）塞进一条 annotation，那一条**根本没出现**（同一次运行其他 12 条都在），
所以现在能读到的只是"门名 + 12 行尾巴"，更长的要走**运行页**（人肉可读）。

**两条候选修法（都还没做）**：

1. **钉住工具链**，让 CI 用 `DEV.md` 那个版本。⚠️ 实测**安装脚本钉不住具体版本**：
   bucket 只提供 `latest` 与 `nightly`，带日期的路径一律 **403**
   （`0.1.20260827`、`v0.1.20260827`、`0.1.20260827+d0aaa07` 都试过）。要钉就得另找分发渠道。
2. **把代码升到能过新工具链**：E0079 那条要显式写成
   `pub extend Snapshot with Show::{to_string, output}`（或给 `extend` 标 `#deprecated`）。
   ⚠️ 那处在 `vendor/rabbita/**` 里，而 vendor 是**生成物** —— 改动必须落成
   `tools/patches/*.patch`，再走 `--capture` / `--check` 才算数（见 `FORK.md` §0）。

---

## 补记（CI 那 4 条红门的真因：**一条语法错误**，2026-10-01 收口）

上一节把 4 条红门留在"未解决 —— 交接项"，并把 `Warning [0079]` 当成嫌疑犯。
**收口了：真因不是警告，是一条解析错误（E3002），而且只有一行代码。**

### 真因

```
Error: [3002]
    ╭─[ .../examples/apps/antd-demo/gallery.mbt:10:8 ]
 10 │ fn cell[C : @html.IsChildren](name : String, children : C) -> @html.Html {
    │        ╰── Parse error, unexpected `fn f[T]`, you may expect `fn[T] f`.
```

新工具链把**旧式泛型写法** `fn f[T]` 判成**语法错误**，新写法是 `fn[T] f`。
一条错误解释**全部 4 条红门** —— 另外三条都只是"需要能编译"：
`gen_forwarders --check` 要跑 `moon info`（`.mbti` 是它的输入），脚手架两条门要编译生成物。

上一节那句"`[0079]` **未必**是让 `moon check` 失败的那一行"**猜对了**，但猜的方向错了：
那次 `moon check` 的收尾是 `Failed with 322 warnings, 1 errors` —— **error 只有 1 个**，
就是这条 3002；`[0079]` 只是同一份日志里的一条警告。**"日志尾巴全是警告"把人往
"警告致红"引，是因为尾巴被截断了，真因在更早的位置。**

### 怎么拿到的：不再求 CI 日志，改为**在本地把 CI 的工具链装出来**

这是这一轮最值钱的一条。CI 装的是安装脚本的默认值 `latest`，而**本机钉的是 `DEV.md` 那个版本** ——
于是"CI 红、本机绿"只要工具链有差异就会发生，而**日志还读不到**（见上一节：job log 走 API 要 403）。

出路是：**Windows 上也有 `latest` 的包**（unix 安装脚本只认 Linux/macOS，
所以这条大概只有在这台机器上才会被发现）：

```bash
curl -fsSL -o moon.zip https://cli.moonbitlang.com/binaries/latest/moonbit-windows-x86_64.zip
curl -fsSL -o core.tar.gz https://cli.moonbitlang.com/cores/core-latest.tar.gz
unzip -q moon.zip -d <scratch>          # bin/ lib/ include/ share/
tar xzf core.tar.gz -C <scratch>        # 解出来的是 core/ → 必须放到 lib/core
MOON_HOME=<scratch> <scratch>/bin/moon.exe -C <scratch>/lib/core bundle --warn-list -a --all
```

（⚠️ 三步都不能省：`core` 放错位置 → 报 `prelude.mi: No such file or directory`；
不 `bundle` → 同一条。另外 `MOON_HOME` 要传 **Windows 路径**，MSYS 路径它不认。
`registry/`、`cache/` 从 `~/.moon` 拷过去，否则依赖图解不出来。）

装完是 `0.1.20260920 (914d7da 2026-09-20)`，用它跑 `moon check --target js`，
**一行不差地复现了 CI 的报错形状** —— 连日志尾巴那条 `impl Show for Snapshot` 警告
（`vendor/rabbita/websocket/types.mbt:89`）都在同一个位置。这就是"同代工具链"的证据。

⇒ **"CI 红了但读不到日志"不再是无解的**：日志读不到，但**工具链能装出来**。
下一轮遇到同类问题，先按上面这段复现，再去猜。

### 修法：改那一行语法（**不钉工具链**）

```moonbit
fn[C : @html.IsChildren] cell(name : String, children : C) -> @html.Html {
```

为什么是它而不是"钉住工具链"：

- **钉不住**（这次是亲测，不是转述）：`binaries/0.1.20260827/moonbit-linux-x86_64.tar.gz`、
  `cores/core-0.1.20260827.tar.gz`、`binaries/0.1.20260920/…` **一律 403**；
  `latest` 与 `nightly` 是 200。bucket 上**没有**带日期的路径。⇒ 上一节候选修法 1 **出局**。
- **而且钉错了靶**：用户从官网下载页拿到的就是 `latest`，所以**库必须在新工具链上能编**。
  把 CI 钉回旧版本，只会把这个问题留到用户那里爆炸。

### 判据：新旧两代**都要绿**

先在小探针上把两条事实钉住（`fn[C] cell` 两代都认；`fn cell[C]` **只有旧代认**），再动仓库。
然后整个离线全集在两条工具链上各跑一遍：

| 工具链 | `bash tools/verify_all.sh` |
|---|---|
| `0.1.20260827 (d0aaa07)` —— 工作区钉的、`DEV.md` 记的 | **16 / 16 · 0 失败 · 0 跳过** |
| `0.1.20260920 (914d7da)` —— ≈ CI 的 `latest` | **16 / 16 · 0 失败 · 0 跳过** |

⚠️ 一个**坑中坑**：删掉 `_build` 再跑全集时，"组件库接入（antd 试金石）"会红 ——
它要 `_build` 里**已经构建过**的 `moobile-antd-spike.js`（`verify_all.sh` 自己不 build）。
**这条红与本次改动无关**，是因为我把 `_build` 清了；`moon build --target js` 之后即绿。
（真要在 CI 那种新鲜克隆里判定，得先看这条门是 PASS 还是 SKIP —— 新鲜克隆没有
`antd-spike/host/node_modules`，它是 **SKIP**。）

### 顺带：把"读日志"这件事本身修好（这轮真正的教训）

真因只是**一行过时的语法写法**，但**它花了很久才被看见** —— 因为出口给的信息**不指向它**。
所以两处出口都改了：

| 改哪 | 改成什么 | 验过吗 |
|---|---|---|
| `tools/verify_all.sh` 的失败块 | **先**打 `---- 错误行（真因常常不在尾巴上）----`（从门的完整日志里捞 `Error:` / `AssertionError:` 那类行，**带 3 行上下文**），**再**打原来的 12 行尾巴。没有错误行时这一段**不打**（不留噪声） | 本地：拿**真 `tally()` 函数**（从源码里截出）+ **真失败日志**跑，输出直接给出 `Error: [3002]` → `╭─[ …/gallery.mbt:10:8 ]` → `10 │ fn cell[C : …]` 三行；另用一条真失败门（行尾门）验了"没有错误行时不加段落" |
| `.github/workflows/ci.yml` 的失败 annotation | 顺序改成 **门名 → 错误行 → 尾巴 → 工具链版本**；那条"装整份输出（12000 字符）"的**删掉**（实测发不出去） | ⚠️ **只在本地验过**：从 ci.yml 里原样截出那段 shell、喂真转录，跑出 22 条 annotation、顺序正确；YAML 能解析。**没在真 CI 上跑过**（要推上去才触发，而这轮没推） |

为什么"错误行在前"这么重要：这次尾巴上**全是警告**，于是"警告把门弄红了"看起来像个合理解释 ——
它是一个**能自洽的错误结论**。**入口信息不指向真因时，人不缺推理能力，缺的是线索。**

### 仍未解决：警告里那颗**定时炸弹**

新工具链下 `moon check` 是 **322 warnings / 0 errors**（旧工具链 **75 warnings**）。
把每条警告归到它前面那个诊断头（`╭─[ … ]`）上，出处是这样分的：

| 出处 | 条数 | 能不能改 |
|---|---|---|
| `vendor/rabbita/**`（**我们的 fork**） | 243 | 能 —— 但要落成 `tools/patches/*.patch` 再 `--capture`/`--check` |
| `examples/apps/**`（示例应用） | 59 | 能 |
| 库自己的包（`canvas/` `gesture/` `sqlite/` `style/` `host.mbt` …） | 19 | 能 |
| `.mooncakes/` 里的上游依赖 | **0** | 改不了 —— **好在它们现在也没报** |

（归到诊断头下的是 **321** 条，moon 汇总那行写 **322** —— 差 1 是口径不同：
汇总那行把 `Warning: [0079]` 这种短式输出也算进去了。别把 321/322 当一个数用。）

其中 **238 条是 `implicit_impl_as_method`**（就是 `[0079]`，其中 210 条在 vendor 里），
官方措辞是 "deprecated and **will be removed in the future**" —— **它将来会从警告变成错误**，
落点正是 `impl Show for X` 那类写法（新写法是 `pub extend X with Show::{…}`）。
**好消息是它全在我们能改的地方**（vendor 是 fork，走 patch 流程就行）；坏消息是 243 条在 vendor 里。
另有 2 条 `deprecated_syntax`（`vendor/rabbita/cmd/operation.mbt:35` 的
`pub(all) extenum Extension {}`）—— `extenum` 也是**将来会消失**的写法。

这一条**没有修**（新工具链上它只是警告，不影响任何门），但**记在这里**：
下一代工具链冲击面的形状已经能看见了，且**不需要等 CI 红了才知道**。

---

## 补记（发布日：三个"看起来像别的问题"的坑，2026-10-01）

`0.3.0` 发布那天，三件事都**报出了指向别处的症状**。全部是可复用的判据。

### 坑一：npm 对**未认证**的 `PUT` 回 **404**，不是 401

```
npm ERR! 404 Not Found - PUT https://registry.npmjs.org/moobile-host - Not found
npm ERR! 404  'moobile-host@0.3.0' is not in this registry.
```

这句话在说"这个包里没有这个版本"，读起来像**包名写错 / 版本号写错 / 权限不足** ——
真因是 **`~/.npmrc` 里那个 token 已经失效**：抓下 tarball、内容全对、`publishConfig.registry` 也对。

**判据（两条，都不需要猜）**：

```bash
npm whoami --registry=https://registry.npmjs.org/     # 401 Unauthorized ⇒ token 废了
# 或者绕开 npm 客户端，直接拿 token 问 registry（排除"是客户端的问题"）：
#   GET https://registry.npmjs.org/-/whoami  +  Authorization: Bearer <token>   → 401
```

那 token 的形状是 `npm_` 开头、**40 字符** = **granular access token**（**有有效期**，最长 90 天）。
修法：`npm login --registry=https://registry.npmjs.org/`（npm 9 默认走浏览器授权）。

⚠️ **第一手证据在 npm 自己的 debug 日志里**，不在终端上：

```
<npm cache>/_logs/<时间戳>-debug-0.log      # 本机是 E:\BACKUP\npm\_logs\
  http fetch PUT 404 https://registry.npmjs.org/moobile-host 1409ms
  verbose statusCode 404
```

**教训**：`404 Not Found` 在"发布"这个语境下**不等于**"资源不存在" —— npm 对匿名请求一律这么回，
不泄露"包到底存不存在"。看到 404 先查**认证**。

### 坑二：发布成功时是 **202 = 异步受理**，`0.3.0` **约 6 分钟**后才可见

成功那次的日志长这样（顺序本身有信息量）：

```
http fetch PUT 401 https://registry.npmjs.org/moobile-host      ← 旧 token 先失败
http fetch GET 202 https://registry.npmjs.org/-/v1/done?authId=…  ← **npm CLI 自己**起了 web 授权
notice Your package is being processed and may take a few minutes to become available.
http fetch PUT 202 https://registry.npmjs.org/moobile-host      ← 受理
verbose exit 0
```

实测时间线：**23:09:54 受理 → 23:16:09 才在 `dist-tags` 里出现 `latest: 0.3.0`**（约 6 分钟）。

> ⚠️ **这一轮我判错过一次**：受理后 1 分钟就去查 registry，看到还是 `0.2.0`，
> 差点写下"没发出去"。**两件事都说明同一条规矩：先看 job log，再下结论；查 registry 要轮询，别单次取样。**
>
> 顺带：401 之后又成功**不是灵异事件** —— 那个 401 让 CLI 触发了 web 授权（`/-/v1/done`），
> 用户在浏览器点一下确认，CLI 拿到新 token 后重试成功。

### 坑三：**npmmirror 镜像会滞后**（对国内用户是真会撞上）

官方源上已经是 `latest: 0.3.0`，而**默认镜像源**上：

```
npm ERR! notarget No matching version found for moobile-host@^0.3.0.
```

这不是"包没发出去"。处置：

```bash
# 触发按需同步（返回 {"ok":true,"state":"waiting"}；排队几分钟到一小时）
curl -X PUT https://registry.npmmirror.com/-/package/moobile-host/syncs
# 应急：直接走官方源
npm install --registry=https://registry.npmjs.org/
```

本轮就是靠第二条把"用户路径"验完的（`npm install` → 488 个包 → 4 分钟）。
⚠️ 这条的**边界**：它不是我们仓库的问题，但会**伪装成**"发布失败"，值得写进用户可见的排错清单。

### 顺带

`npm/moobile-host/publish.sh` 原来把 `--otp=` **原文**打进回显（终端回滚缓冲、npm debug 日志各留一份）。
OTP 只有 30 秒有效，但没有任何理由留痕 —— 已改成 `--otp=***`（只影响回显，真发给 npm 的参数不变）。

---

## 补记（CI 第二次红：`file:` 依赖在 Linux 上是**软链**、在 Windows 上是**拷贝**，2026-10-01）

修完语法错误推上去之后，CI **仍红 2 条**（脚手架模板 / 承载真应用）。但这次**错误行直接读到了**
（上一提交新加的 annotation 生效，不再是被截断的警告尾巴）：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'react'
  imported from /home/runner/work/moobile/moobile/npm/moobile-host/core.js
```

注意那个路径：是**仓库源码**，不是装好的副本 —— 这就是全部线索。

### 真因：同一个 `package.json`，两个平台装出**不同形态**

各应用的 `package.json` 用 `"moobile-host": "file:../../../../npm/moobile-host"`。于是：

| 平台 | npm 装成什么 | `core.js` 里的 `import 'react'` 从哪解析 | 结果 |
|---|---|---|---|
| **Linux**（CI 的新鲜克隆） | **软链** → 真身是仓库源码 | Node 默认按**真身**解析 → 从 `npm/moobile-host/` 往上找 `node_modules` → 仓库里没有 | **`ERR_MODULE_NOT_FOUND`** |
| **Windows**（本机） | **拷一份**真目录（建不了软链） | 它就在**装着 react 的那个 `node_modules`** 里 | 正常 |

⇒ **同一份代码、同一个提交，本机 16/16、CI 红**。这是本仓库最花钱的那类坑的**第二个实例**
（第一个是"新鲜克隆没有 `vendor/`"）——但这次的原因在**平台差异**，不在配方漏了一步。

### 复现（本机，用 junction 造出 CI 的形态）

```bash
mv examples/apps/todo-app/host/node_modules/moobile-host /tmp/mh_backup
powershell -NoProfile -Command "cmd /c mklink /J 'examples\apps\todo-app\host\node_modules\moobile-host' 'D:\ai_project\interest\moobile\npm\moobile-host'"
node tools/verify_headless.mjs      # → ERR_MODULE_NOT_FOUND，与 CI 同一句
```

（junction 不需要管理员权限；`cmd //c` 会被 MSYS 吃掉，得走 PowerShell。）

### 修法：`tools/verify_headless.mjs` 开头 re-exec 加 `--preserve-symlinks`

让解析按**链接所在位置**走 —— 语义正是"装在哪儿就从哪儿解析"。**实测**（就在上面那个 junction 状态下）：

| | `verify_headless` | `template_check` | `scaffold_probe` |
|---|---|---|---|
| 不加 | 复现 CI 那句错（exit 1） | 红 | 红 |
| 加了 | **10 / 10** | **15 / 15** | **7 / 7** |

真目录状态下重跑同样 10/10（**没有为了救 CI 把本机弄坏**），整个离线全集 **16 / 16**。

### 试过但**没用**的那条（记下来，免得下一个人再试）

**给 CI 加 `refresh_host_copies.sh` 救不了**：那个脚本是 `rm -rf node_modules/moobile-host && npm install`
—— 而 **npm 在 Linux 上又把它装成软链**。它之所以在 Windows 上"能把副本刷成真目录"，
靠的正是**拷贝**这个平台副作用，不是脚本本身。

### 附带发现：有一条门在 CI 上**是空的**

`check_npm_fresh`（宿主包副本新鲜度）在 CI 上**永远通过** —— 副本是软链时，它比的是"源码 vs 源码"，
恒等。只有在本机（真目录）它才有意义。**这不是 bug，是那条门在软链环境下的能力边界**，
记在这里，别在 CI 上看到它绿就以为副本被验过了。

### 教训

**"同一个 `package.json`，两个平台装出来的不是同一个东西"** 是一类独立于代码的坑。
判断"CI 红是不是我们写错了"之前，先问一句：**两边环境里，这个东西是同一个东西吗？**
这次两边差的不是文件内容，而是**文件系统里的一种形态**。

### 结果：CI **绿了**（它落地以来第一次）

把这条修复推上去之后：run **`36888896799`** @ `3e4a3fc` → **`conclusion = success`**，
8 个步骤全 success，annotation 只剩两条与本仓库无关的弃用提示。

⚠️ 值得记一笔的是**两次红的诊断成本差了一个量级**：
第一次红，能读到的只有"门名 + 12 行日志尾巴"，而那 12 行**全是警告**，把所有人（包括我）
往"警告致红"引了一轮；第二次红，`verify_all.sh` 先打**错误行**、CI 再把它们发成 annotation ——
`ERR_MODULE_NOT_FOUND ... imported from …/npm/moobile-host/core.js` **一眼就是全部线索**。
**同样的失败，出口不同，成本差一整轮。**

---

## 补记（SSE 流式通道：一条通道、两份传输，2026-10-01）

**起因**：要给手机 LLM chat 应用做"边生成边显示"。库里原来**只有一问一答**
（`@http` 的 `expect_json` / `expect_text` 都会把整个响应读完才交回来），于是新开了
**`@http` 的流式那一半**（`http/stream.mbt`）—— 一个请求、**很多条消息**回到 `update`。
试金石 `examples/apps/sse-spike/`（无头 12 项 + 真机 14 项），已接成 `verify_all.sh` 的第 17 条门。

### 一、**RN 的 `fetch` 没有 `response.body`** —— 平台上必须有**两份**传输

| 平台 | 传输 | 判据 |
|---|---|---|
| Web / Node | `fetch` + `response.body.getReader()` | 无头 12 项 ✅ |
| **React Native** | **`XMLHttpRequest` 渐进读 `responseText`** | **真机 14 项** ✅ |

- RN 的 `fetch` 基于 whatwg-fetch，**拿不到流式 body**。照 fetch 写法写出来的"流式"在真机上
  **一条 `Delta` 都收不到，而且不报错** —— 正好是最容易想当然的地方。
- ⚠️ **必须在发请求之前判平台**（`navigator.product === "ReactNative"`）。
  "先用 fetch 试、不行再换 XHR"会把**同一个 POST 发两遍**（对 LLM 接口就是双倍扣费 + 双份生成）。
- 好消息：RN 的 XHR **支持**增量（`__didReceiveIncrementalData`；只要挂了 `onreadystatechange`
  或 `onprogress` 就会走这条路），`readyState === 3` 时 `responseText` 是**累积**的。
  真机实测（`adb logcat` 里的临时探针，验完已撤）：

  ```
  rs=3 status=200 len=15 → len=30 → len=45 → len=59   ← 一帧一次，边收边长
  rs=4 status=200 len=59                              ← 收尾
  ```

- **诊断路径**（值得记）：`console.log` 在 RN 里会进 **logcat**（`ReactNativeJS` 标签）。
  "真机上什么都没发生"的时候，这是最快分清"没收到数据"与"收到了但没渲染"的办法。

### 二、`Emit[Msg]` 返回的是一个 **Cmd** —— 光调 `emit` 消息会**静默丢掉**

`pub(all) struct Emit[Msg]((Msg) -> Cmd)`。也就是说 `emit(msg)` **只是造了个命令**，
不把它交给运行时，那条消息**永远不会到 `update`**，而且**不报错**。

从外部（JS 回调、定时器）送消息进来的官方路径是：

```moonbit
@cmd.custom_cmd(scheduler => {
  some_js_thing(..., ev => scheduler.add(emit(Msg(ev))))   // ← scheduler.add 才是"送达"
})
```

这与 `@sub.every` 的加载器是同一条路（`scheduler.add(tagger.val)`）。
⚠️ 两个真 bug 都是判据第一天抓到的，且都属于"**静默**"那一类：

1. **收尾事件被自己挡掉**：`finish()` 先把 `terminal = true` 再调 `send()`，
   而 `send()` 第一行就是 `if (terminal) return` —— 于是 `Done`/`Fail` **一条都没发出去**。
   症状：分片全对，界面永远停在"接收中"。修法是把"裸投递"与"带闸门的投递"分开。
2. **探针自己成了被测物**（见下条）。

### 三、`uiautomator dump` 的**单引号**陷阱 —— 真机判据读不到含 `"` 的文字

真机判据一开始报"一帧都没有"，而**界面上明明有**。抓下原生节点树才看清：

```
<node index="0" text='#1 {"i":1}' … />      ← 属性值里含双引号 → xml 用**单引号**包起来
<node index="0" text="待办" … />            ← 寻常情况
```

`tools/verify_android.py` 的 `ATTR_RE` 原来只匹配 `="…"`，于是这类文字被读成**空字符串** ——
**不报错**，只表现为"断言说没有、人眼看得到"。**界面文字里带 `"` 并不罕见**：
任何显示 JSON / 代码 / 引用的应用都会撞上（本项目正是在显示 `{"i":1}` 时撞的）。

**证伪用真实那份 dump 做的**（修前 vs 修后）：修前读出 4 条文字，修后 **7 条**
（多出 `#1 {"i":1}`、`#2 {"i":2}`、`#3 {"i":3}`）。两边的解析器都改了
（`tools/verify_android.py` 与 `sse-spike/device_check.mjs`）。

> 教训与"红的是探针不是被测物"同源，但这次**更阴**：不是探针红，而是**探针给了个错的"绿/否"**
> —— 它说"界面上没有"，而这与截图矛盾。**看到"断言说没有、人眼说有"时，先怀疑解析器。**

### 四、顺带重踩的两个已知坑（说明它们值得写在显眼处）

- **`CI=1` 会让 Metro 关掉文件监听**：改了 JS 重新构建后，app 拉到的还是**旧 bundle** ——
  表现是"我加的探针日志一条都没出现"。这一条 `FINDINGS` 里早有记录，我仍然踩了。
- **冷启动拉 bundle 有时序**：改了 `moobile.js` 之后立刻拉 app，可能正好卡在 Metro 重新打包上，
  停在 "Unable to load script"，**再起一次就好**。判据因此加了"重试一次"，
  免得把**时序问题记成功能缺陷**。

---

## 补记（接一个**现成的 RN 组件**：markdown 渲染，2026-10-02）

**起因**：chat-app 的助手回复原来是**纯文本**渲染的。LLM 的输出基本都是 markdown —— 这不该
自己写解析器/渲染器，**组件库接入机制**（antd 那条，I 轨道）正是为这件事准备的。
选 `react-native-markdown-display@7.0.2`：**纯 JS**（依赖只有 `markdown-it` / `css-to-react-native`），
渲染的是 `react-native` 原语 —— 所以**同一份代码在 RNW(web) 上也是这套**。
接的方式：宿主 `App.js` 里 `registerLibrary({namespace:'md', …})`，MoonBit 侧写 `@html.node("md:Markdown", …)`。

接的过程撞了**四个坑，三个在真机上才露头**。全部有真机/无头判据压着（`device_check.mjs` 17 项、
`verify.mjs` 21 项）。

### 一、`markdown-it` 依赖 Node 内置的 `punycode` → **Android 打包直接失败**

```
The package at "node_modules/markdown-it/lib/index.js" attempted to import
the Node standard library module "punycode".
```

web 上打包器会去 node builtin 里取，**真机打包不认**。修法：`npm i punycode` + `metro.config.js` 里
`config.resolver.extraNodeModules = { punycode: require.resolve('punycode/') }`
（必须是一条**依赖**，不能只在配置里写路径 —— 那样新鲜克隆会缺件）。

### 二、`registerLibrary` 必须在 `installHost()` **之后**调

真机上启动即抛：

```
moobile-host: registerLibrary 必须在 installHost 之后调用（MOBILE_HOST 还没装）。
```

而 `MOBILE_HOST` 是在 `mountApp` 里才装的。正确写法（`npm/moobile-host/index.js` 的文件头也写了）：

```js
installHost();                  // 先装
registerLibrary({ namespace: 'md', module: … });
export default mountApp(app, { registry });   // 再装一次是幂等合并
```

### 三、★ **字符串 children 会被包成 `<Text>`** —— 自定义组件要裸字符串时接不上

这条最值钱。`render.mbt` 的 `render_node` 对 `VNode::Text(s)` 的规定是
**包一层宿主 `Text` 组件**（RN 的规矩：裸字符串不能当 `View` 的子节点）。

于是 `@html.node("md:Markdown", attrs, b.text)` 交给组件的是**一个 React 元素**，不是字符串，
`markdown-it` 当场抛 `Error: Input data should be a String` —— **每个字一次**，刷满 logcat，
而界面上只表现为"AI 那条空着"，**看不出是这条**。

修法（不去改库的渲染规则）：**文本走 prop，宿主侧套一层适配**：

```js
// App.js
components: {
  Markdown: ({ markdown, ...rest }) => React.createElement(Markdown, rest, String(markdown ?? '')),
}
```
```moonbit
@html.node("md:Markdown", attrs(...).prop_str("markdown", b.text), ([] : Array[@html.Html]))
```

这与 `jsonProps`（给结构化 prop 套解析器）是**同一个手法**：形状对不上的组件在**宿主侧**适配。
⚠️ 边界：库现在**没有**"给自定义组件传裸字符串子节点"的表达方式；要的话得改渲染规则，
而那会**反过来**弄坏"自定义组件把字符串当 RN 子节点"的用法。**记在这里，别当已支持。**

### 四、判据自己是"只读元素树、从不渲染"——所以读不到 prop 里的文字

无头判据（`verify.mjs`，与 `verify_headless` 同一套路子）**只遍历 `handles.element()` 的元素树**，
从不真的渲染它。助手文字现在在 `markdown` **prop** 里（见坑三），而遍历器只看 `props.children`
→ **文字对它不存在**。处置：遍历时**把 `markdown` prop 也当文字读**，并在注释里说明
"这与替身是同一个性质（换一个宿主实现）；它验的是'文字到了界面这一层'，不是'markdown 长什么样'"。

### 五、真机探针侧的两个坑（都不是应用的问题）

- **`adb shell input text` 会丢字符**，而且**丢的位置随机**（`sk-device-test` → `sk-ice-t`、
  `http://…` → `hp://…`）。块打丢得更多，**逐字符慢打（160ms/字符）+ 回读校验 + 重试**才稳。
  ⚠️ 形状与"**受控输入框在输入快于往返时丢键**"一模一样（每次按键都要 emit → update → 重渲染，
  值从 Model 回灌）。**真用户粘贴一大段文本时可能撞上同一件事** —— 记在这里，值得单独查。
- **软键盘会盖住底部的「发送」**：症状是"点了没反应、草稿还留着"，看起来像应用不工作。
  要先 `input keyevent 4` 收键盘再点。
- 另外：判据要先 `pm clear`（否则上一轮的 key 还在库里，应用**正确地**直接进聊天页，
  而"首次打开落在设置页"那条就没法验）——⚠️ `pm clear` 会连 Metro 的 bundle 缓存一起清，
  冷启动必须轮询。

### 判据

- 无头 **21 / 21**（假 OpenAI 服务 + 假 `MOBILE_HOST.db`，`md:Markdown` 用替身）；
- **真机 17 / 17**：界面上读到 `AI | 标题一 | 这是粗体和行内代码。 | const a = 1; | • | 列表甲 | • | 列表乙`
  —— `#` / `**` / 反引号 / 围栏**全被吃掉**，标题、粗体、行内代码、代码块、列表都渲染出来了；
  而**流到一半**时读到的是 `AI | 标题一 | 这是** | ▍ | 生成中…`（未闭合的 `**` 当普通文本，
  这正是"边收边渲染"该有的样子）。

### 补记：把 markdown 那个组件也交给**生成器**（`libgen`），看能不能直接出函数化支持

**结论：能跑，产物质量不错，但这个组件有一个洞 —— 内容是 React 的隐式 `children`，生成器看不见它。**

跑法（照 antd-demo 的惯例，配置 + 两个 npm 脚本）：

```bash
cd examples/apps/chat-app
npm run libgen          # 生成 4 份产物
npm run libgen:check    # 校验没被手改（本应用已接）
```

**它产出了什么**（`react-native-markdown-display@7.0.2` → 1 个组件）：

| 产物 | 内容 |
|---|---|
| `generated/md.manifest.json` | 组件 → prop 的清单（`rules` json / `mergeStyle`、`debugPrintTree` bool / `onLinkPress` event，另 3 个 `unsupported` 带原因） |
| `libraries.generated.js` | 宿主注册调用（`components` / `jsonProps: { Markdown: ['rules'] }` / `events: { onLinkPress }` / `platforms`） |
| `md/components.generated.mbt` | 类型化 DSL：`@md.markdown(rules?, merge_style?, debug_print_tree?, on_link_press?, attrs?)` |
| `md/moon.pkg` | 生成的包声明（含"为什么必须 `+js`"的说明） |

**已经用起来了**（⚠️ 这是**当轮**的写法，下面那条补记把它换掉了）：`app.mbt` 当时写
`@md.markdown(merge_style=true, attrs=…prop_str("markdown", …))` —— 类型化的 prop + 逃逸口。
**无头 21/21、真机 17/17**（换调用方式之后两套都重跑过）。

#### 洞：`children` 藏在**泛型包裹**里，生成器认不出来

那个包的声明是：

```ts
type MarkdownStatic = ComponentType<PropsWithChildren<MarkdownProps>>;
export const Markdown: MarkdownStatic;
```

`PropsWithChildren<P>` 是**类型级糖**，`children` 并不在 `MarkdownProps` 接口里。
生成器里确实有 `children` 这个概念（`manifest.js`：`kind === 'children'` → "不生成，另走 trait 参数"，
并且有一个"组件类型里声明了 children 就补上"的兜底分支），但**兜底没认出这种包裹形态** ——
于是 manifest 里**根本没有 `children`**，生成的函数也就**没有地方放 markdown 文本**。

对比 antd：`Button` 的 `children?: ReactNode` 直接写在公开 props 接口里 → 生成器能认 ✅，
生成的 DSL 就是 `@antd.button(…, "加一条")`。

⇒ **影响面不止这一个包**：`ComponentType<PropsWithChildren<P>>` / `P & { children }`
是 RN 生态里非常常见的写法。撞上的症状是"生成的函数**没有内容参数**，只能走 `attrs` 逃逸口"。

#### 而且：就算把 `children` 认出来，这个组件**还是**不能直接用

因为 `children` 在生成物里走 `IsChildren` trait，而**字符串会被包成 `<Text>`**
（`render.mbt` 的 `render_node`，RN 的规矩）—— 而 markdown-it 要的是**裸字符串**，
于是又回到那条 `Input data should be a String`（本文件上一条补记的坑三）。

⇒ 所以对这个组件，"宿主侧套一层适配（把具名 prop 接成 children）"**不是绕路，而是对的层**：
它与 `jsonProps`（结构化 prop 套解析器）是同一个手法。生成器将来若要覆盖它，
需要的新概念是"**内容走某个具名 prop**"（在 `libgen.config.json` / manifest 里声明），
而不是"认出 children"。

⚠️ 现状记账（**2026-10-02 已解决，见下一条补记**）：当时 `libraries.generated.js` 没有被
`App.js` 使用 —— 因为生成的那份注册会把适配层丢掉，而生成器还缺"内容走某个具名 prop"这个概念。
下面那条补记把这个概念补上了（而且发现**根本不需要宿主适配层**）。

---

## 补记（把那个洞补上：**两处「类型定义在撒谎」**，2026-10-02）

上一条补记停在"生成器缺一个新概念"。这一轮把它补齐了，过程里又撞上**第二处撒谎**
（而且它只在真机上露头）。两份洞的落地方式刻意不同，理由在下面。

### 洞一：`PropsWithChildren` **不是**透明的（`PropsWithoutRef` 才是）

`resolve.js` 的 `WRAPPERS` 里早就列着 `PropsWithChildren` / `PropsWithoutRef`，
但 `switch` 里**没有 case** → 掉进 `default: unresolved` → "组件类型那条路断了"。
修法是在**一处**归一化（不是在调用点打补丁）：

| 包装 | 语义 | 处理 |
|---|---|---|
| `PropsWithChildren<P>` | `P & { children?: ReactNode }` | **加**一个 `children` 字段（`from: 'PropsWithChildren'`） |
| `PropsWithoutRef<P>` | 只是去掉 `ref` —— 对 props 面**无影响** | **透明**（返回 `P`） |

⚠️ 别把两者一起"透明化"：那样 `children` 会**静默消失**，而症状是"生成的函数没有内容参数"。

**波及面是实测出来的，不是推出来的**：重跑 `antd-demo` 之后，`Skeleton` / `BackTop`
这两个"以前看起来没有 children"的组件真的多出了 `children : C`，于是 demo 里两处调用**编不过**：

```
Error: [4080] @antd.skeleton(active=true, paragraph=json_skeleton),
  which requires 1 positional arguments, but is given 0 positional arguments.
```

补上既有的空 children 写法 `([] : Array[@html.Html])` 即可。
⇒ **这就是 `antd-demo` 作为试金石的价值**：它 71 个组件、几百处调用，改一处解析规则就会红，
而红的地方是**编译期**（不是"某天渲染时发现少了东西"）。

### 洞二：`content` 声明 —— 而且**不需要宿主适配层**

上一条补记的结论是"宿主侧套一层适配不是绕路，而是对的层"。**实测下来它是多余的一层。**

原因在渲染路径上（`render.mbt`）：

```
props.props_map() 的键**原样**进 JS 对象（render_props 不筛键）
  → js_create_element(comp, props, ...children)
```

于是 `Attrs::prop_str("children", "# 标题")` 到宿主就是 `props.children === "# 标题"`
（**原始 JS 字符串**），而 `createElement` 在**没有位置参数 children** 时不会覆盖它
—— 也就是"内容走 prop"，与"内容走子节点"（`VNode::Text` → RN 的 `<Text>` 元素）是**两条路**。

所以补的东西只有"**声明**"：

```jsonc
// libgen.config.json
"content": ["Markdown"]                  // 内容进 `children` prop（默认落点）
"content": { "Fancy": "text" }           // 也可以点名落点 prop
```

⇒ manifest 的 `components.Markdown.props.children = {kind:'children', deliver:'raw', prop:'children',
deliver_from:'config:content'}`，生成物写成 `children : String` + `a.prop_str("children", children)`。

**为什么不猜**：判据有两档 —— ① 类型说 `children: string` → 自动 `deliver:'raw'`（无需声明）；
② **类型在撒谎**（这个包写的是 `ComponentType<PropsWithChildren<MarkdownProps>>`，即
`children: ReactNode`，运行期却把它交给 markdown-it）→ 只能由人声明。
猜错的下场就是上一条补记里那个：组件内部报一句与 prop 无关的错。

### 第二处撒谎：`Markdown` **只在 `default` 上**（只在真机露头）

洞二修好之后，**无头 22/22 全绿**，而真机直接红：

```
[runtime not ready]: Error: moobile-host: registerLibrary("md") 里列了 `Markdown`，但模块里没有这个导出。
```

真因是第三个"类型定义与 JS 不一致"：`index.d.ts` 写着 `export const Markdown: MarkdownStatic;`，
而 `src/index.js` 里具名导出那一串**没有** `Markdown`（只有 `export default Markdown`）。

⇒ 为什么无头判据看不见：**web/node 上 Metro/Babel 的 interop 恰好能看见具名导出**，
Hermes 上看不见。这与手势那条通道是同一类分工（"web 上验过 ≠ 真机也能跑"）。

修法沿用同一条规矩（**类型说不准的事由人声明，声明错了就报错**）：

```jsonc
"defaultExports": ["Markdown"]           // 这个名字**就是**模块的 default 导出
```

⚠️ 宿主**刻意不自动回落**到 `default`：那是猜，猜错是"注册了另一个组件"（比启动即报错坏得多），
所以没声明时照旧点名报错，并且报错里**指路**这个配置项。

⚠️ 第一版语义还写错了（值得记）：我实现成"从 `default` 里找**同名属性**"，
而 `export default Markdown` 的组件**名字不在自己身上** —— 声明写了、错照旧。
**真机跑了第二轮才定住**。最终语义是两条：① `default` 上真有这个名字 → 取它（CJS
`module.exports = {…}` 的 interop 形状，含 `Form.Item` 这种点号路径）；
② 单段名字且取不到 → **这个名字就是 default 本身**。

### 为什么必须有一条**假包探针**（`tools/libgen_probe.mjs`，24 项）

生成器自己的规则（哪一档算 children / 哪一档算原始字符串 / 拼错名字会不会报错）
此前**没有任何一条离线门看得见**：antd 那条要装 antd、chat-app 那条要装 markdown 渲染器。
于是它在临时目录里手写一个假包（四个组件各代表一档规则）+ **四条负例**，全程离线。

**它当天就抓到两个真 bug**，而且两个都是"静的"：

1. **清单条目是逐字段重建的**（`buildComponentProps` 里 `props[name] = {kind: cls.kind, …}`），
   `classify` 新加的 `deliver` / `deliver_from` **被静默丢掉** —— 于是 `children: string`
   明明判成了 raw，产物却仍按子节点发。症状在真机上，离生成器隔着整个流水线。
2. 上面那条 `defaultExports` 的语义错误（`default[name]` vs `default` 本身）。

⇒ 探针里那条**负例 C**（没声明时 `children` 必须仍走子节点）是主判据：
没有它，"把规则放宽成全都当原始字符串"也能全绿，而真实后果是**普通组件的子树全被塞进一个 prop**。

### 判据侧的两个自省（都不是应用的问题）

1. **无头判据"只读元素树、从不渲染"** —— 所以往替身组件（`md:Markdown` 的 stub）里塞断言是
   **假的**：那个函数根本不会被调用（第一版就是这么写的，得到"0 次渲染"）。
   要看"内容以什么形态到达"，只能读**元素的 props**，而"哪个元素是 markdown 组件"的判据是
   **注册进 `MOBILE_HOST.components` 的那个对象本身**（别按名字猜：jsonProps 会给它套一层适配器）。
2. **`fnBody` 的正则要认 `pub fn[C : @html.IsChildren] name(`** —— 名字前面挂着 trait 约束。
   第一版按 `pub fn <名字>(` 找，"带 children 的函数找不到"被当成了"生成器没生成它"，
   差点去改生成器。**判据自己的盲点与生成器的 bug 长得一模一样**，所以这类"取函数体"的助手
   要能同时认两种签名。

### 判据

| 门 | 分数 | 说明 |
|---|---|---|
| `tools/libgen_probe.mjs` | **24/24** | 假包 + 四条负例 + 宿主编（stub react 真注册）；离线、进 `verify_all.sh` |
| chat-app 无头 | **22/22** | 新增一条：`md:Markdown` 元素的 `props.children` 类型必须是 `string` |
| chat-app 真机 | **17/17** | markdown 真渲染（`**` / 围栏 / 列表都被吃掉 = 真解析了字符串） |
| `antd-demo` | **24/24** + `libgen --check` | 洞一的重生成本身把它撞红过，修好后两套都对 |


---

## 补记（把 `interest/yi` 真搬过来：脚手架两条命令 + 真浏览器里跑通，2026-10-02）

这一轮的目标第一次不是"库的能力"，而是**用真实应用反过来压工具**：把 `interest/yi`
（《御纂周易折中》阅读器，1924 行视图 + 476 行 CSS + 1.7 MB 数据 + 一张 canvas 罗盘）
用 `moobile-host create --from-rabbita` 搬成 moobile 项目，并在真 Chrome 里验收。
产物：`examples/apps/zhouyi-reader/`（含 `MIGRATION.md` 迁移报告）。

下面每一条都是**踩过之后才写下来的**，按"下一个人最容易重踩"排序。

### 一、`create` 那边：五个"看起来对、边界上错"的坑

| # | 现象 | 真因 | 修法 |
|---|---|---|---|
| 1 | 入口改写后**文件少了几百行**；症状是"`class=` 改写处数从 129 掉到 14" | 用正则惰性量词跨行去凑 `fn app()`：`/(?:\/\/\/\|\s*\n)(?:[^\n]*\n)*?fn app\(/` 里的 `(?:[^\n]*\n)*?` **能跨任意多行**，于是从文件里第一个 `///|` 开始匹配，把中间整段吃掉了 | 改成**括号配对**定边界（`matchCloseForBrace`）。**行号/边界这类东西，正则不靠谱** |
| 2 | 41 处"这个元素已经有 `attrs=`"的假冲突（真冲突只有 2 处） | 内层元素被改写后，它插进去的 `attrs=…` **正好落在外层调用的括号里**，于是外层再问"你有 attrs 吗"就得到"有" | ① 冲突判定必须在**改之前的原文**上一次算完；② 只看**本调用参数那一层**（跳嵌套括号），别整段 grep |
| 3 | 生成的骨架**挂不起来**：入口 `pub fn app()` 也被注释掉了 | 块级"注释掉迁不过去的代码"会**沿调用链传播**：`view` 调 `bagua_view` → `bagua_view` 有 canvas → 被注释 → `view` 编不过 → 也被注释 → 入口跟着没 | 改成**保底桩**：签名照原样留着（调用点一个字不改），函数体换成空值/`abort`，原实现以注释留在桩体里 |
| 4 | 桩体改成 `abort` 之后，**整个页面白屏** | 罗盘那类函数返回 `Html` 且挂在**列表页**里 —— "跑到这里会炸"变成了"整页起不来"，使用者看到一条与迁移毫无关系的运行时 panic | 桩体**按返回类型给空值**：`Html`→`nothing`、`Cmd`→`@cmd.none`、`Unit`→`()`…；只有**不认识的类型**才 `abort`（那种情况必须响） |
| 5 | 报告里的行号**总差 7 行**（指到别处） | 内联 `<style>` 的内容从它自己第 1 行起算，而它在 HTML 里可能位于第 7 行；另外选择器的行号取的是 `preludeStart`——那一位紧跟在上一条规则的 `}` 后面，算在**上一行** | `parse(text, file, baseLine)` 传内联块的起始行；选择器取**第一个非空白字符**的位置 |

### 二、`on_click` 挂在 `div` 上 = **静默点不动**（跨端最隐蔽的一类）

`render.mbt:243` 把 `click` 映射成 `onPress`，而标签表里**只有 `button` / `a` 落到 `Pressable`**；
`div` / `span` / `p` 落到 `View` / `Text`，那两个组件没有 `onPress` —— **点击被丢掉，不报错、不警告**。

- 实测：`interest/yi` 有 **5 处** `div(… on_click=…)`（卦卡 1 处 + 折叠 4 处）。
  浏览器上点得动，迁过来**点不动**：真 Chrome 里"点卦卡 → 进详情"这条断言一直红，
  而 DOM 里一切正常、控制台一句错误都没有。
- F1 的 14 条**按行子串**规则**抓不到它**：它要的是"标签 + 事件"两个 token 的**同调用结构关系**。
  所以这条判据做在 `create` 的 `detectClickOnView()` 里，进报告的 TODO 清单。
- 修法是**换标签**（`div` → `button`），不是加样式。

### 三、数据：相对 URL 这条路在库里**本来就不通**

原项目的数据由它自己的后端在 `/reader_data.json` 提供。迁移时先按"同源相对路径"试：

1. Expo 会把工程根的 `public/` 挂在站点根 —— 实测 `GET /reader_data.json` → **200 / 1717913 字节** ✓；
2. 但界面仍然报"无法加载数据"，而**网络面板里明明是 200**：真因是 moobile 的 http 走
   `moonbitlang/async`，它的客户端**只认完整 URL**（`request.mbt:37`：没有 `://` 直接 `raise InvalidFormat`）。
   界面把错误吞成了一句"无法加载数据"，**真因是在浏览器控制台里逼出来的**。
3. 更根本的一条：**原生端没有"站点根"这回事** —— 这条路本来就走不到 Android / 桌面。

⇒ 结论：这份 1.7 MB 的只读数据**编译期嵌进产物**（`data_reader.mbt`，`pub let raw_json : String`）。
量过：源文件 1.79 MB、`moon build` 4.6 s、JS 产物 1358 KB → **3104 KB**。三端零差异、启动即读、离线可读。

⚠️ 顺带修掉的一处**宿主 bug**：`index.js` 的 `apiBase: apiBase || DEFAULT_API_BASE` 里
**空串是合法值（同源）**却被 `||` 吃掉了 → 改成 `??`。症状同样是"页面说加载失败、curl 同一 URL 是 200"。

### 四、桌面端（RNW）：文档与真实要求**不一致**，且 Skia 没有 Windows 后端

- **RNW 0.83.2 要的是 VS 2026（≥18.6.1）**，不是官方文档页写的 VS 2022 —— 依据是它**包内自带**的
  `rnw-dependencies.ps1`（`$vsver = "18.6.1"`）与 CLI 的 `msbuildtools.js:160`（默认 `'18.6.0'`）。
  本机只有 VS 2022 BuildTools → `NoMSBuild: Could not find MSBuild with VCTools for Visual Studio 18.6.0 or later`。
  绕过闸门直连 MSBuild 的下一层是 `MSB8036: 找不到 Windows SDK 版本 10.0.22621.0`。
- **`@shopify/react-native-skia` 不支持 Windows**：`npm pack` 后 `package/windows/` **0 个文件**；
  维护者原话"You'd need a dedicated backend for it"（issue #2058）。⇒ **罗盘在桌面上得改用
  `react-native-svg`**（它的 tarball 里有 153 个 windows 文件，含 Fabric 实现）。
- ✅ 有价值的那半：**JS 侧整条通了** —— 裸 RN（零 Expo）+ 仓库源码版 `moobile-host` + **同一份**
  `moobile.js`，`npx react-native bundle --platform windows` 退出码 0。也就是说
  "各宿主各自 pin RN 版本、共享同一份 MoonBit 产物"这条**已经是实测事实**，不再是论断。

细节与 16 条诚实清单见 [`design/DESKTOP-RNW.md`](design/DESKTOP-RNW.md)。

### 五、一条**判据自己**的坑（这类最容易骗过自己）

`verify.mjs` 第一版把"详情页有返回入口"判成 `/六十四卦/` —— 而**列表页也有"六十四卦速查"**，
于是"根本没跳转"也 PASS。同类还有：拿 `element.click()` 当"点到了"（RNW 的 `Pressable`
把 handler 挂在自己那个 div 上，`.click()` 常落在包裹层）、拿"页面上有字"当"宿主编译进来了"。

⇒ 判据要能**区分当前状态**：用 `‹ 六十四卦` 这种只可能出现在详情页的串，
用**真鼠标事件**（CDP `Input.dispatchMouseEvent`）而不是 `.click()`，
以及**信任应用自己打的日志**（`debug_log("阅读数据已装载：658049 字符")`）而不是 DOM 长相。


### 五、★ 手势坐标那条通道：**"手势元素"必须与"坐标空间"是同一个元素**

这是本轮最有价值的一条。应用把 `@gesture.attrs(...)` 挂在**外层 box**（整行宽）上，
而角度/命中判定用的是**画布坐标**（720 那一套，圆心 (360,360)）。两者差一个**居中的偏移**：

- web 实测（CDP 打点 + 应用自报坐标）：点外环 260 的位置，应用算出来是 **356** ——
  跑到环外（222–300 之外），于是"点了没反应"。偏移量 = 48px（盒子比画布宽出来的那半）。
- 修法一行：给手势元素钉上与画布一样的宽高。修完 web **24/24 恢复**（那条断言之前是绿的，
  在画布尺寸从 720 改成 360 之后才暴露 —— 偏移量不变、但比例变了，于是从"勉强命中"变成"miss"）。

⇒ **规矩（应用侧）**：`@gesture` 的 `x/y` 是"**承载手势的那个元素**内的坐标"，
所以**要么让那个元素与你的坐标系同尺寸，要么自己减掉原点**。别默认"挂哪儿都一样"。

### 六、★★ 库的真 bug：**同一次手势里 `start` 与 `move` 用了两个参照系**（已修）

上面那条残差（Android 上拖 45° 只转约 5°、同一点转过之后命中同一卦）查到了**库侧**的真因，
一句话：**`start` 事件的 `x/y` 和 `move` 事件的 `x/y` 不在同一个参照系里。**

`npm/moobile-host/gesture-rn.js` 在原生上要自己量元素原点（`locationX/locationY` 是"手指
底下最深那个 view"的、还会中途换，所以用 `pageX/pageY − 原点`）。但：

- `grant` 那一刻量测**还没回来**（`geom.state === 'idle'`），于是 `values()` 走了
  "退回 `locationX/locationY`"那条路，快照出来的起点就是**另一个参照系**的坐标；
- 而 `move` 用的是 `pageX − 原点` ✓。

也就是说"起点错、后续增量对" —— 净旋转被啃掉一大截（实测 45° → **5°**），
环上命中自然也不跟手。**web 上看不见**（`MEASURE_ORIGIN` 在 web 上是 `false`，
两端都用 `locationX`，恰好自洽）—— 又一条"web 上验过 ≠ 真机也能跑"。

**真机量到的证据**（临时插桩，验完已删）：

```
[gesture-diag] grant: node=ReactNativeElement hasMeasure=true
[gesture-diag] measure cb ox=20 oy=159.6363525390625 state=idle     ← 量测回来了，但 v0 已经算过了
```

**修法**：起点坐标**不在 `grant` 时定死** —— 存原始值（`pageX/pageY/locationX/locationY`），
等量测就绪后再用**同一套换算**（`xyOf`）算出 `v0`。这样 `start` 与 `move` 必然同系。

**修完的判据**（`device_check.mjs` 的"同一点、转过之后应命中另一卦"）：
`风天小畜#9` → `火泽睽#38` ✅，真机 **18 / 18**。
这条判据是刻意这么设计的：它同时覆盖**手势坐标、旋转、环上命中**三件事，
而"命中哪一卦"正是"轮盘转了"在这个应用里的语义（截屏指纹不可靠，见上文）。

⚠️ **它自己也误报过一次**：第一次跑出 16/17，看着像"修复没生效"，其实是**夹具**——
"从详情页返回列表页"那一步打偏了（`tapText` 只点一次、不等生效），于是**拖动发生在详情页上**
（那里没有罗盘），第二次点的自然还是同一卦。改成"轮询到确实出现「八卦罗盘」再拖"之后 18/18。
**判据红了先怀疑判据** —— 这个仓库里已经有好几例。

### 判据（本轮实测）

| 门 | 分数 | 说明 |
|---|---|---|
| `node examples/apps/zhouyi-reader/verify.mjs` | **19/19** | 真 Chrome：首屏 / 数据装载 / 搜索→网格 / 点卦卡→详情（真爻辞）/ 样式落地 / 无异常 |
| `moon check --target js`（含生成物） | **0 错误** | 迁移生成的项目在工作区里编得过（`--rn 0.83`） |
| `node tools/migrate_scan_reconcile.mjs` | **对账通过** | F1 的 JS 版与 MoonBit 版 18 类 / 357 条命中逐项一致 |
| 生成样式模块 | **104 个函数 / 声明 510 = 已映射 435 + 有损 75** | 对账不闭合就抛 |
| 迁移报告 | **21 项 TODO**（3 保底桩 + 13 整块注释 + 5 `on_click`-on-view） | 每项都有下一步指向 |

---

## 补记（罗盘落地：画布通道在 **Web 上原本没有后端**，2026-10-02 续）

接上一节。`interest/yi` 的罗盘（`canvas` + 鼠标拖拽）是迁移里最后一块硬骨头，
这一轮把它搬完了 —— 结果挖出三件**库/host 侧**的事，比应用本身更值得记。

### 一、组件通道没注册 = **整页空白，而且控制台不说人话**

`render.mbt` 对"宿主没注册的组件"是**点名 fail-fast**（`host.mbt` 的 `js_host_component`
会列出已注册的键）—— 设计上是对的。但在 React 里，**渲染期抛异常会把整棵树卸掉**，
于是现场是：

- `<div id="root"></div>` **空的**、`document.body.innerText` 空串；
- 控制台**没有任何 error**（Metro 照常 200、bundle 照常加载）；
- 我这边第一反应是"是不是数据没进来"、"是不是 CSS 全丢了" —— 都不是。

⇒ **判据要能区分"空"与"错"**：这类排查第一步应该是"root 里有没有东西"，
而不是看页面文本。`verify.mjs` 的首屏断言能抓住它（全红但**没有任何异常**），
所以**"没有任何 console 错误 + 首屏文本为空"**这个组合本身就是一条信号。

### 二、Web 上画布**没有后端**（库只提供了原生那条）

`npm/moobile-host/` 里原本只有 `canvas-skia.js` → `@shopify/react-native-skia`，
而 Skia 的注册默认 `platforms: ['android','ios']`。**Web 没有第二条注册**：
文档里那句"要在 Web 上看同样的画面，走 CanvasKit，那是另一条注册"指的是
`canvas-spike` 里的一次性回放脚本，不是应用能用的后端。

补的：**`npm/moobile-host/canvas-web.js`** —— 零依赖、同步、浏览器原生 2D。
它**不是"实现渲染"**（DESIGN 原则 1）：18 条 op 逐条对应 `CanvasRenderingContext2D`
的同名方法，是**翻译**（与 `canvas-skia.js` 把 op 翻成 Skia 元素树同理）。
顺带把"高分屏"收进后端：`setTransform(dpr,0,0,dpr,0,0)` ——
应用侧原来那段 `prepare_canvas`（自己读 `devicePixelRatio` 重设位图）**可以删掉**。

### 三、`package.json` 的 `files` 白名单**漏一个文件 = 副本里也没有它**

新增 `canvas-web.js` 之后忘了加进 `files`，于是 `bash tools/refresh_host_copies.sh`
刷完还是拿不到 —— 因为那个脚本是 `rm -rf node_modules/moobile-host && npm install`，
而 `file:` 依赖**照样按 `files` 白名单拷**。症状是 Metro 的
`UnableToResolveError: Unable to resolve module moobile-host/canvas-web`，
而**源码就在那里**。⇒ 这条与 `AGENTS.md` 里"`files` 白名单"那条是同一个坑的另一面：
**白名单同时管发布与本地 `file:` 安装**。

（另：Metro 会缓存解析结果，改完之后要 `--clear` 重启才认。）

### 四、应用侧：罗盘迁移的三个决定（都写进代码注释了）

1. **绘制变成纯函数**：`draw_bagua_cmd`（渲染后去 DOM 找 `#bagua-canvas` 再画）→
   `bagua_ops(model)` → `@canvas.canvas(ops, size, size)`。"模型 → 指令"可断言、可测。
2. **坐标 1:1**：手势给的 `x/y` 是**元素内坐标**，所以画布边长必须等于元素边长 ——
   原来是 CSS `min(94vw,720px)` 缩放的，RN 没有 CSS。做法：`@sub.on_resize` 把视口宽度喂进
   Model → `size = min(720, 0.94 * vw)` → 画布里 `ctx.scale(size/720, size/720)`。
   **边长不只是排版问题，它决定手势坐标能不能直接当画布坐标用。**
3. **"长按 300ms 才能拨动"那道闸退休了**：手势通道已经把 `on_pan` 与 `on_tap` 分开报，
   再叠一层时长判断只会让"拖了但没转"变成一个说不清的现象。轻点则**重新发一遍 `DragEnd`**
   —— 判卦导航那套逻辑（按半径/角度算落在哪一卦）一个字都不用重写。

### 判据（本轮实测，真 Chrome）

| 断言 | 结果 |
|---|---|
| 首屏出现罗盘面板（模式按钮 + 立竿测影） | ✅ |
| 画布位图 720×720、**非透明像素 518400**（真的画了） | ✅ |
| **拖拽之后画面变了**（`toDataURL().length` 前 339770 → 后 365462） | ✅ 手势 → 模型 → 重绘整条链通 |
| **轻点外环 → 进入某卦详情**（落在「萃 · 泽地萃 · 第45卦」） | ✅ 环上命中判定对 |
| 搜索 → 网格 → 点卦卡 → 详情（真爻辞） | ✅ 未回归 |
| 全程无 console 错误 / 未捕获异常 | ✅ |
| 合计 | **24 / 24**（`node examples/apps/zhouyi-reader/verify.mjs`） |

---

## 补记（Android 端：**画布那条通道第一次上真机**，2026-10-02 三续）

同一份应用（`examples/apps/zhouyi-reader/`）搬到 Android 模拟器上跑通了 —— 14 / 14 真机断言。
下面四条都是**只在真机上才露头**的，库里之前没记过。

### 一、RN 的"平台文件"必须用**无扩展名**导入，否则等于没写

Skia 在 web 上**连 Metro 的解析都过不去**（`UnableToResolveError: Unable to resolve module ./animation`
from `@shopify/react-native-skia/lib/module/index.js`），所以两条画布后端要按平台拆文件：

```
canvas-native.js        ← android / iOS：Skia
canvas-native.web.js    ← web：空实现
```

**但 `import { x } from './canvas-native.js'` 会把平台解析锁死在 `.js` 上** ——
Metro 只在**无扩展名**的导入上按平台挑文件。症状是：web 上仍然加载了 Skia 那份、
于是整包解析失败、页面全白。写成 `'./canvas-native'` 才对。

⚠️ 另一个**看起来该管用但不该管用**的写法：`if (Platform.OS !== 'web') require('@shopify/react-native-skia')`。
**挡不住** —— Metro 在**打包期**解析所有 `require`，平台判断在运行期。

### 二、`registerLibrary` 的平台闸门是**运行期抛**的，所以 web 那条也得按平台分支

两条后端都无条件调用时，Android 上启动即红屏：

```
moobile-host: 组件库 `moobile` 声明只在 [web] 上可用，而当前平台是 `android`。
```

⇒ 三条注册要用**两种**不同的分支手段，各有原因：
`Platform.OS === 'web'`（运行期，够用）· 平台文件（打包期，必需）· 平台文件（同上）。

### 三、画布的文字要 `makeFont` —— **库里记着"没上过真机"，这次撞上了**

HANDOVER §6 写着「画布**文字字形**（`makeFont` 那条路）**没上过真机**」。第一个把它搬上真机的
应用当场红屏：

```
moobile-host/canvas-skia: 指令里有文字（`fill_text`），但没给 `makeFont`。
  RN Skia 的 <Text> 需要一个 SkFont，而「用哪个字体」是应用的资源决定，宿主不该替你猜。
```

两处细节（都不在文档里）：
1. **`import * as Skia from '@shopify/react-native-skia'` 拿到的是包的命名空间**，
   **不是** native 注入的 Skia API 对象 —— 所以 `Skia.FontMgr` 是 `undefined`
   （报 `Cannot read property 'System' of undefined`）。要字体就走包导出的
   **`matchFont({ fontFamily, fontSize })`**，它内部才去拿 `FontMgr.System()`。
2. 落到真机上的字形与浏览器不同：Android 上没有 "Kaiti TC"/"Charter" 这些族名，
   `matchFamilyStyle` 找不到就回落 —— **中文排版要重新看**（这是"排版要重新验"那一类，不是 bug）。

✅ 结论：`registerSkiaCanvas({ skia, makeFont })` 这条路**现在真机验过了**：
截图 `docs/evidence/zhouyi-android-compass.png`（1080×2340）逐点取色 ——
纸色 `#f6efe0` 最多、墨色 `#1a1410` 与朱红 `#8a2518` 都在，罗盘中心 ±260px 内有
**1608** 个朱红采样点（四正方位）与 **5256** 个墨色采样点（环线与卦名）。

### 四、真机判据的两条**边界**（不写下来就会被误当成 bug）

1. **`adb shell input text` 打不出中文**：`input text 乾` 是空、`%E4%B9%BE` 原样落成字面量 `E4%9E`
   （实测 dump 里就是这样）。所以真机上只能验到"**输入通道通了**"（键入了东西 → 模型变 → 过滤网格出现），
   "输入中文 → 命中卦卡 → 点进去"这条留在 **web 判据**里。`device_check.mjs` 里把这条**显式打出来**，
   免得看起来像"验过了"。
2. **`uiautomator dump` 只给可见节点**：1080×2340 的屏上，罗盘模式按钮那行的后两个在折叠区外 ——
   第一版拿"卦爻色环"当判据于是红了一条**其实没问题**的项。判据要取"看得见的那些"。

### 判据（本轮实测）

| 门 | 分数 | 说明 |
|---|---|---|
| `node examples/apps/zhouyi-reader/device_check.mjs` | **14 / 14** | 真机：包与 Metro 同一份 / 首屏罗盘 / 画布几何 / 拖拽不崩 / 轻点外环进卦 / 输入通道 / 无原生崩溃 |
| `node examples/apps/zhouyi-reader/verify.mjs` | **24 / 24** | 真 Chrome（改了平台分支之后**重跑**，没回归） |
| APK | ✅ `BUILD SUCCESSFUL in 7m 23s` | 含 Skia 的 C++（x86_64），76 MB debug 包，装机启动成功 |
| `device_check.mjs` | **17 / 17** | 含「同一点、转过之后命中另一卦」（修掉库侧那个起点参照系的 bug 之后转绿）|
| 改 `gesture-rn.js` 之后按规矩跑的另外两道 | web 试金石 **40 / 40** · `verify_all.sh` **21 / 21** | 见 CONTRIBUTING §1 |

---

## 补记（补齐第三条画布后端：**SVG**，桌面那条路先在本机验掉，2026-10-02 四续）

桌面端（react-native-windows）卡在工具链上（VS 2026 + SDK 22621，见 `DESIGN-DESKTOP-RNW.md`），
但**它的画布路径不必等工具链** —— 因为那条路是 `react-native-svg`，而它**同时支持 web**。
所以这一轮把第三条后端写出来、并在真浏览器里验掉：**`npm/moobile-host/canvas-svg.js`**。

### 三条后端的分工（一张表，别混）

| 后端 | 平台 | 为什么不能兼 |
|---|---|---|
| `canvas-skia.js` | android / iOS | `@shopify/react-native-skia` **没有 Windows 后端**（`npm pack` 后 `package/windows/` 0 个文件）|
| `canvas-web.js` | web | 用 DOM 的 `CanvasRenderingContext2D`，**RN 里没有** |
| **`canvas-svg.js`（新）** | **web / windows** | —— 它是**桌面唯一现成的矢量通道**（`react-native-svg` 的 tarball 里有 153 个 windows 文件，含 Fabric 实现）|

它不是"自己实现渲染"（DESIGN 原则 1）：`canvas-ops.js` 已经把指令翻成一棵**中立元素树**
（`Path`/`Rect`/`Text`，与 Skia 那条通道共用），新文件只把那棵树映射到 react-native-svg 上 ——
**翻译**，不是渲染器。

### 判据（本机实测）

| 门 | 结果 |
|---|---|
| 真 Chrome，**SVG 后端**（`EXPO_PUBLIC_CANVAS=svg`） | **24 / 24** —— 罗盘渲染出 **758 个矢量元素**、拖拽后画面变、轻点外环进卦 |
| 真 Chrome，**DOM 后端**（默认） | **24 / 24**（没有回归） |
| 真机 Android（Skia 后端） | **18 / 18** |

⇒ "桌面端的画布"这一块**已经是实现 + 验过的状态**，剩下的桌面缺口只有：宿主工程 + VS 工具链。

### 三个坑（都写在这儿，免得重踩）

1. **变换的形状要从真源看，别照脑子里的写。** 我第一版把 op 层的变换写成
   `{type:'translate'}`，而 `canvas-ops.js` 用的是 **React Native 的样式变换形状**
   （`{translateX, translateY}` / `{rotate: 弧度}` / `{scaleX, scaleY}`）——
   跑起来报 `不认识的变换 undefined`（每个元素都带一个 `undefined` 项）。
   另外：canvas 的 `rotate` 是**弧度**、SVG 的 `rotate()` 是**度**，这一处必须换，否则画面静默转错。
2. **判据只认一种后端 = 判据在测自己。** `verify.mjs` 原先写死 `querySelector('canvas')`
   并用 `toDataURL()` 判"画了东西 / 画面变了" —— 换成 SVG 后端时**四条断言一起红**，
   而红的是判据不是被测物。改成：选择器 `canvas, svg`；canvas 读**像素**、svg 数**元素**；
   "画面变了"用**字符串哈希**（旋转只改数字，`outerHTML` 的**长度**可能一点不变）。
3. **判据的顺序会互相污染。** "轻点外环"与"拖拽"两条原本是"先拖后点"，某些后端下
   后一次轻点会被当成上一次拖动的**延续**（responder 还没交出去）→ "点了没反应"。
   拆开、各自从干净状态开始之后就对了；而"点完之后要去详情页、拖拽要在列表页"这件事
   也得显式回位（回位那一步没做时，取画布矩形直接拿到 `null` 崩掉）。

---

## 补记（桌面宿主落地：**"同一份产物进第三个宿主"从论断变成判据**，2026-10-02 五续）

`examples/apps/zhouyi-reader-desktop/` —— 裸 RN + `react-native-windows@0.83.2` 的 Windows 宿主，
**应用侧一行未改**（`App.js` 只是把同一份 `moobile.js` 交给宿主）。

### 判据：**不必等 VS 工具链**（`node verify.mjs`，5 项）

| 判据 | 结果 |
|---|---|
| 应用产物 `moobile.js` 在 | ✅ 3262 KB |
| `react-native bundle --platform windows` 退出码 0 | ✅ 34.6 s |
| 产物生成 | ✅ **8.80 MB** |
| 产物里有**这个应用**的真串 | ✅ `御纂周易折中` |
| 产物里有宿主接线（`mountApp` + `registerSvgCanvas`） | ✅ |

它验的是"**能不能把界面打进第三个宿主**"（Metro 解析 + RNW 平台插件 + `AppRegistry` 入口 +
跨工程 `watchFolders`），而**不是**"桌面窗口能起来"（那要 VS 2026 + SDK 22621）。

⚠️ **比对串不能从产物里随便取**：第一版取到的是**库自己的报错文案**
（`宿主给对象或给字`）—— 那种串换一个应用也照样在产物里，判据就瞎了。
现在取的是**应用源码（`main.mbt` 等）与产物里都有**的串，才说明"这份产物是**这个应用**编的"。

### 三个坑（两个是 PATH 写法，都极具误导性）

1. **`spawnSync npx.cmd` 在 Windows 上直接 `EINVAL`** —— 必须 `shell: true`。
   报错只有一句 `spawnSync npx.cmd EINVAL`，看着像"命令不存在"。
2. **`pwsh.exe` 不在 PATH 上时，RNW 报的是"平台不存在"**：
   `error: Invalid platform "windows" selected. Available platforms are: "ios", "android", "native"`。
   真因链：RNW 的 CLI 加载 `react-native.config.js` 时要 require
   `@react-native-windows/find-dotnet-tools` → 它用 `where pwsh.exe` 找 pwsh →
   找不到就**抛错**，而 RN CLI **静默吞掉**这个错误 → 平台表里就没有 windows。
3. **PATH 项的写法在两个位置要求相反**（这条最费时间）：
   · 从 **bash** 里传：要 MSYS 形式（`/c/Users/...`），写 `C:\Users\...` 反而找不到；
   · 在 **node** 里拼：要 Windows 形式（`C:/Users/...`，正斜杠即可），写 `/c/...` 找不到
     —— 因为 `where.exe` 是原生程序，而 node **不做** MSYS 转换（它看到的 PATH 本来就是 `C:\...;D:\...`）。
   两种写错时的报错**是同一句** `Unable to find pwsh.exe. It should have been made available by \`yarn install\``
   —— **把人往"要装 yarn"上带**，而根治办法只是把那一项写成对的形状。

   用法见 `examples/apps/zhouyi-reader-desktop/verify.mjs` 的 `windowsAppsDir()`。

---

## 补记（`--host rnw`：**「换宿主不改应用」第一次有了硬判据**，2026-10-02 六续）

脚手架现在有第二个宿主：`moobile-host init <目录> --host rnw` 生成 **Windows 桌面宿主**
（裸 RN + RNW）。宿主表在 `lib/hosts.js`，宿主文件集在 `hosts/rnw/`。

### 判据（`node tools/desktop_host_probe.mjs`，20 项，**离线**、进 `verify_all.sh`）

> ⚠️ 这个文件在 2026-10-02 晚**改名成 `tools/host_probe.mjs`** 并扩成三宿主矩阵（32 项）——
> 本节记的是它当时（只有 expo / rnw 两个宿主）那一版的读数，读的时候别去找旧文件。

它守的是 SCAFFOLD §3.3 那句承诺的**可执行形式**：

| 断言 | 说明 |
|---|---|
| `moon.mod` / `moon.pkg` / `app.mbt` 两个宿主下**逐字节相同** | ★ 这才是「换宿主、不改应用」。只断言「文件生成了」说明不了这件事 |
| expo 档有 `expo` 没 `react-native-windows`；rnw 档反之 | 两边的宿主确实换了 |
| rnw 档 `@react-native-windows/find-dotnet-tools` 在 **dependencies** | RNW 0.83.2 漏声明它；放 dev 会被 `npm install` 剪掉 |
| rnw 档 RN 0.83.x + RNW 0.83.2 | **RN 版本由宿主钉**，不是拍脑袋写的 |
| 入口用 `AppRegistry`（不是 `registerRootComponent`）、metro 用 `@react-native/metro-config`（不是 `expo/metro-config`） | 混了就是「看起来能跑」 |
| 生成了 `.gitignore`，里面有 `windows/` 与 `moobile.js` | 见下面第二坑 |
| **`--host desktop`（不认识的别名）必须非零退出并列出可选值** | 证伪：拼错参数不能静默降级成 expo |

### 两个坑

1. **`npm pack` 永远不打 `.gitignore`** —— 连「单独列进 `files` 白名单」也不行。
   （旧结论里只写了「列了 `template/.gitignore` 就可以」；那一条对**模板**成立，对**新加的目录**不成立：
   实测 `hosts/rnw/.gitignore` 列进 `files` 之后，`npm pack --dry-run` 里依然没有它。）
   ⇒ 宿主文件集里那份真源改叫 **`gitignore`（无点）**，由 `lib/init.js` 写盘时映射成 `.gitignore`。
   这样连「`npm install` 把 `.gitignore` 改名成 `.npmignore`」那条老坑也一并绕开了。
2. **判据别 grep 全文**。「入口不能用 Expo」这条第一版写的是 `!/expo/.test(index.js)` ——
   而我在那份 `index.js` 的注释里**正大光明地写了「不用 Expo」**，于是假红两条。
   改成只认 `import`/`require` 那一行（`!/from\s+['"]expo['"]/`）。

### 顺带

- `create --from-rabbita` 也支持 `--host` 了：`create … --host rnw` 直接把迁移产物生成成桌面工程。
- `--host` 不认的值**当场报错**（`不认识的 --host desktop。可选的：expo · rnw`）——
  别名会让文档漂（两个名字指同一个东西，写两遍就会有人按错的那个去查文档）。

## 补记（折叠区块与两个"只在真机上现形"的洞，2026-10-02 七续）

这一轮把 zhouyi-reader 的 S6 收尾做完（`<details>` 三块折叠 → 受控折叠），
顺手逮到**两个机械迁移移不过来、而 web 判据永远看不见**的东西。
三件事都记在这儿：判据怎么写、坑在哪、真因是什么。

### 一、`<details>/<summary>` 迁不动 —— 但"悄悄不渲染"比报错更坏

`details` / `summary` 在 moobile 的标签表里是**明确排除**的（`render.mbt` 的
`excluded_tags()`：RN 没有那个开关语义）。机械迁移能做的只有"改名/注释掉"，
于是页面上少三块内容 —— 而**少了内容页面照样"正常"**（首屏、搜索、点卦全都不受影响）。

所以判据不能是"元素在不在"，得是**行为**，而且必须包含**收回去**那一步：

| 断言 | 为什么这一条 |
|---|---|
| 标题按钮**常显**，正文**不在树上** | 区分"默认折叠"与"整块丢了" |
| 真鼠标点标题 → 正文里那句**具体的话**出现（`元者，善之长也`） | 判据取正文的**具体句子**，不取"节点多了几个" |
| 箭头 `▸` → `▾` | 顺带证明状态在 Model 里（不是 DOM 自己的） |
| **再点一次 → 那句又不在树上** | ★ 只断言"点开出现了"会漏掉**半受控**（`<details>` 自带状态，写成"能开不能收"照样过前三条） |

实现上三块折叠进 Model（`open_more : Array[Bool]`）+ `ToggleMore(Int)`，
`more_section(title, i, open_more, emit, body)` 生成"按钮 + 条件渲染"。

**证伪**（判据自己能不能红）：把 `more_section` 里的 `if open` 改成 `if true`（永远展开）
→ 6 条红，且红的正好是"默认折叠"与"再点一次收起"那六条；改回来 **45 / 45**。
判据是能分辨的，不是恒真。

### 二、坑：判据别写死 `parentElement`

"箭头"那条第一版读 `el.parentElement.textContent`，三条箭头断言全红 ——
**红的是判据**：标题与 `▸/▾` 是同一行里的两个 span，中间隔着宿主生成的一层
（web 上 `button` → `Pressable` 会多包一层 `<div>`）。
改成**沿祖先链往上找第一个含箭头的文本**（最多 4 层）才稳。

### 三、坑：写 JS 模板字符串时，注释里的反引号会把模板**提前闭合**

`evaluate(\`…\`)` 里那段注释我写了 `` `▸/▾` ``，于是 node 报
`SyntaxError: missing ) after argument list`（指向的是**几行之后**的行）——
真因是模板在注释中间就结束了。**模板字符串里不要出现反引号**（要写就写 `▸/▾`）。

### 四、★★ 生成物自查：两条"web 上永远看不见"的洞（库侧已补判据）

Android 上第一次跑折叠判据时，界面**滚不动**：滚 30 次、`uiautomator dump` 逐字节相同。
追下去是两个**各自独立**的问题，两个都只在原生上现形：

| 洞 | 真因 | 为什么 web 判据看不见 |
|---|---|---|
| **`page()` 没人挂** | CSS 里 `body`/`html` 的声明被样式转换器抽成了独立的 `page()`（`style-emit.js` 的 `__page__` 组），**但生成物的根容器是裸的** —— 底色 / 字体族 / 行高没落到任何元素上 | 浏览器自己有 `body` 样式兜着；而 web 判据里"纸色底 / 衬线族"那几条**被别的元素满足了**，于是照样绿 |
| **根上没有滚动容器** | HTML 靠 `overflow` 做**文档级滚动**，RN 的 `View` **不滚动** —— 不套 `ScrollView`（moobile 的 `"scroll"` 伪标签），真机上过了第一屏就**再也够不着** | DOM 自己会滚。同一个页面在 web 判据里 **45 / 45**，Android 上却是"纹丝不动" |

修法是两层根容器：

```moonbit
div(attrs=@styles.att(@styles.page().flex(1.0)), [              // ← ① 源 CSS 的 body/html
  @html.node("scroll", @styles.att(@style.Style::new().flex(1.0)), [ …整页内容… ]),  // ← ② RN 的 ScrollView
])
```

⚠️ 根还要 `flex(1.0)`：`ScrollView` 的 `flex:1` 得有**确定的父高**才量得出视口，
父级 auto 高时它会被量成 0（RN 的 flex 语义，不是 CSS 里"`flex-grow` 在块级上下文无效"那回事）。

**收口方式（判据写进库，而不是写在指南里口口相传）**：

- `npm/moobile-host/lib/migrate/app-audit.js` —— 读生成物的 `.mbt`，报
  `page-style-unused` / `no-native-scroll` / `scroll-without-flex`（+ 目录里没有 `.mbt`）；
- `create --from-rabbita` **落盘后自动跑一遍**，收尾打印并把结果写进 `MIGRATION.md §5`
  （实测：拿仓库外的真源跑，当场报出 **2 条必须处理** —— 生成器**知道**自己移不过来，只是以前不说）；
- 离线门 `tools/migrate_app_audit.mjs`（13 项，进 `verify_all.sh` → **23 项**）：
  4 个真实应用**必须干净**、2 个例外**逐条点名**（`perf-bench` 是压测 harness，行数**刻意**撑爆视口；
  `antd-demo` 是 web 画廊 —— 记在门里，别让它偷偷绿），外加 **5 个故意做坏的样本**。

### 五、自查器自己的两个假阳性（都是"字符串不是代码"）

1. **文档注释里的假代码**：`todo-app/ui.mbt` 的注释里写着"用 `node("scroll", …)`" ——
   第一版拿**原文**扫，于是报了个不存在的 `ui.mbt:261`。
   真因是"过滤器用了去注释文本、行扫描却用了原文"，两边不是同一份。
2. **组件属性名也叫 `scroll`**：`antd-demo` 的 `opt_json(a, "scroll", scroll)` 被当成了滚动容器。
   ⇒ 判据只认**伪标签的用法** `node("scroll"`，不认裸串。

两条都补进了证伪样本（③ 与 ⑤）—— **"永远返回空数组"的检查器能让所有真实应用都绿**，
所以坏样本是这条门的必需品。

### 六、真机判据的两个坑（uiautomator 与软键盘）

1. **`uiautomator` 只 dump 可见节点** —— 展开折叠区块后新插进来的正文落在屏幕**下面**，
   不滚过去它根本不在 dump 里。第一版直接数"标题下面有几条长文本"，展开前后都是 1
   （折叠本身是对的：箭头 `▸→▾` 当场就变了）。改法是**边滚边收成集合**，再做**差集**：
   展开后"比折叠态多出的长文本"必须有 ≥2 条（实测 **14** 条），收起后多出的必须是 **0** 条。
2. **软键盘会改布局**：上一段在搜索框里打过字，键盘还占着下半屏，而画布几何是**开头量的**
   —— 拿旧坐标点罗盘会落到画布外，表现是"折叠标题找不到"，真因在**夹具的坐标**。
   改法：点之前先 `keyevent 111`（ESC 收键盘）+ **重新量**画布几何 + 不行就重试（3 次）。

另外顺手修了两处**判据太脆**的地方（都不是被测物的问题）：
`adb exec-out screencap` 回陈旧帧 → "画面变了"那条改成**连截 3 次**；
`verify_all.sh` 的标签里写了反引号 → bash 命令替换（每跑一次都执行一条叫 `--host` 的命令）。

### 判据（本轮实测）

| 门 | 结果 |
|---|---|
| `node examples/apps/zhouyi-reader/verify.mjs`（真 Chrome） | **45 / 45**（新增 21 条折叠断言）；证伪轮 **39 / 45**，红的正好是那 6 条 |
| `node examples/apps/zhouyi-reader/device_check.mjs`（模拟器 emulator-5554） | **27 / 27**（新增 9 条折叠断言；滚动修好之前夹具红、修好后绿） |
| `node tools/migrate_app_audit.mjs`（离线） | **13 / 13**（4 真实应用干净 + 2 例外点名 + 5 坏样本 + 1「没有 .mbt」） |
| `bash tools/verify_all.sh` | **23 / 23**（新增第 23 条） |

## 补记（F1 补上 `click.on-view`：把"手工数出来的 5 处"变成报告里的一条，2026-10-02 八续）

### 一、这条规则是什么，为什么它当年不在 F1 里

`render.mbt:243`：`on_click` 在 moobile 里映射成 RN 的 **`onPress`**，而标签表里
**只有 `button` / `a` 落到 `Pressable`**；`div` / `span` / `p` 落到 `View` / `Text`，
那两个组件**没有 `onPress` 这个 prop** —— 点击被**丢掉**：不报错、不警告、`moon check` 全绿。

实测（`interest/yi`）：**5 处** `div(… on_click=…)` —— 卦卡点不动、折叠点不开。
当年它们是在**迁移装配器**里被一个临时函数（`create.js` 的 `detectClickOnView`）找出来的，
**F1 动检报告里没有这一条**：于是"先跑一次动检看看会静默失效什么"的人**看不到它**，
只有走到 `create` 那一步（并且读 §4 的 TODO）才会撞见。

它进不了 `RULES` 的原因很具体：`RULES` 的契约是**按行子串匹配**，
而这一条要的是"标签 + 事件"两个 token 的**结构关系**（同一次调用里）——
`div(… on_click=…)` 与 `button(… on_click=…)` 逐字看没有区别。所以它是 F1 里的
**第二条结构规则**（第一条是"标签分类要查真源两张表"，也不是子串）。

### 二、实现只有一份（JS 侧），MoonBit 侧照抄 —— 两处都改了

| 位置 | 角色 |
|---|---|
| `npm/moobile-host/lib/migrate/click-on-view.js` | **唯一实现**（JS）：`scanClickOnView(text)` |
| `npm/moobile-host/lib/migrate/scan.js` | F1 报告里报 `click.on-view`（插在 14 条规则**之后**、标签分类**之前**） |
| `npm/moobile-host/lib/migrate/create.js` | 只 `require` 那一份（原来自己数了一遍，已删）—— 生成 §4 的 TODO 条目 |
| `tools/mbtools/src/migrate_scan.mbt` | MoonBit 真源里的同构实现（`scan_click_on_view`） |

**算法**（两侧逐字同构，别"顺手优化"）：找到 `on_click` → 要求后面（跳过空白）是 `=` →
往回用括号配对找到**包着它的那次调用**的左括号 → 读左括号紧前面的标识符当标签名
（`div(` / `@html.div(` / `div (` 都读成 `div`）→ 不是 `button` / `a` 就记一条，
行号取 `on_click` 那一行。

⚠️ **口径与那 14 条规则一致：扫原始文本，注释里的代码同样算命中。**
这是**刻意的**（兄弟规则也是这样：`needle: 'class='` 在注释里一样命中）——
假阳性（注释）比假阴性（漏掉一个真的点不动的块）代价小得多，
而"逐字抄一份更聪明的实现"会让对账门变成在比谁的注释处理更花哨。

### 三、判据：诱饵 + 真项目 + 两侧对账，三件都要

`node tools/migrate_click_scan.mjs`（**13 项**，进 `verify_all.sh` → **24 项**）：

- **诱饵项目**（临时目录里现造，期望值写死）：`div` ✓ / 跨行的 `@html.div(` ✓ /
  `div (`（标签与括号间有空格）✓ / `span` ✓ / **注释里的那行也算** ✓；
  负例：`button` ✗ / `a` ✗ / `on_clicked(1)` ✗；另有一份 `.mbt.bak` 确认规则只在 `.mbt` 上生效。
- **两侧逐 hit 一致**：`file:line` 与 `text`（含 why/next）都比。
- **真项目读数**：`yi/zhouyi_reader` 命中 **5 处**，且都在 `frontend/main.mbt`
  （`484 / 1269 / 1372 / 1400 / 1463`）—— 与当年**手工数出来的 5 处**一致。

**已证伪（两个方向都试了）**：
- 只改 JS：把 `span` 塞进 `PRESSABLE_TAGS` → **9 / 13**（诱饵少一条 + 两侧 count 4 vs 5，红 4 条）；
- 只改 MoonBit：在真源里把 `span` 当会响的 → **11 / 13**（两侧 count 5 vs 4，红 2 条）。
⇒ 这条门两个方向都盯着，不是"只比一边"。

### 四、对账门的读数变化

`node tools/migrate_scan_reconcile.mjs`：**18 类 / 357 条命中** → **19 类 / 362 条**
（新增 `click.on-view` 5 条），两侧**逐 finding 逐 hit** 仍然一致
（第 15 行，插在 `canvas.api` 与 `tag.excluded` 之间 —— `finding` 顺序参与对账）。

### 五、顺带修掉的一处"两个真源"

`create.js` 里那份 `detectClickOnView` 与 F1 要报的是**同一件事**，两处各写一遍 =
一个必然的漂移点（`migrate_scan_reconcile.mjs` 的文件头记着"副本 ≠ 源码"那次事故）。
现在实现搬到 `click-on-view.js`，`scan.js` 与 `create.js` 共用一份；
`create.js` 的文件头那段"为什么 F1 抓不到、所以在 create 里做"的说明也一并改成了现状。

## 补记（第三个宿主：**零 Expo、零 Metro 的静态 Web**，2026-10-02 九续）

### 一、这一轮补的是哪一块

SCAFFOLD §3.3 承诺"支持一个新平台 = **换一个宿主**，不是改库"，宿主表里一直挂着
`--host webview`（PWA / Tauri / Electron 的底座）却没落地。本轮把它做出来，
判据分两层（与桌面那条同构）：

| 层 | 判据 | 结果 |
|---|---|---|
| **生成器**（离线） | `node tools/host_probe.mjs` | **32 / 32** —— 三个宿主（expo / rnw / webview）的应用侧 `moon.mod`/`moon.pkg`/`app.mbt` **逐字节相同**，宿主文件确实换了 |
| **真跑**（要 Chrome + 依赖） | `node examples/apps/zhouyi-reader-webview/verify.mjs` | **15 / 15** —— 其中第 3 层是**把应用自己那 45 条界面判据原样指向静态宿主的 URL**，报 **45 / 0** |

> ★ 第二层那句话是这一轮最有力的一句证据：**同一份 MoonBit 产物 + 同一套 45 条界面判据，
> 换一个宿主（连 Metro 都没有）照样全过**。而它不是重写一遍断言 —— 是 `spawn` 那个脚本、
> 读它的汇总行（用户会跑的也是它）。

顺带把 `tools/desktop_host_probe.mjs` **改名成 `tools/host_probe.mjs`**：它现在守的是
**整张宿主矩阵**（三个宿主），留着旧名会让"这条门守什么"变成猜的。

### 二、★ 一个 8 分钟没输出的教训：`spawnSync` 会**堵死自己进程里的服务**

第一版 `verify.mjs` 用 `spawnSync` 调应用的判据脚本。结果：**8 分钟没输出**，
页面在 Chrome 里停在 `about:blank`，而**单独在前台跑同一条命令 3 分钟就 45/45**。

真因：**静态服务就跑在父进程里**，而 `spawnSync` 是**同步**的 —— 它阻塞事件循环，
父进程的 HTTP server 无法响应请求 ⇒ Chrome 拿不到 6 MB 的 bundle ⇒ 子进程里的页面永远
渲染不出来。表现极具误导性（"这条门只是很慢"），因为**没有任何一处报错**。

修法：换成异步 `spawn` + `await`（`Promise` 包一层，带 10 分钟硬超时）。
⇒ **规则**：只要本进程还担着"服务/回调"的角色，就用异步 `spawn`；`spawnSync` 只适合
"父进程在这段时间里确实什么也不用干"的场合。

### 三、同一类假红第三次出现：**判据别 grep 全文，注释里会写**

宿主矩阵探针加进 webview 后，三条新判据当场假红，全是同一个病：

| 假红 | 真因 |
|---|---|
| "依赖表里没有 `react-native`" | 用了**前缀**正则 `/^react-native/` → 把 `react-native-web` 也命中（而它正是这个宿主要用的） |
| "入口不 import expo" | `index.js` 的**注释里**正大光明地写着 `import { registerRootComponent } from 'expo';`（对照说明） |
| "不给静态宿主引 react-native-svg" | `App.js` 的注释里写着"别引 `react-native-svg`，会撞 peer 冲突" |

这在本仓库是**第三次**（第一次：rnw 的 `index.js` 注释里写"不用 Expo"；第二次：`app-audit`
扫到 `todo-app` 注释里的 `node("scroll", …)`）。所以这轮把规矩写进代码：
探针里加了一个 **`code()` 助手（只留代码行，去掉 `//` 之后的注释）**，新判据一律过它。
⇒ **规则**：断言只认**代码行**；包名比较用**确切名字**，不用前缀。

### 四、宿主文件集只**覆盖**、删不掉：`drop` 是补上的那一半

`init` 的模板本身就是 Expo 宿主，宿主文件集只会**覆盖同名文件** —— 于是第一次
`init --host webview` 生成出来的工程里**留着 `app.json` 与 `metro.config.js`**（Expo 的配置）。
它们不参与构建（依赖表里没有 expo），但用户看见它们会以为"还得装 Expo"。

修法：宿主描述符加 `drop: [...]`（`lib/hosts.js` 里 webview 声明丢那两份），`init`
在合并之后删掉。判据两条一起立：**webview 档没有那两份**，而 **expo / rnw 档仍然有**
（drop 不许溢出到别的宿主）。
**已证伪**：把 `drop` 那行删掉 → 探针 **31 / 32**，红的正是这一条。

### 五、两个小坑（都写进了注释）

1. **`react-native-svg` 会把 `react-native` 本体拖进来**：静态宿主里 `react@19.2.0` 与它
   要的 RN 0.87.1（peer `react ^19.2.3`）撞 ERESOLVE。所以这个宿主**只注册 DOM 2D**
   画布后端 —— 它本来也用不到 SVG 那条（那是桌面宿主的通道）。
2. **`init` 的收尾提示要跟着宿主走**：原来只有 expo / rnw 两档，webview 用户会照着一句
   `npm run web` 去敲 —— 而那个脚本在静态宿主里根本不存在。现在按宿主给三句。

### 六、对账与门

| 门 | 结果 |
|---|---|
| `node tools/host_probe.mjs`（**改名**，离线，进 `verify_all.sh`） | **32 / 32**（原 20 项 + webview 档 12 项）；证伪：删 `drop` → 31/32 |
| `node examples/apps/zhouyi-reader-webview/verify.mjs`（要 Chrome + 依赖，手动跑） | **15 / 15**（含"应用那 45 条判据在静态宿主上全过"） |
| `bash tools/verify_all.sh` | **24 / 24**（第 21 条从"桌面宿主生成器"变成"宿主矩阵生成器"，项数 20 → 32） |
| `node tools/package_check.mjs` | 见下面那条（新宿主文件集要随包发出去：`files` 里 `hosts/` 已覆盖，实测 tarball 里有 `hosts/webview/`） |

### 七、★ 模板**生成出来的**工程端到端跑过（不只是手写示例）

上面那条 15/15 跑的是 `examples/apps/zhouyi-reader-webview/` —— 那份宿主是**手写的**。
而"用户拿到的是**生成物**"（SCAFFOLD §3.4：模板是唯一真源），所以还得拿**模板生成**的工程再撞一次：

```
init --host webview  →  把 moobile-host 换成本地 file:  →  npm install（30 个包，无 expo/metro）
  →  把真应用的 moobile.js 放进去  →  node build-web.mjs（模板自带）  →  node serve-web.mjs
  →  应用自己的 45 条判据打这个 URL
```

实测（2026-10-02）：`dist/bundle.js 6239 KB`、静态服务 HTTP 200、**通过 45 失败 0**。
⇒ "模板生成的 webview 工程能承载真应用"**是判据，不是推理**；手写示例与模板**没有漂开**。

⚠️ 这条链**没有**进 `verify_all.sh`（要 Chrome + 装依赖），与 `host-swap-spike` 同一档：
手动跑、脚本在 FINDINGS 这一段里（一条 20 行的 bash）。

### 八、两个"只有真装一遍才看得见"的坑

1. **`moobile-host@^0.4.0` 还没发布** ⇒ **生成出来的工程 `npm install` 直接失败**
   （`ETARGET: No matching version found for moobile-host@^0.4.0`）。
   这不是本轮引入的：工作区已经是 `0.4.0`，而 registry 上还是 `0.3.0`（见 STATUS §1）。
   绕法（仓库里的探针一直是这么干的）：把生成的 `package.json` 里那条依赖改成本地
   `file:` 路径再装。**对真实用户**的含义很直接：**发版之前，生成物装不上** —— 这条本来就写在
   §1 的"已发布 vs 工作区"里，这里只是又一次撞上它。
2. **Windows 上 `file:` 依赖的路径写法**：写 `file:/d/ai_project/...`（MSYS 风格）会被 npm
   解析成 **`C:\d\ai_project\...`**（它把 `/d/` 当成当前盘下的目录），报
   `ENOENT … C:\d\ai_project\…\package.json`。要写 **`file:D:/ai_project/...`**。
   （仓库里那些 `file:../../../npm/moobile-host` 是相对的，所以一直没暴露这个坑。）

## 补记（第十轮：把"没判据的功能"逐个补上判据 —— 顺手逮到三个真缺陷，2026-10-02 十续）

### 一、起因：详情页有**六个折叠族 + 三个状态族**一条判据都没有

前九轮的 web 判据（45 项）只覆盖了底部三块折叠（`more_view`）。而同一个详情页里，
**卦辞 / 大象 / 彖辞逐句 / 爻辞 / 小象**这五个折叠族，以及**变爻标记 / 错综互预览 / 上下卦导航**
这三个状态族，从没被断言过 —— 而它们**全都动过**（`on_click` 挂错标签会静默失效、
`<details>` 换成受控、样式重挂）。**没有判据的迁移 = 靠运气**，这一轮就是来收这笔账的。

补完之后 `verify.mjs` 从 **45 → 81 项**，而**其中三条一开始就是红的** —— 三个都是真缺陷：

### 二、★ 缺陷一：爻线**根本不存在**（`class=` 动态拼 + RN 默认方向）

`yao_view` 里那根"爻线"原来是 `button(class=line_cls, …)`，而 `line_cls` 是**运行时拼**的
（`"m-yao-line yang" + bian/hl`）。迁移报告把它标成了 `dynamic-class` TODO（"动态 class 只能靠人工"），
**一直没做**。后果不是"样式差一点"：

- `class=` 在 moobile 里**静默失效** ⇒ 那根线没有任何尺寸；
- 它的内容只有 ○/× 标记（不选变爻时是空的）⇒ 它的盒子是 **0×0**；
- ⇒ **变爻标记在 web 与真机上都点不到**（实测：`elementsFromPoint` 在那个点上拿不到它，
  点完 ○ 的个数 1 → 1）。

修的时候还撞到第二层：RN 的**默认 flex 方向是 `column`**（CSS 是 `row`），而原 `.m-yao` 是
网格 `160px 1fr` —— 转换器只留下了 `gap` 与 `align-items`，没写方向 ⇒ 爻线与文本**竖着堆**，
而我第一版给爻线只写了 `flex:1`（没给宽度）⇒ 在 column 容器里**量成 0×0**。
两处一起修：行容器显式 `flex_direction(Row)`，爻线给**确定宽高**（160×32，原网格列宽与 `.m-yao-line` 的高度）。

⇒ 现在判据是"**点爻线 → 页面上 ○ 的个数 +1**，且「变卦」按钮出现，点了它跳到 111110=夬"。

### 三、★★ 缺陷二：侧栏的 sticky 退化成相对定位，**压住了下一栏 70px**

`大象` 那一行点不开。量了几何才看清真因（**先按"少媒体查询"猜了一轮，猜错了**）：

| 量到的东西 | 值 |
|---|---|
| 布局容器 | `(112,121,519,1054)`，样式 `gap: 44px; align-items: flex-start;` —— **没有方向** ⇒ RN 默认 **column** |
| 第一个子元素（侧栏） | 布局盒 `y=121..372`，但它**画**在 `y=191` —— 差 **正好 70px** |
| 第二个子元素（正文栏） | `y=416` 起 |

`y=191` 那个 70 从哪来？`.m-side { position: sticky; top: 70px }` —— **sticky 在 RN 里没有对应物，
转换器留下了 `top: 70px`**，于是它变成 `position: relative; top: 70`：**相对定位只挪画的位置、
不占布局位置** ⇒ 侧栏整体下移 70px，**压在正文栏上**；正文栏在后面 ⇒ 画在上面 ⇒
**大象那一行的点击落到了正文栏那句提示上**（`elementsFromPoint` 的头两个就是那句提示的 span/div）。

修法：① 侧栏不再用 `aside_m_side()`（那个样式只剩下退化的 `top`），改用**网格列宽本身**（`width: 250px; flex-shrink: 0`）；
② 布局容器显式 `flex_direction(Row)`。

### 四、★ 缺陷三：媒体查询那个断点，**用"换行 + 最小宽度"表达**（而不是去读窗口宽度）

原 CSS 有 `@media (max-width: 760px) { .m-layout { grid-template-columns: 1fr } }`，
迁移报告写着"RN 没有媒体查询，断点要在 **Model 里按窗口宽度**表达"——
**但那条路走不通**：`model.vp_w` 来自 `@sub.on_resize`，而它**刻意不补发初始值**
（"与 DOM 一致"），不转屏 / 不拖窗口**恒为 0**。

所以断点改成**结构性**表达：两栏 + `flex_wrap: Wrap` + 右栏 `min_width(320)`
⇒ 放得下就并排、放不下自动换行成单栏 —— **不需要知道窗口多宽**（在原生上尤其重要，
手机不转屏时 `vp_w` 就是 0）。效果与原断点几乎同一条线（757px 换行 vs 原来的 760px）。

> 📌 **库侧的缺口**（这轮没做，写在这儿）：`@sub.on_resize` 只有订阅、**没有"读当前视口"** ——
> 应用想按窗口宽度做任何判断都做不到（罗盘画布当时就是靠一个"往小里取"的回落值绕过去的）。
> 补法：宿主能力加一个 `geometry.read()`（web 用 `window.innerWidth/innerHeight`，
> 原生用 `Dimensions.get('window')`），库侧给一个 `@sub.on_resize` 的兄弟 API。

### 五、判据自己的四个坑（都记下来，别再踩）

| 坑 | 真因 | 改法 |
|---|---|---|
| `○`/`×` 断言"页面上有没有" | 详情页那句操作提示里**本来就有**「阳→老阳 ○，阴→老阴 ×」 | 改成**数 ○ 的个数**（点一下 +1）；`×` 改成"**文本恰好等于 × 的那个节点**在不在" |
| `title` 定位元素 | **react-native-web 不把 `title` 落到 DOM**（`querySelectorAll('[title]')` 数出 **0**） | 按**形状**找（空文本 + 宽 100–260 + 高 24–40 + 有子元素） |
| "往上找祖先"找可点元素 | 会先撞上**爻辞那一行**（它不是爻线）⇒ 点击落在别处，"点了没反应"其实是**没点着** | 同上：按被点物的**形状**找，别靠"离谁近" |
| 变卦的期望值 | 判据写"六爻皆变 → 坤"，而**只点了一根爻线** ⇒ 111110 = **夬**（第 43 卦）—— **红的是判据** | 按"实际标了几个变爻"算期望 |

再加一条**夹具纪律**：这几段判据会**跳走**（变卦 → 夬、下一卦 → 坤、错综互 → 坤），
所以每段之前/之后都用 `backToQian()` 回到乾 —— 否则红出来的是"找不到错卦那一枚"，
**看起来像功能坏了**（第一版就是这样，浪费了一轮诊断）。

### 六、判据（本轮实测）

| 门 | 结果 |
|---|---|
| `node examples/apps/zhouyi-reader/verify.mjs`（真 Chrome） | **81 / 81**（45 → 81：新增 36 条 —— 5 个折叠族 × 4 条 + 变爻 6 条 + 上下卦 4 条 + 错综互 6 条） |
| ↳ 其中三条的**前后对照**（判据能不能红） | 修之前：大象注疏红、变爻 ○ 个数 1→1 红、变卦按钮不出现红；三个缺陷修完 → 全绿 |
| `node examples/apps/zhouyi-reader/device_check.mjs`（模拟器） | **26 / 26**。⚠️ 条数从 27 变成 26：删掉了一条**阈值型**判据（"折叠时标题下面长文本 ≤2 条"）—— 它在真机上实测是 **3 条**（另外两个折叠标题 + 页脚都算长文本），阈值只会随屏幕高度抖；换成**更硬的**两条："展开后才出现的那句正文"（取出样句）在展开时在、收起时不在。判据变少一条、变强一档 |
| `bash tools/verify_all.sh` | **24 / 24**（离线：这轮只改应用与文档） |

## 补记（第十一轮：补上"**读一次当前视口**"这条能力 —— 罗盘此前一直画在回落值上，2026-10-02 十一续）

### 一、症状：罗盘在 1400px 的浏览器里只有 360px 大，而且**没有任何报错**

原实现的画布边长是 CSS 算的：`min(94vw, 720px)`。迁移后这条得自己算（RN 没有 CSS），
应用写成 `canvas_side(vp_w)`，而 `vp_w` 来自 `@sub.on_resize` —— **订阅只推"变化"，
两端都不补发初始值**（DOM 的 `resize` 不在挂载时触发；RN 的 `Dimensions` 的 `change`
不转屏不触发）。于是：

| | 实得 | 应该是 |
|---|---|---|
| web（1378px 窗口） | **360**（回落值） | 720 |
| 真机 | 要等一次转屏才对 | 挂载即正确 |

360 这个数字是**当时的绕法**："哪端都不溢出的保守尺寸" —— 那不是响应式，是猜。
而它在 758px 宽的窗口里"看着还行"，所以**肉眼和判据都没抓到**（第十轮补齐判据时才暴露）。

### 二、库侧补的是什么：与 `subscribe_*` 并列的**第三种形状**

宿主能力通道原来只有两种形状：`subscribe_bool` / `subscribe_json` —— 都答"**变化**"，
没有一种答"**现在是**"。这一轮补上：

```moonbit
// cmd/host_native.mbt —— 能力对象上的 read()
pub fn HostCapability::read_json(self : HostCapability) -> String?

// sub/sub.mbt —— 应用真正调的那一句（宿主能力优先，问不到回退 DOM）
pub fn current_viewport() -> Viewport?
```

RN 宿主侧（`native-rn.js` 的 `geometry`）多了 `read()`：

```js
read() {
  const { width, height } = Dimensions.get('window');
  return { width: Math.round(width), height: Math.round(height) };
}
```

**三条设计取舍**（都在代码注释里写了理由）：

1. **不靠"挂载时补发一次 subscribe"来实现** —— 那会让两端行为不一致（DOM 的 `resize`
   也不在挂载时触发），而"补齐初始值"应该是**一句显式 API**，两端同一套语义；
2. **严格解、形状不对当场报错**（同 `subscribe_json`）：取默认值恰好复现这条通道要消灭的
   "静默给错值"；宿主**没登记** `read`（老宿主）⇒ `None` ⇒ 调用方回退，**不算错**；
3. **回退 DOM 之前先问 `host_has_dom()`** —— RN 上 `window` 存在但 `innerWidth` 是
   `undefined`，直接读会**静默给 0**（这正是当初 `on_resize` 栽过的那个坑）。

### 三、应用侧：首帧就把窗口宽度算进去，顺带把第十轮"拆掉"的窄屏档补回来

`init_app` 里读一次（不是 Cmd，也不是订阅）：

```moonbit
let vp_w = match @sub.current_viewport() {
  Some(v) => v.width.to_double()
  None => 0.0  // 拿不到就明确回落到 0：`canvas_side(0)` 那条分支有保守尺寸 + 理由
}
```

第十轮我把"窄屏档"（爻线 32→27 / 160→120）**拆掉了**，理由写得很清楚：`vp_w` 恒为 0，
拿它做判断等于永不生效。**这一轮数据源补上了，所以按原 CSS 的语义把它做回来** ——
两栏布局的 `flex_wrap` 兜底仍然留着（窗口被拖到极窄时它保证不重叠）。

### 四、判据（这一轮新增的两条，正好是那条 API 的验收）

| 断言 | 结果 |
|---|---|
| 首屏画布边长 == `min(94vw, 720)`（窗口 1378px ⇒ 720） | **实得 720**（修之前是 **360**，这条会红） |
| 窗口收窄到 400px ⇒ 边长变成 `min(94×4, 720)`=376 | **实得 376** |

外加宿主替代物门（`tools/native_rn_check.mjs`，**15 → 19 项**）：`read` 存在 / 形状取整 /
**读的是当前值**（改 stub 尺寸后再读）/ 两个形状都在（变化走 subscribe、当前值走 read）。

### 五、这一轮的"连锁账"

第十轮我在 FINDINGS 里把这条记成"库侧的缺口（这轮没做）"，这一轮把它做掉了 ——
**并且它顺带解释了两个此前只能猜的现象**：① 罗盘为什么在大窗口里那么小；
② 为什么"媒体查询的断点"当时只能改成结构性表达。
⇒ 一条能力缺口的代价往往不是一处 bug，而是**一串**只能靠绕法活着的代码。

### 六、改这条通道要跑的门（写清楚，免得下次漏）

- `bash tools/vendor_sync.sh --capture` 再 `--check`（动了 `vendor/rabbita/**` **必须**）
- `python3 tools/gen_forwarders.py`（`sub/forward.generated.mbt` 是新名字清单）
- `node tools/native_rn_check.mjs`（宿主替代物的形状）
- `node tools/cap_platform.mjs`（"哪端可用"矩阵；**它的条目按真实用到的 DOM API 点**，
  加一个自造的键会红 —— 这轮踩过一次）
- `bash tools/verify_all.sh` + 两条宿主实测（web 83 项 / 真机 26 项）
- `node examples/apps/zhouyi-reader-webview/verify.mjs`（期望条数跟着应用走：45 → 81 → **83**）

## 补记（第十二轮：罗盘面板那四族控件补上判据 —— 三条都是**判据自己的错**，2026-10-02 十二续）

### 一、这一轮补的是最后一块"没判据的交互族"

十一轮结束时，详情页那几族都判据齐全了，剩下的空白是**首页罗盘面板**：
四个模式（伏羲先天 / 后天文王·卦气 / 京房八宫 / 卦爻色环）、立竿测影、环层/顺序按钮 ——
它们各自是一份**独立的绘制逻辑**（迁移时改动最多的地方），却只有"按钮在不在"这一条弱断言。

补完：`verify.mjs` 从 **83 → 99 项**。判据形状是"**两条后果**"：
① 按钮**变成选中态**（底色变成"on"那一版）；② **画布像素真的变了**（`toDataURL` 的哈希）。
只判 ① 会漏"模型变了但没重绘"，只判 ② 会漏"点到别的按钮也碰巧刷了屏"。
另有两条收口判据：**四种模式两两不同**、**切回去是同一张图**（可逆）。

### 二、结果是：**应用是对的，判据错了三次**（都记下来）

| 判据的错 | 真因 | 改法 |
|---|---|---|
| "点「卦气」之后画布没变" | **默认模式就是「后天文王 · 卦气」** —— 原项目如此（`interest/yi/.../frontend/main.mbt:106` 的 `mode: GuaQi`），移植照搬 ✓。我点的是**已经选中的按钮**（无操作，像素当然不变） | 先把默认模式断言查实，再点**另外三个**；四个模式各取一张图比"两两不同" |
| "画布没变"（第一次跑的版本） | **画布还没重绘完就采样**：点完 500ms 读到的是上一帧/中间态。单跑探针、点完等 1.5s，四张图哈希两两不同 ⇒ 应用没问题 | 加 `canvasHashSettled()`：**连续两次读到同一个值**才算稳（判据要能分辨"没变"与"还没画完"） |
| "「卦爻色环」按钮没变成选中态（底色 none）" | **同名文本**：切到色环模式后面板标题也变成"卦爻色环"，而"取第一个匹配"取到了那个 `h2`（它没有背景色） | 在所有同名候选里**挑能解析出背景色的那个**（按钮才有） |

> 这一轮**没动一行应用代码** —— 三处红全是判据的错。这本身是个有用的结论：
> **判据红 ≠ 被测物坏**；动手改应用之前先做一次"这条红能不能用一句命令解释成判据自己的问题"的自检
> （前十一轮里"红的是判据"已经出现过七八次了）。

### 三、真机侧也补了（用与 web **同构但不同手法**的判据）

真机读不到画布像素（Skia 原生绘制），所以两侧判据**注定不一样**，但可以同构：
- web：`toDataURL` 哈希变化；
- 真机：**截屏指纹**变化 + **切回去要求指纹复原**（只判"变了"会把"点任意按钮都乱刷一屏"也算过）。

判据（`device_check.mjs`，26 → **29 项**）：点「京房八宫」→ 画面变了（Skia 那条路径也跟着模式走）、
切回「后天文王 · 卦气」→ 画面**复原**。⚠️ 这一条与截屏那条一样要**重试**（`screencap` 会回陈旧帧）。

### 四、顺带核到的一件事：迁移报告的 TODO 清单**已经过期**

`MIGRATION.md` §4 还挂着 26 项"必须人工处理"，而实际状态是：

| 报告里的类别 | 条数 | 现在 |
|---|---|---|
| `class=line_cls`（动态类名） | 1 | ✅ 第十轮修（爻线重写） |
| `class="m-yaos"` / `m-detail` / `rl-name` / `rl-label`（上下文键对不上） | 4 | ✅ 都是**状态标记**，本来就不该有样式（源码 CSS 里查无此规则）—— 已在代码注释里写明 |
| `more_view` / `draw_bagua_cmd` / `bagua_view`（保底桩） | 3 | ✅ 都重写完了（`more_view` 十轮、罗盘十一轮） |
| `@dom` 直连的整块注释 | 13 | ✅ 全部重写/删除（`grep @dom` 现在 **0 命中**） |
| 入口/using/import 改写（自动完成） | 5 | ✅ 无需动作 |

⇒ **报告是产物，产物会过期**。它记的是"迁移那天工具搬不动什么"，而应用在这之后被人改了很多；
判据（`verify.mjs` 99 项 + `device_check.mjs` 29 项 + `migrate_app_audit`）才是**当前状态**的来源。
下次再有人问"这个应用还差什么"，先看判据与 README 的诚实清单，别直接读 §4。

## 补记（第十三轮：**桌面端真的起了窗口** —— Electron 宿主，本机不需要 VS 工具链，2026-10-02 十三续）

### 一、这一轮补的是目标里最后一个"没有真机实测"的端

前三端的状态是：web ✅ 真 Chrome、Android ✅ 模拟器、**桌面** ⚠️ 只到"能把界面打进 RNW 的 bundle"
（`#host rnw` 要 **VS 2026 + SDK 22621**，本机没有）。而目标写的是
"**在对应宿主上实测**" —— 桌面这一格一直空着。

这一轮用 **Electron** 把它填上了：`examples/apps/zhouyi-reader-electron/`，**一个真窗口**，
里面装的就是静态 Web 那份产物（`build.mjs` 与 `../zhouyi-reader-webview/build.mjs` 同一条流水线）。

> **两条桌面路线不是二选一**，它们答的问题不同：
> · `--host rnw`（裸 RN + RNW）答"**同一份产物能不能进 React Native 的原生宿主**"（要 VS 工具链）；
> · **Electron** 答"**桌面端能不能真的跑起来给人用**"（本机就能验）。
> 判据分别在 `examples/apps/zhouyi-reader-desktop/verify.mjs`（5 项）与本轮新增的
> `examples/apps/zhouyi-reader-electron/verify.mjs`。

### 二、★ 判据复用：给应用那份判据加"**附着模式**"，于是桌面端不用重写断言

`../zhouyi-reader/verify.mjs` 新增 `PROBE_CDP_URL` —— **附着到别人的 CDP 端点**（不自己起浏览器、
**也不导航**，因为宿主已经加载了它自己的入口）。于是 Electron 判据第三层就是：

```
起窗口（带 --remote-debugging-port） → PROBE_CDP_URL=http://127.0.0.1:<port> node ../zhouyi-reader/verify.mjs
```

实测：**97 / 97**（应用那份判据在 Electron 窗口里全过）。与 webview 那条同构 ——
"换宿主之后界面行为一样"这句话，在**四个宿主**上都是判据了。

### 三、换宿主踩到的五个坑（每个都会让你误以为应用坏了）

| # | 现象 | 真因 | 处置 |
|---|---|---|---|
| 1 | 界面判据里"点一下应当出现"**整批红**，而点击的效果**在下一条断言时才出现**（像"慢一拍"） | **Chromium 给隐藏窗口降频**（判据跑时窗口是 `show:false`）：rAF/定时器被节流 ⇒ React 的提交晚于我的固定 `sleep(500)` | ① `main.js` 里四个开关关掉节流（`disable-renderer-backgrounding` / `disable-background-timer-throttling` / `disable-backgrounding-occluded-windows` / `webPreferences.backgroundThrottling:false`）；②★ **判据改成"点完等到页面真的变了"**（`clickAt` 等 DOM 变化，超时按当前状态判）—— 固定 sleep 在任何慢宿主上都是错的 |
| 2 | "切回默认模式 ⇒ 同一张图"在 Electron 红、在 Chrome 绿 | 我自己的响应式测试用 CDP 把 **dpr 从 1.5 改成 1 再清掉**，而**画布位图分辨率跟着 dpr 走** ⇒ 跨过它的两次像素哈希没有可比性（判据红，应用没问题） | ① 把响应式那段**挪到模式判据之后**；② 快照里补 **`bw/bh`（位图尺寸）**，让"图变了"与"分辨率变了"能分开看 |
| 3 | 同上那条**仍然**红（第二轮） | **首帧那张图与之后同一模式的图不同**（实测：首次进「卦气」的哈希与第二次不同，第二、三次相同 ⇒ 首帧字体定型） | 基准取**稳定态**：先走一趟"切走再切回"，再量基准（两个稳定态相比） |
| 4 | "窗口收窄到 400px ⇒ 画布跟着变"在 Electron 红 | `Emulation.setDeviceMetricsOverride` 是**浏览器夹具**的能力；附着到 Electron 上时"窗口多大"是**宿主的事**，模拟出的视口不算数 | 附着模式下**跳过**这一组（打印 SKIP 说明理由），改由宿主自己用**两个不同尺寸的真窗口**验（见下） |
| 5 | 小窗口的画布 367，而按 `window.innerWidth` 算是 381 | **Electron 窗口的内尺寸在页面加载之后才定型**（`init` 读到 390，之后才是 406 —— 一个窗口边框的量级），而应用是"首帧读一次 + 之后靠 resize" | 判据改成"**跟随窗口宽度**（±20px 容差，理由写在注释）+ **明显不是回落值 360**"—— 判的是那个性质，不是那一像素 |

### 四、桌面端的响应式：用**两个真窗口**验（不用模拟）

`ELECTRON_WIN_W=1280` 与 `420` 各起一个窗口，读各自的画布边长：

| 窗口 | 视口 | 画布边长 | 判定 |
|---|---|---|---|
| 1280（dpr 1.5） | 1266 | 720（= min(94vw,720) 的上限） | ✓ |
| 420（dpr 1.5） | 406 | 367 | ✓ 跟随窗口、**不是 360 那个回落值** |

⇒ 第十一轮补的 `@sub.current_viewport()` 在**第三个宿主**上也验证了（web / Android / 桌面）。

### 五、判据（本轮实测）

| 门 | 结果 |
|---|---|
| `node examples/apps/zhouyi-reader-electron/verify.mjs`（**真窗口**，要 `npm install`） | **17 / 17**（含"应用那 97 条判据在窗口里全过"+ 小窗口响应式 4 条） |
| `node examples/apps/zhouyi-reader/verify.mjs`（真 Chrome） | **99 / 99**（附着模式改动后重跑确认没坏） |
| `bash tools/verify_all.sh` | **24 / 24** |
| 装 Electron 的坑 | npm 的 postinstall **被镜像跳过**（`added 13 packages in 1s` 但没有二进制）⇒ 手动 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js` |

### 六、还有一个"看起来像应用崩了"的坑：**隐藏窗口不合成帧**

第一版判据跑完**没有汇总行**，而退出码是 0 —— 因为收尾那段 `Page.captureScreenshot`
**一直不返回**（Chromium 不为**不可见**窗口合成帧），脚本卡在 `await` 上。
跑的人看到的是"没有输出"，很容易读成"应用挂住了"。
处置：给截图加 **6 秒硬上限**并在超时时**打一行说明**（"隐藏窗口不合成帧 —— 要看截图就用
`ELECTRON_HEADLESS=0` 跑一次"）。**证据类操作不该把判据挂住**，这条与"截图只是旁证"是一套取舍。

### 七、桌面端这一格的现状（写清楚，别读大）

- ✅ **Electron 这条**：真窗口 + 应用那 97 条判据全过 + 真窗口响应式 ⇒ "桌面端能跑起来给人用"**是判据**；
- ⏳ **RNW 那条**（`--host rnw`）：仍只到"能把界面打进 bundle"（5 项），窗口要 VS 2026 + SDK 22621；
- ⏳ **这条路线还没进脚手架**：现在它是手写示例（`examples/apps/zhouyi-reader-electron/`），
  下一步是把它做成第四个宿主档 `--host electron`（与 `hosts/webview/` 同源 + 叠加主进程那几份文件）。

## 补记（第十四轮：性能基线**重测** + 归因**改判** —— 首测把成本记在了错误的函数上，2026-10-02 十四续）

### 一、症状：一份"看起来很确定"的归因，实际指到了空处

首测的 `PERF.md` §7 写着：`render_props` 调 `props.styles_map()`，"而它（`vdom.mbt:163`）是
`copy_map(self.styles)`"，并据此排了"下一刀 = 去掉 `styles_map()` 的那次复制（一行实验）"。

**实际读源码：`styles_map()` 在 `:221`，实现就是 `self.styles` —— 只读、零复制。**
`copy_map` 确实在 `:163`，但那行属于 **`Props::copy`**。⇒ **照那"一行实验"去改，会改在一个
根本没有 `copy_map` 的函数里**（改完什么都不会发生，而人会以为"探针无效、归因不成立"）。

**真因**：写归因时把**行号**当成了**函数名**（`:163` 是 `copy_map(self.styles)` 那一行的位置，
被读成了"`styles_map()` 就是它"）。**解法**：引用代码事实必须**贴函数名 + 它的实现**，
只贴行号不算证据 —— 行号会在任何一次编辑后失效，而且它不携带"这行属于谁"这个信息。

### 二、真因之外还有一层：`Map` 是**可变**的，所以"去掉那次复制"根本不是一行实验

首测把 `Props.styles` 描述成"**不可变 HAMT**"。查标准库：
`~/.moon/lib/core/builtin/linked_hash_map.mbt:42` 的 `Map` 是带 `mut entries : FixedArray[…]`
的**可变** LinkedHashMap（有 grow / rehash）。

**这件事有实际后果**：`copy_map` **不是白花的** —— 它撑的是 `Attrs::copy` 的公开契约
（注释原文 "Return an independent copy that can be extended without mutating `self`"）。
真去掉它，"副本"和"原件"就共享同一张表，**改副本会漏回原件**。
⇒ 那一刀是**语义决策**，不是一行实验。**"不可变"这个词一旦想当然，整条推理链就都歪了。**

### 三、解法：**用消融探针定位成本，而不是读代码**

纠正归因的正确手法不是"再读一遍代码"（首测就是这么错的），而是**做一处消融、量差**：
把 `Props::copy` 临时改成**共享四张表**，构建成留档产物，与对照**在同一会话里交错跑**。
结果（`min` 统计量，各 9 次）：**−36.1%（N=1000）/ −27.8%（N=5000）**，
折算 **0.64 µs/元素**（两个规模 0.643 / 0.635，几乎完全相同）。

**探针的三条硬规矩**（写下来，否则实验会污染成"事实"）：

1. 改 `vendor/**` 前先**字节级备份**（记 `sha256`），测完还原并**重新校验哈希**；
2. 探针**不入 patch 系列** —— 别对半成品跑 `vendor_sync.sh --capture`（那会把实验写进真源）；
3. 探针与对照**必须同会话交错**（理由见下条），且**核对负载形状断言**（`shape_ok`）没变
   —— 否则你量的是"换了个负载"，不是"省了这些成本"。

### 四、顺带逮到的两条测量学坑（都影响判据口径）

- **在负载下量的 A/B 会放大差值**：D3 首测报 −10.7%@N=1000，机器空闲后重测只有 **−7.6%**。
  机制说得通 —— 改前版本分配更多，在 CPU 争抢下被罚得更狠。**"别人的 CPU 占用"对两个变体的
  惩罚并不相等**，所以它不只是噪声，还是**有方向的偏差**。
- **跨会话同一份产物能差 7%**：`art-d3a.js`（同一哈希、同机、同参数）在重测批次是 11.68 ms、
  在探针批次是 12.49 ms。⇒ **A/B 只能同会话交错比**；跨会话只能比"两组区间是否重叠"。
  本轮把"**两组各 9 次的 `min` 区间不重叠**"定为"硬结论"的门槛，就是为了这个。

### 五、本轮实测（数字）

| 项 | 结果 |
|---|---|
| 基线（重测，机器空闲，`min` 统计量） | N=1000 **12.64 ms**（7007 元素）/ N=5000 **84.90 ms**（35007 元素）· 每元素 **1.8–2.4 µs** |
| D3（重判） | **−10.5%@N=5000**（区间完全不重叠）/ **−7.6%@N=1000**（区间轻微重叠） |
| A/B 配对的可信度 | 两份留档产物**都能从源码重建出同一哈希**（`3d8b00bf…` / `90bdcb5f…`），即**只差 D3 一处** |
| 归因（消融探针） | 四张表全共享 **−36.1% / −27.8%**（**0.64 µs/元素**）；只共享 `styles` −15.4% / −5.6% |

### 六、★ 把那一刀真的落下去（同日续）：三条坑 + 一条语言事实

#### ① "删掉那次复制"是错的 —— 它是元素的**私有草稿纸**

探针量出那笔复制值 0.64 µs/元素之后，最自然的下一步是"那就别复制了"（一行）。**读构造器才发现不行**：

```moonbit
let (attrs, children) = resolve_attrs(attrs, children)
push_class(class, attrs)      // ← 复制之后，元素还在往这份 attrs 里写自己的显式参数
push_style(style, attrs)
VNode::elem("button", attrs.to_props(), children)
```

上游那次 `copy` **不是防御性复制**，而是元素"把自己的 `class` / `style` / `on_click` 写进去"的草稿纸。
删掉它会**污染调用方的 `Attrs`** —— 同一个 Attrs 传给第二个元素，第二个就继承第一个推入的属性。
**真因**：把 `resolve_attrs` 函数体读成了整条路径（它自己确实不改写，**但它的调用方紧接着改写**）。
**解法**：**让复制变便宜，而不是取消它** —— 见 ③。

> 📌 这条同时纠正了本文件同轮 §一～§四 的叙述惯性：我当时把"归因正确"误当成了"改法显而易见"。
> **归因回答"钱花在哪"，不回答"怎么省"。**

#### ② 语言事实：MoonBit 的索引赋值可以自定义（`#alias("_[_]=_")`）

- 写法：普通方法名 + **`#alias("_[_]=_")`**（core 的 `builtin/array.mbt` 就是这么写的）。
  旧语法 `fn T::op_set` **仍能用**，但会报 `deprecated_syntax`。
- ⚠️ **是三个占位符**：写成 `"[_]="` 会得到
  `[4015] Type ... has no method op_set`（看着像"不支持"，其实是字符串写错）。
- 实测可行的三件事：`t[k] = v` 走 `op_set`；`self.field = self.field.add(...)`（**`mut` 字段经 `self` 赋值**）；
  `for k, v in t`（包装类型提供 `iter2` 即可）。
- **收益**：上游那 **~200 处** `self.0.attrs["name"] = value` 与成百处 `.get/.contains/for…in`
  **一个字都不用改**。

#### ③ 优先选"编译器强制"的改法

同一目标有两条路：

| 路 | 做法 | 漏一处的后果 | 改动面 |
|---|---|---|---|
| A 手工 | 给 ~210 个写入点插"是否需要先复制"的检查（copy-on-write） | **静默 bug**（漏点悄悄共享可变表） | 大且易漏 |
| **B 换类型** | 把四张表换成**不可变**表（`PropsTable[V]` 包 `immut/hashmap`）⇒ `Props::copy()` 退化成 **O(1) 指针拷贝**，**复制这个动作保留** | **编译不过** | 7 个文件 |

选了 B：契约与语义**零变化**（不可变结构共享天然安全），并且靠编译器把改动面一次枚举干净
（`moon check` 逐层报错：`vdom/ssr.mbt` → `html|svg/attrs.mbt` → `render.mbt`，共 4 轮收敛）。

#### ④ 改 `vendor/**` 的完整流程与判据（照抄即可）

字节级备份（记 `sha256`）→ 改 → **构建留档产物**（不在测量中途重编）→
`bash tools/vendor_sync.sh --capture` → `bash tools/vendor_sync.sh --check`。
**`--check` 过了才叫"这次改动能被重建"** —— 第三方目录是 gitignore 的，`git status` 不会提醒你漏了 patch。

⚠️ 顺带一条观察：`--capture` 报"更新 25 个、新增 8 个"，其中 6 个新增是**既有 fork 文件**（`cmd/host_native*`、
`sub/*_wbtest` 等）被拆成了独立 patch —— 这是按路径重新分组，**不是补漏**：capture 前后 `--check` 都通过，
且结果逐文件相同。**判据是 `--check`，不是 patch 的条数。**

#### ⑤ 收益与代价要一起报（别只报赢的那一半）

时间 **−32.4%（N=1000）/ −29.3%（N=5000）**；但 **`heap_delta` 中位数方向相反**
（N=1000：81 → 98 MB；N=5000：233 → 154 MB）⇒ **"分配量"本轮没有结论**。
不可变表的插入要分配路径节点，用可变表则不用 —— 所以"省了复制"与"插入变贵"是两笔账，
**要分开测**（本轮只测了净值）。

### 七、换底 `rabbita 0.15.4 → 0.16.0`（2026-10-03）：五条，其中**两条是方法论级的**

**结果**：`moon check` 0 错误 · `verify_all.sh` **24/24** · 基准**不回归**（N=1000 7.40→7.36 ms、
N=5000 46.62→47.52 ms，区间重叠）· **P1（`PropsTable`）在 0.16.0 上活着**。
33 个 patch 里**只有 4 个**要手工重做（`04`/`08`/`09`/`28`），其余 29 个直接重放。

#### ★ 坑一（最值钱）：**拿"被自己改脏的树"当基准，会悄无声息地丢掉我们自己的东西**

侦察冲突时我在同一个目录里跑了一遍"把 33 个 patch 全打一遍"，**那棵树就被打脏了**
（失败的 patch 留下了部分已应用的 hunk）。接着做三方合并时，我把**那棵脏树当成了"上游"**
⇒ 于是"我们加的 helper"在基准里已经存在 ⇒ 合并结果与 patch **都不再包含它们**。

**症状很隐蔽**：`moon check` **编译通过**（编的是没被丢掉的那部分），
直到另一处报 `The value identifier viewport_of_payload is unbound` 才暴露 ——
一条 helper 定义 + 两个调用点，静默消失。

**解法**（两条都要）：
① 基准树 / ours 树 / verify 树**各自独立**，**只在 verify 树里跑重放**；
② 动手前**先验收三棵树都干净**（`*.rej` / `*.orig` 为空，且"我们加的东西"在 ours 里有、在 theirs 里没有）。

> 📌 与 §六 是同一个形状：**"谁是基准"必须是被验证过的事实，不是顺手拿来的那个目录。**

#### ★ 坑二：`patch` 的 fuzz 会**丢掉上下文行并报告成功**

`12-runtime-moon-pkg.patch` 里 `"moonbitlang/async/js_async",` 是**上下文行**。
上游 0.16 把它换成了 `"moonbitlang/async",` ⇒ 对不上 ⇒ `patch` 用 fuzz 把尾部上下文
**丢掉并报告成功** ⇒ **依赖悄悄没了**，`react_host.mbt` 报 `Package "js_async" not found`。

**解法**：patch 必须**显式**写出我们要的每一行（用干净基树 `diff` 生成，出现在 `+` 那一侧）；
并且**"我们加的东西还在不在"要点名断言**（本轮 `grep -c PropsTable` / `grep -c viewport_of_payload`）
—— **不能拿 `--check` 全绿当"改动完整"的证据**。

#### 坑三：判断"哪些 patch 会冲突"必须**实跑重放**，不能按"文件被上游改过"估

`FORK.md` 当年按**文件级 diff** 预测"5 个文件冲突"，实测是 **4 个 patch，名单还不一样**
（预测里的 `ssr.mbt` / `html_utils.mbt` / `runtime/moon.pkg` 被 `patch` 的上下文吸收了；
真正失败的是 `04`/`08`/`09`/`28`）⇒ **"文件被改过" ≠ "patch 打不上"**。
侦察要在**独立干净副本**里 `patch --dry-run` 跑一遍到底（否则就是坑一）。

#### 坑四：上游的 API 变更会**溅到应用层**，比想象的多一级

`@common.Viewport` 的 `width/height` 从 `Int` 改 `Double`（`Window::inner_width/inner_height` 同改）
⇒ 涟漪到**三层**：库的宿主载荷解析（`sub.mbt`）、`todo-app` 的 `SizeChanged(Int, Int)`、
`zhouyi-reader` 的 `Viewport(Int, Int)`；另一条 `@js.Promise` → `Promise[T]` 溅到 `sqlite/`。
**解法**：**在边界显式转**（`.to_double()` / `.to_int()`），**不改两端接口的松紧** ——
否则"上游改了类型"会变成"我们把契约改松了"，而后者没人发现得了。

#### 坑五：**"上最新"可能是语言/工具链问题，不是冲突问题**

最新是 0.16.3，但它把 `cmd/operation.mbt` 的 `pub(all) extenum Extension {}` 改成**不写体的**
`pub extenum Extension` —— 本机 `moon 0.1.20260827` / `moonc v0.10.11` **解析不了**
（最小探针实测 `Error [3002] missing '{'`）。⇒ 上 0.16.3 **得先升工具链**。
**教训**：动手合并之前，先拿**目标版本的最小语法探针**验一次"本机编译器认不认" ——
否则可能把一整套 patch 重做完了才发现根本编不过。

### 八、升工具链（2026-10-03）：**六条坑，其中三条会伪装成"代码问题"**

**结果**：`moon 0.1.20260827 → 0.1.20260920` · `moonc v0.10.11 → v0.10.14+7d59c7ec9` ·
`core 0.10.11+6ff76a5f9 → 0.10.14+7d59c7ec9`。
判据：`moon check` 0 错误 · `verify_all.sh` **24 / 24**（在 0.16.0 的树上）·
**不写体的 `extenum` 现在编得过**（带对照探针实测）⇒ **0.16.3 可达**。

#### ★ 坑一：`moon upgrade` **要 TTY**，非交互 shell 下连 `-f` 都不行

`moon upgrade` / `moon upgrade -f` 都报 `Error: IO error: not a terminal`；
`winpty moon upgrade -f` 也不行（`stdin is not a tty`）。
⇒ **正路是官方归档**（`binaries/latest/moonbit-<target>.zip` + `.sha256`）。
⚠️ 更坑的是：那次失败的 `moon upgrade` **没有退出**，一直挂在那儿**占着 `moon.exe`** ——
后面覆盖安装就报 `Device or resource busy`（见坑五）。

#### ★★ 坑二：官方归档**不含 `lib/core`** —— 只换 `bin/` 会得到假的"代码错误"

`moonbit-windows-x86_64.zip` 里只有 `bin/ lib/ include/ share/`，**没有 `lib/core`**。
只覆盖 `bin/` 之后（`moonc` 已新、core 还是旧）编译我们的树，报的是：

```
Error: [4015] Type BytesView has no method unsafe_read_uint32_le.   ← 在 .mooncakes/moonbitlang/async 里
Error: [4014] has type : ?Error / wanted : ...
```

**30 条错误全在依赖里、一条都不在我们的代码里** —— 极容易被读成"新编译器不兼容我们的依赖"。
真因是**核心库与工具链版本错配**（新 moonc 配旧 core）。判据：`~/.moon/lib/core/moon.mod` 的
`version` 必须与 `moonc -V` 对得上 ⇒ core 从 `cores/core-latest.tar.gz` 下，
而它**是按工具链版本命名的**（本地缓存里的旧 core 就叫 `0.1.20260827+8f8e8db1e.zip`）。

#### ★★ 坑三：光解压 core 不够 —— 官方脚本里还有一步 `moon bundle`

换完 core 仍报 9 条：

```
Error: Sys_error("…\lib\core\_build\js\release\bundle\json\json.mi: No such file or directory")
```

`moon build` 产出 `_build/js/release/**build**/`，而树要的是 `**bundle**/`。
真因：**官方安装脚本 `install/unix.sh` 里有这一步**（读它就是最快的答案）：

```bash
moon -C "$lib_dir"/core bundle --warn-list -a --all
moon -C "$lib_dir"/core bundle --warn-list -a --target wasm-gc --quiet
```

⇒ **"官方安装器做的事"就是清单**：抄它的步骤，别自己猜。

#### 坑四：`core` 里的符号链接在 Windows 上建不出来（只有一个，影响可控）

`tar xf` 报 `Cannot create symlink … ./core/lazy_list/README.md -> README.mbt.md`
（Git Bash 没有建符号链接的权限）。**只有一个**，而且是文档文件 ⇒ 照旧安装的样子
（旧 core 里那个位置是**普通文件**）复制一份即可。

#### ★ 坑五：Windows 上**运行中的 exe 不能覆盖，但能改名**

`cp moon.exe` 报 `Device or resource busy`（占用者正是坑一里那次卡住的 `moon upgrade`）。
**解法**：`mv moon.exe moon-<旧版本>.exe.bak` 再放新的进去（Windows 允许重命名运行中的 exe），
**别硬删**；顺手 `taskkill` 掉那个卡住的进程。
⚠️ 代价：改名后若中途停手，`~/.moon/bin` 会留下**混合工具链**（本轮真出现过：
`moon` 旧 + `moonc` 新）—— 所以这步要一次做完，并用 `moon -V` 的三行**逐行核对**。

#### 坑六：换完工具链**警告暴涨**（89 → 391），但门不一定红

新 lint 更严，`moon check` 的警告数从 **89 涨到 391**。**本次实测：24 条门仍全绿** ——
所以"警告变多"不等于"门要红"；但也**别当噪声**：它意味着**别的仓库/CI（装 `latest`）
看到的警告比我们本地文档里记的多得多**。
📌 顺带纠一条老结论：`DEV.md` 曾写"工作区钉 `0.1.20260827`、CI 装 `latest`，两代都该绿" ——
**现在两边都是 `latest` 了**（而且本文件早已实测"钉不住"：版本化 URL 一律 403）。

### 九、再冲到 `0.16.3`（同日）：**一条好消息 + 一条方法论上的复利**

**结果**：`tools/vendor.lock` = `0.16.3` · `moon check` **0 错误** · `verify_all.sh` **24 / 24** ·
基准**不回归**。而且**一行代码都不用改**（`0.16.0 → 0.16.3` 落在我们覆盖路径上的差异全是格式）。

#### 好消息：33 个 patch 里**只有 1 个**打不上

| 步骤 | 预测的冲突 | **实测** |
|---|---|---|
| `0.15.4 → 0.16.0` | 5 个文件 | **4 个 patch，名单还不同** |
| `0.16.0 → 0.16.3` | 3 个额外路径 | **只有 1 个**（`04` = `html/README.mbt.md`） |

⇒ **"文件被上游改过" ≠ "patch 打不上"，而且这个偏差是双向的**（既可能像上次那样"看着像冲突其实不冲突"，
也可能反过来）。**判冲突只能实跑重放**；按文件级 diff 估出来的清单，两次都不准。

#### 方法论上的复利：把上次的教训变成流程，这次一次就对

第一步换底时我丢了东西（拿跑脏的树当基准 ⇒ `sub.mbt` 的两个 helper 静默消失）。
这次**先把三棵树全部验收干净再动手**：

```bash
# 三棵树各自独立，且都验：无 *.rej/*.orig、且"我们加的东西"在 ours 里有、在 theirs 里没有
for d in v163 base160 base154; do find $d \( -name '*.rej' -o -name '*.orig' \) | wc -l; done
```

结果：**33/33 验收通过，且点名断言（`grep -c PropsTable` = 24、`fn viewport_of_payload` 在）一次过**。
⇒ 教训只有在**变成可执行的检查**之后才算学到 —— 否则它只是一段叙事。

#### 一条口径纪律：同时动两个变量时，别声称归因

`0.16.3` 那一刀**同时**动了工具链与上游版本，所以基准只能回答"整套有没有变慢"：
实测 N=1000 `7.22 → 7.50 ms`（`min` 统计量 +3.9%，但 `min` 中位 −0.6%）、N=5000 `46.70 → 47.61 ms`
（+2.0% / −0.4%）—— **两种统计量符号相反、区间重叠 ⇒ 在噪声内**。
**要分各自的贡献，得各留一份产物重测**（本轮没做，所以不写"是谁带来的"）。

#### 附带观察

换到 0.16.3 之后 `moon check` 的警告数从 **391 掉到 169/164** —— 上游在新 lint 下更干净了。
⚠️ 这与 §八 坑六并不矛盾：**警告数是"代码 × 编译器"的函数，换任何一边都会变**，别把它当版本好坏的指标。

---

## 补记（发布 0.4.0 那天：**在新鲜克隆里预演 CI**，逮到一条"本机绿、CI 红"的断链，2026-10-03 十五续）

### 一、可复用的手法：把 CI 的条件在**本机复现出来**（不是"把本机的门再跑一遍"）

这个仓库有条老规矩：**"本机全绿 ≠ CI 会绿"** —— 因为 CI 每次都是**新鲜克隆**
（没有 `vendor/`、没有各应用的 `node_modules`、没有 `_build`、没有 `.scratch/`）。
所以"本机 25/25"**不构成**推送前的证据，当时能做的只有"推上去看"。

**这一轮把它变成了本机就能做的事** —— 一条命令把"新鲜"这个条件造出来：

```bash
git clone --no-hardlinks . /d/tmp/ciclone          # 克隆**只含入库内容** ⇒ 天然没有那四样
cd /d/tmp/ciclone && git checkout main
bash tools/vendor_sync.sh --apply                  # CI 的第一步（这一步曾缺失 ⇒ CI 永远不可能绿）
cd examples/apps/todo-app/host && npm install --no-audit --no-fund   # CI 只在这一个目录装依赖
cd /d/tmp/ciclone && bash tools/verify_all.sh      # CI 跑的就是这一条
```

⚠️ 三条容易漏的：① 必须 `--no-hardlinks`；② **`npm install` 那一步要照做**（CI 只装
`todo-app/host`，漏了它会有几条门把 SKIP 当成本该如此）；③ **克隆出来的期望**不是"25 / 25"：
新鲜克隆上应是 **`通过 19 · 失败 0 · 跳过 6`**（4 条 `node_modules` 不在、1 条仓库外的 F1 扫描对象、
1 条 antd 试金石）—— **SKIP 是"判据不成立"，不是通过**。

### 二、它当场逮到的东西：一条断链（**本机怎么跑都是绿的**）

预演结果 **`通过 19 · 失败 1 · 跳过 4`** —— 红的那条是 **`文档相对链接（check_links）`**，
而**本机它一直是绿的**。真因：

```
断链 2 个：
  docs/design/DESKTOP-RNW.md:12  ->  ../../.scratch/rnw-probe/logs/
  docs/design/DESKTOP-RNW.md:227 ->  ../../.scratch/rnw-probe/logs/16-q1-evidence.log
```

那两处把**一次性探针目录**写成了 Markdown **链接**。而 `.scratch/` 是 **gitignore 的** ——
本机有（探针留下的），**新鲜克隆里没有** ⇒ **本机绿、CI 红**。
修法**不是**去放宽门（**门是对的**：那种链接在 GitHub 上永远点不动），而是把文档改对：
**写成路径、不写成链接**，并在原地写明"为什么这里只能是路径"。

⇒ 一般形式值得记住：**"本机有、仓库没有"的路径，在文档里一律不能写成链接。**
同类嫌疑：`.scratch/**`、`_build/**`、`vendor/**`、各应用的 `node_modules/**`。

### 三、这次预演顺带证实了两件事

- ✅ `tools/vendor_sync.sh --apply` 在**新鲜克隆里能重建出 `vendor/`**（那条修复仍然成立）；
- ✅ `moon check` 能编译**新加进工作区的 `zhouyi-reader`** —— 它唯一的外部依赖是
  `XiLaiTL/moobile@0.4.0`，而那一版**当天刚发布**。（**发布之前**这其实是个隐患：
  工作区成员之外没人能解析到它。现在通了。）
