---
title: 宿主侧接入、产物搬运与能力边界
description: 手写 4 行宿主入口、加能力的三步、产物为什么不能写死路径、换宿主的含义，以及"写得出来但真机上才现形"的能力边界表。
---

# 宿主侧接入、产物搬运与能力边界

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、宿主侧：手写 4 行

```js
import { mountApp } from 'moobile-host';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';

export default mountApp(app, { registry });
```

- **加能力 = `npm install <包>` + `npm run regen` + `moon.pkg` 加一条 import**
  （`examples/apps/template/README.md`）。注册表是**生成物**；缺包时启动即点名报错，而不是 `undefined`。
- 产物搬运**一律走 `moobile-host build`**（生成出来的项目里 `npm run build` 就是 `moon build --target js` + 它）。
  **别写死 `cp`**：产物路径取决于模块在构建根里的身份（工作区成员 vs 独立模块），写死哪条都会错一边
  （`npm/moobile-host/README.md`）。
- 换宿主（`expo` / `rnw` / `webview`）**不改编译侧**：`moon.mod` / `moon.pkg` / `app.mbt` 三档逐字节相同
  （`npm/moobile-host/README.md` §宿主档）。

## 二、跑起来 / 改完看效果

```bash
npm run web            # 生成出来的项目：build + expo start --web（浏览器打开即看）
npm run android        # 模拟器或真机（要 Android SDK，且 adb 在 PATH 上）
bash tools/build.sh    # 仓库内：编译 + 把产物搬进 examples/apps/todo-app/host
```

- 仓库内**跑 Web 预览**：`cd examples/apps/todo-app/host && npx expo start --port 8081`。
- **真机**要 `adb reverse tcp:8081 tcp:8081`，否则白屏（`DEV.md` §3）。

## 三、必须知道的能力边界（写得出来、但真机上才现形）

| 事实 | 说明 |
|---|---|
| `img` `video` `audio` `svg` `table` `iframe` `select` 等标签**明确不支持** | 兜底渲染成 `View`（不崩）并被计数；句柄表里有 `unmapped` / `unsupported` 诊断可读 |
| 未收录的标签 | 同上 —— 它是"发现漏项"的线索，不是错误 |
| 第三方 / 自定义原生组件 | 标签写 `"库名:组件名"`（`@html.node("antd:Button", …)`）直通宿主注册的 React 组件 → 组件库那条 skill |
| 需要原生能力 | 生态里已有 RN / Expo 包的，在 MoonBit 里写绑定即可（就是"加能力"那三步） |
| 换平台 | 通常等于换宿主，而不是改库 |
| 现状、分数、已发布版本 | 只看 `docs/STATUS.md` |

> `canvas` 是另一种情况：标签表**明确排除**它，要用画布得走组件通道
> （`@canvas` 画指令 + 宿主注册 Skia / CanvasKit）—— 那是画布那条 skill。

## 四、去哪看细节

| 要看什么 | 去哪 |
|---|---|
| 最小完整应用（本地库 + 网络同步 + 多页面） | `examples/apps/todo-app/` |
| 脚手架真源与生成物约定 | `examples/apps/template/`、`docs/design/SCAFFOLD.md` |
| 能力边界全表 | `README.md` §2 |
| 宿主包（契约、能力、组件库、画布、手势） | `npm/moobile-host/README.md` |
| 性能配方（memo / 虚拟化） | `docs/PERF-RECIPES.md` |
| 不报错但错的坑（逐条清单） | `moobile-pitfalls`、`docs/FINDINGS.md`、`AGENTS.md` §3 |
| 验证入口 | `bash tools/verify_all.sh` |
