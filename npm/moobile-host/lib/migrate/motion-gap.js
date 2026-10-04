// motion-gap.js —— **观感缺口**：源 CSS 里"一眼看得出来的东西"，哪些迁移后**必然没了**。
//
// ## 为什么它该存在（这一条来自"迁移是脚手架的功能点发现"这个视角）
//
// 迁移报告里已经分了四类：F1 动检（会静默失效的）、样式层有损（逐条给理由）、
// 生成物自查（原生上才现形的洞）、以及"必须人工处理"。**但它们都是逐条声明的碎片** ——
// 人要自己把它们聚合成一句"这个应用迁移过来之后，**看/用起来会差什么**"。
//
// 实测的代价（`interest/yi`，2026-10-23）：源 CSS 里有 `:hover` **16 处**、`transition`
// 4 处、`border-radius` 9 处、`box-shadow` 4 处、`transform` 5 处、`cursor` 18 处。
// 它们在报告里散在几十行里，而没有一处说："**这个应用迁移后没有 hover 反馈、没有过渡、
// 圆角没了、阴影没了**。" —— 观感层的第一件事本该是这张清单。
//
// ## 判据（为什么按"类别"而不是按"条数"）
//
// 一条 `transition` 丢了对观感的影响，取决于**它是不是唯一的动效**。所以这里给每一类
// 算一个**影响等级**，并写清"在 RN 里怎么补"：
//
//   · `must`   —— 用户会明显感觉到"这个东西死了"（hover 反馈、过渡、动画）
//   · `info`   —— 看得出但影响小（圆角、阴影、光标）
//
// **不做近似**：认不出的属性一律不进这张表（它们照旧走 `style-map.js` 的有损清单）。

/** 每一类的判据：正则 + 影响等级 + 在 RN 里怎么补。 */
const KINDS = [
  {
    id: 'hover',
    re: /:hover\b/,
    level: 'must',
    why: '触屏没有"悬停"这个状态 —— 源 CSS 里靠 `:hover` 给的高亮/位移全部不会发生',
    how: '改成**按下的状态驱动的条件样式**（RN 的 `Pressable`/状态进 Model），或者干脆不做',
  },
  {
    id: 'focus',
    re: /:focus\b/,
    level: 'info',
    why: '同理：`:focus` 是键盘/指针概念，触屏上没有',
    how: '输入框的聚焦态可以做成"有内容 vs 空"的条件样式',
  },
  {
    id: 'transition',
    // ⚠️ 数的单位是"**有几个属性被声明了过渡**"：`transition: a .15s, transform .15s;`
    //    要算 **2** 个缺口（每个可过渡属性一处）。实测（2026-10-23）：源 CSS 里恰好有这种写法，
    //    而第一版正则要求"属性名紧跟冒号"，只算到 1 —— 判据当场抓住了（`transition: x, transform .15s` ⇒ 1）。
    re: /\btransition\b/g,
    level: 'must',
    why: 'RN 没有 CSS 过渡 —— 状态切换会是**硬切**',
    how: '要动效就走 `Animated` / `Reanimated`（库侧已接画布通道，但过渡没有对应物）',
  },
  {
    id: 'animation',
    re: /\banimation\b/,
    level: 'must',
    why: '同理：`@keyframes` 在 RN 里没有对应物',
    how: '同上（`Animated` 关键帧）',
  },
  {
    id: 'border-radius',
    re: /\bborder-radius\b/,
    level: 'info',
    why: '圆角在 `@style` 里**有**对应物（`border_radius`），但 `50%`（圆形）这一档要人看',
    how: '方形圆角可直接映射；`50%` 要用固定边长换算',
  },
  {
    id: 'box-shadow',
    re: /\bbox-shadow\b/,
    level: 'info',
    why: '`@style` 里没有 `box-shadow`（要结构化数组，装不进扁平的 (key, value)）',
    how: '要阴影就用 `react-native-shadow` 一类，或者接受"没有阴影"',
  },
  {
    id: 'transform',
    re: /\btransform\b/,
    level: 'info',
    why: '`transform` 在 RN 上要结构化数组，装不进扁平样式表',
    how: '`translateY(-1px)` 这种只出现在 `:hover` 里的，随 hover 一起没了；其它要单独表达',
  },
  {
    id: 'cursor',
    re: /\bcursor\b/,
    level: 'info',
    why: '触屏没有光标概念',
    how: '不用补（这条对原生无意义，只在桌面宿主上可惜）',
  },
  {
    id: 'media',
    re: /@media\b/,
    level: 'must',
    why: 'RN 没有媒体查询 —— 断点只能在 Model 里按窗口宽度表达',
    how: '把断点写进 Model（用 `@sub.on_resize`），或者接受"只有一套尺寸"',
  },
];

/**
 * 扫源 CSS，聚合成"观感缺口"清单。
 *
 * @param {{rel: string, text: string}[]} files 源项目文件（只扫 `.html` / `.css`）
 * @returns {{id: string, level: string, hits: number, where: {file: string, line: number}[], why: string, how: string}[]}
 */
function scanMotionGaps(files) {
  const out = [];
  for (const kind of KINDS) {
    const where = [];
    for (const f of files) {
      if (!/\.(html|css)$/.test(f.rel)) continue;
      const lines = f.text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        // ⚠️ 计数要按**出现次数**，不是按"哪几行命中"（2026-10-23 实测踩到）：
        //    源 CSS 把 `transition: border-color .15s, transform .15s;` 写在一行里，
        //    按行数会少报。行号仍按行扫（人要去看的是行）。
        if (kind.id === 'transition') {
          // 过渡的**单位是"有几个属性被声明了过渡"**，不是"出现了几次 transition"：
          //   `transition: border-color .15s, transform .15s;` ⇒ **2** 个缺口。
          // 实测（2026-10-23）踩过两次：① 要求"名字紧跟冒号"⇒ 只算到 1；
          // ② 放宽成"数那批属性名"⇒ 把 `transform: translateY(-1px)` 这类**普通声明**
          //    也算成过渡，真实项目里报到 **277** 处（实际 4 处）。现在只解析 `transition:` 后面的值。
          const hit = lines[i].match(/transition\s*:\s*([^;}]*)/);
          if (hit) {
            const parts = hit[1]
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean);
            for (let k = 0; k < Math.max(1, parts.length); k++) {
              where.push({ file: f.rel, line: i + 1 });
            }
          }
          continue;
        }
        const m = lines[i].match(new RegExp(kind.re.source, 'g'));
        for (let k = 0; k < (m ? m.length : 0); k++) where.push({ file: f.rel, line: i + 1 });
      }
    }
    if (!where.length) continue;
    out.push({
      id: kind.id,
      level: kind.level,
      hits: where.length,
      where: where.slice(0, 6),
      why: kind.why,
      how: kind.how,
    });
  }
  // `must` 在前，命中多的在前
  out.sort((a, b) => (a.level === b.level ? b.hits - a.hits : a.level === 'must' ? -1 : 1));
  return out;
}

module.exports = { scanMotionGaps, KINDS };
