#!/usr/bin/env node
// `moobile-host` —— 宿主侧的命令行。一个可执行文件，几个子命令。
//
// ── 子命令面（**冻结**，改名前先看 docs/design/SCAFFOLD.md 的 CLI 面那一节）────────
//
//   init <dir>     从模板生成一个项目（= 脚手架；E 轨道）
//   build          把编好的 MoonBit 产物搬到宿主目录（Metro 只认工程目录内的路径）
//   regen          能力注册表（从 package.json 的依赖生成，已有）
//   doctor         环境自检（S3：缺什么直接说装什么）                    —— **未实现**
//   libgen         组件库生成（I 轨道：manifest + MoonBit DSL + 宿主注册）—— **未实现**
//   upgrade        读 moon.mod + package.json 列出要改的版本             —— **未实现**
//
// ⚠️ 为什么把子命令写在这个文件里当"契约"：**这个文件是共同战场** ——
//    脚手架与组件库生成器都会往里加命令，名字与产物路径先冻结，两边就不会各写一半
//    （历史的坑：`regen` 的 `from:` 曾经写死过仓库相对路径，还随包发了出去）。
//
// ⚠️ 每个子命令的实现住在 `lib/<命令>.js`，**不要往这个文件里塞逻辑**：
//    并行开发时各改各的文件，冲突面只有下面那张表。
//
// 为什么是这个文件用 JS（而不是 MoonBit）：它跑在**消费者的 JS 工程里**
// （读 package.json、调 npm、写 metro.config.js），而 npm 包只能发 JS。见 SCAFFOLD §4.2。

const fs = require('fs');
const path = require('path');

const USAGE = `moobile-host —— moobile 的宿主侧工具

用法：
  moobile-host init <目录> [--name <应用名>]     从模板生成一个项目
  moobile-host build [--release] [--out <文件>]  把 MoonBit 产物搬到宿主目录
  moobile-host regen [--out <文件>] [--check]    生成 / 核对能力注册表

常用选项：
  -h, --help        这条帮助
  -v, --version     版本号

生成出来的项目里：
  npm run build     ==  moon build --target js  +  moobile-host build
  npm run web       ==  npm run build  +  expo start --web

名字已冻结、但还没实现的（别抢）：doctor / libgen / upgrade
`;

function version() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
      .version;
  } catch {
    return 'unknown';
  }
}

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    process.stdout.write(USAGE);
    process.exit(cmd ? 0 : 2);
  }
  if (cmd === '-v' || cmd === '--version') {
    console.log(version());
    return;
  }

  // 子命令 → 实现文件（按顺序取第一个存在的）。**加命令只动这一行**。
  //
  // ⚠️ 每个命令一个文件，是为了让并行开发时冲突面只剩这张表（这个文件是共同战场）。
  // ⚠️ `libgen`（I 轨道：组件库生成）的实现**它把入口放到位就自动接上**：
  //    `bin/libgen.js`（独立入口）/ `libgen/index.js`（库式）/ `lib/libgen.js`。
  //    没放就落到下面那句"名字已冻结、还没实现"。
  const table = {
    init: ['../lib/init.js'],
    build: ['../lib/build.js'],
    regen: ['../lib/regen.js'],
    libgen: ['../bin/libgen.js', '../libgen/cli.js', '../libgen/index.js', '../lib/libgen.js'],
  };
  const reserved = ['doctor', 'upgrade'];

  const resolveEntry = (cands) => {
    for (const c of cands) {
      try {
        return require.resolve(c);
      } catch {
        /* 试下一个 */
      }
    }
    return null;
  };

  /**
   * 入口的两种形态，都支持：
   *
   *   ① **库式**（导出 `main(argv)` 或 `run(argv)`）—— 本仓库 `lib/*.js` 的写法；
   *   ② **脚本式**（自己读 argv、自己 exit，没有导出）—— `bin/libgen.js` 的写法。
   *
   * 为什么要支持两种：这个文件是共同战场，而"入口长什么样"是最容易被两边各写一半的地方。
   * 与其要求对方改成我的形状，不如**两种都接** —— 判断方式就是看文件里有没有导出
   * （`module.exports`）；脚本式的一律**交给子进程**跑，参数与 stdio 原样透传。
   */
  function runEntry(entry, args) {
    const src = fs.readFileSync(entry, 'utf8');
    const isModule = /\bmodule\.exports\b|\bexports\.[A-Za-z_$]/.test(src);
    if (isModule) {
      const m = require(entry);
      if (typeof m.main === 'function') return m.main(args);
      if (typeof m.run === 'function') {
        const rc = m.run(args);
        if (typeof rc === 'number') process.exitCode = rc;
        return;
      }
      console.error(
        `moobile-host: ${path.relative(__dirname, entry)} 是库式入口，但没有导出 \`main(argv)\` 或 \`run(argv)\`。`,
      );
      process.exit(2);
    }
    const r = require('child_process').spawnSync(process.execPath, [entry, ...args], {
      stdio: 'inherit',
    });
    process.exit(r.status === null ? 1 : r.status);
  }

  if (!Object.prototype.hasOwnProperty.call(table, cmd)) {
    // 未实现的命令给一句明确的话，而不是 "unknown command" —— 用户多半是照文档敲的。
    if (reserved.includes(cmd)) {
      console.error(
        `moobile-host ${cmd}: 这个子命令**名字已冻结、但还没实现**（见 docs/design/SCAFFOLD.md）。\n` +
          `  现在可用的是：${Object.keys(table).join(' / ')}`,
      );
      process.exit(3);
    }
    console.error(`moobile-host: 不认识子命令 \`${cmd}\`。\n`);
    process.stdout.write(USAGE);
    process.exit(2);
  }

  const impl = resolveEntry(table[cmd]);
  if (!impl || !hasMain(impl)) {
    console.error(
      `moobile-host ${cmd}: 名字已冻结，但实现还没到位（找过：${table[cmd].join(' / ')}）。`,
    );
    process.exit(3);
  }

  runEntry(impl, argv.slice(1));
}

/**
 * "实现到位了没有"：文件存在，且**看起来不是只有注释的占位**。
 *
 * ⚠️ 这一条是给并行开发用的：`libgen` 的目录可能先落地、入口后落地。
 *    没有它，`require` 会以一句 `is not a function` 收场 —— 那是"我这边坏了"的形状，
 *    而真实情况是"名字已冻结、还没实现"。
 */
function hasMain(entry) {
  try {
    return fs.statSync(entry).size > 0;
  } catch {
    return false;
  }
}


main();
