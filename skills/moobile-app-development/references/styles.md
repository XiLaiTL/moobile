---
title: 样式：唯一通道是 @style，没有 CSS
description: 类型化样式的写法、两条"能写但没有任何效果"的 CSS 通道、Dimension 与关键词枚举、按下态 press() 的语义与未验之处。
---

# 样式：**唯一**通道是 `@style`，没有 CSS

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

```moonbit
@html.div(
  attrs=@html.Attrs::build().styles(
    @style.Style::new().flex(1.0).padding_horizontal(@style.px(12.0)),
  ),
  [ @html.span(attrs(@style.Style::new().font_size(15.0)), "标题") ],
)
```

## 一、两条 CSS 通道：能写、能编译、**没有任何效果**

- ❌ `@html.Attrs::build().class("…")` 与 `.style_attr("…")`（即 HTML 里的 `class=` / `style="…"`）：
  库把它们当**普通 prop 原样递给 React**（`render.mbt` 里 `props.attrs_map()` 那条分支），
  而 RN 没有 CSS 类、也不吃 CSS 字符串。
- 浏览器里看着对，是**浏览器自己认**（`README.md` §2）。
- 所以样式一律走 `Attrs::styles` —— **这是唯一有视觉效果的通道**。

## 二、参数形状：长度给数字，关键词给枚举

- 尺寸类参数收 `@style.Dimension`：写 `@style.px(12.0)` / `@style.pct(50.0)`；
  `font_size` / `border_radius` 这类收 `Double`。
- **长度一律给数字** —— RN 不接受 `"16px"` 这种字符串（`render.mbt` 的 `styles_to_js`）。
- 关键词用枚举而不是字符串：`@style.Align::Center`、`@style.FlexDirection::Row`、
  `@style.Justify::Center`、`@style.FontWeight::W700`。

## 三、按下态：`press()` 的语义容易用反

- `@style.Style::press()` 的键会被拆成 `pressStyle` 交给宿主（`render.mbt`），
  宿主包 `npm/moobile-host` 里**搜不到消费点** ⇒ **未验证**它在真机上有视觉效果。
- ⚠️ `press()` 的语义是"给**它前面**的键加前缀"（`style/style.mbt`）⇒ **链尾调用会把常态键一起变成按下态**。
  按下态要写在链的**前段**，常态键写在它后面。
