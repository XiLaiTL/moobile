---
title: 事件与 children：两条最容易白干的通道
description: on_raw + Payload 的提取器与事件键三级优先；children 的两种形态、字符串被包成元素那个坑、以及刻意未做的两处缺口。
---

# 事件与 children：两条最容易白干的通道

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、事件：要真值就必须走 `on_raw`

`on_change` 那批老处理器在 React 后端**载荷是零值**（能触发、拿不到值）⇒ 受控组件用不了；
真值通道是 `Attrs::on_raw` + `Payload` 的提取器，实现在 `vendor/rabbita/html/payload.mbt`：

| 提取器 | 覆盖的载荷形态 |
|---|---|
| `Payload::text()` | 字符串**直接给**（RN 的 `onChangeText` 走这条）；事件对象读 `target.value` / `nativeEvent.text` |
| `Payload::json()` | 组件回调递来的业务值（数组 / 对象）—— 结构化数据**回**的方向 |
| `Payload::num()` / `Payload::bool()` | 数值 / `target.checked` |
| `Payload::field(name)` | 任意属性，可继续 `field` 下去（提取器没覆盖到的形状自己走） |

- MoonBit 侧写 `.on_raw("select", e => emit(SetSel(e.json())))`：**事件键是你自己的语义名**，
  真正的 prop 名由你的 `events` 表决定（三级优先：`events['ns:X']` → `events['ns:*']` → `events['*']`，
  见 `host.mbt`）；`registerLibrary` 只写 `ns:*` 那一档。
- 提取器**永不抛错**（形状对不上给 `""` / `0` / `false`）⇒ "值没上来"要**自己断言**，别指望它喊。
- 缺口：回调**只取第一个参数**（`vendor/rabbita/html/payload.mbt`）⇒ 多参数回调要在**宿主侧**
  （你的组件里）拼成一个值或一个对象再递出去。

## 二、children 的两种形态（★ 最容易白干的一处）

| 通道 | 到组件是 | 谁合适 |
|---|---|---|
| **子节点**（默认，位置参数） | React 子节点；**字符串子节点已被包成 `<Text>` 元素**（`render.mbt` 的 `make_text`） | 绝大多数组件 |
| **`children` prop** | `props.children === "…"` **裸字符串**（`render.mbt` 的 `render_props` 键原样进对象；`docs/design/DESIGN-COMPONENT-LIBRARY.md` §2 N3b） | 把内容当**数据**用的组件 |
| 具名 prop + 宿主侧适配 | 你自己挑一个键 | 上面两条都不顺手时（推荐） |

- 组件把 children 当**数据**（markdown-it 那种）时，收到 `<Text>` 元素会抛
  `Input data should be a String` —— 每个字一次刷满日志，界面上只表现为"那块空着"
  （`docs/FINDINGS.md`「接一个现成的 RN 组件」补记坑三）。
  处置是**文本走 prop + 宿主侧适配**，与 `jsonProps` 套解析器是同一个手法：

```js
// 宿主：把具名 prop 接回 children
components: { Md: ({ text, ...rest }) => React.createElement(Md, rest, String(text ?? '')) }
```

- ❌ 缺口（**别当已支持**）：库**没有**给自定义组件传**裸字符串子节点**（位置参数）的表达方式 ——
  要的话得改渲染规则，而那会反过来弄坏"字符串当 RN 子节点"的用法。
- ❌ 缺口：**渲染型回调**（`itemRender` / `renderItem` 这类"返回视图"的 prop）**过不了**这条通道 ——
  回调是另一条通道，其契约是"返回**消息**"（`docs/design/DESIGN-COMPONENT-LIBRARY.md` §5）。

## 三、组件拿到的 prop 从哪来

| MoonBit 侧 | 到组件的键 |
|---|---|
| `Attrs::prop_str` / `prop_bool` / `prop_int` / `prop_num` | **原样**（**没有** camelCase 转换 —— 名字要逐字对上组件的 prop） |
| `prop_json` + 该组件的 `jsonProps` 白名单 | 该键被 `JSON.parse` 后再交给组件 |
| `Attrs::styles` | `style` 对象（RN 词汇表；手写组件自己决定怎么用 / 转发） |
| 按下态（`press:` 前缀的样式键） | `pressStyle` —— **库侧没有消费方**（`render.mbt`），手写组件想要按下态可以自己接 |
| 位置参数的 children | React 子节点（字符串已被包成 `<Text>` 元素） |
| `on_raw` 声明的事件 | 按 `events` 表映射出的 prop 名 |
