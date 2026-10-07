---
title: 机制：一条命名空间直通的窄通道
description: 标签从哪来、落在哪一档、计不计诊断，以及不想用生成器时手写的形状。
---

# 机制：一条命名空间直通的窄通道

> 那张三行标签表在**主文档**（门禁）里；本文件是它的**细则** —— 为什么"计数仍然有效"、以及
> 不用生成器时手写长什么样。表以主文档为准，这里不重抄。

| 你写的标签 | 去哪 | 计不计诊断 |
|---|---|---|
| `div` / `span` / `button`（表内） | 标签表 → 宿主基础组件 | 不动 |
| **`antd:Button`（含冒号）** | **原样直通**给宿主注册表 `MOBILE_HOST.components` | **不计数** |
| `img` / `table`（表外、无冒号） | 回落 `View` | `unmapped +1` |

- 写错名字 / 库没装 → **启动时抛**并列出已注册的名字，**不会静默渲染成空盒子**
  （`host.mbt` 的 `js_host_component`）。
- ⚠️ 忘了写冒号（`Card` 而非 `antd:Card`）：**不报错**，落进第三档渲染成 `View`，
  只有**计数**会点名它（`render.mbt` 的 `map_tag`；`docs/design/DESIGN-COMPONENT-LIBRARY.md` 的 §N1）。
- 那张**可移植标签表**（`render.mbt` 的 `tag_table()`，收录判据只有一条「两端都有等价物」）
  与第三方组件**正交**：第三方名字**不进**那张表，所以 `unmapped()` 这个断言在接入之后**仍然有效**
  （`docs/design/DESIGN-COMPONENT-LIBRARY.md` 的 §1.2）。

## 手动写法（不想用生成器时）

组件库侧**一行代码都不用写**：

```moonbit
@html.node("antd:Button", @html.Attrs::build()
  .prop_str("type", "primary")     // 任意 prop（HTML 里没有的名字也能写）
  .prop_json("columns", columns_json)  // 结构化值走 JSON 文本
  .on_click(_ => emit(Bump)), "加一条")
```

> 出处简写：**M** = `npm/moobile-host/README.md`｜**D** = `docs/design/DESIGN-COMPONENT-LIBRARY.md`（机制总纲）
> ｜**G** = `npm/moobile-host/libgen/`（生成器本体，每个文件头部写了它的边界）
> ｜**C** = `npm/moobile-host/core.js`。
> 分数、项数、组件数这类会漂的数字只在 `docs/STATUS.md`。
