// `moobile-host build` —— 把编好的 MoonBit 产物**搬进宿主目录**。
//
//   moobile-host build                        # _build/js/debug → ./moobile.js
//   moobile-host build --release
//   moobile-host build --out moobile.js
//   moobile-host build --print-path           # 只打印产物路径（给脚本用）
//
// ── 为什么这步必须存在，而且不能写成一句 `cp`（2026-09 实测）────────────────────
//
// `App.js` 里 `import { app } from './moobile.js'` 读的是 `moon build --target js` 的产物，
// 而 **Metro 只解析宿主目录内的路径** —— 所以产物必须待在工程目录里，而不能像 node
// 那样直接 import `_build/...`（antd 试金石跑在 node 里，它刻意不拷，理由相反）。
//
// 那"拷哪个文件"呢？实测（本机，2026-09）**产物路径不是模块名的函数，而是模块在构建根里身份的函数**：
//
//   独立模块（在一台干净机器的空目录里 `moon new` → `moon add XiLaiTL/moobile`，平铺）：
//       _build/js/debug/build/<模块名最后一段>.js                     例：myapp.js
//   工作区成员（仓库里 `moon.work` 的成员）：
//       _build/js/debug/build/<作者>/<模块>/<模块>.js                 例：XiLaiTL/moobile-template/moobile-template.js
//
// 于是**写死一个路径必错一边**：写死平铺 → 模板/示例在仓库里跑不起来；
// 写死嵌套 → 用户在自己机器上跑不起来。**所以这里"发现"产物：先按预测路径找，找不到就扫。**
//
// ⚠️ 还有一个陷阱：同一个 `_build/` 里可能躺着**改了名的旧模块**的产物（历史上
//    `moobile-demo` 就留在那儿）。按"最新"或"唯一"去猜都会拷错，所以这里**按模块名精确匹配**，
//    匹配到多个就报错并列出候选（歧义是要人看一眼的信号，不是可以猜的）。

const fs = require('fs');
const path = require('path');

const USAGE = `用法：moobile-host build [--release] [--out <文件>] [--module <名字>] [--print-path]

  --release         用 release 产物（默认 debug）
  --out <文件>      拷到哪（默认 moobile.js，相对当前目录）
  --module <名字>   覆盖从 moon.mod 读到的模块名（默认读最近的那个 moon.mod）
  --print-path      只打印产物路径，不拷
`;

function parseArgs(argv) {
  const out = { release: false, out: 'moobile.js', module: null, printPath: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--release') out.release = true;
    else if (a === '--out' && argv[i + 1]) out.out = argv[++i];
    else if (a === '--module' && argv[i + 1]) out.module = argv[++i];
    else if (a === '--print-path') out.printPath = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else throw new Error(`不认识的参数：${a}`);
  }
  return out;
}

/** 从 start 往上找第一个含 `name` 的目录（含 start 自己）。 */
function findUp(start, name) {
  let cur = path.resolve(start);
  for (;;) {
    const cand = path.join(cur, name);
    if (fs.existsSync(cand)) return { dir: cur, hit: cand };
    const up = path.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

/** 从 moon.mod 里读模块名（`name = "XiLaiTL/moobile-template"`）。 */
function readModuleName(moonMod) {
  const text = fs.readFileSync(moonMod, 'utf8');
  const m = text.match(/^\s*name\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error(`${moonMod} 里读不出 name = "..."`);
  return m[1];
}

/** 递归收集 dir 下的 `.js`（不含 `.js.map`）。 */
function listJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) listJs(abs, out);
    else if (name.endsWith('.js') && !name.endsWith('.js.map')) out.push(abs);
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`moobile-host build: ${err.message}\n`);
    process.stdout.write(USAGE);
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  const cwd = process.cwd();
  const profile = args.release ? 'release' : 'debug';

  // ── 模块名 ──────────────────────────────────────────────────────────────────
  const found = findUp(cwd, 'moon.mod');
  if (!found && !args.module) {
    console.error(
      `moobile-host build: 从这里往上找不到 moon.mod（${cwd}）。\n` +
        '  这条命令要在**应用工程里**跑 —— 生成出来的项目根目录有 moon.mod。',
    );
    process.exit(2);
  }
  const moduleName = args.module || readModuleName(found.hit);
  const last = moduleName.split('/').pop();

  // ── 构建根：往上找第一个有 `_build/js/<profile>/build` 的目录 ────────────────
  const buildDirName = path.join('_build', 'js', profile, 'build');
  const buildRoot = findUp(cwd, buildDirName);
  if (!buildRoot) {
    console.error(
      `moobile-host build: 找不到 ${buildDirName}/（从 ${cwd} 往上找）。\n` +
        '  先编一次：moon build --target js' +
        (args.release ? ' --release' : ''),
    );
    process.exit(2);
  }

  // ── 发现产物：先按预测路径，再扫 ────────────────────────────────────────────
  const predicted = path.join(buildRoot.hit, moduleName, `${last}.js`);
  let artifact = fs.existsSync(predicted) ? predicted : null;
  let how = '预测路径';

  if (!artifact) {
    // 预测不中：扫整个 build/ 按**文件名**匹配。
    // ⚠️ 这一步的存在本身就是证据——"路径可预测"这件事只在同一种工作区形态下成立。
    const hits = listJs(buildRoot.hit).filter((p) => path.basename(p) === `${last}.js`);
    if (hits.length === 1) {
      artifact = hits[0];
      how = '扫描（预测路径不中，按文件名唯一命中）';
    } else if (hits.length > 1) {
      console.error(
        `moobile-host build: 在 ${path.relative(cwd, buildRoot.hit)} 里找到 ${hits.length} 个 ` +
          `叫 \`${last}.js\` 的产物，**分不清是哪一个**：\n` +
          hits.map((h) => '  · ' + path.relative(cwd, h)).join('\n') +
          '\n  用 --module <模块名> 指定，或把 _build/ 清掉重编。',
      );
      process.exit(1);
    } else {
      const all = listJs(buildRoot.hit).map((p) => path.relative(buildRoot.hit, p));
      console.error(
        `moobile-host build: 找不到模块 \`${moduleName}\` 的 JS 产物。\n` +
          `  找过：${path.relative(cwd, predicted)}\n` +
          (all.length
            ? '  构建根里现有：\n' + all.map((p) => '    · ' + p).join('\n')
            : '  构建根是空的 —— moon build 真的跑了吗？') +
          '\n  常见原因：改了 moon.mod 的 name 但没重编；或编的是别的 target。',
      );
      process.exit(1);
    }
  }

  if (args.printPath) {
    console.log(artifact);
    return;
  }

  // ── 搬 ──────────────────────────────────────────────────────────────────────
  const dst = path.resolve(cwd, args.out);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(artifact, dst);

  const kb = (fs.statSync(artifact).size / 1024).toFixed(0);
  console.log(`moobile-host build: ${profile} → ${path.relative(cwd, dst) || args.out}`);
  console.log(`  ${how}：${path.relative(cwd, artifact)}（${kb} KB）`);
  console.log(`  模块 ${moduleName}`);
  if (how !== '预测路径') {
    console.log('  ⚠️ 走的是扫描：产物路径与预测的不一样 —— 看一眼 _build/ 的布局变了没有。');
  }
}

module.exports = { main, readModuleName, findUp, listJs };
