---
title: 身份、缺参数的处置与写完自查
description: 组件对象只能建一次（错了会整棵子树重挂）、哪些东西必须由应用传进来、缺参数要当场抛而不是静默跳过、以及六条能跑出证据的自查。
---

# 身份、缺参数的处置与写完自查

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、身份必须稳定：**只建一次**

- 组件对象与适配器**只在注册时建一次**（`npm/moobile-host/core.js` 的 `jsonPropAdapter` 与
  `registerLibrary`）。
- 每次渲染重新注册、或在**组件函数体里现造一个组件类型** ⇒ React 认为**类型变了** ⇒
  整棵子树卸载重挂 ⇒ 组件内部的 state / 动画归零（症状：**输入框每敲一个字就失焦**）。
- 落地写法：造组件的**工厂**（`makeGauge(options)`）返回组件，在**模块级或注册时调一次** ——
  范例见 `npm/moobile-host/canvas-skia.js` 的 `makeSkiaCanvas`、
  `npm/moobile-host/canvas-web.js` 的 `makeWebCanvas`。

## 二、什么该由应用决定；缺了要当场抛

- **资源与引擎由应用传进来，宿主不替它猜**：Skia 画布要应用 `import` 的 Skia 模块 + `makeFont`
  （**用哪个字体是应用的资源决定**）；web 画布零依赖；svg 画布要 `react-native-svg`。
  见 `npm/moobile-host/canvas-skia.js`、`npm/moobile-host/canvas-web.js`、`npm/moobile-host/canvas-svg.js`。
- **缺参数时当场抛，不要静默跳过**：有文字指令而没给 `makeFont` → 抛
  （静默跳过会让"标签不见了"很久以后才发现）；`ops` 没进 `jsonProps` → 拿到的是字符串 → 抛。
- **缺注册的失败模式要认得**：视图里出现没注册的标签时，`host.mbt` 的 `js_host_component` 会
  **抛错并列出已注册的名字**，而 React 遇到渲染期异常会卸掉整棵树 ⇒ 表现为**整页空白、
  控制台里看不出是本页的问题**（症状记录在 `npm/moobile-host/canvas-web.js` 的文件头）。

## 三、写完自查（每条都指向一个能跑出证据的动作）

1. 注册返回值里有你要的键（启动日志打印它，**别只凭"没抛错"**）。
2. 每个目标平台都设了 `platforms`，并且**真的在那个平台跑过一次**。
3. 结构化 prop 进了那一档 `jsonProps` 白名单。
4. 每个 `on_raw` 的事件键在 `events` 里有落点；判据是"**值对上了**"而不是"回调触发了"。
5. 组件类型**只建一次** —— 组件里没有"渲染期现造组件"。
6. 改了 `npm/moobile-host/**` 就先跑 `bash tools/refresh_host_copies.sh`：不刷新的话门会红，
   更糟的是验证脚本会**悄悄测旧代码**。

## 四、去哪看细节

- 三个手写组件的完整范例：`npm/moobile-host/canvas-skia.js`（原生，应用传引擎与字体）、
  `npm/moobile-host/canvas-web.js`（web，零依赖）、`npm/moobile-host/canvas-svg.js`。
- 应用侧那三行注册怎么摆：`examples/apps/canvas-demo/App.js`、`npm/moobile-host/hosts/rnw/App.js`
  （顺序与平台闸门都在里面）。
- 设计面（命名空间、宿主注册表、四件事、平台矩阵、缺口清单）：
  `docs/design/DESIGN-COMPONENT-LIBRARY.md` 的 §2 与 §5。
- 事件载荷的落地说明：`npm/moobile-host/README.md` 的「接入一个 React 组件库」一节。
- 实测证据库：`docs/FINDINGS.md` 的「接一个现成的 RN 组件」补记；现状与分数只看 `docs/STATUS.md`。
