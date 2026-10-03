// 宿主侧的全部手写代码（桌面壳里的"渲染进程"入口）—— 与静态 Web 宿主同一份。
//
// ⚠️ 这份文件是"**宿主是可替换件**"的第三份证据（前两份：Expo 宿主、`--host rnw` 桌面宿主）。
//    它与 Expo 那份的差别只有两处，都是**宿主自己的事**：
//      ① 没有 `canvas-native`（平台文件 → Skia）：这个宿主只有 Web 一个平台，
//         而那条分支在 web 上本来就是空实现；
//      ② 画布后端走 `canvas-web`（DOM 2D，零依赖），可选 `canvas-svg`（`EXPO_PUBLIC_CANVAS=svg`）。
//    应用侧（`../zhouyi-reader/main.mbt`、`moobile.js`、`registry.generated.js`）**一个字节都不动**。
//
// `react-native` 这个名字由**构建配置**映射到 `react-native-web`（`build.mjs` 里一行 `alias`，
// 等价于 Metro / Expo 在 web 平台做的事）—— 这就是"换宿主"的全部代价。
import { Platform } from 'react-native';
import { installHost, mountApp } from 'moobile-host';
import { registerWebCanvas } from 'moobile-host/canvas-web';
import { app } from '../zhouyi-reader/moobile.js';
// 注册表也吃应用那一份（不复制，免得两边漂）
import { registry } from '../zhouyi-reader/registry.generated.js';

// ⚠️ 顺序：`registerLibrary` 需要 `MOBILE_HOST` 已存在，而 `mountApp` 里才装 —— 所以先显式 install。
installHost();
// 画布后端：这个宿主**只**注册 DOM 2D 那条（`canvas-web.js`，零依赖）。
//
// ⚠️ 为什么这里不挂 `canvas-svg`：那条是**桌面宿主**的通道（RNW 上 Skia 没有后端、也没有 DOM
//    canvas），它的判据在 Expo 宿主那边用 `EXPO_PUBLIC_CANVAS=svg` 验过（同一套 45 条）。
//    这个宿主的定位是"**零额外依赖的静态外壳**"——为了一个用不到的通道把
//    `react-native-svg`（连带一个 RN 本体 peer）拖进来，等于把卖点拆了。
//    （实测：装它会撞 peer 冲突，`react@19.2.0` vs RN 0.87 要的 `^19.2.3`。）
if (Platform.OS === 'web') {
  registerWebCanvas();
}

// ⚠️ **数据不走网络**：阅读数据是**编译期嵌进产物**的（`../zhouyi-reader/data_reader.mbt`），
//    所以这里不需要给 `apiBase` 指任何后端 —— 静态文件服务器就是全部基础设施。
export default mountApp(app, { registry });
