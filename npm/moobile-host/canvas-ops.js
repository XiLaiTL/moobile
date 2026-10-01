// canvas-ops.js —— **draw-op 层**：词汇表 + 解码 + 指令列表 → Skia 元素树。
//
// 这一层为什么在**宿主包**里而不是库侧：库侧（MoonBit 的 `canvas/` 包）只负责
// "把绘制指令说清楚"并发出一段 JSON 文本；**对面用什么渲染是宿主的事**
// （Skia / CanvasKit / 别的）。契约的两端一个在 MoonBit、一个在 JS，
// 所以两边各有一份实现 —— 它们靠 `examples/apps/canvas-spike/` 的跨语言对账钉在一起
// （MoonBit 编出来的载荷交给这里的解码器与翻译器，真 Skia 出图后逐像素断言）。
//
// ## 词汇表（18 条，实测出来的）
//
// 来自 `interest/yi` 的罗盘（`frontend/colorring.mbt`）：`begin_path` 16 · `arc` 12 ·
// `stroke` 9 · `line_to` 9 · `fill` 8 · `close_path` 8 · `set_line_width` 7 · `move_to` 6 ·
// `translate` 3 · `save`/`rotate`/`restore`/`fill_rect` 各 2 · `set_stroke_style`/`set_font`/
// `set_fill_style`/`scale`/`fill_text` 各 1。多一条就是凭空发明 canvas 没有的语义。
//
// ## op 是短数组，不是对象
//
// 六十四卦那一档实测 5335 条 op：数组编码 **181 KB**，对象编码 260 KB（省 31%）。
// 而 tag 名保留完整拼写（`move_to` 而不是 `mv`）—— 再省几个百分点不值得换来看不懂的载荷。

/** 词汇表：tag → 参数名（顺序即数组顺序）。**18 条**。 */
export const OPS = {
  begin_path: [],
  move_to: ['x', 'y'],
  line_to: ['x', 'y'],
  arc: ['cx', 'cy', 'r', 'start', 'end', 'anticlockwise'],
  close_path: [],
  fill_rect: ['x', 'y', 'w', 'h'],
  fill: [],
  stroke: [],
  set_line_width: ['w'],
  set_fill_style: ['color'],
  set_stroke_style: ['color'],
  set_font: ['font'],
  fill_text: ['text', 'x', 'y'],
  save: [],
  restore: [],
  translate: ['x', 'y'],
  rotate: ['rad'],
  scale: ['x', 'y'],
};

export const OP_TAGS = Object.keys(OPS);

/** 做一条 op（挡住拼错的 tag 与参数个数 —— 与其静默收下，不如当场炸）。 */
export function op(tag, ...args) {
  if (!(tag in OPS)) throw new Error(`canvas-ops: 未知 op \`${tag}\`（词汇表只有 ${OP_TAGS.length} 条）`);
  const want = OPS[tag].length;
  if (args.length !== want) throw new Error(`canvas-ops: \`${tag}\` 要 ${want} 个参数，收到 ${args.length}`);
  return args.length ? [tag, ...args] : [tag];
}

export function encode(ops) {
  return JSON.stringify(ops);
}

/**
 * 解码 + **校验**库侧发来的载荷。
 *
 * 校验不是洁癖：形状错的载荷解出来是一堆 `undefined`，绘制时表现成"画了但什么都没有"，
 * 而报错发生在离出错很远的地方。宁可在这里点名。
 */
export function decode(text) {
  const v = typeof text === 'string' ? JSON.parse(text) : text;
  if (!Array.isArray(v)) throw new Error('canvas-ops: 载荷不是数组');
  for (const o of v) {
    if (!Array.isArray(o) || !(o[0] in OPS)) {
      throw new Error(`canvas-ops: 载荷里有未知 op \`${o && o[0]}\``);
    }
  }
  return v;
}

/** 一组 op 用到了词汇表里的哪些 tag（覆盖断言用）。 */
export function usedTags(ops) {
  return [...new Set(ops.map((o) => o[0]))].sort();
}

// ── 指令列表 → Skia 元素树 ────────────────────────────────────────────────────
//
// 输出是**纯数据**（`{type, props, children}`）：既能被 stub 断言形状（离线），
// 也能被真引擎回放（CanvasKit），还能被 `canvas-skia.js` 变成 React 元素。
// 一份产物三处用，不会"文档说一套、代码做一套"。
//
// ## 四个必须做对的 canvas 语义（都是实测踩出来的，前两个会静默画错）
//
// 1. **整圆不能只写一条 SVG 弧**：`arc(cx,cy,r,0,2π)` 是整圆，而 SVG 的 `A` 是两点之间的弧
//    —— 起点终点相同 → **什么都不画**。罗盘每次画纬线与外圈都踩它，必须拆成两段半圆。
// 2. **没有当前点时 `arc()` 要补一个 `M`**：canvas 里它会新开一条子路径。漏了这条，
//    路径就**以 `A` 开头**（没有起点）→ Skia/浏览器把起点当 `(0,0)` → 整圆画到别处。
// 3. **有当前点但不在弧起点上 → 补一条 `L`**（canvas 的隐式连线）。
// 4. **`fill()` 不吃掉路径**：紧随的 `stroke()` 描的是同一条 → 产出**两个**元素（同 `d`，各带一种 paint）。

const TAU = Math.PI * 2;

/** 从 `"12px 'Kaiti TC',serif"` 里取字号与字族（canvas 的 font 是 CSS 简写）。 */
function parseFont(font) {
  const m = /^\s*(\d+(?:\.\d+)?)px\s*(.*)$/.exec(font || '');
  if (!m) return { size: 10, family: 'serif' };
  const family = (m[2] || 'serif').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return { size: Number(m[1]), family };
}

/**
 * `arc()` → SVG 弧命令（含整圆拆分与隐式连线/起点两条 canvas 语义）。
 * @param {number[]|null} cur 当前点（没有子路径起点时为 null）
 */
function arcToSvg(cx, cy, r, start, end, anticlockwise, cur) {
  const out = [];
  const pt = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  let sweep = end - start;
  const ccw = Boolean(anticlockwise);

  r = Math.abs(r);
  if (r === 0) return { d: '', next: cur };
  if (ccw) {
    while (sweep > 0) sweep -= TAU;
  } else {
    while (sweep < 0) sweep += TAU;
  }

  const [sx, sy] = pt(start);
  if (!cur) {
    out.push(`M ${sx} ${sy}`); // canvas：arc 在没有当前点时新开一条子路径
  } else if (Math.abs(cur[0] - sx) > 1e-9 || Math.abs(cur[1] - sy) > 1e-9) {
    out.push(`L ${sx} ${sy}`); // canvas：隐式连线
  }

  const total = Math.abs(sweep);
  const segs = total >= TAU - 1e-9 ? 2 : 1; // 整圆 = 两段半圆
  const step = sweep / segs;
  let a0 = start;
  for (let i = 0; i < segs; i++) {
    const a1 = a0 + step;
    const [x1, y1] = pt(a1);
    const large = Math.abs(step) > Math.PI ? 1 : 0;
    const sweepFlag = (ccw ? step < 0 : step > 0) ? 1 : 0;
    out.push(`A ${r} ${r} 0 ${large} ${sweepFlag} ${x1} ${y1}`);
    a0 = a1;
  }
  return { d: out.join(' '), next: pt(end) };
}

/**
 * 指令列表 → Skia 元素树。
 *
 * `save/translate/rotate/scale/restore` 是 canvas 的**可变状态**，而 Skia 元素树是**声明式**的：
 * 这里把当前累积变换挂到**每个元素自己的 `transform` prop** 上（RN Skia 的绘制节点都接受它），
 * 于是 `save/restore` 退化成"存/取快照"，树保持扁平。
 */
export function opsToTree(ops, options = {}) {
  const width = options.width ?? 720;
  const height = options.height ?? 720;
  const root = { type: 'Canvas', props: { style: { width, height } }, children: [] };

  let transforms = [];
  let fillStyle = '#000000';
  let strokeStyle = '#000000';
  let lineWidth = 1;
  let font = '10px sans-serif';
  let path = [];
  let cur = null;
  const saves = [];

  const push = (el) => {
    if (transforms.length) el.props.transform = transforms.map((t) => ({ ...t }));
    root.children.push(el);
  };

  for (const o of ops) {
    const tag = o[0];
    if (!(tag in OPS)) throw new Error(`canvas-ops: 未知 op \`${tag}\``);
    switch (tag) {
      case 'begin_path':
        path = [];
        cur = null;
        break;
      case 'move_to':
        path.push(`M ${o[1]} ${o[2]}`);
        cur = [o[1], o[2]];
        break;
      case 'line_to':
        path.push(`L ${o[1]} ${o[2]}`);
        cur = [o[1], o[2]];
        break;
      case 'arc': {
        const r = arcToSvg(o[1], o[2], o[3], o[4], o[5], o[6], cur);
        if (r.d) path.push(r.d);
        cur = r.next;
        break;
      }
      case 'close_path':
        path.push('Z');
        break;
      case 'fill':
        if (path.length) {
          push({ type: 'Path', props: { path: path.join(' '), color: fillStyle, style: 'fill' } });
        }
        break;
      case 'stroke':
        if (path.length) {
          push({
            type: 'Path',
            props: { path: path.join(' '), color: strokeStyle, style: 'stroke', strokeWidth: lineWidth },
          });
        }
        break;
      case 'fill_rect':
        push({
          type: 'Rect',
          props: { x: o[1], y: o[2], width: o[3], height: o[4], color: fillStyle },
        });
        break;
      case 'set_line_width':
        lineWidth = o[1];
        break;
      case 'set_fill_style':
        fillStyle = o[1];
        break;
      case 'set_stroke_style':
        strokeStyle = o[1];
        break;
      case 'set_font':
        font = o[1];
        break;
      case 'fill_text':
        push({
          type: 'Text',
          props: { text: o[1], x: o[2], y: o[3], color: fillStyle, font: parseFont(font) },
        });
        break;
      case 'save':
        saves.push({
          transforms: transforms.map((t) => ({ ...t })),
          fillStyle,
          strokeStyle,
          lineWidth,
          font,
        });
        break;
      case 'restore': {
        const s = saves.pop();
        if (!s) throw new Error('canvas-ops: `restore` 多于 `save`（库侧不该产出这种指令序列）');
        transforms = s.transforms;
        fillStyle = s.fillStyle;
        strokeStyle = s.strokeStyle;
        lineWidth = s.lineWidth;
        font = s.font;
        break;
      }
      case 'translate':
        transforms.push({ translateX: o[1], translateY: o[2] });
        break;
      case 'rotate':
        transforms.push({ rotate: o[1] });
        break;
      case 'scale':
        transforms.push({ scaleX: o[1], scaleY: o[2] });
        break;
      default:
        throw new Error(`canvas-ops: 未处理的 op \`${tag}\`（词汇表加了新 op 却忘了映射）`);
    }
  }
  return root;
}

/** 树里各类元素的计数（诊断与断言用）。 */
export function treeStats(tree) {
  const byType = {};
  const walk = (n) => {
    byType[n.type] = (byType[n.type] || 0) + 1;
    (n.children || []).forEach(walk);
  };
  walk(tree);
  return byType;
}
