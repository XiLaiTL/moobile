---
title: 事件：点了没反应，而且什么都不说
description: 事件通道的逐条清单 —— 挂错标签、载荷是零值、消息送不到、调度器是 stub、文本被包成元素、多参数回调。
---

# 事件：点了没反应，而且什么都不说

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。
每条都是「现象 → 真因 → 处置」。出处简写：**F** = `docs/FINDINGS.md`｜**M** = `npm/moobile-host/README.md`
｜**A** = `AGENTS.md`｜**DESIGN** = `docs/design/DESIGN-COMPONENT-LIBRARY.md`。

| 现象 | 真因 | 处置 |
|---|---|---|
| `div` / `span` 挂 `on_click`：点不动、无警告 | 标签表里只有 `button` / `a` 落到 `Pressable`；`div` → `View`，没有 `onPress` | 换标签成 `button`，别去加样式；迁移器的 `detectClickOnView()` 会点名这一处（F「把 `interest/yi` 真搬过来」补记） |
| 受控输入回填不了；点按拿不到坐标 | 老的 `on_*` 处理器在 React 后端**载荷是零值**（能写、不崩、拿不到值） | 用 `Attrs::on_raw` + `@html.Payload` 的 `text()` / `json()` / `num()` / `bool()` / `field()`（README §2） |
| 从 JS 回调或定时器里送消息：`update` 永不执行 | `emit(msg)` 只是**造了个 `Cmd`**，不交给运行时，消息就到不了 | `@cmd.custom_cmd(scheduler => … scheduler.add(emit(Msg(ev))))` —— `scheduler.add` 才是送达（F「SSE 流式通道」补记） |
| 界面照常渲染、点击无错、状态永不变 | 交给事件处理器的调度器是个 stub：`scheduler.add(cmd)` 变成 no-op | 必须是真正在跑的那个 host；用 `handler_count()` 这类计数器对账（F 第三轮「一个静默失败，值得单记」） |
| 自定义组件拿到元素而不是字符串（markdown 抛 `Input data should be a String`） | 字符串子节点被包成 `<Text>` **元素** | 文本走 prop + 宿主侧适配，或在 `libgen.config.json` 声明 `content`（F「接一个现成的 RN 组件」补记；M 的 libgen 一节） |
| 多参数回调只拿得到第一个参数 | vdom 侧处理器的形态是 `(v) => f(v)` | 在宿主侧用适配器把参数拼成一个值（DESIGN §5 T1） |
| 无头跑 `@sub.every` 直接 `ReferenceError: window is not defined` | 订阅加载器读 `window.setInterval`；换成 `setTimeout` 不解决（这个能力由平台给） | 补一个最小 `window`（注明是环境补齐），并显式 `process.exit`（F「E 轨道脚手架」补记） |
