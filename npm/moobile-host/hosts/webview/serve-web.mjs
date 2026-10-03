#!/usr/bin/env node
// serve-web.mjs —— 零依赖静态服务（`node serve-web.mjs [端口]`，默认 8123）。
//
// 为什么自己写这 30 行而不 `npx serve`：这个宿主的卖点之一就是**零额外依赖**
// （`package.json` 里没有 expo / metro / 任何 CLI），为了看一眼界面去装一个包等于把卖点拆了。
//
// ⚠️ 路径穿越要挡住：`path.resolve` 之后必须仍在 `dist/` 里（不然 `GET /../package.json`
//    就能读到工程里的任何文件）。
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
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

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

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('serve-web.mjs: 还没有 dist/ —— 先 `npm run build`');
    process.exit(2);
  }
  createStaticServer().listen(PORT, '127.0.0.1', () => {
    console.log(`静态宿主起来了：http://127.0.0.1:${PORT}/  （dist/ 就是全部基础设施）`);
  });
}
