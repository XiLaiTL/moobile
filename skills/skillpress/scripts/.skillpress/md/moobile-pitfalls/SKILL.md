---
name: moobile-pitfalls
description: moobile 里「编译过了、也渲染了，但行为或外观不对」时先看的那份门禁：最贵的六条雷与禁区；逐条清单在 references/。
whenToUse: 你要写、改或审 moobile 的视图 / 样式 / 宿主 / 组件库接入代码，或者撞上「编过了、界面也出来了，但行为或外观不对」的时候；也用于动手前自查，避免重踩已记录的坑。
---

# moobile-pitfalls —— 「不报错但错」的门禁

**只解决一件事**：编译器不管、运行时不喊的那些错。这一份是**门禁** —— 最贵的几条写在这里，
每条一句话说清「现象 → 真因 → 处置」；**逐条清单与证据在 `references/`**（按主题分，按需读）。

> 还没上手过？先看 [moobile 应用开发：从零一个应用、加一个页面](../moobile-app-development/SKILL.md)
> —— 那一份讲"怎么写"，这一份讲"写完为什么不响"。
> （这条交叉引用也是**站点正文里的一条真链接**：它验证"正文里的链接可点、点了站内跳页"。）

动手前先把门跑一遍，确认你看到的结果是**这一版**代码的：

```bash
bash tools/verify_all.sh
```

## 最贵的六条（错了要付大代价，而且没人会告诉你）

| 现象 | 真因（一句话） | 处置 |
|---|---|---|
| `div` / `span` 挂 `on_click`：点不动、无警告 | 标签表里只有 `button` / `a` 落到 `Pressable` | 换标签成 `button`，别去加样式（`references/events.md`） |
| `class=` 与 `style="…"` 写了没效果 | RN 没有 CSS 类；RNW 的 props 白名单外**连警告都没有** | 一律走 `Attrs::styles`（`references/styles.md`） |
| 尺寸 / 滚动量恒为 0，不抛也不报 | RN 定义了 `window` 却**从不定义** `innerWidth` ⇒ `undefined` 静默变 0 | 这类"静默给错值"单独查（`references/platform.md`） |
| 按窗口宽度算的尺寸永远是回落值 | `@sub.on_resize` 只推**变化**，两端都不补发初始值 | 再用 `@sub.current_viewport()` 读一次"现在是"（`references/platform.md`） |
| 列表整棵子树重挂、组件内部 state 归零 | 每次渲染都重新注册组件 / 适配器 ⇒ React 认为"类型变了" | 组件与适配器**只注册一次**（`references/channels.md`） |
| 正圆画成横扁的椭圆 | RN Skia 的 `processTransform3d` **每项只读第一个键** | 变换一律**每项一个键**（`references/channels.md`） |

## 贯穿全篇的一条：**web 上看不出来 ≠ 真机没问题**

凡标了「web 上看不出来」的洞，web 与真机是**两套**判据 —— 改完只跑一边等于没验。
真机入口 `tools/verify_android.py`；各应用自己的浏览器套件在 `examples/apps/<app>` 下。

## 禁区（`AGENTS.md` §5 + 库侧）

- 不要为了让检查过而放宽断言 —— 那是把 bug 藏起来。
- 不要在没跑验证的情况下说「已完成」。
- 不要往库本体的 `moon.mod` 加依赖（会连带所有使用者）；先问能不能放进独立模块。
- 不要擅自 `git commit` / `git push`。
- 别手改生成物（`styles/styles.mbt`、`html/forward.generated.mbt`、`registry.generated.js`、
  `components.generated.mbt`）：门会逐函数点名（F 第三十一轮）。
- 别写死 `moon build` 的产物路径（它取决于模块在构建根里的身份）—— 搬运一律走 `moobile-host build`。
- 别指望 `.gitignore` 随包发出去；`files` 白名单同时管发布与本地 `file:` 安装。

## 细则（按需读）

| 主题 | 里面是什么 |
|---|---|
| `references/events.md` | 事件：点了没反应、载荷拿不到、消息送不到、调度器是 stub |
| `references/styles.md` | 样式：写了不报错就是没效果（含 `.press()` 与文字键白名单） |
| `references/tags-and-layout.md` | 标签表与布局：不滚动、`page()` 没人挂、inline 表达不出 |
| `references/platform.md` | 平台与数据：静默给错值、完整 URL、流式拿不到 |
| `references/channels.md` | 两条"通道"：第三方组件库、画布（两端不一致的重灾区） |

## 往下读哪儿

| 要什么 | 去哪 |
|---|---|
| 现状 / 分数 / 剩余工作 | `docs/STATUS.md`（**唯一来源**） |
| **仍然没验证**的诚实清单 | `docs/HANDOVER.md` §6（读它，别把"没验"当"已做"） |
| 缺口与下一步 | `docs/design/DESIGN-COMPONENT-LIBRARY.md` §5 |
| 已踩过的坑与真因（证据库） | `docs/FINDINGS.md` |
| 宿主契约 / 能力注册表 / 画布注册 | `npm/moobile-host/README.md` |
| 能力边界表（不报错但没效果那几行） | `README.md` §2 |

> 出处简写：**F** = `docs/FINDINGS.md`（引号里是它的补记标题，轮次同理）｜**M** = `npm/moobile-host/README.md`
> ｜**A** = `AGENTS.md`｜**DESIGN** = `docs/design/DESIGN-COMPONENT-LIBRARY.md`。
