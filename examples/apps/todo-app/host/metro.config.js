// Metro 配置 —— 目前只为 **expo-sqlite 的 Web 端**服务。
//
// 事实（依据 Expo v57 文档给 AI 的 diff：docs/public/static/diffs/sqlite-web-metro-config.diff）：
//   · web 版 expo-sqlite 在 worker 里加载 `wa-sqlite.wasm`，所以 wasm 必须当成**资源**；
//   · 它用 OPFS + (同步 API 才需要的) SharedArrayBuffer，因此需要 crossOriginIsolated，
//     也就是这两个响应头。
//
// 本项目**只用异步 API**（同步 API 在 web 上依赖 SharedArrayBuffer，是更脆的那一半），
// 但头还是照加 —— 少一个变量，且 COEP: credentialless 不会挡住同源资源。
//
// ⚠️ 改了本文件必须**重启 Metro**（dev server 的中间件在启动时装配）。

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

const prevEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const wrapped = prevEnhance ? prevEnhance(middleware, server) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    wrapped(req, res, next);
  };
};

module.exports = config;
