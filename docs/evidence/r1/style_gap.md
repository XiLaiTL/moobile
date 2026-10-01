# 样式层差集（补齐后重算）

目标 (2)「补全类型化样式层至覆盖 yi 的 198 条 CSS」的**可核对账目**。

yi 的 CSS：**198 条规则 / 57 个属性名**；moobile 样式层：**77 个属性**

| 分类 | 数量 |
|---|---|
| ✅ 已覆盖 | **37** |
| 🔁 简写，可拆成已有属性 | **7** |
| ⛔ 明确排除（web 专属 / 无对应） | **7** |
| ⚠️ 结构性问题（要设计，不是加属性） | **6** |
| ❓ 未归类 | **0** |

## 🔁 简写 → 已有属性的拆法

- `background` → 纯色用 background_color；渐变见下面结构性问题　（yi 里 **41** 处）
- `border-bottom` → border_bottom_width/color/style　（yi 里 **5** 处）
- `border` → border-width/color/style 三件套　（yi 里 **21** 处）
- `border-top` → border_top_width/color/style　（yi 里 **8** 处）
- `border-left` → border_left_width/color/style　（yi 里 **6** 处）
- `text-decoration` → text_decoration_line/color/style　（yi 里 **1** 处）
- `border-right` → border_right_width/color/style　（yi 里 **1** 处）

## ⛔ 明确排除

- `-webkit-font-smoothing` —— web 专属（抗锯齿），RN 由平台决定　（**1** 处）
- `cursor` —— 桌面专属，RN 触屏无光标　（**18** 处）
- `outline` —— web 焦点样式，RN 无　（**1** 处）
- `transition` —— RN 无 CSS 过渡 → 用 Animated / Reanimated　（**4** 处）
- `touch-action` —— web 专属，RN 由手势系统管　（**1** 处）
- `list-style` —— RN 无列表语义（ul/li 已映射为 View）　（**2** 处）
- `user-select` —— RN 里是 selectable 属性，不是样式　（**2** 处）

## ⚠️ 结构性问题 —— 这才是真正的工作量

- `font-feature-settings` —— RN 侧为 fontVariant/fontFeatureSettings，平台差异大，待验证
  - yi 里 **1** 处，样例：`"palt"`
- `grid-template-columns` —— Grid 专属 → 必须改 flex
  - yi 里 **8** 处，样例：`repeat(auto-fill, minmax(116px, 1fr))`
- `transform` —— RN 要结构化数组 [{translateY:-1}]，扁平 (key,value) 通道装不下
  - yi 里 **3** 处，样例：`translateY(-1px)`
- `box-shadow` —— RN 拆成 shadowColor/Offset/Opacity/Radius + Android elevation，非单值
  - yi 里 **3** 处，样例：`0 2px 10px rgba(26,20,16,.10)`
- `content` —— 伪元素专属 → 必须改成真实组件
  - yi 里 **4** 处，样例：`"▸ "`
- `grid-template-rows` —— Grid 专属 → 必须改 flex
  - yi 里 **1** 处，样例：`repeat(6, 3px)`