// `--host webview` 的宿主接线 —— 与 `--host expo` 那份**同形**，只有一处不同：
//
//   画布只注册 **DOM 2D** 那条（`canvas-web.js`，零依赖）。这个宿主只有 web 一个平台，
//   而 `canvas-svg` 是**桌面宿主**的通道（RNW 上 Skia 没有后端、也没有 DOM canvas）。
//   为了一个用不到的通道把 `react-native-svg`（连带一个 RN 本体 peer）拖进来，
//   等于把这个宿主"零额外依赖"的卖点拆了。
//
// ⚠️ 注册顺序：`registerLibrary`（`registerWebCanvas` 内部会调）需要 `MOBILE_HOST` 已存在，
//    而 `mountApp` 里才装 —— 所以先显式 `installHost()`。
import { installHost, mountApp } from 'moobile-host';
import { registerWebCanvas } from 'moobile-host/canvas-web';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';

installHost();
// 平台闸门写 `web`：`Platform.OS` 在 react-native-web 上就是 `'web'`。
// 同一个 `moobile:Canvas` 键在别的平台由别的后端接管（android/iOS → canvas-skia，windows → canvas-svg）。
registerWebCanvas();

export default mountApp(app, { registry });
