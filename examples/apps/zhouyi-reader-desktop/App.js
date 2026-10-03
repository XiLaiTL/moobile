// 桌面宿主的**全部手写代码** —— 与 Expo 模板的 `App.js` 同形，只有两处不同：
//
//   ① **宿主换成了裸 RN + react-native-windows**（没有 Expo：Expo 57 钉 RN 0.86.3，
//      而 RNW 0.83.2 要 RN 0.83.x —— 两个宿主各自 pin 自己的版本，共用同一份 MoonBit 产物）；
//   ② 画布走 **SVG** 那条后端：Windows 上既没有 DOM canvas，Skia 也没有 Windows 后端
//      （见 `npm/moobile-host/canvas-svg.js` 的文件头与 `docs/design/DESKTOP-RNW.md`）。
//
// `moobile.js` 是**隔壁应用工程**的构建产物（`examples/apps/zhouyi-reader/` 里 `npm run build`
// 生成）。桌面宿主不重新编 MoonBit —— 同一份产物在三个宿主上跑，这正是"宿主是可替换件"。
import { installHost, mountApp } from 'moobile-host';
import { registerSvgCanvas } from 'moobile-host/canvas-svg';
import * as Svg from 'react-native-svg';
import { app } from '../zhouyi-reader/moobile.js';
import { registry } from './registry.generated.js';

// ⚠️ 顺序：`registerLibrary`（`registerSvgCanvas` 内部会调）需要 `MOBILE_HOST` 已存在，
//    而 `mountApp` 里才装 —— 所以先显式 `installHost()`。
installHost();
// 平台闸门写 `windows`：`Platform.OS` 在 RNW 上就是 `'windows'`。
// 同一份 `moobile:Canvas` 键在别的平台由别的后端接管（web → canvas-web，android/iOS → canvas-skia）。
registerSvgCanvas({ svg: Svg, platforms: ['windows'] });

export default mountApp(app, { registry });
