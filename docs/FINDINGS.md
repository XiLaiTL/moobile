# FINDINGS.md —— 实现侧的实测结论（原 README）

> 这份文档是**研究与实测记录**：R1 排版判决、样式差集、DOM 缝隙普查、
> fork 配方、S1/F2–F7/N1– 等逐条发现。想快速了解这个项目，看仓库根的
> [`README.md`](../README.md)；想看"当初为什么这么定"，看这里。

---

# moobile

> **用 MoonBit 写一次 UI，交给 React / React Native 渲染。**
>
> **R1 已判决：可接受 ✅** —— `docs/DESIGN.md` §6 说它是
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
| `docs/DESIGN.md` | **设计文档（主）** —— 定位、架构、路线图、风险、未决问题 | 想查设计意图时 |
| `docs/EVIDENCE.md` | **可行性验证记录** —— 全部实测数据、复现方式、已否决方案的论证链 | 想查依据时 |
| `docs/DESIGN-README.md` | 设计期的项目导读（留档） | 考古时 |
| 本文件 | **实现侧的实测结论** —— R1 判决、样式差集、DOM 缝隙普查 | 想查依据时 |

**代码侧的目录**（就在本目录下）：

| 目录 | 是什么 |
|---|---|
| `moon.mod` | 模块定义（模块名 `XiLaiTL/moobile`） |
| **模块根包**（`host.mbt` `render.mbt` `app.mbt` `store.mbt` `schedule.mbt`） | **库本体** —— `import { "XiLaiTL/moobile" @moobile }` 拿到的就是它 |
| `style/` | **公开包**：类型化样式层（使用者写视图的入口） |
| `internal/rabbita/` | vendor 的 rabbita **主包**（`App` / `run` / `Val` / `elmish`），2026-09 从模块根挪进去 |
| `internal/vdom/` `html/` `cmd/` `dom/` … | vendor 的 rabbita（改动清单见 `FORK.md`） |
| `demo/` | 演示应用：`ui.mbt`（待办）+ `r1.mbt`（R1 样本） |
| `host/` | Expo 宿主（`App.js` 只有一个根组件） |
| `_tools/` | 环境脚本（`android_env_setup.sh` 等） |
| `_r1/` | R1 的测量产出与原始数据 |

---

## 跑起来

```bash
./build.sh                                  # moon build --target js → host/moobile.js
cd host && npm run web                      # Expo web，http://localhost:8081

node _verify.js                             # 另开一个终端；需 dev server 已在 8081
```

`_verify.js` 用无头 Chrome（390×844 / DPR 2）真实加载页面，用**真实鼠标与键盘事件**走一遍
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
demo/                 ← 应用：全新的小应用（待办清单，TEA）
  app.mbt                Model / Msg / update / view
  main.mbt               dispatch（带相等性判断）+ 三个导出给 JS 的入口
host/                 ← 宿主：Expo（React + React Native + react-native-web）
  App.js                 一个根组件 + useSyncExternalStore，仅此而已
  moobile.js             ← build.sh 生成的产物，不要手改
_verify.js            ← 端到端验证
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

- `host/` 里有 create-expo-app 留下的独立 `.git`（只有模板初始提交）。要做整体仓库的话建议先 `rm -rf host/.git`

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
// demo/ui.mbt —— 与 yi 的写法一致，不再是 moobile 自造的 DSL
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
