---
title: 样式：写了不报错，就是没效果
description: 样式通道的逐条清单 —— CSS 字符串被吃、flex 方向默认 column、sticky 没对应物、行高单位、文字键白名单、按下态。
---

# 样式：写了不报错，就是没效果

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**逐条细则** —— 按需读。
出处简写：**F** = `docs/FINDINGS.md`｜**M** = `npm/moobile-host/README.md`｜**A** = `AGENTS.md`
｜**DESIGN** = `docs/design/DESIGN-COMPONENT-LIBRARY.md`。

| 现象 | 真因 | 处置 |
|---|---|---|
| `class=` 与 `style="…"` 写了没效果 | RN 没有 CSS 类、不吃 CSS 字符串；RNW 的 `View` 用严格 props 白名单，白名单外的键**连警告都没有** | 一律走 `Attrs::styles`；`pressStyle` 就是这样被静默吃掉的（README §2；F 第十八轮） |
| 版面竖着堆；元素量成 0×0 | RN 的默认 flex 方向是 `column`（CSS 是 row），迁移常只留下 `gap` / `align-items` | 显式 `flex_direction(Row)`；子项给**确定宽高**，别只给 `flex(1.0)`（F 第十轮） |
| 某一栏压住下一栏，点击落到别人身上 | `position: sticky` 在 RN 没有对应物，留下的 `top` 退化成**相对定位**：只挪画的位置、不占布局位置 | 不用 sticky；改用网格列宽或结构本身表达（F 第十轮） |
| 内容横着溢出容器 | RN 的 flex item 默认 `flex-shrink: 0`（CSS 是 1） | 文字那一侧配 `flex_shrink(1.0)` + `min_width(0.0)`（F 第三十一轮） |
| 行高变成 `1.65px` | 无单位的 `line-height` 在 CSS 是**倍数**、在 RN 是**点数** | `line_height_em(1.65)`；≥4 的无单位值按点数处理（F 第十六轮） |
| 整页字体/字号/颜色「换了个人」 | RNW 给每个 `Text` 附一条 `font-family` 默认规则 —— 落在元素上的声明永远赢过继承，而 RN 里**没有继承** | 在 `init` 里调一次 `set_text_style_of(@styles.page())`；⚠️ 别写成模块级 `let`（未引用的模块级绑定会被当纯表达式优化掉）（F 第十六轮） |
| 部分文字键在裸文本上丢了 | 两处「按名字重建」的白名单比那张筛选表窄，落在清单外的键被替换成空表 | 同上；**凡是按名字认键的地方都是嫌疑犯**，而唯一「什么都不过滤」的那一步是干净的（F 第十八轮） |
| 虚线在真机上画成实线（web 上看不出来） | 原生 RN 只有四边共用的 `borderStyle`，不认 `borderBottomStyle` ⇒ 按默认 `solid` 画 | 库会自动折叠（只在有宽度的边 style 一致时）；不一致的必须人来定（F 第二十九轮） |
| `numberOfLines` 这类键写了没用 | 它**不是样式键**而是 `Text` 的组件属性：留在 style 里原生静默忽略、RNW 当一条非法 CSS | 用 `Style::number_of_lines()`（库会把它摘出来挂成 prop）；语义是「截断 + 省略号」，不是「不折行」（F 第三十轮） |
| `.press()` 写了没用 | `pressStyle` 是**零消费方**；而且组装顺序反过来会把常态标成按下态 | 别指望按下态有反馈；生成器默认不产 `.press()`（F 第十八轮；`docs/HANDOVER.md` §6） |
