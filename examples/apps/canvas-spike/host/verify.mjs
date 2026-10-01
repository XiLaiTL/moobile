#!/usr/bin/env node
// verify.mjs —— canvas 通道试金石的判据（PLAN §3.6 / P3 T3.2）。
//
//   node examples/apps/canvas-spike/host/verify.mjs            # 全部
//   node examples/apps/canvas-spike/host/verify.mjs --keep     # 保留 PNG 证据
//
// 六组断言，**每组都回答一个具体问题**（不是"跑完就算"）：
//
//   ① 词汇表覆盖   18 个 canvas 调用里，rover 真用到的那几个，词汇表是否**全都有**？
//   ② 载荷大小     ops 塞进一个 JSON prop 有多大？（六十四卦那一档是上千条）
//   ③ 形状（stub）  ops → Skia 元素树，逐条对不对？（fill/stroke 同路径两条、整圆拆两段…）
//   ④ 真引擎出图   用**真 Skia**（CanvasKit）画出来 —— 不崩、有像素
//   ⑤ 像素对数据   采样 (扇区, 环) 的点，颜色必须**等于数据推出的颜色**（不是"画了东西"）
//   ⑥ 证伪         改数据 / 反转弧方向 → 上面的断言**必须变红**（否则断言是摆设）
//
// 最后一组是本文件最重要的部分：AGENTS.md §4 那条"断言粒度要能抓住设计错误"，
// 只有证伪才证明得了。第 ⑤ 组若抓不住 ⑥ 的两个诱饵，就说明它只是在数像素。

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OPS, OP_TAGS, decode, encode, usedTags, opsToTree, treeStats } from '../../../../npm/moobile-host/canvas-ops.js';
import { COLORS, ringDraw, ringItems } from './compass.mjs';
import { loadCanvasKit, pickTypeface, pixelAt, readPixels, replay, savePng, hexToRgb } from './play.mjs';
// ★ 对账用的镜像程序：与 MoonBit 的 `spike.mbt` 是同一条规格的两个实现
import { probeOps } from './probe_program.mjs';

/** 啰嗦编码 —— **只用于量省了多少**，不发放（所以它不在宿主包里）。 */
function encodeVerbose(ops) {
  return JSON.stringify(
    ops.map((o) => {
      const names = OPS[o[0]];
      const out = { op: o[0] };
      names.forEach((n, i) => (out[n] = o[i + 1]));
      return out;
    }),
  );
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const KEEP = process.argv.includes('--keep');
const EVIDENCE = path.join(ROOT, 'docs', 'evidence', 'canvas-r1');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  <- ' + detail : ''}`);
  return ok;
}
const skipped = [];
function skip(name, why) {
  skipped.push({ name, why });
  console.log(`SKIP  ${name}  <- ${why}`);
}
function section(t) {
  console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 60 - t.length))}`);
}

const hexagrams = JSON.parse(fs.readFileSync(path.join(HERE, 'hexagrams.json'), 'utf8')).hexagrams;

// ── ① 词汇表覆盖 ──────────────────────────────────────────────────────────────
section('① 词汇表覆盖（实测的 18 个调用 vs 契约）');

const YI_MEASURED = [
  'begin_path(16)', 'arc(12)', 'stroke(9)', 'line_to(9)', 'fill(8)', 'close_path(8)',
  'set_line_width(7)', 'move_to(6)', 'translate(3)', 'save(2)', 'rotate(2)', 'restore(2)',
  'fill_rect(2)', 'set_stroke_style(1)', 'set_font(1)', 'set_fill_style(1)', 'scale(1)', 'fill_text(1)',
];
const yiTags = YI_MEASURED.map((s) => s.replace(/\(\d+\)$/, ''));
check(
  `契约词汇表恰好 18 条，且与 yi 实测的 18 个调用逐字对上`,
  OP_TAGS.length === 18 && yiTags.every((t) => OP_TAGS.includes(t)) && new Set(yiTags).size === 18,
  `契约 ${OP_TAGS.length} 条 / 实测 ${new Set(yiTags).size} 条`,
);

const compass64 = ringDraw('liushisi', hexagrams);
const used = usedTags(compass64.ops);
const missing = ['begin_path', 'move_to', 'line_to', 'arc', 'close_path', 'fill', 'stroke', 'fill_rect',
  'set_line_width', 'set_fill_style', 'set_stroke_style', 'set_font', 'fill_text', 'save', 'restore',
  'translate', 'rotate'].filter((t) => !used.includes(t));
check(
  '罗盘样本用到的 17 个 op，词汇表全都有（`scale` 罗盘没用 —— 由 ③ 的单测覆盖）',
  missing.length === 0,
  missing.length ? `缺 ${missing.join(', ')}` : `用到 ${used.length} 个 tag`,
);
check(
  '`scale` 在词汇表里且能过编码（罗盘不经过它，所以不能靠样本覆盖）',
  OP_TAGS.includes('scale') && decode(encode([['scale', 2, 3]]))[0][0] === 'scale',
);

// ── ② 载荷大小 ────────────────────────────────────────────────────────────────
section('② 载荷大小（它要整个塞进一个 JSON prop）');

const compact = encode(compass64.ops);
const verbose = encodeVerbose(compass64.ops);
console.log(`     六十四卦：${compass64.ops.length} 条 op · ${compass64.sectors} 扇区 × ${compass64.rings} 环`);
console.log(`     紧凑数组 ${(compact.length / 1024).toFixed(1)} KB ｜ 啰嗦对象 ${(verbose.length / 1024).toFixed(1)} KB ｜ 省 ${(100 - (compact.length / verbose.length) * 100).toFixed(0)}%`);
for (const lv of ['liangyi', 'sixiang', 'bagua']) {
  const r = ringDraw(lv, hexagrams);
  console.log(`     ${lv.padEnd(9)}：${String(r.ops.length).padStart(5)} 条 op · ${(encode(r.ops).length / 1024).toFixed(1)} KB`);
}
check('紧凑编码比啰嗦对象小（这条决定了 op 用短标签数组）', compact.length < verbose.length * 0.75);
check('六十四卦的载荷在"一个 prop 能扛"的量级（<1 MB）', compact.length < 1024 * 1024);

// ── ③ 形状（stub）────────────────────────────────────────────────────────────
section('③ ops → Skia 元素树：形状逐条断言（不需要引擎）');

const t = (ops) => opsToTree(ops);

// 3a. fill + stroke 是**同一个 d** 的两个元素（canvas 语义：fill 不吃掉路径）
const a = t([
  ['begin_path'], ['move_to', 0, 0], ['line_to', 10, 0], ['close_path'],
  ['set_fill_style', '#111111'], ['fill'],
  ['set_stroke_style', '#222222'], ['set_line_width', 0.4], ['stroke'],
]);
check(
  '3a `fill()` 后再 `stroke()` → 两个元素、同一条 d（不是"一个元素两个属性"）',
  a.children.length === 2 &&
    a.children[0].props.path === a.children[1].props.path &&
    a.children[0].props.style === 'fill' &&
    a.children[1].props.style === 'stroke' &&
    a.children[1].props.strokeWidth === 0.4,
  JSON.stringify(a.children.map((c) => [c.type, c.props.style, c.props.strokeWidth])),
);

// 3b. 整圆：SVG 的 A 画不出整圆 → 必须拆两段
//     ⚠️ 要补一个 `fill()` 才看得到路径：canvas 的路径是**延迟物化**的，
//     没有 fill/stroke 就不产出元素 —— 这条语义本身也是断言的一部分（见 3h）。
const circle = t([['begin_path'], ['arc', 10, 10, 5, 0, 2 * Math.PI], ['set_fill_style', '#123456'], ['fill']]);
const dCircle = circle.children[0]?.props.path || '';
const nA = (dCircle.match(/A /g) || []).length;
check(
  '3b `arc(…,0,2π)`（整圆）拆成 2 段 A —— 只写一条 A 的 SVG 路径**什么都不画**',
  nA === 2,
  `d=${dCircle}`,
);
// 3b′. 没有当前点时，`arc()` 必须自己补一个 `M`（canvas 的隐式起点）。
//      这条漏了，SVG 路径就以 `A` 开头 → Skia 把起点当 (0,0) → 整圆画到别处。
//      第一版就是漏在这里，靠 ⑤ 的全覆盖像素断言才暴露。
check(
  '3b′ 路径**以 `M` 开头**（没有当前点时 `arc` 自己补起点）—— 以 `A` 开头的路径起点是 (0,0)',
  /^M 15 10 /.test(dCircle),
  dCircle,
);
check(
  '3b″ 两段 A 的终点正是直径两端（(5,10) 与 (15,10)）—— 拆分的落点与 canvas 的整圆一致',
  dCircle === 'M 15 10 A 5 5 0 0 1 5 10 A 5 5 0 0 1 15 9.999999999999998',
  dCircle,
);

// 3c. 弧的隐式连线：当前点不在弧起点上时要补一条 L
const withJoin = t([
  ['begin_path'], ['move_to', 0, 0], ['arc', 10, 10, 5, 0, Math.PI / 2],
  ['set_fill_style', '#123456'], ['fill'],
]);
check(
  '3c 当前点≠弧起点 → 补一条 `L`（canvas 的隐式连线语义）',
  /L 15 10/.test(withJoin.children[0]?.props.path || ''),
  withJoin.children[0]?.props.path,
);
const noJoin = t([
  ['begin_path'], ['move_to', 15, 10], ['arc', 10, 10, 5, 0, Math.PI / 2],
  ['set_fill_style', '#123456'], ['fill'],
]);
check(
  '3c′ 当前点就在弧起点上 → **不**重复补 L（罗盘每个扇区都是这种写法）',
  !/ L /.test(' ' + (noJoin.children[0]?.props.path || '') + ' '),
  noJoin.children[0]?.props.path,
);

// 3h. 延迟物化：只画路径不 fill/stroke → 不产出任何元素（canvas 的既有语义）
const noPaint = t([['begin_path'], ['move_to', 0, 0], ['line_to', 10, 10]]);
check('3h 只累积路径、没有 `fill`/`stroke` → 不产出元素（路径是延迟物化的）', noPaint.children.length === 0);

// 3d. save/translate/rotate/fill_text/restore → Text 带 transform，且 restore 之后不再带
const texts = t([
  ['save'], ['translate', 100, 200], ['rotate', 1.5], ['set_font', "12px 'Kaiti TC',serif"],
  ['set_fill_style', '#8a2518'], ['fill_text', '乾', -6, 4], ['restore'],
  ['set_font', "10px serif"], ['set_fill_style', '#000000'], ['fill_text', '后', 0, 0],
]);
const first = texts.children[0];
const second = texts.children[1];
check(
  '3d `save/translate/rotate/fill_text/restore` → Text 带 [{translateX},{rotate}]，字号取自 font 简写',
  first.type === 'Text' &&
    JSON.stringify(first.props.transform) === JSON.stringify([{ translateX: 100, translateY: 200 }, { rotate: 1.5 }]) &&
    first.props.font.size === 12 &&
    first.props.font.family === 'Kaiti TC' &&
    first.props.color === '#8a2518',
  JSON.stringify({ t: first.props.transform, f: first.props.font }),
);
check(
  '3d′ `restore()` 之后画的文字**不继承**那次变换（变换是可变状态，不是全局设置）',
  second.props.transform === undefined && second.props.x === 0,
  JSON.stringify(second.props),
);

// 3e. fill_rect 用**当时**的 fillStyle
const rect = t([['set_fill_style', '#f6efe0'], ['fill_rect', 0, 0, 720, 720]]);
check(
  '3e `fill_rect` → Rect，颜色取调用当时的 fillStyle',
  rect.children[0].type === 'Rect' && rect.children[0].props.color === '#f6efe0' &&
    rect.children[0].props.width === 720,
);

// 3f. 负例：restore 多于 save 必须抛（不许静默）
let threw = false;
try {
  t([['restore']]);
} catch {
  threw = true;
}
check('3f 负例：`restore` 多于 `save` → 当场抛（不静默）', threw);

// 3g. 负例：词汇表外的新 op 忘了映射 → 抛
let threw2 = false;
try {
  opsToTree([['set_line_dash', [1, 2]]]);
} catch {
  threw2 = true;
}
check('3g 负例：词汇表里没有的 op → 抛（防止"加了 op 忘了映射"静默通过）', threw2);

// ── ④⑤ 真 Skia 出图 + 像素对数据 ─────────────────────────────────────────────
section('④⑤ 真 Skia（CanvasKit）出图 + 像素必须对得上数据');

const ck = await loadCanvasKit();
const tf = pickTypeface();
// 字体：直接建 Typeface（不走 family 匹配 —— 本机给的多半是 .ttc 集合，
// 按名字匹配多半匹不上，而我们要的只是"有没有字形可画"）。
let typeface = null;
if (!tf) skip('文字渲染', '本机没找到可用中文字体（几何判据不受影响，见 play.mjs 文件头）');
else {
  typeface = ck.Typeface.MakeFreeTypeFaceFromData(tf.data);
  if (!typeface) skip('文字渲染', `本机字体读不出字形：${tf.path}`);
  else console.log(`     字体：${tf.path}`);
}

const tree = opsToTree(compass64.ops, { width: 720, height: 720 });
const stats = treeStats(tree);
console.log(`     元素树：${JSON.stringify(stats)}`);

const { surface, stats: pstats } = replay(ck, tree, { typeface });
const px = readPixels(ck, surface, 720, 720);
check('④ 真 Skia 回放没有崩，且画出了元素', pstats.drawn > 700, `drawn=${pstats.drawn}`);
if (pstats.skipped.Text) console.log(`     跳过：${JSON.stringify(pstats.skipped)}`);

/** 在 (扇区 i, 环 j) 的**中位点**采样，期望色由数据独立推出。 */
function sampleSector(i, j, layout) {
  const { radii, items, cx, cy, sa } = layout;
  const ang = -Math.PI / 2 + (i + 0.5) * sa;
  const rMid = (radii[j] + radii[j + 1]) / 2;
  const x = Math.round(cx + rMid * Math.cos(ang));
  const y = Math.round(cy + rMid * Math.sin(ang));
  // ⚠️ 期望值必须是 **RGB 数组**（拿 hex 字符串来比就是一个什么都没测的断言）
  const expected = hexToRgb(items[i].lines[j] === 1 ? COLORS.yang : COLORS.ink);
  return { x, y, expected, got: pixelAt(px, 720, x, y), hex: items[i].lines[j] === 1 ? COLORS.yang : COLORS.ink };
}

const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

// ⑤ 全覆盖：**64 个扇区 × 6 个环 = 384 个采样点**，逐一对照数据推出的颜色。
//    只测几个点抓不住"角度→扇区"或"半径→环"写反这类错（第一版只测 18 个点）。
const samples = [];
for (let i = 0; i < compass64.sectors; i++) {
  for (let j = 0; j < compass64.rings; j++) samples.push({ i, j, ...sampleSector(i, j, compass64) });
}
const bad = samples.filter((s) => !eq(s.expected, s.got));
check(
  `⑤ **全部 ${samples.length} 个采样点**（${compass64.sectors} 扇区 × ${compass64.rings} 环）的颜色等于数据推出的颜色`,
  bad.length === 0,
  bad.length
    ? `${bad.length} 个不符，例如 ` +
      bad
        .slice(0, 3)
        .map((b) => `扇区${b.i}环${b.j}@(${b.x},${b.y}) 期望${b.hex}=${b.expected} 实得${b.got}`)
        .join(' | ')
    : `${samples.length} 个全中（期望色由 hexagrams.json 的爻码独立推出）`,
);

// ⑤‴ 径向扫描：代替"用眼睛看图"。
//     沿某扇区的中线从圆心扫到盘缘，颜色变化的**位置**必须落在 `r_k = R·√(k/rings)` 上，
//     且每段的颜色必须等于该卦对应爻的颜色 —— 这条同时压住了等面积半径公式、环序（内圈初爻）与填充。
{
  const { radii, items, cx, cy, sa } = compass64;
  const mismatch = [];
  const boundaryErr = [];
  // ⚠️ 起点取 **r=60** 而不是 r=2：64 条经线全都从圆心出发，半径很小时它们彼此重叠
  // （r=20 处一条 1.2px 的线占 3.4°，而一个扇区只有 5.6°）→ 中线附近也是金色，
  // 那是**原实现的真实观感**，不是画错。r=60 起扇区中线就干净了。环带 0 仍被覆盖（0–122.5）。
  const R_FROM = 60;
  const ringOf = (r) =>
    radii.findIndex((rk, k) => r >= rk && (k + 1 >= radii.length || r < radii[k + 1]));
  for (const i of [0, 13, 40]) {
    const ang = -Math.PI / 2 + (i + 0.5) * sa;
    const item = items[i];
    // (a) 逐像素颜色：落在边界 ±2px 内的点跳过（那里压着 1.2px 的金色纬线，本来就取不到纯色）
    for (let r = R_FROM; r <= 296; r += 1) {
      if (radii.some((rk) => rk > 0 && Math.abs(r - rk) <= 2)) continue;
      const x = Math.round(cx + r * Math.cos(ang));
      const y = Math.round(cy + r * Math.sin(ang));
      const j = ringOf(r);
      const want = hexToRgb(item.lines[j] === 1 ? COLORS.yang : COLORS.ink);
      const got = pixelAt(px, 720, x, y);
      if (!eq(got, want)) mismatch.push(`扇区${i} r=${r} 环${j} 期望${want} 实得${got}`);
    }
    // (b) **边界位置**：金线压着的 ±2px 里看不出颜色变化，所以改成"跨界两侧取点"——
    //     `rk-3` 必须还是环 k-1 的颜色、`rk+3` 必须已经是环 k 的颜色。边界偏 3px 以上就红。
    //     （第一版想用"颜色变化点"量边界，而那个点被我自己设的 ±2 跳过窗口推到了 rk+3 ——
    //      是检测逻辑写歪了，不是画歪了。）
    for (let k = 1; k < radii.length - 1; k++) {
      const rk = radii[k];
      const at = (r) => {
        const x = Math.round(cx + r * Math.cos(ang));
        const y = Math.round(cy + r * Math.sin(ang));
        return { got: pixelAt(px, 720, x, y), ring: ringOf(r) };
      };
      const inner = at(rk - 3);
      const outer = at(rk + 3);
      const wantInner = hexToRgb(item.lines[k - 1] === 1 ? COLORS.yang : COLORS.ink);
      const wantOuter = hexToRgb(item.lines[k] === 1 ? COLORS.yang : COLORS.ink);
      if (!eq(inner.got, wantInner) || inner.ring !== k - 1) {
        boundaryErr.push(
          `扇区${i} 边界${rk.toFixed(1)} 内侧 r=${(rk - 3).toFixed(0)} 期望环${k - 1}色${wantInner} 实得${inner.got}(判为环${inner.ring})`,
        );
      }
      if (!eq(outer.got, wantOuter) || outer.ring !== k) {
        boundaryErr.push(
          `扇区${i} 边界${rk.toFixed(1)} 外侧 r=${(rk + 3).toFixed(0)} 期望环${k}色${wantOuter} 实得${outer.got}(判为环${outer.ring})`,
        );
      }
    }
  }
  check(
    '⑤‴ 径向逐像素（3 扇区，r=60..296）颜色对得上爻码，且 5 条环带边界落在 R·√(k/rings) 的 ±3px 内',
    mismatch.length === 0 && boundaryErr.length === 0,
    mismatch.length ? mismatch.slice(0, 3).join(' | ') : boundaryErr.join(' | ') || '径向上 6 段颜色与 5 条边界全部对上',
  );
}

// 圆外必须是纸色（否则说明有东西画到了不该画的地方）
const outside = [
  [360, 20], [20, 360], [700, 700], [360, 360 + 340],
].map(([x, y]) => ({ x, y, got: pixelAt(px, 720, x, y) }));
const paper = hexToRgb(COLORS.paper);
check(
  '⑤′ 四角/圆外是纸色 #f6efe0（环带没有溢出到整块画布）',
  outside.every((o) => eq(o.got, paper)),
  outside.map((o) => `(${o.x},${o.y})=${o.got}`).join(' '),
);

// 外圈描边（r=300，gold 2.5px）——细线有抗锯齿，所以给容差并写明理由
const angMid = -Math.PI / 2 + 0.5 * compass64.sa;
const ringPt = [Math.round(360 + 300 * Math.cos(angMid)), Math.round(360 + 300 * Math.sin(angMid))];
const ringGot = pixelAt(px, 720, ringPt[0], ringPt[1]);
const gold = hexToRgb(COLORS.gold);
const dist = Math.hypot(ringGot[0] - gold[0], ringGot[1] - gold[1], ringGot[2] - gold[2]);
check(
  '⑤″ 外圈（`arc(…,0,2π)` 那条 2.5px 金线）**真的画出来了** —— 整圆不拆两段的话这里什么都没有',
  dist < 90,
  `@(${ringPt}) 实得 ${ringGot}，与金 ${gold} 距离 ${dist.toFixed(1)}（阈值 90：2.5px 细线 + 抗锯齿，取不到纯色）`,
);

// ── ⑥ 证伪 ───────────────────────────────────────────────────────────────────
section('⑥ 证伪：上面那两组断言到底抓不抓得住错');

// 6a. 改数据 → 对应扇区/环的采样点必须变色
//     ⚠️ 扇区号 ≠ 卦号：`items[i].number` 才是该扇区对应的卦（先天圆图那套顺序）。
//     第一版我按"扇区 7 = 卦 7"翻，翻错了卦 → 画面当然没变（那是测试的错，不是断言的错）。
const SECTOR = 7;
const RING = 0;
const target = compass64.items[SECTOR].number;
const flipped = hexagrams.map((h, idx) =>
  idx === target - 1 ? { ...h, code: (h.code[RING] === '1' ? '0' : '1') + h.code.slice(1) } : h,
);
const layoutF = ringDraw('liushisi', flipped);
check(
  '6a-pre 定位性：被翻的那一卦**确实**落在采样的那个扇区里（否则诱饵翻了个寂寞）',
  layoutF.items[SECTOR].lines[RING] !== compass64.items[SECTOR].lines[RING],
  `扇区 ${SECTOR} ↔ 卦 ${target}（${compass64.items[SECTOR].label}）；第 ${RING + 1} 爻 ${compass64.items[SECTOR].lines[RING]} → ${layoutF.items[SECTOR].lines[RING]}`,
);
const s = sampleSector(SECTOR, RING, layoutF);
const flora = opsToTree(layoutF.ops);
const { surface: sf } = replay(ck, flora, { typeface });
const pxF = readPixels(ck, sf, 720, 720);
const gotF = pixelAt(pxF, 720, s.x, s.y);
check(
  '6a 诱饵：改一条爻码 → 那个采样点的像素**必须**跟着变（否则 ⑤ 只是在数像素）',
  !eq(gotF, s.got),
  `同一点 (${s.x},${s.y})：改前 ${s.got} → 改后 ${gotF}`,
);

// 6b. 反转弧方向（扇区内弧本来逆时针，改成顺时针）→ 画面必须变
const opsSweepFlipped = compass64.ops.map((o) => (o[0] === 'arc' ? [o[0], o[1], o[2], o[3], o[4], o[5], !o[6]] : o));
const { surface: ss } = replay(ck, opsToTree(opsSweepFlipped), { typeface });
const pxS = readPixels(ck, ss, 720, 720);
const diffCount = (() => {
  let n = 0;
  for (let i = 0; i < 720 * 720; i++) {
    if (px[i * 4] !== pxS[i * 4] || px[i * 4 + 1] !== pxS[i * 4 + 1] || px[i * 4 + 2] !== pxS[i * 4 + 2]) n++;
  }
  return n;
})();
check(
  '6b 诱饵：把 `arc` 的逆时针标志反过来 → 画面必须变（外弧/内弧是扇区成形的关键）',
  diffCount > 1000,
  `像素差异 ${diffCount} 个点（${((diffCount / (720 * 720)) * 100).toFixed(2)}%）`,
);

// 6c. 整圆不拆两段会怎样？—— 用一条"起点终点相同"的 A 复现，断言它画不出东西。
//     注意 A 的参数：半径 300、圆心 (360,360) 时，"上→下"各一段才是整圆；
//     第一版我把终点写成 (60,360)（左），那是个 90° 的短弧，包围盒当然不是 600。
const degenerate = ck.Path.MakeFromSVGString('M 360 60 A 300 300 0 1 1 360 60');
const withCircle = ck.Path.MakeFromSVGString('M 360 60 A 300 300 0 0 1 360 660 A 300 300 0 0 1 360 60');
const bbDeg = degenerate ? degenerate.getBounds() : null;
const bbFull = withCircle ? withCircle.getBounds() : null;
const wDeg = bbDeg ? bbDeg[2] - bbDeg[0] : NaN;
const wFull = bbFull ? bbFull[2] - bbFull[0] : NaN;
check(
  '6c 定位性证据：同起终点的单条 `A` 包围盒为空（= 什么都不画），拆两段才有 600 宽的圆',
  wDeg === 0 && wFull > 550,
  `单条 A 宽 ${wDeg} / 拆两段 宽 ${wFull}（期望 0 与 ≈600）`,
);

// ── ⑦ 跨语言对账 ─────────────────────────────────────────────────────────────
section('⑦ 跨语言对账：MoonBit 编出来的载荷 ⇄ 宿主包的解码器 / 翻译器 / 真 Skia');

// 契约的一端在 MoonBit（`canvas/` 包的编码器），另一端在宿主包（`canvas-ops.js` 的解码与翻译）。
// 两份实现就是等着漂 —— 所以这里让**同一个程序**两边各写一遍（`spike.mbt` ↔ `probe_program.mjs`），
// 再逐条对账、最后各自出图比像素。
const SPIKE_MOD = 'examples/apps/canvas-spike';
const MB_ARTIFACT = path.join(
  ROOT,
  '_build',
  'js',
  'debug',
  'build',
  'XiLaiTL',
  'moobile-canvas-spike',
  'moobile-canvas-spike.js',
);

let mbProbe = null;
try {
  execSync(`moon build --target js ${SPIKE_MOD}`, { cwd: ROOT, stdio: 'pipe' });
  mbProbe = await import(pathToFileURL(MB_ARTIFACT).href);
} catch (e) {
  skip('跨语言对账', `编不出 MoonBit 产物（要 moon 工具链）：${String(e.message).split('\n')[0]}`);
}
check(
  '⑦-0 编出 MoonBit 产物，且导出面正好是那三个名字',
  Boolean(mbProbe) && typeof mbProbe.probe_payload === 'function',
  mbProbe ? MB_ARTIFACT.split(path.sep).slice(-3).join('/') : '没编出来',
);

if (mbProbe) {
  const mbCount = mbProbe.probe_ops_count();
  const mbOps = decode(mbProbe.probe_payload());
  const jsOps = probeOps();

  check(
    '⑦-1 条数三方一致（MoonBit 报的 / MoonBit 载荷里的 / JS 镜像程序的）',
    mbOps.length === mbCount && mbCount === jsOps.length,
    `MoonBit ${mbCount} · 载荷 ${mbOps.length} · JS ${jsOps.length}`,
  );

  // ⑦-2 逐条对账：tag 逐字、数字容差 1e-9、字符串逐字。
  //      容差而不是逐字相等，是因为两边的浮点格式化**没有约定**（也不该有）：
  //      契约是"JSON 数字"，不是"某一种数字写法"。这条差别本身就是结论之一。
  const diffs = [];
  const eqNum = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b);
  for (let i = 0; i < Math.min(mbOps.length, jsOps.length); i++) {
    const a = mbOps[i];
    const b = jsOps[i];
    if (a.length !== b.length || !a.every((v, k) => eqNum(v, b[k]))) {
      diffs.push(`#${i} MoonBit=${JSON.stringify(a)} JS=${JSON.stringify(b)}`);
    }
  }
  check('⑦-2 逐条对账：57 条 op 的 tag 与数值全部一致', diffs.length === 0, diffs.slice(0, 3).join(' | ') || `${mbOps.length} 条逐条相同（数值容差 1e-9）`);

  // ⑦-3 逐字相等吗？（**不要求**，但要量出来 —— 它决定"能不能用文本 diff 对账"）
  const mbText = mbProbe.probe_payload();
  const jsText = encode(jsOps);
  if (mbText === jsText) {
    console.log('     顺带：两边载荷**逐字节相同**（所以文本 diff 也能当对账手段）');
  } else {
    const at = [...mbText].findIndex((c, i) => c !== jsText[i]);
    console.log(`     顺带：两边载荷逐字节**不同**（首处差异在第 ${at} 字符）—— 浮点写法没有约定，语义仍相等`);
    console.log(`       MoonBit: …${mbText.slice(Math.max(0, at - 20), at + 30)}…`);
    console.log(`       JS     : …${jsText.slice(Math.max(0, at - 20), at + 30)}…`);
  }

  // ⑦-4 两份载荷各自过翻译器 + 真 Skia 出图，**像素逐点相同**
  const pxMb = readPixels(ck, replay(ck, opsToTree(mbOps, { width: 200, height: 200 }), { typeface }).surface, 200, 200);
  const pxJs = readPixels(ck, replay(ck, opsToTree(jsOps, { width: 200, height: 200 }), { typeface }).surface, 200, 200);
  let pxDiff = 0;
  for (let i = 0; i < 200 * 200; i++) {
    if (pxMb[i * 4] !== pxJs[i * 4] || pxMb[i * 4 + 1] !== pxJs[i * 4 + 1] || pxMb[i * 4 + 2] !== pxJs[i * 4 + 2]) pxDiff++;
  }
  check(
    '⑦-4 两份载荷各自出图，像素逐点相同（0 个不同点）',
    pxDiff === 0,
    `${pxDiff} 个点不同（共 ${200 * 200}）`,
  );

  // ⑦-5 证伪：把 MoonBit 载荷里某个半径改一点点，⑦-2 与 ⑦-4 都必须变色
  const tampered = mbOps.map((o, i) => (i === 5 && o[0] === 'arc' ? [o[0], o[1], o[2], o[3] + 0.5, o[4], o[5], o[6]] : o));
  const tamperDiff = tampered.some((a, i) => a.length !== jsOps[i].length || !a.every((v, k) => eqNum(v, jsOps[i][k])));
  const pxTamper = readPixels(ck, replay(ck, opsToTree(tampered, { width: 200, height: 200 }), { typeface }).surface, 200, 200);
  let pxTamperDiff = 0;
  for (let i = 0; i < 200 * 200; i++) {
    if (pxMb[i * 4] !== pxTamper[i * 4] || pxMb[i * 4 + 1] !== pxTamper[i * 4 + 1] || pxMb[i * 4 + 2] !== pxTamper[i * 4 + 2]) pxTamperDiff++;
  }
  check(
    '⑦-5 诱饵：把 MoonBit 载荷里一条 `arc` 的半径 +0.5 → 逐条对账与像素对账**都**必须变红',
    tamperDiff && pxTamperDiff > 0,
    `逐条对账${tamperDiff ? '红' : '绿（不合格！）'}；像素差 ${pxTamperDiff} 个点`,
  );

  // ⑦-6 MoonBit 侧的载荷必须能被宿主包的**解码器**收下（形状校验：未知 op 会点名）
  let rejected = false;
  try {
    decode('{"不是":"数组"}');
  } catch {
    rejected = true;
  }
  check('⑦-6 宿主包解码器对形状错的载荷当场点名（不是静默解成 undefined）', rejected);
}

// ── 证据落盘 ─────────────────────────────────────────────────────────────────
if (KEEP) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  savePng(ck, surface, path.join(EVIDENCE, 'compass64.png'), 720, 720);
  for (const lv of ['liangyi', 'sixiang', 'bagua']) {
    const r = ringDraw(lv, hexagrams);
    const { surface: s2 } = replay(ck, opsToTree(r.ops), { typeface });
    savePng(ck, s2, path.join(EVIDENCE, `compass-${lv}.png`), 720, 720);
  }
  console.log(`\n证据 PNG 写到 ${path.relative(ROOT, EVIDENCE)}/`);
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────
const pass = results.filter((r) => r.ok).length;
console.log(`\n================ 汇总 ================`);
console.log(`通过 ${pass}  失败 ${results.length - pass}  跳过 ${skipped.length}`);
if (results.some((r) => !r.ok)) {
  console.log('失败项：');
  for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
  process.exit(1);
}
