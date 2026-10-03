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
const { resolveHost, HOST_IDS } = require('./hosts.js');
const { derive, apply, assertClean, assertIdentity } = require('./placeholders.js');

const USAGE = `用法：moobile-host init <目录> [--name <应用名>] [--host <宿主>] [--force] [--dry-run]

  <目录>            生成到哪（不存在就建；已存在且非空要 --force）
  --name <应用名>   应用名（默认取目录名）：小写字母/数字/连字符
  --host <宿主>     用哪个宿主（默认 expo）：${HOST_IDS.join(' | ')}
                      · expo = Expo（android / ios / web 一次到位）
                      · rnw  = 裸 RN + react-native-windows（Windows 桌面）
                    **应用侧（moon.mod / moon.pkg / app.mbt）两种宿主下逐字相同** ——
                    换宿主只换那几个宿主文件（package.json / App.js / index.js / app.json / metro.config.js…）
  --force           目标目录非空时也往里写（会覆盖同名文件，不动其它文件）
  --dry-run         只列出将要写哪些文件、替换成什么，不落盘
`;

function parseArgs(argv) {
  const out = { dir: null, name: null, host: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name' && argv[i + 1]) out.name = argv[++i];
    else if (a === '--host' && argv[i + 1]) out.host = argv[++i];
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

/**
 * 生成物的**内存形态**（不落盘）—— `init` 与 `create --from-rabbita` 共用这一份。
 *
 * 为什么抽出来而不是各写一遍：模板渲染里的三条断言（残留 / 身份锚点 / 忽略规则）
 * 是"模板是真字面量"这个取舍的**对价**。抄一份到 `create` 去，早晚会漂 ——
 * 而漂掉的那半边会以"用户拿到一个叫别人名字的项目"的形式暴露，且**没有任何门会红**
 * （`template_check` 只测 `init`）。
 *
 * @param {string} name 应用名（kebab-case）
 * @returns {{values: any, tplDir: string, files: {rel: string, text: string}[], problems: string[], missingIgnore: boolean}}
 */
function renderProject(name, opts = {}) {
  const values = derive(name);
  const host = resolveHost(opts.host);
  const tpl = locate();
  // 宿主文件集**覆盖**模板里的同名文件（模板本身就是 expo 宿主，所以 expo 档不需要额外文件集）
  const merged = new Map(read(tpl.dir).map((f) => [f.rel, f]));
  const fromHost = host.filesDir ? read(host.filesDir) : [];
  // ⚠️ 宿主文件集里的 **`gitignore`（无点）在写盘时要变成 `.gitignore`** ——
  //    因为 `npm pack` 永远不打 `.gitignore`（实测：单独列进 `files` 也没用），
  //    真源里叫那个名字的话，发布出去的宿主文件集里就会缺这一份。
  for (const f of fromHost) {
    const rel = f.rel === 'gitignore' ? '.gitignore' : f.rel;
    merged.set(rel, { ...f, rel });
  }
  // 宿主文件集只覆盖同名文件，**删不掉**模板里的宿主专属文件（Expo 模板的 `app.json` /
  // `metro.config.js`）—— 所以宿主可以显式声明 `drop`。不删的话生成物里留着别的宿主的
  // 配置文件，用户会以为还要装那个宿主（实测踩到，见 hosts.js 里 webview 那段）。
  for (const rel of host.drop || []) merged.delete(rel);
  const files = [...merged.values()];

  // 忽略规则文件：`.npmignore`（npm 解包时把 `.gitignore` 改成了它）要还原回来 ——
  // 用户项目里要的是 `.gitignore`，不忽略的话 `moobile.js` 与 `_build/` 会被提交进他的仓库。
  let ignoreRules = 0;
  for (const f of files) if (f.rel === '.npmignore' || f.rel === '.gitignore') ignoreRules++;
  const normalized = files.map((f) => (f.rel === '.npmignore' ? { ...f, rel: '.gitignore' } : f));

  const rendered = normalized.map((f) => ({ rel: f.rel, text: apply(f.text, values) }));
  const problems = [...assertClean(rendered), ...assertIdentity(rendered, values, { host: host.id })];
  return {
    values,
    host,
    tplDir: tpl.dir,
    files: rendered,
    problems,
    missingIgnore: ignoreRules === 0,
  };
}

/** 把内存形态落盘。 */
function writeProject(target, files) {
  fs.mkdirSync(target, { recursive: true });
  for (const f of files) {
    const dst = path.join(target, f.rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, f.text);
  }
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
  //
  // 渲染逻辑**只有一份**（`renderProject`），`create --from-rabbita` 用的是同一个函数：
  // 抄第二份出来，早晚会漂，而漂掉的那半边没有任何门会红。
  let plan;
  try {
    plan = renderProject(name, { host: args.host });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const { values: planValues, tplDir, files: rendered, problems } = plan;
  const residue = problems.filter((p) => !p.includes('应当是'));
  const wrongIdentity = problems.filter((p) => p.includes('应当是'));
  const missingIgnore = plan.missingIgnore;
  if (args.dryRun) {
    console.log(`moobile-host init（dry-run）：模板 = ${tplDir} · 宿主 = ${plan.host.label}`);
    console.log(`  应用名 ${planValues.APP_NAME}  模块名 ${planValues.MODULE_NAME}  包名 ${planValues.ANDROID_PACKAGE}`);
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
  console.log(`  宿主：${plan.host.label}`);
  console.log(`  模板：${tplDir}`);
  console.log(`  应用名 ${planValues.APP_NAME} · 模块名 ${planValues.MODULE_NAME} · Android 包名 ${planValues.ANDROID_PACKAGE}`);
  console.log('');
  console.log('  接下来：');
  const cd = path.relative(process.cwd(), target);
  if (cd) console.log(`    cd ${cd}`);
  console.log('    npm install');
  console.log(
    plan.host.id === 'rnw'
      ? '    npm run windows    # 桌面（要 VS 2026 + SDK 22621）；不上工具链可先 `npm run bundle:windows`'
      : plan.host.id === 'webview'
        ? '    npm run build      # 打成静态站点（dist/）\n    npm run serve      # 起静态服务看一眼（零依赖）'
        : '    npm run web        # 或 npm run android',
  );
  console.log('');
  console.log('  前提：机器上要有 moon 与 node（见生成出来的 README）。');
}

module.exports = { main, nameFromDir, renderProject, writeProject };
