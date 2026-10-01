// 模板在哪 —— 生成器与"模板新鲜度"门共用的定位逻辑。
//
// 真源只有一个：**仓库的 `examples/apps/template/`**（SCAFFOLD §3.4：模板是真源，
// demo 是它的测试用例）。但生成器有两种运行场合，所以这里按顺序找：
//
//   ① `MOOBILE_TEMPLATE_DIR`      —— 显式指定（门与调试用；也让"用一个别的模板跑一遍"可测）
//   ② 从本文件往上找 `examples/apps/template/moon.mod`
//                                 —— 在仓库里跑（`node npm/moobile-host/bin/cli.js init …`）
//   ③ 包内的 `template/`          —— 发布出去的形态：`publish.sh` 把真源**按发布规矩拷进来**，
//                                    于是 `npx moobile-host init` 在别人的机器上也能用
//
// ⚠️ ③ 是一份**副本**，于是又是一个"副本 ≠ 源码"的漂移点（本仓库被这件事咬过好几次，
//    见 tools/check_npm_fresh.mjs）。所以它必须配一条门：`tools/template_check.mjs`
//    比对包内模板与真源，不一致就红。**副本可以存在，但不能静默。**
//
// ⚠️ 为什么不像 vendor 那样把模板 vendor 出去：模板**就是给使用者跑的工程**，
//    它必须能被 `moon check`（所以它在 examples/apps/ 里、在 moon.work 里）。

const fs = require('fs');
const path = require('path');

/** 仓库里的真源位置（相对仓库根）。 */
const REPO_REL = path.join('examples', 'apps', 'template');

/**
 * 判断一个目录像不像"模板真源"。
 *
 * 判据是 `moon.mod`（而不是"目录存在"）：空目录、被误删过的目录都能骗过存在性检查，
 * 而一个没有 moon.mod 的目录生成出来的项目**连 moon check 都过不了**。
 */
function looksLikeTemplate(dir) {
  return Boolean(dir) && fs.existsSync(path.join(dir, 'moon.mod'));
}

/**
 * @param {string} [from] 从哪个目录开始往上找（默认本文件所在目录 = 包内 lib/）
 * @returns {{dir: string, how: string}}
 */
function locate(from = __dirname) {
  const tried = [];

  const env = process.env.MOOBILE_TEMPLATE_DIR;
  if (env) {
    const abs = path.resolve(env);
    tried.push(`MOOBILE_TEMPLATE_DIR=${env}`);
    if (looksLikeTemplate(abs)) return { dir: abs, how: 'MOOBILE_TEMPLATE_DIR' };
  }

  // ② 往上找仓库布局
  let cur = path.resolve(from);
  for (;;) {
    const cand = path.join(cur, REPO_REL);
    tried.push(cand);
    if (looksLikeTemplate(cand)) return { dir: cand, how: `仓库布局（${cand}）` };
    const up = path.dirname(cur);
    if (up === cur) break;
    cur = up;
  }

  // ③ 包内副本（发布形态）
  const inPkg = path.join(__dirname, '..', 'template');
  tried.push(inPkg);
  if (looksLikeTemplate(inPkg)) return { dir: inPkg, how: `包内副本（${inPkg}）` };

  const err = new Error(
    'moobile-host: 找不到模板工程（要的是一个含 moon.mod 的目录）。找过：\n' +
      tried.map((t) => '  · ' + t).join('\n') +
      '\n  · 在仓库里跑：真源是 examples/apps/template/（别删它，它是生成物的唯一真源）\n' +
      '  · 发布出去的包：publish.sh 会把它拷成 <包>/template/',
  );
  err.tried = tried;
  throw err;
}

/** 生成时不带过去的东西（构建产物、依赖、编辑器垃圾）。 */
const SKIP_DIRS = new Set(['node_modules', '.git', '_build', '.expo', 'dist']);
const SKIP_FILES = new Set(['moobile.js', 'package-lock.json']);

/**
 * 读模板的全部文件（相对路径 + 内容）。
 *
 * 只读**文本**：模板里全是文本，遇到二进制（含 NUL）就报错而不是静默跳过 ——
 * 静默跳过会让"生成物少了一个文件"这件事只在使用者的机器上暴露。
 *
 * @param {string} dir
 * @returns {{rel: string, abs: string, text: string}[]}
 */
function read(dir) {
  const out = [];
  const walk = (d, base) => {
    for (const name of fs.readdirSync(d).sort()) {
      const abs = path.join(d, name);
      const rel = base ? base + '/' + name : name;
      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        walk(abs, rel);
        continue;
      }
      if (SKIP_FILES.has(name)) continue;
      if (name.endsWith('.map') || name.endsWith('.mbti')) continue;
      const buf = fs.readFileSync(abs);
      if (buf.includes(0)) {
        throw new Error(`模板里有二进制文件：${rel}（模板应当全是文本 —— 是不是误放了 assets？）`);
      }
      out.push({ rel, abs, text: buf.toString('utf8') });
    }
  };
  walk(dir, '');
  return out;
}

module.exports = { locate, read, looksLikeTemplate, REPO_REL, SKIP_DIRS, SKIP_FILES };
