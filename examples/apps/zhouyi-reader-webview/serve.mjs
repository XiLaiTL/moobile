#!/usr/bin/env node
// serve.mjs —— 零依赖静态服务（`node serve.mjs [端口]`，默认 8123）。
//
// 为什么自己写这 30 行而不是 `npx serve`：
//   ① **零依赖**是这个宿主的卖点之一（`package.json` 里没有 expo / metro / 任何 CLI），
//      为了看一眼界面去装一个包，等于把卖点拆了；
//   ② `verify.mjs` 也要起同一个服务 —— 两份实现必然漂（本仓库的老账）。
//
// ⚠️ 路径穿越要挡住：`path.resolve` 之后必须仍在 `dist/` 里（不然 `GET /../package.json`
//    就能读到仓库里的任何文件）。
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 8123);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** 建一个只服务 `dist/` 的 http 服务（verify.mjs 也用这个函数，所以**导出**）。 */
export function createStaticServer(dist = DIST) {
  return http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(dist, rel);
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
}

// 直接 `node serve.mjs` 时起服务；被 `import` 时只导出（verify.mjs 走这条路）
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`serve.mjs: 还没有 dist/ —— 先跑 \`node build.mjs\``);
    process.exit(2);
  }
  createStaticServer().listen(PORT, '127.0.0.1', () => {
    console.log(`静态宿主起来了：http://127.0.0.1:${PORT}/  （dist/ 就是全部基础设施）`);
  });
}
