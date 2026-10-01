// **裸 RN(Web) 宿主入口** —— C0 实验的全部差别就在这个文件。
//
// 对照 Expo 侧（`examples/apps/template/index.js`）：
//
//   import { registerRootComponent } from 'expo';      // ← Expo 的入口约定
//   registerRootComponent(App);
//
// 这边用的是 **RN 自己的 `AppRegistry`**，而且**一个 expo 包都不 import**：
// `verify.mjs` 会断言这个工程 `import('expo')` 直接失败，也会断言打出来的包里
// 一个 `node_modules/expo*` 都没有 —— 所以"它跑起来了"跟 Expo 无关，是**实测**。
//
// ⚠️ `react-native` 这个名字由**构建配置**映射到 `react-native-web`
//    （esbuild 的 `--alias`，等价于 Metro / Expo 在 web 平台做的事）。
//    这正是"换宿主"的全部代价：**换入口这几行 + 换一行 resolver 配置**，
//    而库、产物、应用侧代码（`App.js`）一个字节都不用动。
import { AppRegistry } from 'react-native';
import App from './App.js';

AppRegistry.registerComponent('main', () => App);
AppRegistry.runApplication('main', {
  rootTag: document.getElementById('root'),
  initialProps: {},
});

// ── 两条"自证新鲜"的标记（由 verify.mjs 在打包时注入）─────────────────────────
// ⚠️ 为什么需要它：页面渲染出来只能说明"某个 bundle 跑通了"，说明不了"跑的是**这一次**编的
//    产物"。`__ARTIFACT_SHA__` 是 verify.mjs 在打包那一刻算出来的 `moobile.js` 的 sha256 ——
//    页面上读到的必须与磁盘上那份一致，否则说明浏览器吃的是旧包（这正是本仓库踩过的
//    "读到陈旧产物"那一类坑）。
globalThis.__ARTIFACT_SHA__ = __ARTIFACT_SHA__;
globalThis.__HOST_KIND__ = 'bare-rnw';
