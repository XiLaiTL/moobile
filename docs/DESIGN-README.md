# moobile

> **用 MoonBit 写一次 UI，通过可插拔后端运行在 Web 与 React Native 上。**

把 [RabiTa](https://mooncakes.io/docs/moonbit-community/rabbita) 的视图树翻译成 React 元素，
由 React 负责调和、React Native 负责布局与文字渲染。

---

## 状态

**🚧 草案 / 待验证。** 代码尚未开始，当前处于可行性论证阶段。

**唯一阻塞项**：内联文本流在 React Native 上能否接受（见 [DESIGN §6 风险](DESIGN.md#6-风险)）。
此项未验证前，不进入实现。

---

> 📌 **这是设计期的项目导读，已留档。** 项目当前的门面是 [`../README.md`](../README.md)（实现侧），
> 工作计划在 [`../PLAN.md`](../PLAN.md)，环境手册在 [`../DEV.md`](../DEV.md)。

---

## 文档

| 文档 | 内容 |
|---|---|
| [`DESIGN.md`](DESIGN.md) | **设计文档（主）** —— 定位、架构、路线图、风险、未决问题 |
| [`EVIDENCE.md`](EVIDENCE.md) | **验证记录** —— 全部实测数据、原始输出、复现方式、已否决方案的论证链 |

建议阅读顺序：先 `DESIGN.md` §0–§4 建立整体认识，再按需查 `EVIDENCE.md` 核对依据。

⚠️ **本文写于实现之前**，其中若干处已被实测修正 —— 修订点见
[`../README.md`](../README.md) 的「实测发现」与「R1 判决」：
`Props.styles` 已加宽成类型化值（§3.2 说的是字符串 map）、`Event` 已从 `@dom.Event` 解耦、
§8 Q6（Web 是否也走 React）**已被推翻**、§3.1 的 `Text` 草图照抄会在 RN 上炸。

---

## 三条核心结论

1. **翻译是一个 4 分支递归，不是框架重写。**
   `Html` 是 `VNode` 的包装且暴露 `to_virtual_dom()`；`VNode` 只有
   `Elem` / `Text` / `Frag` / `Thunk` 四个构造器。

2. **样式已经是结构化数据，不需要 CSS 引擎。**
   `Props.styles : Map[String, String]` 是每元素自带的结构化样式表，
   DOM 后端已在消费并做增量 diff。
   → 无选择器匹配、无层叠、无优先级、无继承。
   （不需要新建"style 树"这一层。）

3. **渲染可以整体外包。**
   React Native 没有非 React 的建视图 API，所以产出 React 元素是**必经之路**而非选择；
   而 React 管调和、RN 管布局与文字 —— 这些都不需要 moobile 实现。

---

## 边界（一句话）

> **moobile 不做渲染，它做翻译。** 渲染交给 React 和 React Native。

越过这条线去做布局或文字排版，项目就变成"重写 Flutter"。越界即停。

---

## 下一步

**阶段 0：可行性验证（spike）**

- 取内联排版最密集的一段（`.m-yao` 系列：爻题 / 爻辞 / 小象 / 折叠箭头）
- 映射为 RN 的 `Text` 嵌套 + `View`，跑起来看排版是否可接受
- 判定标准是"**可接受**"，不是"像素一致"

产出：可行性结论 + 一个最小骨架（4 分支递归 + 少量标签映射）。
若结论为"能接受"，该骨架即成为库的起点。

---

## 驱动案例

`interest/yi` —— 《御纂周易折中》阅读器（MoonBit + RabiTa）。
它是 moobile 的**驱动力与验证场**，但不是目标本身，也**不作为代码依赖**。
