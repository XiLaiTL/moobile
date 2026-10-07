---
title: 两条"通道"：第三方组件库与画布
description: 把外部东西接进来时的逐条清单 —— 注册顺序与平台闸门、类型定义撒谎、渲染型回调没通道；画布两端不一致（变换每项一个键、字体回退）。
---

# 两条"通道"：第三方组件库与画布

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**逐条细则** —— 按需读。
出处简写：**F** = `docs/FINDINGS.md`｜**M** = `npm/moobile-host/README.md`｜**A** = `AGENTS.md`
｜**DESIGN** = `docs/design/DESIGN-COMPONENT-LIBRARY.md`。

## 一、第三方组件库（`libgen` 声明 → 宿主注册）

| 现象 | 真因 | 处置 |
|---|---|---|
| 标签名写错 / 库没装 → 启动时点名报错并列出已注册的名字 | **设计如此**，不是静默渲染成空盒子 | 别自己加兜底渲染；照报错改名字（M） |
| 真机启动即抛「`registerLibrary` 必须在 `installHost` 之后调用」 | `MOBILE_HOST` 是在 `mountApp` 里才装的 | 顺序写成「先 `installHost()` → 再 `registerLibrary(...)` → 再 `mountApp`」；`installHost()` 是幂等**合并**，重复装不会冲掉已注册的组件（F「接一个现成的 RN 组件」补记；M） |
| 启动即抛「组件库声明只在 [web] 上可用」 | 平台闸门是**运行期抛**的：`registerSkiaCanvas` 默认 `['android','ios']`；而 **`registerLibrary` 自己没有默认值** —— **手写注册不传 `platforms` 就完全不过闸门**（`['web']` 只是 libgen 生成配置时的默认，别当成库的默认；2026-10-04 更正，原先这里写反了） | 两条注册都要按平台分支，而且 web / 原生要用**两种**手段：运行期判平台 + 打包期平台文件（F「Android 端：画布那条通道第一次上真机」补记） |
| 回调不触发 | 事件落点由宿主决定：`click` 在 RN 基础组件上是 `onPress`、在 antd 上是 `onClick` | 显式写 `events`；camelCase 兜底能让 `change` 到达，`click` 到不了（M） |
| 报「模块里没有这个导出」 | 类型定义撒谎：那个名字**只在 `default` 导出上** | 写进 `defaultExports`；⚠️ 不声明**不会**自动回落，而且这条错只在真机（Hermes）上露头（M） |
| 结构化 prop 写错字段名不红、值形状对不上也没人管 | `prop_json` 的**值**仍是 `String`，编译期只检查名字 | 值自己保证形状；`children` 类型写着 `string` 的会自动走「原始字符串」那档（DESIGN §5 T2 / T2b） |
| `itemRender` / `renderItem` 这类回调接不上 | 渲染型回调走的是另一条通道，它的契约是「返回消息」 | 两条解法（宿主注入默认渲染器 / 库侧新增通道）**都还没做** —— 别当成已支持（DESIGN §5 T2b） |
| 列表整棵子树重挂、组件内部 state 归零 | 每次渲染都重新注册组件/适配器 ⇒ React 认为「类型变了」 | 组件与适配器**只注册一次**（M） |

## 二、画布

| 现象 | 真因 | 处置 |
|---|---|---|
| 正圆画成横扁的椭圆、内外圈对不上 | RN Skia 的 `processTransform3d` **每项只读第一个键**，第二个键静默作废 | 变换一律**每项一个键**；判据在 `examples/apps/canvas-spike/host/verify.mjs`（F 第二十三轮） |
| 画布上的文字一条都画不出来（web 却全绿） | RN Skia 的 `<Text font=>` 用单个 `SkFont`，**不走系统回退链**（`FontMgr` 也没有「按字符找字体」的 API）；web 的 `fillText` 由浏览器回退 | 宿主（`npm/moobile-host/canvas-font.js`）提供回退注册口，由**应用**异步读系统 CJK 字体喂进去；⚠️ 注册是异步的 ⇒ 必须靠订阅通知重渲染，否则首屏永远没字、重开又有。另一条路（改走 `ParagraphBuilder` 让排版器自己回退）**还没做**（F 第二十四、二十五轮） |
| 指令里有文字却没给字体 → 当场抛 | 「用哪个字体」是应用的决定，宿主不替你猜（刻意不静默跳过文字） | 传 `makeFont`；`import * as Skia` 拿到的是包的命名空间，要字体用包导出的 `matchFont`（F「Android 端：画布那条通道第一次上真机」补记） |
| `arc(…, 0, 2π)` 在 SVG 后端画不出来 | SVG 的 `A` 表达不了整圆 | 宿主拆成两段；没有当前点时 `arc()` 要自己补起点，有当前点但不在弧起点上要补一条直线（F「canvas 通道 spike」补记） |
| web 上整包解析失败、页面全白 | 平台文件用 `.js` 扩展名导入会把平台解析锁死；`if (Platform.OS !== 'web') require(…)` 也挡不住（打包期解析所有 require） | 导入写成**无扩展名**（`'./canvas-native'`）（F「Android 端：画布那条通道第一次上真机」补记） |
| web 上根本没有画布后端 | Skia 那条注册默认只跑原生 | 三个后端分工不同：web→DOM 2D、android/iOS→Skia、windows→SVG（M 的「画布」一节；F「罗盘落地」补记） |
