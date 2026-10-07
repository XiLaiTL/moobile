---
title: 事件与订阅：要"真实值"就得挑对通道
description: 点按 / 输入 / 手势各走哪条通道、Payload 的五个提取器、以及订阅 Sub（定时器、回前台、尺寸变化、原生流）。
---

# 事件与订阅：要"真实值"就得挑对通道

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、想要什么，走哪条

| 想要的东西 | 走哪条 |
|---|---|
| 点一下触发消息 | `on_click=emit(Msg)`（默认落 RN 的 `onPress`，见 `render.mbt` 的 `map_event`） |
| 输入框里的文本 | `@html.input(value=model.draft, on_input=emit.map(s => SetDraft(s)))` |
| `on_*` 的 DOM 载荷（坐标 / 按键 / 滚动量） | ❌ 在 React 后端是**零值**：能写、不崩、拿不到 |
| 任意事件键的真实载荷 | `@html.Attrs::build().on_raw("change", e => emit(SetDraft(e.text())))` |
| 拖动 / 点按手势（元素内坐标、位移） | `@gesture.attrs(on_pan=…)`、`@gesture.pan(attrs, …)` |

## 二、`Payload` 的提取器（形状对不上时给空值，**不抛**）

`text()` / `json()` / `num()` / `bool()` / `field()` —— 实现在 `vendor/rabbita/html/payload.mbt`。
"值没上来"要自己断言，别指望它喊。

- 输入框为什么靠 `on_input` 就有文本：挂载时库把"从输入事件取表单值"的策略换成了 React 语义
  （RN 的 `onChangeText` 直接递文本），见 `app.mbt`。
- 而 `Mouse` / `Keyboard` / `Scroll` 三个解码器返回**零值**，是**已知降级**
  （`vendor/rabbita/html/event_decoders.mbt`）。
- ⚠️ `on_raw` 的回调**只拿得到第一个参数**，多参数回调要在**宿主侧**拼成一个值。

## 三、订阅（`Sub`）：运行时主动推消息

```moonbit
pub fn subscriptions(_model : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.batch([
    @sub.every(5000, emit(Tick)),
    @sub.on_visibility_change(hidden => emit(VisibilityChanged(hidden))),
  ])
}
```

- 用户没点任何东西也会来的消息（定时器、回到前台、尺寸变化）走这里；原生持续流用 `@sub.custom_sub`。
- `subscriptions` 在 `handlers(...)` 里是**可选**参数，不需要就从出口去掉。
- ⚠️ `@sub.every` 的间隔别取 1 秒：真机验证工具（`uiautomator dump`）要等界面进入 idle，
  一秒一跳会让它一直等不到（代价记在 `examples/apps/todo-app/model.mbt` 的注释里）。
- ⚠️ 订阅这一类有个共性坑（**只推变化、两端都不在挂载时补发初始值**）——
  完整清单在 `skills/moobile-pitfalls/references/platform.md`，别在这儿重抄一遍。
