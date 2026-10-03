// 静态 Web 宿主入口 —— 与 Expo 宿主（`../zhouyi-reader/index.js`）的差别只有这几行。
//
//   Expo：        import { registerRootComponent } from 'expo';  registerRootComponent(App);
//   这里（零 Expo）：RN 自己的 `AppRegistry` + 一个静态 `index.html` 里的 `#root`
//
// `verify.mjs` 会断言这个工程 `import('expo')` 直接失败、打出来的包里也没有任何
// Expo / Metro 运行时 —— 所以"它跑起来了"与 Expo 无关，是**实测**出来的。
import { AppRegistry } from 'react-native';
import App from './App.js';

AppRegistry.registerComponent('main', () => App);
AppRegistry.runApplication('main', {
  rootTag: document.getElementById('root'),
  initialProps: {},
});

// ── "自证新鲜"：打包那一刻注入的产物指纹 ─────────────────────────────────────
// ⚠️ 页面渲染出来只说明"某个 bundle 跑通了"，说明不了"跑的是**这一次**编的产物"。
//    `__ARTIFACT_SHA__` 由 `build.mjs` 在打包时算出来（`../zhouyi-reader/moobile.js` 的 sha256），
//    `verify.mjs` 会拿**服务端那一份** `artifact.json` 与磁盘上的产物比对 ——
//    这条挡的是"浏览器/服务器吃的是旧包"（本仓库踩过："两次跑出来一模一样"）。
globalThis.__ARTIFACT_SHA__ = __ARTIFACT_SHA__;
globalThis.__HOST_KIND__ = 'webview';
