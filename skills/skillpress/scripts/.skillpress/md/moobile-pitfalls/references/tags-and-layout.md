---
title: 标签与布局：机械迁移最先撞的几处
description: 标签表与布局的逐条清单 —— excluded_tags 少内容、未收录标签静默回落、View 不滚动、page() 没人挂、span 各占一行。
---

# 标签与布局：机械迁移最先撞的几处

出处简写：**F** = `docs/FINDINGS.md`｜**M** = `npm/moobile-host/README.md`｜**A** = `AGENTS.md`
｜**DESIGN** = `docs/design/DESIGN-COMPONENT-LIBRARY.md`。

| 现象 | 真因 | 处置 |
|---|---|---|
| 页面少了几块内容，而页面「看着正常」 | `details` / `summary` 等在 `excluded_tags()` 里（RN 没有那个开关语义） | 状态搬进 Model + 条件渲染；权威清单是 `render.mbt` 的 `excluded_tags()`（F「折叠区块与两个只在真机上现形的洞」补记） |
| 写了个没收录的标签：不崩，也没效果 | 兜底回落成 `View`，同时**被计数** | 断言未收录计数为 0（`unmapped_tag_count()`），让它说话而不是静默（`render.mbt`） |
| 超过一屏的内容在手机上够不着 | RN 的 `View` **不滚动**，而 DOM 自己会滚 | 两层根容器：`page()` 挂根 + `@html.node("scroll", …)` 包整页（M 的「生成后自查」一节） |
| 页面底色 / 字体族丢了 | 源 CSS 的 `body` / `html` 声明被抽成了 `page()`，但没人挂到元素上（浏览器自带 `body` 样式兜住了） | 把 `page()` 挂到根元素；这是自查项 `page-style-unused`（M 的「生成后自查」一节） |
| 兄弟 `span` 各占一行；折叠箭头浮在行中央 | `@style` 只有 Flex / Hidden 两个 display 取值 ⇒ 表达不出 `display:inline`；1:1 映射 + `View` 默认 column | 行容器显式 `flex_direction(Row)` + `align_items(Baseline)`；**刻意别加 `flex_wrap`**（会让长句整块掉行）（F 第三十一轮） |
