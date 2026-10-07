// engine.mjs —— **跨平台地**找到"程序根"（skillpress 引擎所在的那个仓），再把命令转发给它的工具。
//
//   node engine.mjs press             # == 程序根里的 tools/press.mjs
//   node engine.mjs press --check
//
// ## ⚠️ 为什么需要这个壳子（实测的坑，不是讲究）
//
// 原来 `package.json` 里写的是 POSIX 的参数展开：
//
//   "press": "node \"${SKILLPRESS_ENGINE:-../../../..}\"/tools/press.mjs"
//
// **npm 在 Windows 上用 `cmd.exe` 跑 script** —— 它不认 `${VAR:-default}`，于是那串东西**原样**
// 传给 node，报的是：
//
//   Error: Cannot find module 'D:\ai_project\interest\moobile\skills\skillpress}\tools\press.mjs'
//
// （注意那个多余的 `}` —— 一眼就能看出是"shell 写法没被展开"。）
// ⇒ 也就是说：**文档里写的 `npm run press` 在 Windows 上从来跑不通**，而本仓的主力环境就是 Windows。
// 修法不是"让用户记得先 export"（那还是得靠人记），而是把"找程序根"这件事放进 **Node** 里做：
// 那边没有 shell 方言问题，`SKILLPRESS_ENGINE` 仍然优先。
//
// ## 程序根在哪
//
// ① 环境变量 `SKILLPRESS_ENGINE`（**优先**，给"引擎搬走了/在别处"用）；
// ② 否则按**生成时算好**的那条相对路径（`{{ENGINE_REL}}`，由 `skillpress attach` 按实例落点填）。
// ⚠️ 两条都拿不到时**直接报错**，不猜 —— 猜错的表现是"站点没更新"，最难查的一类症状。
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENGINE_REL = '../../../../../skillpress';

const engine = process.env.SKILLPRESS_ENGINE
  ? path.resolve(process.env.SKILLPRESS_ENGINE)
  : path.resolve(HERE, DEFAULT_ENGINE_REL);

const [tool, ...rest] = process.argv.slice(2);
if (!tool) {
  console.error('engine.mjs：用法 `node engine.mjs <工具名> [参数…]`（例：`node engine.mjs press --check`）');
  process.exit(2);
}
const file = path.join(engine, 'tools', tool + '.mjs');
if (!fs.existsSync(file)) {
  console.error(
    `engine.mjs：在程序根里找不到工具 —— ${file}\n` +
      `  程序根是按这条算的：${engine}\n` +
      `  用 SKILLPRESS_ENGINE=<程序根> 显式指一条（不猜）。`,
  );
  process.exit(2);
}
const r = spawnSync(process.execPath, [file, ...rest], { stdio: 'inherit' });
process.exit(r.status === null ? 2 : r.status);
