// regen-diff.js —— **改生成器之前的安全网**：告诉你在"生成物"和"你磁盘上那份"之间，
// 哪些差异是**生成器改动引起的**，哪些是**人手工改过的**。
//
// ## 为什么必须有它（不是"顺手加个 diff"）
//
// `styles/styles.mbt` 头上写着"不要手改"，但**人就是会改**（`interest/yi` 那个应用就被手改过）。
// 于是每次动样式生成器都只剩两个坏选择：
//   ① 整份重生成 → 可能悄悄吃掉人工修正；
//   ② 不重生成 → 生成器和产物开始漂移，越拖越不敢动。
// 2026-10-23 我实际就是这么卡的：要修文字样式，就必须动生成器，一动就要重生成
// 一份**被人改过**的产物。当时是靠"105 个函数名逐字比对 + 人肉确认"过关的 ——
// **那是运气，不是机制**。这个模块把那次运气变成一条命令。
//
// ## 判据（怎么分类）
//
// 每个 `pub fn xxx()` 是一"格"。两侧按**函数名**对齐，然后逐字比（行尾已归一）：
//
//   · 两侧都有、逐字相同            → `same`
//   · 两侧都有、内容不同            → `changed`（**要人看一眼**：是生成器改动，还是人工修正）
//   · 只在生成物里                  → `added`  （生成器新长出来的）
//   · 只在磁盘上                    → `orphan` （**最危险**：要么是人加的，要么是生成器不再产它了）
//
// `orphan` 与 `changed` 是**必须有人看**的两类；`same` 只是"没动"。
//
// ⚠️ 这一层**不做语义判断**（不猜"哪边对"）——它只把差异摆成"一格一格"的样子，
//    判断留给人和判据。这与 `style-map.js` 的规矩一致：不留"我以为"的第三种结果。

const fs = require('fs');
const path = require('path');

const MT = require('./style-emit.js');
const classRewrite = require('./class-rewrite.js');

/**
 * `migration.generated.json` 里的 `from` 是**相对仓库根**写的（`../yi/zhouyi_reader`），
 * 不是相对应用目录 —— 所以不能直接 `path.resolve(appDir, from)`。
 *
 * 实测（2026-10-23）：直接 resolve 得到 `examples/apps/yi/zhouyi_reader`（不存在）。
 * 这里按"最可能的几种相对基准"依次试，取第一个真实存在的：
 *   ① 相对 `appDir`；② 相对 `appDir` 往上逐级（最多 4 层，覆盖仓库根）。
 * **不做"猜"**：全试完还没有就报错并把这些候选都打出来（便于人一眼看出该写哪个）。
 */
function resolveFrom(appDir, from) {
  if (!from) return null;
  if (path.isAbsolute(from)) return fs.existsSync(from) ? from : null;
  const cands = [path.resolve(appDir, from)];
  let up = appDir;
  for (let i = 0; i < 4; i++) {
    up = path.dirname(up);
    cands.push(path.resolve(up, from));
  }
  for (const c of cands) if (fs.existsSync(c)) return c;
  resolveFrom.lastCandidates = cands;
  return null;
}

/** 递归收集源项目里的文件（与 `create.js` 的边界一致）。 */
function walkSource(root, out = [], depth = 0) {
  if (depth > 6) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (
      ['node_modules', '_build', '.git', '.mooncakes', 'target', 'dist'].includes(e.name) ||
      e.name.startsWith('.')
    ) {
      continue;
    }
    const p = path.join(root, e.name);
    if (e.isDirectory()) walkSource(p, out, depth + 1);
    else out.push(p);
  }
  return out;
}

/** 把一份生成的样式模块切成"函数名 → 那一格的全部文本（含头上的注释块）"。 */
function splitFunctions(source) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const out = new Map();
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^pub fn ([A-Za-z0-9_]+)\s*\(/);
    if (!m) {
      i++;
      continue;
    }
    let start = i;
    while (start > 0 && (lines[start - 1].startsWith('///') || lines[start - 1] === '///|')) start--;
    let j = i;
    // 函数体结束：第一个顶格的 `}`
    while (j < lines.length && lines[j] !== '}') j++;
    out.set(m[1], { text: lines.slice(start, j + 1).join('\n'), line: start + 1 });
    i = j + 1;
  }
  return out;
}

/**
 * 重算一个迁移应用的样式模块，并与磁盘上那份逐函数比。
 *
 * @param {{appDir: string, srcRoot?: string, appName?: string}} opts
 *        `srcRoot` 不给就从 `migration.generated.json` 的 `from` 字段推。
 * @returns {{ok: boolean, srcRoot: string|null, reason?: string, counts: object, groups: object}}
 */
function diffApp(opts) {
  const appDir = opts.appDir;
  const diskPath = path.join(appDir, 'styles', 'styles.mbt');
  const manifestPath = path.join(appDir, 'migration.generated.json');

  if (!fs.existsSync(diskPath)) {
    return { ok: false, reason: `${diskPath} 不存在 —— 这不是一个迁移生成的应用`, counts: {}, groups: {} };
  }
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: false,
      reason: `${manifestPath} 不存在 —— 没有它就无法知道源项目在哪（这一条只能作用于 create 生成的应用）`,
      counts: {},
      groups: {},
    };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const srcRoot = opts.srcRoot || resolveFrom(appDir, manifest.from);
  if (!srcRoot) {
    const tried = (resolveFrom.lastCandidates || []).map((c) => `
    · ${c}`).join('');
    return {
      ok: false,
      // ★ **机器可读的"环境不够"标记**（2026-10-23 加）：源项目在仓库**外面**
      //   （`interest/yi/zhouyi_reader`），所以新鲜克隆 / CI 上必然找不到。
      //   调用方要据此记 **SKIP**，不能记 FAIL —— 否则这两条样式门一提交就让 CI 红，
      //   而本机（有那个源项目）全绿，正是本仓库栽过好几次的"本机绿、CI 红"。
      //   为什么给标记而不是让调用方匹配 `reason` 里的字：字符串一改，判据就**悄悄失效**。
      missingSource: true,
      reason: `源项目目录找不到（清单里 from=${JSON.stringify(manifest.from)}）—— 试过：${tried}`,
      counts: {},
      groups: {},
    };
  }

  const files = walkSource(srcRoot)
    .filter((f) => /\.(html|mbt|css)$/.test(f))
    .map((f) => ({
      rel: path.relative(srcRoot, f).replace(/\\/g, '/'),
      text: fs.readFileSync(f, 'utf8'),
    }));

  const { sites } = classRewrite.extractSites(files.filter((f) => f.rel.endsWith('.mbt')));
  const gen = MT.generate(files, { appName: opts.appName || manifest.to || 'app', sites });

  const A = splitFunctions(gen.source);
  const B = splitFunctions(fs.readFileSync(diskPath, 'utf8'));

  const same = [];
  const changed = [];
  const added = [];
  const orphan = [];
  for (const [name, a] of A) {
    if (!B.has(name)) {
      added.push({ name, gen: a.text, disk: null });
      continue;
    }
    if (a.text === B.get(name).text) same.push(name);
    else changed.push({ name, gen: a.text, disk: B.get(name).text });
  }
  for (const [name, b] of B) {
    if (!A.has(name)) orphan.push({ name, gen: null, disk: b.text });
  }

  return {
    ok: true,
    srcRoot,
    diskPath,
    gen,
    counts: {
      genFns: A.size,
      diskFns: B.size,
      same: same.length,
      changed: changed.length,
      added: added.length,
      orphan: orphan.length,
    },
    groups: { same, changed, added, orphan },
    /** 生成器自己的账（声明数 / 有损数），顺手带出来给人看 */
    accounting: gen.accounting,
    ruleLossSummary: gen.ruleLossSummary,
  };
}

/**
 * 两份文本的**逐行差异**（只给 `regen --styles --diff` 打印用）。
 *
 * 为什么需要它：只列"哪个函数变了"不足以判断"这处差异是我的生成器改动引起的，
 * 还是有人手工改的"——必须看到那几行本身。实测（2026-10-23）：一轮改动 3 个函数，
 * 逐行看过去一眼就能确认"都是我的改动"；而只有名字时，只能靠"105 个函数名逐字相同"
 * 这种**间接**证据 —— 那是运气，不是机制。
 *
 * 实现刻意极简：跳过头部与尾部相同的行，中间全部标出来。样式模块的函数很短（5~20 行），
 * 这个近似足够；为此引一个第三方 diff 库不值得。
 */
function lineDiff(a, b) {
  if (a === null) return String(b || '').split('\n').map((l) => '+ ' + l);
  if (b === null) return String(a || '').split('\n').map((l) => '- ' + l);
  const x = String(a).replace(/\r\n/g, '\n').split('\n');
  const y = String(b).replace(/\r\n/g, '\n').split('\n');
  let head = 0;
  while (head < x.length && head < y.length && x[head] === y[head]) head++;
  let tail = 0;
  while (
    tail < x.length - head &&
    tail < y.length - head &&
    x[x.length - 1 - tail] === y[y.length - 1 - tail]
  ) {
    tail++;
  }
  const out = [];
  for (let i = head; i < x.length - tail; i++) out.push('- ' + x[i]);
  for (let i = head; i < y.length - tail; i++) out.push('+ ' + y[i]);
  if (head) out.unshift('  （前 ' + head + ' 行相同）');
  if (tail) out.push('  （后 ' + tail + ' 行相同）');
  return out;
}

module.exports = { diffApp, splitFunctions, lineDiff };
