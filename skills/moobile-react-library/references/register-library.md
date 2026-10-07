---
title: registerLibrary：一个决定，四个面
description: 组件登记 / 结构化 prop / 事件名 / 平台闸门与 Provider 为什么写在同一个函数里，以及 platforms 没有默认值这条要以代码为准。
---

# `registerLibrary`：一个决定，四个面

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

四件事写在**一个函数**里，因为它们是**同一个决定**；分散到四处就会出"注册了组件、忘了事件"
这种**半接状态**（**C**）。

| 面 | 生成的还是人写的 |
|---|---|
| **组件登记**：`MOBILE_HOST.components['<ns>:<Name>']` | 生成（manifest 显式列出，`Form.Item` 这类子组件按 `.` 逐段下钻） |
| **结构化 prop**：给要 JSON 通道的组件套一层解析适配器（`jsonProps`） | 生成（prop 类别为 json 的那些） |
| **事件名**：写进 `MOBILE_HOST.events['<ns>:*']`（库级通配，与 MoonBit 侧三级优先对账） | 生成（身份映射：键就是 prop 名） |
| **平台闸门 + Provider**：不支持当前平台就在**启动时抛**（`wrap` 包 Provider） | 闸门用 `platforms`；Provider 写 `"provider": "ConfigProvider"` |

## 一、事件落点为什么在宿主

- `click` 落在 RN 的 `Pressable` 上是 `onPress`、落在 antd 的 `Button` 上是 `onClick`
  —— 这**不是事件语义的差别**，而是「手里这个组件对象接受什么 prop」，只有拿着组件对象的宿主答得了。
- 生成的注册是**身份映射**（生成的 MoonBit 侧直接写 `.on_raw("onClick", …)`）；
  **手写**注册时必须自己给 `events: { click: 'onClick' }`，否则 `click` 到不了 ——
  React 只会说一句「未知事件属性 `onPress`，将被忽略」（**D** 的 §N4）。

## 二、`platforms` 在 `registerLibrary` 里没有默认值

- ⚠️ 不传就**完全不过闸门**（`core.js` 的
  `if (platforms && !platforms.includes(host.platform))`）。
- `["web"]` 那个默认来自 **libgen 的配置装载**，不是 `core` 的行为 —— 在别处
  （例如 `npm/moobile-host/canvas-skia.js` 的文件头，以及 `moobile-pitfalls` 那份清单）会看到把它说成
  「`registerLibrary` 的默认」的写法，**以代码为准**。
