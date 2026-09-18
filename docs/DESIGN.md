# moobile 设计文档

> 状态：**草案 / 待验证**
> 创建：2026-09
> 前置项目：`interest/yi`（《御纂周易折中》阅读器，MoonBit + RabiTa Web 应用）

---

## 0. 一句话

**用 MoonBit 写一次 UI，通过可插拔后端运行在 Web 与 React Native 上。**

具体形态：把 **RabiTa 的视图树**翻译成 **React 元素**，由 React 负责调和、React Native 负责布局与文字渲染；样式从 RabiTa 的结构化样式表映射到目标平台。

---

## 1. 定位与边界

### 是什么

- 一个 **渲染后端适配层**：`RabiTa(VNode 树) → React 元素 → React Native 原生视图`
- 一套 **可移植样式子集**：只覆盖 Web 与 RN 都有等价物的 CSS 属性
- 一份 **标签映射表**：HTML 标签 → RN 组件

### 不是什么

- ❌ 不是 RabiTa 的 fork（**只有一处拆包需求**，见 §7 阶段 1）
- ❌ 不是 CSS 引擎（**不需要选择器匹配、层叠、优先级** —— 见 §3.2）
- ❌ 不是浏览器引擎（不实现布局、不实现文字排版）
- ❌ 不是给 yi 做移植的专用工具（yi 是驱动力与验证场，不是目标本身）

### 一句话边界

> **moobile 不做"渲染"，它做"翻译"。渲染交给 React 和 React Native。**

这条边界是整个设计的地基：一旦越界去做布局或文字排版，项目就变成"重写 Flutter"，必须立即停手。

---

## 2. 动机

### 2.1 问题的来源

`interest/yi` 是一个 MoonBit 写的周易阅读器，架构为：

```
shared/            数据模型（196 行，纯 MoonBit）
frontend/          RabiTa 前端（2363 行，supported_targets = +js）
backend/           async 静态服务（66 行，+native）
zhouyi_desktop/    Proton(CEF) 桌面壳（~150 行，+native）
```

想把它搬到移动端时，撞上了三层障碍：

| 层 | 障碍 |
|---|---|
| 桌面壳 | Proton 仅支持 Windows/Linux/macOS，无移动端形态 |
| 前端渲染 | RabiTa 的挂载层（`diff.mbt` + `dom/`）硬绑 DOM |
| 外观 | 样式在宿主 HTML 的 `<style>` 里，与 MoonBit 之间靠 **90 个无类型 class 名字符串**耦合 |

### 2.2 为什么现有方案都不够

已评估并否决的路径（详见 `EVIDENCE.md` 的论证链）：

| 方案 | 否决原因 |
|---|---|
| Flutter + WebView | 可行但不是原生；WebView 性能与体验的固有代价 |
| Flutter + 原生 UI | UI 全量重写；逻辑层需要 FFI（C ABI + 引用计数），且 iOS 交叉编译无先例 |
| Flutter + MoonBit native (FFI) | 通路已实测打通（见 EVIDENCE），但每平台各编一次、需守引用计数约定 |
| Flutter + wasm | 需内嵌 wasm 运行时（数 MB），对 196 行逻辑层不划算 |
| 给 RabiTa 写 canvas 后端 | RabiTa 的边界在**布局之下**，等于实现浏览器引擎 |
| Html 树 → 序列化 → Flutter 解释器 | Flutter widget 是 Dart 对象，C 侧造不出来；且序列化失去同运行时优势 |
| 换用 `tiye/react` + React Native | 逻辑与 UI 分属两套状态模型；且现有 view 代码需重写 |

**moobile 的立足点**：保留 RabiTa 的状态层与视图树（MoonBit 资产），把"渲染"整体外包给一个已经有十年投入的栈。

---

## 3. 核心洞察

三个已实测验证的事实，构成本方案的可行性基础。

### 3.1 树是可移植的 —— `Html` 只是 `VNode` 的包装

```moonbit
// rabbita/html/html.mbt
pub(all) struct Html(@vdom.VNode) derive(Eq)

pub fn Html::to_virtual_dom(self : Html) -> @vdom.VNode {
  self.0
}
```

而 `VNode` 的完整定义只有 **4 个构造器**：

```moonbit
// rabbita/internal/vdom/vdom.mbt
pub enum VNode {
  Elem(String, Props, Children[VNode], namespace_uri~ : String?)
  Text(String)
  Frag(Array[VNode])
  Thunk(Int, () -> VNode)
}
```

**推论**：翻译函数是一个 **4 分支递归**，不是框架重写。

```js
function renderNode(v) {
  switch (v.kind) {
    case 'Elem':  return React.createElement(mapTag(v.tag), mapProps(v.props),
                     ...v.children.map(renderNode))
    case 'Text':  return v.text
    case 'Frag':  return React.createElement(React.Fragment, null,
                     ...v.children.map(renderNode))
    case 'Thunk': return renderNode(v.force())
  }
}
```

**并且 `rabbita` 核心 + `rabbita/html` 已实测可编译到 `native` 目标**（完整 Elm 架构 0 错误通过），说明视图树层不依赖 DOM。

### 3.2 样式已经是结构化数据 —— 不需要 CSS 引擎

这是最关键的发现，它推翻了"必须实现 CSS 层叠"的假设。

```moonbit
// rabbita/internal/vdom/vdom.mbt
pub struct Props {
  handlers : Map[String, (Event, &Scheduler) -> Unit]
  attrs    : Map[String, String]
  props    : Map[String, @variant.Variant]
  styles   : Map[String, String]      // ★ 每个元素自带一份结构化样式表
}
```

```moonbit
// rabbita/html/attrs.mbt
pub fn Attrs::style(self : Attrs, key : String, value : String) -> Attrs {
  self.0.styles[key] = value
}
```

DOM 后端已经在消费它，**而且做了增量 diff**：

```moonbit
// rabbita/internal/vdom/diff.mbt:641-652
for key, _ in old.props.styles {
  if !new.styles.contains(key) { stylesheet.remove_property(key) }
}
for key, value2 in new.styles {
  if old.props.styles.get(key) is Some(value1) { ... }
  else { stylesheet.set_property(key, value2) }
}
```

**推论**：非 DOM 后端拿到的是 `Map[String, String]`，**无需选择器匹配、无需层叠、无需优先级、无需继承**。

yi 当前用 `class=` 是应用层的选择，不是 RabiTa 的强制。**"样式作为组件属性"这件事不需要新增架构层 —— 通道已经存在。**

剩余差距仅一条：**值是 CSS 字符串**（`"4px"`、`"#8a2518"`、`"grid"`），需要补一个值解析 + 平台映射。这是**平表映射，不是引擎**。

> ⚠️ 已知坑：`div(style=[...])` 便捷参数走的是另一条路
> （`attrs.attribute("style", style.join(";"))`，拼成字符串塞进 attribute），
> 结构化入口只有 `Attrs::style(key, value)`。需通过 `attrs=` 使用。

### 3.3 渲染可以外包 —— React 管 diff，RN 管布局与文字

**React Native 没有公开的「从任意 JS 创建原生视图（不用 React）」的 API。** 旧架构的 `UIManager.createView` 在新架构（Fabric）中已移入 C++。

因此 **产出 React 元素不是一种设计选择，而是通往 RN 的必经之路**。

这条路的机制已被 `tiye/react@0.4.0` 证明可行：

```moonbit
extern "js" fn react_create_element(
  tag : String, props : @dom.JsObjectObscure, children : FixedArray[@dom.JsObscure],
) -> @dom.JsObscure =
  #| (tag, props, children) => globalThis.React.createElement(tag, props, ...children)
```

**借力清单**（这些都不需要 moobile 实现）：

| 能力 | 由谁提供 |
|---|---|
| 增量调和 / diff | React（RabiTa 的 `diff.mbt` 在本方案中**不使用**） |
| 布局引擎 | React Native（Yoga / flexbox） |
| 文字排版与渲染 | React Native（`Text` 组件 + 平台文字栈） |
| 滚动 | React Native `ScrollView` / `FlatList` |
| 组件与事件模型 | React |

---

## 4. 架构

### 4.1 分层

```
┌──────────────────────────────────────────────────────────┐
│  应用层（MoonBit）                                        │
│    Model / Msg / update        ← RabiTa TEA              │
│    view() -> Html              ← RabiTa @html DSL        │
│    样式值（可移植子集）         ← moobile/style           │
└──────────────────────────────────────────────────────────┘
                          │  VNode 树（4 构造器）
                          ▼
┌──────────────────────────────────────────────────────────┐
│  moobile 后端层                                           │
│    tree/    VNode → React 元素（递归）                    │
│    tags/    HTML 标签 → RN 组件                           │
│    props/   Props → RN props                              │
│    styles/  样式表 → RN StyleSheet                        │
│    events/  事件模型映射                                  │
└──────────────────────────────────────────────────────────┘
                          │  React 元素
                          ▼
┌──────────────────────────────────────────────────────────┐
│  React 生态                                               │
│    React 调和器 → react-dom（Web）/ react-native（移动）  │
└──────────────────────────────────────────────────────────┘
```

### 4.2 状态桥接

RabiTa 的 `Val[T]` 是**带相等性判断的增量响应式**，React 的 `useSyncExternalStore` 要求**不可变快照 + 订阅** —— 两者语义天然吻合。

```
RabiTa Model (MoonBit)
    ↓ Val[T]（相等性判断，值未变则不传播）
useSyncExternalStore (React)
    ↓
根组件：重新渲染（VNode 树 → React 元素）
    ↓
React Native
```

`tiye/react` 已绑定 `use_sync_external_store`，这一环几乎无新工作。

### 4.3 一个关键取舍

**整个 RabiTa 应用映射为「一个根 React 组件 + 一个递归渲染函数」**，而非"每个 widget 一个 React 组件"。

- 每次状态更新：整棵树重建 → React 全树 diff
- 对本类应用（低更新频率：切页、折叠、模式切换）**性能不构成问题**
- 若未来需要，可沿 `Val` 的粒度拆分为多个订阅点 —— 但这是优化，不是起点

---

## 5. 可行性数据

以下数据均已实测或核实，详见 `EVIDENCE.md`（含复现方式）。

| 项 | 数值 | 来源 |
|---|---|---|
| `VNode` 构造器数 | **4** | `internal/vdom/vdom.mbt` |
| `rabbita/html` 支持的标签 | **116** | `VNode::elem("...")` 字面量统计 |
| yi 实际使用标签 | **11** | `using @html {…}` 声明 |
| `diff.mbt` 依赖的 DOM 原语 | **12** | 全量枚举 |
| `diff.mbt` 行数 | 766 | — |
| `dom/` 文件数 | 70+ | 全是 `extern "js"` 绑定 |
| `rabbita` 根包传递依赖 | `internal/vdom` + `js` | `moon.pkg` |
| yi 的 CSS 规则数 | **198** | 花括号计数（扣 2 个 `@media`） |
| └ 单类 `.foo` | 105 | — |
| └ 后代/子 `.a .b` `.a>b` | 64 | — |
| └ 复合类 `.a.b` | 17 | — |
| └ 伪类/伪元素 | 11 | — |
| yi 的 class 属性引用 | 122 处 / 90 个不同名 | `frontend/*.mbt` |
| yi 的 canvas API 面 | 18 个不同调用 | 全量枚举 |
| `RespoStyle` 定义 | `Array[(String, String)]` | `tiye/respo_css@0.1.7` |
| `respo_css` 类型化枚举 | 20+ 个（含 `CssDisplay::Grid`、`CssPosition::Sticky`） | 同上 |

### 已验证的编译事实

| 测试 | 结果 |
|---|---|
| `rabbita` 核心 + `html` + `cmd` 完整 Elm 架构 → `native` | ✅ 0 错误 |
| `rabbita/dom` → `native` | ❌ 失败（2 errors） |
| `rabbita/server`（SSR）目标 | `native+wasm` |
| yi `frontend` → `wasm-gc` | ❌ 拒绝（`supported_targets = +js`） |
| `rabbita/js` 目标约束 | `options(targets: { "*": ["js"] })` |

---

## 6. 风险

按严重度排序。**R1 未解决前，其余讨论都是在未定基础上盖楼。**

### R1 — inline 文本流 ⚠️ **决定成败**

CSS 有**行内流**（inline 元素与文字混排换行）。**RN / Yoga 除 `<Text>` 内部外没有行内流。**

本类应用核心恰是内联文字排版：爻辞、爻题、小象、`xlab`、折叠箭头等。

- ✅ 纯文字场景可通过 `Text` 嵌套 `Text` 通过
- ❌ 内联元素一旦需要盒模型（边框 / 背景 / 固定宽），RN 无法表达
- 具体样本：`.m-fold { min-width: 10px; text-align: center }` —— 给内联元素加盒属性

**这是唯一可能"做完了发现效果不可接受"的地方。必须先验证（见 §7 阶段 0）。**

### R2 — 事件模型差异

| yi 使用 | RN 对应 | 状态 |
|---|---|---|
| `on_click`（20 处） | `onPress` | ✅ 好办 |
| `on_input` | `onChangeText` | ✅ 好办 |
| `on_toggle`（`<details>` 的） | 无 | ⚠️ 需自实现 |
| `on_mousedown/move/up/leave`（罗盘拖拽） | 需换 `PanResponder` / 手势系统 | ⚠️ 需重设计 |
| `on_mouseleave` | 触屏不触发 | ⚠️ 见 EVIDENCE 备注 |

### R3 — `<canvas>` 即罗盘

RN 无 canvas，需 `react-native-skia` 并单独搭桥。**这是唯一"一张标签表搞定"不成立的地方。**

（对应地，Flutter 的 `CustomPainter` 在这点上更省事 —— 见 EVIDENCE 的方案对比。）

### R4 — RabiTa 只用到约 20%

| RabiTa 组成 | 用得上 |
|---|---|
| TEA 状态机 | ✅ |
| `Val` 增量响应式 | ✅ |
| `Html` 树 DSL | ✅ |
| `diff.mbt`（766 行） | ❌ React 自己 diff |
| `dom/`（70+ 文件） | ❌ 完全不用 |

**"裁剪 RabiTa"裁掉的是三分之二。** 需正视由此带来的问题：

> 既然已用 React 渲染、用 React 的组件模型、处理 React 的事件 —— 为什么不干脆用 React 的状态（hooks）？

唯一站得住的答案：**因为状态也要跨平台。** 但代价是维持一套并行状态模型，并与 RN 生态中自带状态的组件（导航 / 手势 / 动画）共存。

### R5 — 依赖与维护

- `tiye/react` 自述 **"Not recommended for production use"**，API 不稳定
- `respo_css` 是 `Array[(String, String)]`，**CSS 形状**而非目标中立 —— 需要维护属性白名单 + 平台映射，并随 RN 版本演进
- 若 RabiTa 需要改动，理想是上游化；否则面临长期跟踪 fork

---

## 7. 路线图

### 阶段 0 — 可行性验证（spike）**← 当前目标**

**目的**：回答 R1（inline 文本流）能否接受。

**做法**：
- 取 yi 中内联排版最密集的一段（`.m-yao` 系列：爻题 / 爻辞 / 小象 / 折叠箭头）
- 映射为 RN 的 `Text` 嵌套 + `View`
- 跑起来，对比排版是否可接受

**产出**：
- 明确的可行性结论（能 / 不能 / 需降级）
- 一个最小骨架：4 分支递归 + 少量标签映射（若结论为"能"，即成为库的起点）
- 若"不能"：得出样式子集必须施加的约束，直接改写阶段 2 的设计

**判定标准**：内联文字混排 + 折叠交互在 RN 上是否达到"可接受"，而非"像素一致"。

### 阶段 1 — 核心桥与拆包

- `VNode` → React 元素递归映射
- 根 React 组件 + `useSyncExternalStore` 接 `Val`
- **拆包**：使状态层（TEA / `Val` / `@html`）不传递依赖 `internal/vdom` 与 `js`
  - 优先上游化；否则最小 fork
  - **这是唯一需要动 RabiTa 的地方，且是包结构拆分，不是 API 改动**

### 阶段 2 — 样式子集

- 定义**可移植属性白名单**（Web 与 RN 都有等价物）
- 样式值层：复用 `respo_css` 类型化枚举，产出写入 `Attrs::style`
- `styles` map → RN `StyleSheet` 映射
- 明确列出**不可移植项**及其降级策略（`display:grid` → flex；`position:sticky` → 独立处理；`::before` → 真实组件）

### 阶段 3 — 事件与组件扩展

- 事件映射（`on_click` → `onPress` 等）
- 手势系统接入（替代 `on_mouse*`）
- 标签表扩展至通用子集（~30 个）
- `<details>` / `<summary>` 的自实现（注意：yi 已在 `Model` 中维护开合状态，逻辑现成）

### 阶段 4 — 罗盘

- `react-native-skia` 接入
- canvas 绘制指令桥（draw-op 列表 → Skia）
- 参照：yi 的 canvas API 面只有 18 个，且无渐变 / 阴影 / 虚线 / 贝塞尔 / `globalAlpha`

### 阶段 5 — 回到 yi 的移植

**前置条件**：阶段 1–4 完成。
此时移植退化为：
- 样式改用可移植子集重写（198 条 → 90 个组件的样式属性）
- 罗盘换 Skia backend
- 前端视图代码**基本不动**

---

## 8. 未决问题

| # | 问题 | 影响 | 何时决定 |
|---|---|---|---|
| Q1 | inline 文本流能否接受？ | **决定整个方案** | 阶段 0 |
| Q2 | 拆包走上游还是 fork？ | 维护成本 | 阶段 1 |
| Q3 | 样式子集的边界画在哪？ | 表达力 vs 可移植性 | 阶段 2 |
| Q4 | 是否引入 RN 导航 / 手势库？若是，状态如何与 RabiTa 共存？ | 架构复杂度 | 阶段 3 |
| Q5 | 是否同时支持 Flutter 后端？（需序列化协议，无同运行时优势） | 范围 | 暂缓 |
| Q6 | 是否支持 Web 也走 React 后端？ | 无必要（DOM 后端 + CSS 更优） | 建议否 |

---

## 9. 参照物

| 项目 | 关系 |
|---|---|
| `moonbit-community/rabbita` | 基座。状态层 + 视图树 |
| `tiye/react@0.4.0` | **可行性证明**：MoonBit 调 `React.createElement` 的机制；`use_sync_external_store` 绑定 |
| `tiye/respo_css@0.1.7` | 样式值层。SCSS 式 `&` 嵌套 + 20+ 类型化枚举 |
| `tiye/dom-ffi` | React 绑定所用的 DOM FFI 类型（`JsObscure` 等） |
| `react-reconciler` | 备选路径：自定义 host config（公众可用，但会引入 React 状态模型） |
| `nandorojo/sticky` | RN 缺 `position:sticky` 的三方补齐 |

---

## 10. 设计原则

1. **不实现渲染。** 布局、文字、滚动一律外包。越界即停。
2. **不实现 CSS 引擎。** 样式是结构化数据，不是待解析的文本。若发现需要选择器匹配，说明设计走偏了。
3. **可移植子集优先于表达力。** 宁可少支持属性，也不要"Web 能跑、移动端不能"。
4. **先验证未知量，再动手。** 当前未知量只有一个：R1。
5. **对 yi 的改动尽量为零。** yi 是驱动案例，不是耦合对象。
