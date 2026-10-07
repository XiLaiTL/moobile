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
//   Error: Cannot find module '<...>}\tools\press.mjs'
//   ⚠️ 这一行原来把**本机绝对路径**原样抄了进来（`tools/check_public_leaks.py` 当场点名）。
//      引报错文本里带路径是对的，但**抄进仓库**就等于把某个人的盘符一起发了出去 ⇒
//      引报错时一律把路径那截写成 `<...>`。
//
// （注意那个多余的 `}` —— 一眼就能看出是"shell 写法没被展开"。）
// ⇒ 也就是说：**文档里写的 `npm run press` 在 Windows 上从来跑不通**，而本仓的主力环境就是 Windows。
// 修法不是"让用户记得先 export"（那还是得靠人记），而是把"找程序根"这件事放进 **Node** 里做：
// 那边没有 shell 方言问题，`SKILLPRESS_ENGINE` 仍然优先。
//
//
// ## ⚠️ 还有一个"读数指到别人身上"的坑（所以 `package.json` 里写了 `--app .`）
//
// `tools/press.mjs` 的**默认** `--app` 是按"程序根旁边的内容仓"算的
// （`<skills>/skillpress/scripts/.skillpress`）⇒ 在实例里直接 `node <引擎>/tools/press.mjs`
// 会去**改/查内容仓那份实例**，而不是脚下这一份。实测：在程序仓的实例里跑 `press:check`，
// 打印出来的路径是 `…/moobile/skills/skillpress/scripts/.skillpress/…`。
// ⇒ 所以两个 npm script 都显式带 `--app .`（npm 跑 script 时 cwd 就是实例目录）。
// 这也是本仓那条老规矩的又一例：**读数要能回答"它指的是谁"**。
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
// ⚠️ 工具住在两处，**先看随包发的那一处**（2026-10-07 加）：
//    · `launcher/`  —— **随包发**（`press` 就住这儿）：用户装下来的包里只有它；
//    · `tools/`     —— 开发期脚本（`.moonignore` 排掉了 `/tools/`）。
//    原来只找 `tools/` ⇒ 从 registry 装的包生成出来的站点工程跑 `npm run press` 会报
//    「在程序根里找不到工具 —— <包>/tools/press.mjs」（用户那边根本没有 `tools/`）。
//    两处都找、**先 launcher**，并让错误信息把"找过哪两处"打出来（不猜、也不装作只有一处）。
const candidates = [
  path.join(engine, 'launcher', tool + '.mjs'),
  path.join(engine, 'tools', tool + '.mjs'),
];
const file = candidates.find((c) => fs.existsSync(c));
if (!fs.existsSync(file)) {
  console.error(
    `engine.mjs：在程序根里找不到工具 —— ${tool}.mjs\n` +
    `  找过：\n${candidates.map((c) => '    ' + c).join('\n')}\n` +
    `  程序根是按这条算的：${engine}\n` +
    `  用 SKILLPRESS_ENGINE=<程序根> 显式指一条（不猜）。`,
  );
  process.exit(2);
}
const r = spawnSync(process.execPath, [file, ...rest], { stdio: 'inherit' });
process.exit(r.status === null ? 2 : r.status);
