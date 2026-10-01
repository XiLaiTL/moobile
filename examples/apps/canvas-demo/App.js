// 宿主侧的**全部手写代码** —— 就这 4 行。
//
// 契约实现（`MOBILE_HOST`、组件表、调度钩子、后端地址）、契约版本比对、
// 能力注册表的安装与核对，都在 `moobile-host` 包里。
//
// `moobile.js` 是 MoonBit 的构建产物，由 `npm run build` 生成（不用手写、不要提交）。
// `registry.generated.js` 由 `npx moobile-host regen` 从 package.json 的依赖生成 ——
// 加能力 = `npm install` 那个包 + 重跑 regen，不要手改。
import { installHost, mountApp } from 'moobile-host';
import { registerSkiaCanvas } from 'moobile-host/canvas-skia';
import * as Skia from '@shopify/react-native-skia';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';

// 画布通道要**显式注册**：Skia 是应用自己的依赖（宿主包不替你装 —— 它带 reanimated
// 与 worklets 两个原生依赖）。不注册的话，视图里的 `moobile:Canvas` 会 **fail-fast 报错**，
// 而不是渲染成空白 —— 那是刻意的失败模式。
//
// 手势通道**不需要**注册：`installHost` 已经把 5 个内置组件包成"手势可用"的版本
// （`PanResponder`，零依赖），`@gesture.attrs(on_pan=…)` 直接有效。
//
// ⚠️ 顺序：`registerLibrary`（`registerSkiaCanvas` 内部会调）需要 `MOBILE_HOST` 已存在，
// 而 `mountApp` 里才装 —— 所以先显式 `installHost()`。
installHost();
registerSkiaCanvas({ skia: Skia });

export default mountApp(app, { registry });
