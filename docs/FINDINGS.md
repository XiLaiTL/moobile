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
