// Metro 配置。
//
// **默认这份是空的**：Expo 的默认配置本来就够用（`moobile.js` 是普通 ESM，
// `App.js` 只 import 它，不需要任何额外解析规则）。
//
// 什么时候要动它：用了**基于 wasm 的能力包**（现在只有 `expo-sqlite` 的 Web 端）。
// 那时要做两件事，缺一不可：
//   1. `config.resolver.assetExts.push('wasm')` —— 它把 `wa-sqlite.wasm` 当资源加载；
//   2. 给 dev server 加 `Cross-Origin-Embedder-Policy` / `Cross-Origin-Opener-Policy`
//      —— 它用 OPFS +（同步 API 才需要的）SharedArrayBuffer，要 crossOriginIsolated。
// 完整写法抄 `examples/apps/todo-app/host/metro.config.js`（仓库里那份验过）。
//
// ⚠️ 改了本文件必须**重启 Metro**（dev server 的中间件在启动时装配）。
// ⚠️ 用 `expo-sqlite` 还必须在 `app.json` 的 `plugins` 里加 `"expo-sqlite"`。

const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
