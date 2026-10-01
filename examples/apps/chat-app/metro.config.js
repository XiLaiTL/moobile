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

const config = getDefaultConfig(__dirname);

// ── 接 markdown 组件要的一行（2026-10-02 实测撞出来的）────────────────────────
//
// 症状：Android 打包**直接失败**（不是运行时才坏）：
//
//   The package at "node_modules/markdown-it/lib/index.js" attempted to import
//   the Node standard library module "punycode".
//   It failed because the native React runtime does not include the Node standard library.
//
// 真因：`react-native-markdown-display` 用 `markdown-it` 解析 markdown，而 `markdown-it`
// 里有一句 `require('punycode')` —— 那是 **Node 的内置模块**，RN 运行时**没有**它。
// （web 上没这个问题：打包器会去 node 的 builtin 里取；所以这是**只在真机打包时才炸**的一类坑。）
//
// 修法：把 `punycode` 指到 npm 上的 **userland 同名包**（`punycode@2.x`，与 Node 内置同名同语义）。
// ⚠️ 它必须是一条**依赖**（`npm i punycode`），不能只在配置里指路径 —— 那样新鲜克隆会缺件。
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  punycode: require.resolve('punycode/'),
};

module.exports = config;
