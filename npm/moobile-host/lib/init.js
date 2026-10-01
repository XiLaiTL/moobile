// `moobile-host init` —— 脚手架：从模板生成一个能跑的项目。
//
//   moobile-host init my-app
//   moobile-host init my-app --name my-app         （目录名与包名不同时）
//   moobile-host init my-app --force               （目录已存在且非空）
//   moobile-host init my-app --dry-run             （只说要写什么，不落盘）
//
// 三件事，就这三件（**不做交互、不做平台矩阵、不装 npm 依赖**）：
//   1. 拷模板 → 目标目录；
//   2. 按 lib/placeholders.js 的清单做**纯字符串替换**（没有模板语言，见 SCAFFOLD §3.4.2）；
//   3. **断言替换干净** —— 残留即红，且**不留下半个项目**。
//
// 为什么第 3 步必须是"失败就撤"：模板用真字面量（换来"模板本身能编译、能进门"），
// 代价就是"漏参数化"只会在生成后暴露。如果那时还留下一个叫 `moobile-template` 的项目，
// 使用者会以为那是正常的名字，然后把别人的名字提交进自己的仓库。

const fs = require('fs');
const path = require('path');

const { locate, read } = require('./template.js');
const { derive, apply, assertClean, assertIdentity } = require('./placeholders.js');

const USAGE = `用法：moobile-host init <目录> [--name <应用名>] [--force] [--dry-run]

  <目录>            生成到哪（不存在就建；已存在且非空要 --force）
  --name <应用名>   应用名（默认取目录名）：小写字母/数字/连字符
  --force           目标目录非空时也往里写（会覆盖同名文件，不动其它文件）
  --dry-run         只列出将要写哪些文件、替换成什么，不落盘
`;

function parseArgs(argv) {
  const out = { dir: null, name: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name' && argv[i + 1]) out.name = argv[++i];
    else if (a === '--force') out.force = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else if (a.startsWith('-')) throw new Error(`不认识的选项：${a}`);
    else if (!out.dir) out.dir = a;
    else throw new Error(`多余的参数：${a}`);
  }
  return out;
}

/** 目录名 → 合法的应用名（`My App` → `my-app`）。 */
function nameFromDir(dir) {
  return path
    .basename(path.resolve(dir))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`moobile-host init: ${err.message}\n`);
    process.stdout.write(USAGE);
    process.exit(2);
  }
  if (args.help || !args.dir) {
    process.stdout.write(USAGE);
    process.exit(args.help ? 0 : 2);
  }

  const name = args.name || nameFromDir(args.dir);
  let values;
  try {
    values = derive(name);
  } catch (err) {
    console.error(`moobile-host init: ${err.message}`);
    process.exit(2);
  }

  const target = path.resolve(args.dir);

  // ── 目标目录检查 ────────────────────────────────────────────────────────────
  const exists = fs.existsSync(target);
  if (exists && !fs.statSync(target).isDirectory()) {
    console.error(`moobile-host init: ${args.dir} 已存在，而且不是目录。`);
    process.exit(2);
  }
  if (exists && !args.force) {
    const entries = fs.readdirSync(target).filter((n) => n !== '.git');
    if (entries.length) {
      console.error(
        `moobile-host init: 目录 ${args.dir} 已存在且非空（${entries.length} 项）。\n` +
          '  换一个目录，或加 --force 往里写（只覆盖同名文件）。',
      );
      process.exit(2);
    }
  }

  // ── 模板 ────────────────────────────────────────────────────────────────────
  let tpl;
  try {
    tpl = locate();
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const files = read(tpl.dir);

  // ── 忽略规则文件：`.npmignore` **装出来**的名字要还原成 `.gitignore`（2026-09-21 实测）────
  //
  // 用户项目里要的是 `.gitignore`（不忽略的话，`moobile.js` 与 `_build/` 会被提交进他的仓库）。
  // 但 `npm install` 解包时 **npm 会把包里的 `.gitignore` 改名成 `.npmignore`** ——
  // 实测三份样本：
  //   · `npm pack` 出来的 tarball 里：`template/.gitignore` ✓（所以 `files` 白名单那条没白写）
  //   · 手写 `tar -xzf` 解出来：`.gitignore` ✓
  //   · **`npm install` 装进 node_modules 之后：`.npmignore`** ✗ ← 就是这一步
  // 于是"从仓库布局生成"没事、"从装好的包生成"就没有 `.gitignore` —— 而我们这边永远复现不出来。
  // 这条门现在有了：`tools/package_check.mjs`（发布前跑，publish.sh 会调它）。
  let ignoreRules = 0;
  for (const f of files) {
    if (f.rel === ".npmignore" || f.rel === ".gitignore") ignoreRules++;
  }
  const normalized = files.map((f) => (f.rel === ".npmignore" ? { ...f, rel: ".gitignore" } : f));

  // 替换 + 三条断言（**先全部在内存里做完，再落盘**）──────────────────────────
  // ① 残留：旧名字还在（含各种派生写法） ② 锚点：三处身份是不是**正好**是请求的名字
  // ③ 模板里得带着忽略规则（`.gitignore` 或被 npm 改名的 `.npmignore`）
  const rendered = normalized.map((f) => ({ rel: f.rel, text: apply(f.text, values) }));
  const residue = assertClean(rendered);
  const wrongIdentity = assertIdentity(rendered, values);
  const missingIgnore = ignoreRules === 0;

  if (args.dryRun) {
    console.log(`moobile-host init（dry-run）：模板 = ${tpl.dir}`);
    console.log(`  应用名 ${values.APP_NAME}  模块名 ${values.MODULE_NAME}  包名 ${values.ANDROID_PACKAGE}`);
    console.log(`  将写入 ${target}：`);
    for (const f of rendered) console.log(`    · ${f.rel}`);
    if (residue.length || wrongIdentity.length || missingIgnore) {
      console.log('  会红：');
      for (const r of [...residue, ...wrongIdentity]) console.log(`    ! ${r}`);
      if (missingIgnore) console.log('    ! 模板里没有 .gitignore / .npmignore');
      process.exit(1);
    }
    return;
  }

  if (residue.length || wrongIdentity.length || missingIgnore) {
    console.error('moobile-host init: 这个模板是坏的 —— 这是生成器/模板的问题，');
    console.error('  不是你的操作问题。**没有写出任何文件**（半成品项目比报错更难查）。');
    for (const r of residue) console.error('  ! ' + r);
    for (const r of wrongIdentity) console.error('  ! ' + r);
    if (missingIgnore) {
      console.error('  ! 模板里既没有 .gitignore 也没有 .npmignore —— 生成出来的项目会把');
      console.error('    `moobile.js` / `_build/` 一起提交进使用者的仓库（我们不替他做这个决定）。');
    }
    console.error('');
    console.error('  修哪里：');
    console.error('    · 残留 → 模板里那处字面量要写进 lib/placeholders.js 的清单，或者从模板里去掉；');
    console.error('    · 锚点 → 模板的 moon.mod / package.json / app.json 是不是被改了名而清单没跟着改；');
    console.error('    · 忽略规则 → 真源 examples/apps/template/.gitignore 是不是丢了（打包形态见');
    console.error('      tools/package_check.mjs 的说明：npm 解包会把它改名成 .npmignore，由本文件还原）。');
    process.exit(1);
  }

  // ── 落盘 ────────────────────────────────────────────────────────────────────
  fs.mkdirSync(target, { recursive: true });
  for (const f of rendered) {
    const dst = path.join(target, f.rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, f.text);
  }

  console.log(`moobile-host init: 生成 ${path.relative(process.cwd(), target) || '.'} —— ${rendered.length} 个文件`);
  console.log(`  模板：${tpl.dir}`);
  console.log(`  应用名 ${values.APP_NAME} · 模块名 ${values.MODULE_NAME} · Android 包名 ${values.ANDROID_PACKAGE}`);
  console.log('');
  console.log('  接下来：');
  const cd = path.relative(process.cwd(), target);
  if (cd) console.log(`    cd ${cd}`);
  console.log('    npm install');
  console.log('    npm run web        # 或 npm run android');
  console.log('');
  console.log('  前提：机器上要有 moon 与 node（见生成出来的 README）。');
}

module.exports = { main, nameFromDir };
