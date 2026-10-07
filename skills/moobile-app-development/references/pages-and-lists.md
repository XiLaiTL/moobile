---
title: 页面、滚动容器与长列表
description: 没有路由库时"加一个页面"怎么做、为什么整页必须包滚动容器、以及 memo_list 的键契约与三种踩法。
---

# 页面、滚动容器与长列表

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、加一个页面：没有路由库

- 页面是 `Model` 里的一个值，切换是**纯 `update`**，`view` 里一次 `match` 分发 ——
  见 `examples/apps/todo-app/ui.mbt` 的 `view` 与 `examples/apps/todo-app/model.mbt` 的 `Page`。

## 二、整页要包一层滚动容器（web 上完全看不出来）

RN 的 `View` 不滚动，而 `@html` 里**没有滚动标签**（HTML 靠 `overflow`）⇒ 用**伪标签** `scroll`，
标签表把它映射成 `ScrollView`（`render.mbt`）：

```moonbit
@html.node("scroll", attrs(@style.Style::new().flex(1.0)), [ r1_view() ])
```

- 不套的话手机上超过一屏的内容用户**够不着**，而**浏览器里完全看不出来**（DOM 自己会滚）。
- 从别的项目迁过来的**根样式**同理。

## 三、长列表：用 `@moobile.memo_list`，键必须**完备**

```moonbit
@html.div(
  attrs=attrs(@style.Style::new()),
  @moobile.memo_list(model.items, by=item_key, f=t => item_row(t, emit)),
)
```

- **契约**：键相同必须蕴含"这一行的 HTML 与 handler 等价"。
  行里用到的每一个会变的东西（`id` / 文案 / 勾选 / handler 捕获的值）都要进键。
- 三种踩法：

| 踩法 | 后果 |
|---|---|
| 只按 `id` 取键 | 那行的变化**画不出来** |
| 用"第几条"当键 | 插一行后**静默错配** |
| `by` 没含 handler 捕获的值 | 复用旧闭包，点下去动的是**另一条数据** |

- 行依赖序号时用 `@moobile.memo_list_i`，且**序号也要进 `by`**。
- 自查**别靠读代码**：`globalThis.__moobileApp.memo_hits()` / `memo_misses()`，
  每帧命中 ≈ 行数、未命中 ≈ 0。配方见 `docs/PERF-RECIPES.md`。
