// `moobile-host regen` —— 从**应用的依赖**生成能力注册表。
//
// 为什么要有这个工具：所谓"能力清单"就是一份依赖清单，它本来就该是 per-app 的，
// 但**不该由人手写**。手写的下场是"MoonBit 侧要 Clipboard，宿主忘了注册"，
// 报错信息是 `Cannot read properties of undefined` —— 没有信息量。
//
//   npx moobile-host regen [--out registry.generated.js] [--check]
//
// 生成物是**静态 import**：Metro 不能靠运行时拼字符串 import，
// 所以这必须是构建期生成的代码，而不是运行时读一遍。
//
// ⚠️ 真正的"防手滑"在运行时：注册表里的每一项，`mountApp` 都会核对
// `MOBILE_HOST[<name>]` 真的装上了，缺了就点名报错（见 index.js 的 installCapabilities）。

const fs = require('fs');
const path = require('path');

/**
 * 已知能力表：**提供者包名 → 能力名 + 安装函数**。
 *
 * 加新能力时这里加一行，同时确认三件事：
 *   1. npm 包里确实有 `capabilities/<name>.js` 导出安装函数；
 *   2. MoonBit 侧的能力包按名字向 `MOBILE_HOST[<name>]` 取值；
 *   3. MoonBit 侧缺这个能力时会**自己** fail-fast（参考 `sqlite/sqlite.mbt` 的 `ensure()`）。
 *
 * ⚠️ `from` 是**裸模块名**，不是仓库相对路径 —— 它会被原样写进**用户的**
 *    `registry.generated.js`，由用户工程里的 Metro / node 解析。所以它必须
 *    从"装了本包的工程根"解析得到。
 *
 *    这个字段踩过一次（2026-09 发现）：它曾是 `moobile-examples/apps/todo-app/host/…`
 *    （仓库搬目录前的旧路径），于是 `regen` 生成出一个解析不了的 import。
 *    **而 `moobile-host@0.2.0` 已按这个坏值发布出去** —— 实测 `npm pack
 *    moobile-host@0.2.0` 解包后本行就是旧路径。后果：全新用户
 *    `npm i moobile-host@0.2.0` + expo-sqlite + `regen` → 应用起不来。
 *
 *    当时为什么没被发现：`verify_all.sh` 那条门跑的是 `npx moobile-host`
 *    （= `node_modules` 里 09-19 冻结的**副本**），而那份副本的常量恰好是好的
 *    （来源未查明，只知它当时被改过而未回写源码）；门因此是绿的，
 *    真正的源码与线上包都坏着。两道修法见 `tools/check_npm_fresh.mjs`
 *    与 `verify_all.sh` 里改成跑源码那条。
 */
const KNOWN = [
  {
    npm: 'expo-sqlite',
    name: 'db',
    from: 'moobile-host/capabilities/db',
    install: 'installDb',
    note: '本地数据库（expo-sqlite）',
  },
];

function parseArgs(argv) {
  const out = { out: 'registry.generated.js', check: false, diff: false, json: false, sync: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' && argv[i + 1]) out.out = argv[++i];
    else if (a === '--check') out.check = true;
    // `--styles` 是"样式层再生成"的那一半（见 lib/migrate/regen-diff.js 的文件头）：
    //   --styles --diff   只看"生成物 vs 磁盘"逐函数差在哪（不落盘）
    //   --styles --sync   把生成物写回去（**先看 diff 再 sync**，别反过来）
    //   --styles --check  判据模式：有"只在磁盘上"的函数（孤儿）就非零退出
    else if (a === '--styles') out.styles = true;
    else if (a === '--diff') out.diff = true;
    else if (a === '--sync') out.sync = true;
    else if (a === '--json') out.json = true;
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const cwd = process.cwd();
  // ── 样式层那一半（迁移生成的应用才有；手写应用直接跳过）────────────────────
  if (args.styles) {
    const { diffApp } = require('./migrate/regen-diff.js');
    const r = diffApp({ appDir: cwd });
    if (!r.ok) {
      console.error(`moobile-host regen --styles: ${r.reason}`);
      process.exit(2);
    }
    if (args.json) {
      console.log(JSON.stringify({ counts: r.counts, changed: r.groups.changed.map((c) => c.name), added: r.groups.added.map((c) => c.name), orphan: r.groups.orphan.map((c) => c.name) }, null, 1));
    } else {
      console.log(`样式层：源 ${r.srcRoot}`);
      console.log(`  函数 ${r.counts.diskFns} 个（磁盘）/ ${r.counts.genFns} 个（生成器）`);
      console.log(`  一致 ${r.counts.same} · 有差异 ${r.counts.changed} · 新增 ${r.counts.added} · **孤儿 ${r.counts.orphan}**`);
      for (const c of r.groups.changed) console.log(`    ~ ${c.name}`);
      for (const c of r.groups.added) console.log(`    + ${c.name}`);
      for (const c of r.groups.orphan) console.log(`    ! ${c.name}  ← 只在磁盘上（人加的，或生成器不再产它了）`);
      // **逐行 diff**：只列函数名是不够的 —— 要判断"这处差异是我的生成器改动引起的，
      // 还是有人手工改的"，必须看到那几行本身。默认就把差异打出来（差异一般只有几处）。
      const { lineDiff } = require('./migrate/regen-diff.js');
      for (const c of [...r.groups.changed, ...r.groups.added, ...r.groups.orphan]) {
        const lines = lineDiff(c.gen, c.disk);
        if (!lines.length) continue;
        console.log(`
  ── ${c.name} ${'─'.repeat(Math.max(0, 46 - c.name.length))}`);
        for (const l of lines) console.log('    ' + l);
      }
    }
    if (args.sync) {
      const fsx = require('fs');
      // **覆盖前先把"要覆盖什么"说出来**：这个动作会吃掉人工改动，
      // 所以它必须是"看得见的一步"。实测上一次是 3 处改动（都是我改生成器引起的），
      // 但那句话是"这次运气好"，不是机制 —— 说出来才成机制。
      const touched = r.counts.changed + r.counts.added + r.counts.orphan;
      if (touched) {
        console.log('');
        console.log(
          `即将覆盖 ${touched} 处（有差异 ${r.counts.changed} / 新增 ${r.counts.added} / 孤儿 ${r.counts.orphan}）—— 上面已经逐行列出`,
        );
      } else {
        console.log('无需覆盖：生成物与磁盘逐字一致');
      }
      fsx.writeFileSync(r.diskPath, r.gen.source);
      console.log(`已同步：${r.diskPath}`);
      process.exit(0);
    }
    if (args.check) {
      const bad = r.counts.orphan > 0 || r.counts.added > 0 || r.counts.changed > 0;
      if (bad) {
        console.error(
          'moobile-host regen --styles --check: 生成物与磁盘不一致 —— 先看 `--styles --diff`，确认没有人工改动之后再 `--sync`',
        );
        process.exit(1);
      }
      console.log('moobile-host regen --styles --check: 一致（逐函数）');
      process.exit(0);
    }
    process.exit(0);
  }
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(`moobile-host regen: 在 ${cwd} 找不到 package.json（请在应用根目录跑）`);
    process.exit(2);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const found = [];
  const missing = [];
  for (const cap of KNOWN) {
    if (deps[cap.npm]) found.push(cap);
    else missing.push(cap);
  }

  const lines = [];
  lines.push('// 由 `npx moobile-host regen` 生成 —— **不要手改**。');
  lines.push('//');
  lines.push('// 依据：本目录 package.json 的 dependencies。');
  lines.push('// 加能力就 `npm install` 那个包，然后重跑 regen。');
  lines.push('//');
  if (found.length) {
    lines.push('// 已识别：');
    for (const c of found) lines.push(`//   · ${c.name}  ← ${c.npm}（${c.note}）`);
  } else {
    lines.push('// 已识别：（无）');
  }
  if (missing.length) {
    lines.push('// 未装（所以不注册，MoonBit 侧用到时会 fail-fast 并说明怎么装）：');
    for (const c of missing) lines.push(`//   · ${c.name}  ← ${c.npm}（${c.note}）`);
  }
  lines.push('');
  if (found.length) {
    for (const c of found) {
      lines.push(`import { ${c.install} } from '${c.from}';`);
    }
    lines.push('');
  }
  lines.push('export const registry = [');
  for (const c of found) {
    lines.push(
      `  { name: '${c.name}', provider: '${c.npm}', install: ${c.install} },`,
    );
  }
  lines.push('];');
  lines.push('');
  const text = lines.join('\n');

  const target = path.join(cwd, args.out);
  const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;

  if (args.check) {
    if (old === text) {
      console.log(`moobile-host regen --check: 一致（${args.out}）`);
      process.exit(0);
    }
    console.error(
      `moobile-host regen --check: 不一致 —— 跑一次 \`npx moobile-host regen\` 更新 ${args.out}`,
    );
    process.exit(1);
  }

  if (old === text) {
    console.log(`moobile-host regen: ${args.out} 已是最新（${found.length} 项能力）`);
    return;
  }
  fs.writeFileSync(target, text);
  console.log(
    `moobile-host regen: 写入 ${args.out} —— ${found.length} 项能力` +
      (missing.length ? `，${missing.length} 项未装` : ''),
  );
  for (const c of found) console.log(`  · ${c.name} ← ${c.npm}`);
}

module.exports = { main, KNOWN };
