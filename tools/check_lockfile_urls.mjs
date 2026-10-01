// lockfile_url_scan.mjs —— 扫出 package-lock.json 里**只认镜像源那套写法**的坏 `resolved` URL。
//
//   node tools/check_lockfile_urls.mjs
//
// ## 为什么要这条
//
// 实测（2026-10-01）：`examples/apps/todo-app/host/package-lock.json` 里躺着一条
//   https://registry.npmmirror.com/@expo/router-examples/services/todo-server/-/router-server-57.0.10.tgz
// —— 包名明明是 `@expo/router-server`，路径里却插进了 `@expo/router-examples/services/todo-server`。
// 它 **404**。后果与"本机没事"的原因一样值得记：
//   · 本机早就装好了 node_modules → npm 不需要再取那个 tarball → 谁都没发现；
//   · **任何新鲜克隆的 `npm install` 都会挂在这儿**（新贡献者、CI 都是新鲜克隆）。
// 而 CI 那一步写着 `continue-on-error: true` → 装失败却报 success → 从"坏 URL"到"门红"
// 之间没有任何提示。两件事叠起来，才有"CI 永远红、但看不出为什么"。
//
// ## 判据（结构，不是"能不能下载"）
//
// 注册表 tarball 的 URL 形状是固定的：
//   <registry>/<包名含 scope>/-/<包名最后一段>-<版本>.tgz
// 于是**不需要联网**就能判：把 `resolved` 的路径与"包名 + 版本"对一遍，
// 对不上就点名。这比"抽查几个 URL 能不能 200"强：它是**全覆盖**的，几十毫秒跑完。
// （真要确认某个可疑项是不是同一个制品，再单独下载比 `integrity` —— 脚本给得出来命令。）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 找出仓库里所有 package-lock.json（排除 node_modules 与 _build）。 */
function findLockfiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '_build' || name === '.git' || name === '.mooncakes') continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) findLockfiles(full, out);
    else if (name === 'package-lock.json') out.push(full);
  }
  return out;
}

/**
 * 从 `packages` 的键推出包名：`node_modules/a/node_modules/@s/b` → `@s/b`。
 * 顶层包（键就是 `""`）没有 `resolved`，跳过。
 */
function nameFromKey(key) {
  const idx = key.lastIndexOf('node_modules/');
  if (idx < 0) return null;
  const rest = key.slice(idx + 'node_modules/'.length);
  return rest || null;
}

const problems = [];
let checked = 0;

for (const file of findLockfiles(ROOT)) {
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    problems.push({ file, key: '(整份)', why: `解析失败：${e.message}` });
    continue;
  }
  for (const [key, entry] of Object.entries(lock.packages || {})) {
    const url = entry && entry.resolved;
    if (!url || !/^https?:/.test(url)) continue;
    const name = nameFromKey(key);
    if (!name) continue;
    checked++;
    // 期望的尾巴：/<包名>/ -/ <最后一段>-<版本>.tgz（包名含 scope 时两段都留在路径里）
    const base = name.split('/').pop();
    const wantTail = `/${name}/-/${base}-${entry.version}.tgz`;
    // 允许 URL 带 query（部分私有源会加 ?<token>）
    // 有些源会把 scope 写成 `%40scope%2Fname` —— 先解码再比，否则会误报。
    const pathOnly = decodeURIComponent(url.split('?')[0]);
    if (!pathOnly.endsWith(wantTail)) {
      problems.push({ file, key, why: `URL 与包名对不上\n        期望尾巴 ${wantTail}\n        实际       ${pathOnly}` });
    }
  }
}

const quiet = process.argv.includes('--quiet');
const say = (...a) => { if (!quiet) console.log(...a); };
say(`扫了 ${findLockfiles(ROOT).length} 份 package-lock.json，检查 ${checked} 个 resolved URL。`);
if (!problems.length) {
  say('没发现问题 ✓');
  process.exit(0);
}
console.log(`\n坏 URL ${problems.length} 处：`);
for (const p of problems) {
  console.log(`  ${path.relative(ROOT, p.file)}`);
  console.log(`    ${p.key}`);
  console.log(`    ${p.why}`);
}
process.exit(1);
