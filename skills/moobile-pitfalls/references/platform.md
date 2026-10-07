---
title: 平台与数据：静默给错值的那一类最贵
description: 平台差异的逐条清单 —— 尺寸/滚动量静默变 0、视口只推变化、相对 URL 失败、真机拿不到流式。
---

# 平台与数据：静默给错值的那一类最贵

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**逐条细则** —— 按需读。
出处简写：**F** = `docs/FINDINGS.md`｜**M** = `npm/moobile-host/README.md`｜**A** = `AGENTS.md`
｜**DESIGN** = `docs/design/DESIGN-COMPONENT-LIBRARY.md`。

| 现象 | 真因 | 处置 |
|---|---|---|
| 尺寸 / 滚动量恒为 0，不抛也不报 | RN 做了 `global.window = global` 但**从不定义** `window.innerWidth` / `scrollY` ⇒ `undefined` 静默变 0 | 这类「静默给错值」要单独查（`tools/cap_platform.mjs` 会挑出来）——它比「会抛」的那类更该先修（F「N5b 适配器形状」补记） |
| 按窗口宽度算的尺寸永远是回落值（罗盘在 1400px 窗口里只有 360px） | `@sub.on_resize` 只推**变化**，两端都不在挂载时补发初始值 | 用 `@sub.current_viewport()` 读一次「现在是」；拿到 `None` 时用**写下理由的回落值**，别当 0 混进计算（F 第十、十一轮） |
| 相对 URL 请求失败，而 curl 同一个 URL 是 200 | 库的 http 走 `moonbitlang/async`，客户端只认**完整 URL**（没有 `://` 直接 raise）；原生端也没有「站点根」 | 给完整 URL，或把只读数据编译期嵌进产物（F「把 `interest/yi` 真搬过来」补记） |
| 「流式」在真机上一帧都收不到，也不报错 | RN 的 `fetch` 拿不到流式 body | 走 XHR 增量；**必须在发请求前判平台** —— 「先试 fetch 不行再换」会把同一个 POST 发两遍（F「SSE 流式通道」补记） |
