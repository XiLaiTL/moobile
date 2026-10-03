// 宿主侧的**全部手写代码** —— 就这 4 行。
//
// 契约实现（`MOBILE_HOST`、组件表、调度钩子、后端地址）、契约版本比对、
// 能力注册表的安装与核对，都在 `moobile-host` 包里。
//
// `moobile.js` 是 MoonBit 的构建产物，由 `npm run build` 生成（不用手写、不要提交）。
// `registry.generated.js` 由 `npx moobile-host regen` 从 package.json 的依赖生成 ——
// 加能力 = `npm install` 那个包 + 重跑 regen，不要手改。
import { Platform } from 'react-native';
import { installHost, mountApp } from 'moobile-host';
import { registerWebCanvas } from 'moobile-host/canvas-web';
import { registerSvgCanvas } from 'moobile-host/canvas-svg';
import * as Svg from 'react-native-svg';
// ⚠️ 原生那条后端走**平台文件**（`canvas-native.js` / `canvas-native.web.js`）——
//    不能在这里直接 import Skia：它在 web 平台**打包期**就解析不过（见那两个文件的说明）。
// ⚠️ 导入**不要带扩展名**：写成 './canvas-native.js' 会把平台文件解析锁死在 .js 上
//    （Metro 只在**无扩展名**的导入上按平台挑 canvas-native.web.js）。实测踩过。
import { registerNativeCanvas } from './canvas-native';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';

// 画布通道要**显式注册**：视图里的 `moobile:Canvas` 没后端时**点名报错**，
// 而 React 收到渲染期异常会把整棵树卸掉 —— 现象是整页空白、控制台还看不出是本页的问题。
//
// 这里注册的是 **Web 后端**（DOM 2D 重放同一份 draw-op，零依赖）。
// 原生（Android / iOS）该走 `moobile-host/canvas-skia` + `@shopify/react-native-skia`；
// 桌面（RNW）Skia 没有 Windows 后端，要走 `react-native-svg` —— 见 `docs/design/DESKTOP-RNW.md`。
//
// ⚠️ 顺序：`registerLibrary` 需要 `MOBILE_HOST` 已存在，而 `mountApp` 里才装 ——
//    所以先显式 `installHost()`。
installHost();
// 两条后端各管各的平台（`registerLibrary` 的 `platforms` 闸门）：
//   · web        → `canvas-web.js`（DOM 2D，零依赖）
//   · android/iOS → `canvas-skia.js` + `@shopify/react-native-skia`（真 Skia）
// ⚠️ 桌面（RNW）两条都不适用：Skia 没有 Windows 后端，要换 `react-native-svg`
//    —— 见 `docs/design/DESKTOP-RNW.md`。
// ⚠️ 两个都调用是**刻意**的：闸门按平台挑，谁也不会抢谁的键。
// ⚠️ `registerLibrary` 的平台闸门是**严格的**：在 android 上调 web-only 的那条会**直接抛**，
//    表现是启动即红屏（实测踩到：`组件库 moobile 声明只在 [web] 上可用，而当前平台是 android`）。
//    所以两条都要按平台分支 —— 而且两条用的**不是同一种**分支手段，各有原因：
//      · web 这条用**运行期**判断就够了（`canvas-web.js` 只依赖 react，任何平台都能打包）；
//      · 原生那条必须用**平台文件**（`canvas-native` / `canvas-native.web`），
//        因为 Skia 在 web 上连 Metro 的解析都过不去（见 `canvas-native.js` 的说明）。
// 画布后端按平台挑（`registerLibrary` 的 `platforms` 闸门）：三条后端各管一段，谁也不抢谁的键
//   · android / iOS → Skia（`canvas-native`，平台文件）
//   · web           → 默认 DOM 2D（`canvas-web`）；`EXPO_PUBLIC_CANVAS=svg` 时改用 SVG
//   · windows（桌面）→ SVG（`canvas-svg` + `react-native-svg`）—— RN 里没有 DOM canvas，
//     而 Skia 又没有 Windows 后端，SVG 是唯一现成的矢量通道
//
// ⚠️ web 上那条 `svg` 分支不只是"另一种画法"：它**就是桌面端要走的那条代码路径**，
//    所以在这台机器上（装不了 RNW 工具链）它是我能验证桌面画布的唯一手段。
const webCanvas = process.env.EXPO_PUBLIC_CANVAS === 'svg' ? 'svg' : 'dom';
if (Platform.OS === 'web') {
  if (webCanvas === 'svg') registerSvgCanvas({ svg: Svg, platforms: ['web'] });
  else registerWebCanvas();
}
registerNativeCanvas();  // android/iOS：真 Skia；web 上这个函数是空实现

// ⚠️ **数据不走网络**：阅读数据是**编译期嵌进产物**的（见 `data_reader.mbt`），
//    所以这里不需要给 `apiBase` 指任何后端 —— 三端（web / 桌面 / Android）同一条路。
//
//    迁移时先试过"同源相对路径 + `public/reader_data.json`"（Expo 会把工程根的 `public/`
//    挂在站点根，`GET /reader_data.json` 实测 200），但那条路有**两个**过不去的地方：
//      ① 原生端没有"站点根"这回事；
//      ② moobile 的 http 走 `moonbitlang/async`，它**只认完整 URL**（相对路径直接
//         `InvalidFormat`）—— 界面上只有一句"无法加载数据"，真因是在浏览器控制台逼出来的。
//    1.7 MB 的只读数据嵌进产物，换来的是：启动即读、离线可读、三端零差异。
export default mountApp(app, { registry });
