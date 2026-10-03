// `--host rnw` 的宿主接线 —— 与 `--host expo` 那份**同形**，只有两处不同：
//
//   ① 宿主换成**裸 RN + react-native-windows**（不带 Expo：Expo 钉的 RN 版本与 RNW 要的
//      对不上，而 RN 版本由宿主决定、库不绑版本）；
//   ② 画布走 **SVG** 那条后端 —— Windows 上既没有 DOM canvas，Skia 也没有 Windows 后端
//      （见 `moobile-host/canvas-svg.js` 的文件头）。
//
// ⚠️ 注册顺序：`registerLibrary`（`registerSvgCanvas` 内部会调）需要 `MOBILE_HOST` 已存在，
//    而 `mountApp` 里才装 —— 所以先显式 `installHost()`。
import { installHost, mountApp } from 'moobile-host';
import { registerSvgCanvas } from 'moobile-host/canvas-svg';
import * as Svg from 'react-native-svg';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';

installHost();
// 平台闸门写 `windows`：`Platform.OS` 在 RNW 上就是 `'windows'`。
// 同一个 `moobile:Canvas` 键在别的平台由别的后端接管（web → canvas-web，android/iOS → canvas-skia）。
registerSvgCanvas({ svg: Svg, platforms: ['windows'] });

export default mountApp(app, { registry });
