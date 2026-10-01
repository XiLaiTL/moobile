'use strict';
// index.js —— `libgen` 的入口：**一条命令、一份 manifest、两个产物**（PLAN §3.8 的 I2 / I3 / I5）。
//
//     应用装好的组件库（node_modules/**/*.d.ts）
//             │  ① 抽「组件 → prop 名 + 类别」              ← I2
//             ▼
//        manifest（JSON：入库、可 diff、可手改兜底）
//             │  ② 宿主侧注册调用（components / jsonProps / events / wrap / platforms）  ← I5
//             │  ③ MoonBit DSL 包（`@antd.button(...)` 这种平级 DSL）                    ← I3
//             ▼
//        应用侧生成物（入库 + `--check`）
//
// **为什么必须"一条命令、一份 manifest、两个产物"**：宿主侧认的是**名字**
// （`MOBILE_HOST.components["antd:Button"]`），MoonBit 侧发的也是**名字**（标签字符串）。
// 两边各写一份清单就是等着漂；同源于一份 manifest 才是"两侧不会对不上"的**机制保证**。
//
// `--check` 是这个保证的判据：**任一侧被手改都会红**（与 `regen`、`gen_forwarders` 同规矩）。

const fs = require('fs');
const path = require('path');
const { buildManifest } = require('./manifest');
const { emitHost } = require('./emit-host');
const { emitMoonbit, emitMoonPkg } = require('./emit-moonbit');
const GENERATOR_VERSION = require('../package.json').version;

const CONFIG_NAME = 'libgen.config.json';

/**
 * 应用侧配置（可选）。没写也能跑：默认就是 antd 那一套。
 *
 * 两条约定值得写清楚，因为踩过：
 *   1. **配置要向上找**（像 node_modules 一样）。npm 工程在 `host/`，而命令从 `host/` 跑；
 *      配置却属于**应用**（写在应用根）—— 第一版只在 cwd 找，于是"配置根本没被读到"，
 *      产物全落进了 `host/` 里面（`host/host/libraries.generated.js` 这种路径就是它的指纹）。
 *   2. **产物路径相对配置文件**，不是相对 cwd。这样 `out` 里永远不用写 `../`，
 *      写的人不需要知道命令是在哪一层跑的。
 */
function loadConfig(appDir, argv) {
  const file = findConfig(appDir);
  const base = file ? path.dirname(file) : appDir;
  let cfg = {};
  if (file) {
    try {
      cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`libgen: ${file} 不是合法 JSON —— ${e.message}`);
    }
  }
  const libs = cfg.libraries || [];
  const target = argv.lib || (libs[0] && libs[0].namespace);
  const lib = libs.find((l) => l.namespace === target) || libs[0] || {};
  return {
    file,
    base,
    lib: {
      namespace: argv.namespace || lib.namespace || 'antd',
      package: argv.package || lib.package || lib.namespace || 'antd',
      platforms: lib.platforms || ['web'],
      provider: lib.provider === undefined ? null : lib.provider,
      exclude: lib.exclude || [],
      // `content`：哪些组件的 children 是**原始字符串**（而不是子节点）。
      // 数组写法 = 都进 `children` prop；对象写法可以点名落点。见 manifest.js 的 `applyContent`。
      content: lib.content || null,
      // `defaultExports`：这些组件在 JS 里**只在 `default` 上**（类型定义谎报了具名导出）。
      // 真事：react-native-markdown-display 的 `Markdown`；只在真机上露头（web 的 interop 能看见）。
      defaultExports: lib.defaultExports || [],
      out: {
        manifest: (lib.out && lib.out.manifest) || `generated/${lib.namespace || 'antd'}.manifest.json`,
        host: (lib.out && lib.out.host) || `host/libraries.generated.js`,
        moonbit: (lib.out && lib.out.moonbit) || `${lib.namespace || 'antd'}`,
      },
      moonbit: lib.moonbit || {},
    },
  };
}

function parseArgs(argv) {
  const out = { check: false, quiet: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') out.check = true;
    else if (a === '--quiet') out.quiet = true;
    else if (a === '--verbose') out.verbose = true;
    else if (a === '--lib') out.lib = argv[++i];
    else if (a === '--package') out.package = argv[++i];
    else if (a === '--namespace') out.namespace = argv[++i];
    else if (a === '--out-dir') out.outDir = argv[++i];
  }
  return out;
}

/** 生成全部产物（返回 [{file, text}]，**不落盘** —— 好让 `--check` 与写入共用一条路径）。 */
function plan(cwd, argv) {
  const cfg = loadConfig(cwd, argv);
  // 产物根 = 配置文件所在目录（见 loadConfig 的说明）；`--out-dir` 可以覆盖。
  const base = argv.outDir ? path.resolve(cwd, argv.outDir) : cfg.base;
  const lib = cfg.lib;
  const manifest = buildManifest({
    appDir: cwd,
    packageName: lib.package,
    namespace: lib.namespace,
    platforms: lib.platforms,
    provider: lib.provider,
    exclude: lib.exclude,
    content: lib.content,
    defaultExports: lib.defaultExports,
    generatorVersion: GENERATOR_VERSION,
  });
  const hostText = emitHost(manifest, {});
  const moon = emitMoonbit(manifest, {});
  const moonPkg = emitMoonPkg(manifest, lib.moonbit || {});
  const files = [
    { file: path.resolve(base, lib.out.manifest), text: JSON.stringify(manifest, null, 2) + '\n', kind: 'manifest' },
    { file: path.resolve(base, lib.out.host), text: hostText, kind: 'host' },
    {
      file: path.resolve(base, lib.out.moonbit, 'components.generated.mbt'),
      text: moon.text,
      kind: 'moonbit',
    },
    { file: path.resolve(base, lib.out.moonbit, 'moon.pkg'), text: moonPkg, kind: 'moon.pkg' },
  ];
  return { cfg, lib, manifest, files, moonStats: moon.stats };
}

function run(argv, cwd = process.cwd()) {
  const args = parseArgs(argv);

  // `--check` 的失败必须**指名道姓**：哪一份、怎么重建。
  // 本仓库有过多起"生成物与源码不一致而门是绿的"事故（tools/check_npm_fresh.mjs 的注释里有完整记录），
  // 所以这里宁可多打几行，也不让人去猜。
  const { lib, manifest, files, moonStats } = plan(cwd, args);

  if (moonStats.collisions.length) {
    console.error('libgen: 参数名冲突（两个 prop 映射到同一个 MoonBit 参数名）：');
    for (const c of moonStats.collisions.slice(0, 20)) console.error('  · ' + c);
    console.error('  这是生成器的规则问题，不是配置问题 —— 请修 snake() 或加例外表。');
    process.exit(2);
  }

  if (args.check) {
    const bad = [];
    for (const f of files) {
      const old = fs.existsSync(f.file) ? fs.readFileSync(f.file, 'utf8') : null;
      if (old !== f.text) bad.push(f);
    }
    if (!bad.length) {
      if (!args.quiet) {
        console.log(`libgen --check: 一致（${files.length} 份产物，组件 ${manifest.counts.components} 个）`);
      }
      return 0;
    }
    console.error('libgen --check: 生成物与 manifest 不一致 —— 这条门就是为这件事存在的。');
    console.error('');
    for (const f of bad) {
      const rel = path.relative(cwd, f.file).split('\\').join('/');
      const old = fs.existsSync(f.file) ? fs.readFileSync(f.file, 'utf8') : null;
      if (old === null) console.error(`  缺失      ${rel}`);
      else {
        const a = old.split('\n');
        const b = f.text.split('\n');
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        console.error(`  不一致    ${rel}（第 ${i + 1} 行起）`);
        console.error(`            现在: ${JSON.stringify((a[i] || '').slice(0, 100))}`);
        console.error(`            应为: ${JSON.stringify((b[i] || '').slice(0, 100))}`);
      }
    }
    console.error('');
    console.error('  改的是**产物**还是**清单**？两者只能改一个：');
    console.error('    · 想改行为 → 改 libgen.config.json / manifest，然后重跑 `libgen`；');
    console.error('    · 手改了产物 → 请撤回（产物是承诺面，下次重跑会被覆盖）。');
    return 1;
  }

  let written = 0;
  let unchanged = 0;
  for (const f of files) {
    const old = fs.existsSync(f.file) ? fs.readFileSync(f.file, 'utf8') : null;
    if (old === f.text) {
      unchanged++;
      continue;
    }
    fs.mkdirSync(path.dirname(f.file), { recursive: true });
    fs.writeFileSync(f.file, f.text);
    written++;
  }
  if (!args.quiet) {
    const rel = (p) => path.relative(cwd, p).split('\\').join('/');
    console.log(
      `libgen: ${lib.package}@${manifest.library.version} → 组件 ${manifest.counts.components} 个｜` +
        `prop ${manifest.counts.props}（进 DSL ${moonStats.paramTotal}）｜` +
        `写入 ${written} 份、未变 ${unchanged} 份`,
    );
    for (const f of files) console.log(`  ${rel(f.file)}`);
    const r = manifest.report;
    console.log(
      `  报告：入口值导出被排除 ${r.excluded.length} 个（无 Props 接口：` +
        `${r.excluded.map((e) => e.name).join(', ') || '无'}）`,
    );
    const unc = r.unresolved_extends.length;
    if (unc) {
      console.log(`  ⚠️ 有 ${unc} 处 extends 解不开（那些基类上的 prop 会缺）—— 详见 manifest 的 report.unresolved_extends`);
    }
  }
  return 0;
}

/**
 * `bin/cli.js` 的子命令入口（约定：`require(impl).main(argv)`，argv 是子命令之后的参数）。
 *
 * 这套约定来自 `bin/cli.js` 那张分发表 —— `libgen` 是**冻结的**子命令名，
 * 而实现"住 `libgen/`"，把 `main` 导出就自动接上（没导出就落到"名字已冻结、还没实现"那句）。
 */
function main(argv) {
  let code = 0;
  try {
    code = run(argv);
  } catch (err) {
    // 预期内的失败（库没装 / 没有类型定义 / 配置写错了）给**能照着做**的话，不是堆栈。
    // `BAD_CONTENT` 同时覆盖 `content` 与 `defaultExports` 两处声明（同一种错：配置里的名字不存在）。
    if (err && (err.code === 'NO_PACKAGE' || err.code === 'NO_TYPES' || err.code === 'BAD_CONTENT')) {
      console.error(err.message);
      process.exit(2);
    }
    throw err;
  }
  process.exit(code);
}

/** 从 `start` 往上找配置文件（最多 8 层）—— 与 node_modules 的解析方式一致。 */
function findConfig(start) {
  let cur = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    const cand = path.join(cur, CONFIG_NAME);
    if (fs.existsSync(cand)) return cand;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

module.exports = { run, plan, main, loadConfig, findConfig, CONFIG_NAME, GENERATOR_VERSION };
