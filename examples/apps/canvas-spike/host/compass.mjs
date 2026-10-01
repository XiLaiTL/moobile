// compass.mjs —— **真实样本**：把 yi 的六十四卦色环（罗盘）1:1 抄成 draw-op 列表。
//
// 为什么必须用真代码而不是造一个圆：`DESIGN.md` §10 原则 5 说"对 yi 的改动尽量为零"，
// 而罗盘正是"迁移时最贵的那块"。用一个玩具图形验证不了任何东西 ——
// 罗盘会把映射里的坑全暴露出来（整圆 arc、扇区外弧内弧反向、切向文字的 save/rotate/restore、
// 等面积环带半径 `R·√(k/rings)`）。
//
// 逐段对应关系（原文件：`interest/yi/zhouyi_reader/frontend/colorring.mbt` + `main.mbt`）：
//
//   yi 的写法                              → 这里
//   ─────────────────────────────────────────────────────────
//   `ctx.begin_path()` / `move_to` / …      → `ctx.begin_path()` / `move_to` / …（同名）
//   `annulus_sector()`  colorring.mbt:191   → `annulusSector()`
//   `ring_labels()`     colorring.mbt:226   → `ringLabels()`
//   `ring_draw()`       colorring.mbt:270   → `ringDraw()`
//   `ttext()`           main.mbt:652        → `ttext()`
//   `label_w()`         main.mbt:634        → `labelW()`
//   `is_zheng_gua()`    main.mbt:562        → `isZhengGua()`
//   `xiantian_ring` / `jingfang_ring`  main.mbt:543/553 → 同名常量
//
// **改动只有一处、且是必须的**：MoonBit 里 `ctx` 是 DOM 的 `CanvasRenderingContext2D`；
// 这里是 `OpCtx` —— 一个把同样的方法名收成 draw-op 的收集器。除此之外坐标、颜色、
// 半径公式、绘制顺序全部逐行照抄。

// ⚠️ 词汇表住在**宿主包**里（单一来源）—— 试金石刻意导入源码那份，
//    而不是抄一份到这里：两份实现就是等着漂（见 tools/check_npm_fresh.mjs 记的那次事故）。
import { op } from '../../../../npm/moobile-host/canvas-ops.js';

/** 与 yi 的调色板一字不差（`main.mbt:504-513`，`colorring.mbt:48/51`）。 */
export const COLORS = {
  paper: '#f6efe0', // c_paper
  yang: '#fdfaf0', // c_yang —— 阳爻 · 白
  ink: '#1a1410', // c_ink —— 阴爻 · 黑
  ink3: '#7a6851', // c_ink3
  gold: '#b8902f', // c_gold
  vermilion: '#8a2518', // c_vermilion
  sectorStroke: 'rgba(184,144,47,0.28)', // colorring.mbt:219 的字面量
};

/** 先天圆图卦序（`main.mbt:543`，逐字抄）。 */
export const xiantianRing = [
  24, 27, 3, 42, 51, 21, 17, 25, 36, 22, 63, 37, 55, 30, 49, 13, 19, 41, 60, 61, 54, 38,
  58, 10, 11, 26, 5, 9, 34, 14, 43, 1, 44, 28, 50, 32, 57, 48, 18, 46, 6, 47, 64, 40, 59,
  29, 4, 7, 33, 31, 56, 62, 53, 39, 52, 15, 12, 45, 35, 16, 20, 8, 23, 2,
];

/** 京房八宫卦序（`main.mbt:553`，逐字抄）。 */
export const jingfangRing = [
  58, 47, 45, 31, 39, 15, 62, 54, 1, 44, 33, 12, 20, 23, 35, 14, 29, 60, 3, 63, 49, 55,
  36, 7, 52, 22, 26, 41, 38, 10, 61, 53, 51, 16, 40, 32, 46, 48, 28, 17, 57, 9, 37, 42,
  25, 21, 27, 18, 30, 56, 50, 64, 4, 59, 6, 13, 2, 24, 19, 11, 34, 43, 5, 8,
];

/** `tri_meta`（colorring.mbt:55）：三画卦 → [符号, 爻码, 纯卦序号]。 */
const TRI_META = {
  乾: ['☰', '111', 1],
  兑: ['☱', '110', 58],
  离: ['☲', '101', 30],
  震: ['☳', '100', 51],
  巽: ['☴', '011', 57],
  坎: ['☵', '010', 29],
  艮: ['☶', '001', 52],
  坤: ['☷', '000', 2],
};

const BAGUA_NAMES = {
  xian: ['乾', '兑', '离', '震', '坤', '艮', '坎', '巽'],
  houtian: ['离', '坤', '兑', '乾', '坎', '艮', '震', '巽'],
  jingfang: ['乾', '震', '坎', '艮', '坤', '巽', '离', '兑'],
};

/** 四象条目（`four_items`，colorring.mbt:80）。默认走「二进制」那一档。 */
function fourItems(order4) {
  const T = {
    erjin: [
      [[0, 0], '太阴'],
      [[0, 1], '少阳'],
      [[1, 0], '少阴'],
      [[1, 1], '太阳'],
    ],
    xiaozhang: [
      [[1, 1], '老阳'],
      [[1, 0], '少阴'],
      [[0, 0], '老阴'],
      [[0, 1], '少阳'],
    ],
    fangwei: [
      [[0, 0], '老阴'],
      [[0, 1], '少阳'],
      [[1, 1], '老阳'],
      [[1, 0], '少阴'],
    ],
    shengcheng: [
      [[1, 1], '太阳'],
      [[1, 0], '少阴'],
      [[0, 1], '少阳'],
      [[0, 0], '太阴'],
    ],
  }[order4];
  return T.map(([lines, label]) => ({ lines, label, symbol: '', number: 0 }));
}

function codeLines(code) {
  return [...code].map((c) => (c === '1' ? 1 : 0));
}

/** `ring_items`（colorring.mbt:169）：(扇区数, 环数, 条目)。 */
export function ringItems(level, hexagrams, opts = {}) {
  const order4 = opts.order4 || 'erjin';
  const order8 = opts.order8 || 'xian';
  switch (level) {
    case 'liangyi':
      return {
        sectors: 2,
        rings: 1,
        items: [
          { lines: [1], label: '阳', symbol: '', number: 0 },
          { lines: [0], label: '阴', symbol: '', number: 0 },
        ],
      };
    case 'sixiang':
      return { sectors: 4, rings: 2, items: fourItems(order4) };
    case 'bagua':
      return {
        sectors: 8,
        rings: 3,
        items: BAGUA_NAMES[order8].map((name) => {
          const [sym, code, num] = TRI_META[name];
          return { lines: codeLines(code), label: name, symbol: sym, number: num };
        }),
      };
    case 'liushisi': {
      const order =
        order8 === 'houtian'
          ? Array.from({ length: 64 }, (_, i) => i + 1)
          : order8 === 'jingfang'
            ? jingfangRing
            : xiantianRing;
      return {
        sectors: 64,
        rings: 6,
        items: order.map((n) => {
          const h = hexagrams[n - 1];
          return { lines: codeLines(h.code), label: h.name, symbol: '', number: n };
        }),
      };
    }
    default:
      throw new Error(`compass: 未知层级 \`${level}\``);
  }
}

/** `is_zheng_gua`（main.mbt:562）：四正卦 乾坤坎离。 */
function isZhengGua(name) {
  return name === '乾' || name === '坤' || name === '坎' || name === '离';
}

/** `label_w`（main.mbt:634）：**估算**而非测量（yi 自述"无 measure_text"）。 */
function labelW(s, size) {
  return [...s].length * size * 1.02;
}

/** 收集器：方法名与 DOM 的 `CanvasRenderingContext2D` **同名**，于是移植是逐行照抄。 */
export class OpCtx {
  constructor() {
    this.ops = [];
  }
  begin_path() {
    this.ops.push(op('begin_path'));
  }
  move_to(x, y) {
    this.ops.push(op('move_to', x, y));
  }
  line_to(x, y) {
    this.ops.push(op('line_to', x, y));
  }
  arc(cx, cy, r, start, end, anticlockwise = false) {
    this.ops.push(op('arc', cx, cy, r, start, end, anticlockwise));
  }
  close_path() {
    this.ops.push(op('close_path'));
  }
  fill_rect(x, y, w, h) {
    this.ops.push(op('fill_rect', x, y, w, h));
  }
  fill() {
    this.ops.push(op('fill'));
  }
  stroke() {
    this.ops.push(op('stroke'));
  }
  set_line_width(w) {
    this.ops.push(op('set_line_width', w));
  }
  // `c_fill` / `c_stroke`（main.mbt:640/646）就是这两个的字符串包装
  set_fill_style(color) {
    this.ops.push(op('set_fill_style', color));
  }
  set_stroke_style(color) {
    this.ops.push(op('set_stroke_style', color));
  }
  set_font(font) {
    this.ops.push(op('set_font', font));
  }
  fill_text(text, x, y) {
    this.ops.push(op('fill_text', text, x, y));
  }
  save() {
    this.ops.push(op('save'));
  }
  restore() {
    this.ops.push(op('restore'));
  }
  translate(x, y) {
    this.ops.push(op('translate', x, y));
  }
  rotate(rad) {
    this.ops.push(op('rotate', rad));
  }
  scale(x, y) {
    this.ops.push(op('scale', x, y));
  }
}

/** `annulus_sector`（colorring.mbt:191）—— 环带扇区：外弧顺、内弧逆。 */
export function annulusSector(ctx, cx, cy, start, end, rIn, rOut, color) {
  if (rIn >= rOut) return; // 原样保留这个早退（colorring.mbt:201）
  ctx.begin_path();
  const isx = cx + rIn * Math.cos(start);
  const isy = cy + rIn * Math.sin(start);
  const osx = cx + rOut * Math.cos(start);
  const osy = cy + rOut * Math.sin(start);
  const iex = cx + rIn * Math.cos(end);
  const iey = cy + rIn * Math.sin(end);
  ctx.move_to(isx, isy);
  ctx.line_to(osx, osy);
  ctx.arc(cx, cy, rOut, start, end, false);
  ctx.line_to(iex, iey);
  ctx.arc(cx, cy, rIn, end, start, true);
  ctx.close_path();
  ctx.set_fill_style(color);
  ctx.fill();
  ctx.set_stroke_style(COLORS.sectorStroke);
  ctx.set_line_width(0.4);
  ctx.stroke();
}

/** `ttext`（main.mbt:652）—— 切向文字：基线垂直于半径，字头朝外。 */
export function ttext(ctx, cx, cy, deg, r, text, size, color) {
  const rad = (deg * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx + r * Math.cos(rad), cy + r * Math.sin(rad));
  ctx.rotate(rad + Math.PI / 2);
  ctx.set_font(`${size}px 'Kaiti TC','STKaiti',serif`);
  ctx.set_fill_style(color);
  ctx.fill_text(text, -labelW(text, size) / 2, 4);
  ctx.restore();
}

/** `ring_labels`（colorring.mbt:226）。 */
export function ringLabels(ctx, cx, cy, rMax, level, sectors, items, colors = COLORS) {
  const sa = (2 * Math.PI) / sectors;
  for (let i = 0; i < sectors; i++) {
    const mid = -Math.PI / 2 + (i + 0.5) * sa;
    const deg = (mid * 180) / Math.PI;
    const item = items[i];
    if (level === 'liangyi' || level === 'sixiang') {
      ttext(ctx, cx, cy, deg, rMax + 16, item.label, 14, colors.vermilion);
    } else if (level === 'bagua') {
      ttext(ctx, cx, cy, deg, rMax + 16, item.label, 12, colors.vermilion);
      if (item.symbol !== '') ttext(ctx, cx, cy, deg, rMax + 30, item.symbol, 13, colors.gold);
    } else if (level === 'liushisi') {
      ttext(
        ctx,
        cx,
        cy,
        deg,
        rMax + 14,
        item.label,
        10,
        isZhengGua(item.label) ? colors.vermilion : colors.ink3,
      );
    }
  }
}

/**
 * `ring_draw`（colorring.mbt:270）—— 色环主绘图。
 *
 * 返回 `{ ops, sectors, rings, radii, items, cx, cy, rMax }`：
 * 把布局参数一并交出来，**测试才能独立算出"某个点应该是什么颜色"**
 * （只断言"画了东西"抓不住设计错误，见 AGENTS.md §4）。
 */
export function ringDraw(level, hexagrams, opts = {}) {
  const ctx = new OpCtx();
  const cx = 360.0;
  const cy = 360.0;
  const pi = Math.PI;
  const rMax = 300.0;
  const colors = { ...COLORS, ...(opts.colors || {}) };

  ctx.set_fill_style(colors.paper);
  ctx.fill_rect(0, 0, 720, 720);

  const { sectors, rings, items } = ringItems(level, hexagrams, opts);
  const sa = (2 * pi) / sectors;

  // 等面积环带半径：r_k = R·√(k/rings)（colorring.mbt:283）
  const radii = [];
  for (let k = 0; k <= rings; k++) radii.push(rMax * Math.sqrt(k / rings));

  // 扇区填充
  for (let i = 0; i < sectors; i++) {
    const start = -pi / 2 + i * sa;
    const end = start + sa;
    const item = items[i];
    for (let j = 0; j < rings; j++) {
      const isYang = item.lines[j] === 1;
      annulusSector(
        ctx,
        cx,
        cy,
        start,
        end,
        radii[j],
        radii[j + 1],
        isYang ? colors.yang : colors.ink,
      );
    }
  }

  // 经线（扇区边界）
  ctx.set_stroke_style(colors.gold);
  ctx.set_line_width(1.2);
  for (let i = 0; i < sectors; i++) {
    const a = -pi / 2 + i * sa;
    ctx.begin_path();
    ctx.move_to(cx, cy);
    ctx.line_to(cx + rMax * Math.cos(a), cy + rMax * Math.sin(a));
    ctx.stroke();
  }

  // 纬线（环带边界）
  for (let k = 1; k < radii.length - 1; k++) {
    ctx.begin_path();
    ctx.arc(cx, cy, radii[k], 0, 2 * pi);
    ctx.stroke();
  }

  // 外圈
  ctx.set_line_width(2.5);
  ctx.begin_path();
  ctx.arc(cx, cy, rMax, 0, 2 * pi);
  ctx.stroke();

  // 标签
  ringLabels(ctx, cx, cy, rMax, level, sectors, items, colors);

  return { ops: ctx.ops, sectors, rings, radii, items, cx, cy, rMax, sa };
}
