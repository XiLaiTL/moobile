'use strict';
// click-on-view.js —— 「**挂在不会响的标签上的 `on_click`**」这一条判据的**唯一实现**（JS 侧）。
//
//   const { detectClickOnView } = require('./click-on-view.js');
//   detectClickOnView(text, file) -> [{ tag, line, text }]
//
// ── 它守的是什么（迁移里最隐蔽的一类静默失效）─────────────────────────────────
//
// `render.mbt:243`：`on_click` 在 moobile 里被映射成 RN 的 **`onPress`**，
// 而标签表里**只有 `button` / `a` 落到 `Pressable`**；`div` / `span` / `p` 落到
// `View` / `Text`，那两个组件**没有 `onPress` 这个 prop** —— 点击被**丢掉**，
// 不报错、不警告、`class=` 也照样失效。实测（`interest/yi`）：**5 处** `div(… on_click=…)`
// —— 卦卡点不动、折叠点不开。修法是**换标签**，不是加样式。
//
// ── 为什么它不在"按行子串匹配"的那 14 条规则里 ────────────────────────────────
//
// 它要的是"标签 + 事件"两个 token 的**结构关系**（同一次调用里），单行子串判不出来：
// `div(attrs=…, on_click=…)` 与 `button(… on_click=…)` 逐字看没有区别。
//
// ── 为什么单独一个文件（而不是写两遍）────────────────────────────────────────
//
// 两个消费者：F1 扫描器（`scan.js`，报告里逐条点名）与迁移装配器（`create.js`，进 §4 的 TODO 清单）。
// 判据只有一份实现，数出来的东西才敢说"两边一样"。
//
// ⚠️ **口径与那 14 条规则一致：扫的是原始文本，注释里的代码同样算命中。**
//    （兄弟规则也是这么做的：`needle: 'class='` 在注释里一样命中。）
//    这条是**有意的**、并且写进了 FINDINGS —— 假阳性（注释）比假阴性（漏一个真的点不动）
//    代价小得多，而"逐字抄一份更聪明的实现"会让两侧对账门变成在比谁的注释处理更花哨。
//
// ⚠️ **MoonBit 侧那一份（`tools/mbtools/src/migrate_scan.mbt`）是照这个算法抄的**，
//    改这里必须同时改那里 —— 判据是 `node tools/migrate_scan_reconcile.mjs` 与
//    `node tools/migrate_click_scan.mjs` 两侧逐 finding / 逐 hit（含 `text`）一致。

/** `button` / `a` 是标签表里唯二落到 `Pressable` 的标签。 */
const PRESSABLE_TAGS = ['button', 'a'];

/** 标识符字符（与 MoonBit 侧的判定一致：ASCII 字母、数字、下划线）。 */
function isIdentChar(c) {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_';
}

/** 空白（含换行）—— 往回找标签名时要跳过 `div (` 里的那个空格。 */
function isSpace(c) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

/**
 * 找出一段源码里**挂在不支持点击的标签上**的 `on_click`。
 *
 * 算法（**与 MoonBit 侧逐字同构**，别在这里"顺手优化"）：
 *   ① 找到每一处 `on_click`，要求它后面（跳过空白）是 `=`（否则是 `on_clicked` 这类名字）；
 *   ② 从它**往回**扫，用括号配对找到**包着它的那次调用**的左括号（跳过配对的 `)`）；
 *   ③ 读左括号**紧前面**的标识符 —— 那就是标签名（`div(` / `@html.div(` 都读成 `div`）；
 *   ④ 标签名不是 `button` / `a` 就记一条命中（行号取 `on_click` 那一行）。
 *
 * 返回：`[{ tag, line, text }]` —— `text` 是"那一行的摘要 + 标注"，
 * 与扫描器里其它 finding 的 hit 文本同一形状（`excerpt` 由调用方拼，见 `formatHit`）。
 */
function scanClickOnView(text) {
  const out = [];
  const n = text.length;
  let from = 0;
  for (;;) {
    const at = text.indexOf('on_click', from);
    if (at < 0) break;
    from = at + 8; // 无论这次算不算命中，都从这里继续（避免死循环）
    // ① 后面必须是 `=`（跳过空白）
    let j = at + 8;
    while (j < n && isSpace(text[j])) j += 1;
    if (j >= n || text[j] !== '=') continue;
    // ② 往回找包着它的那次调用的左括号
    let depth = 0;
    let tag = null;
    for (let k = at - 1; k >= 0; k -= 1) {
      const c = text[k];
      if (c === ')') depth += 1;
      else if (c === '(') {
        if (depth === 0) {
          // ③ 左括号紧前面那个标识符就是标签名（跳过空白，如 `div (`）
          let p = k - 1;
          while (p >= 0 && isSpace(text[p])) p -= 1;
          let e = p;
          while (p >= 0 && isIdentChar(text[p])) p -= 1;
          if (e > p) tag = text.slice(p + 1, e + 1);
          break;
        }
        depth -= 1;
      }
    }
    if (tag === null || PRESSABLE_TAGS.indexOf(tag) >= 0) continue;
    // ④ 行号 = `on_click` 之前有几个换行
    let line = 1;
    for (let k = 0; k < at; k += 1) if (text.charCodeAt(k) === 10) line += 1;
    out.push({ tag, line });
  }
  return out;
}

/**
 * 命中行的**标注**（`text` 字段的尾巴）。
 *
 * ⚠️ 这个字符串在两侧**必须逐字相同**（对账门逐 hit 比 `text`），所以它是函数、不是拼串散在两边。
 */
function clickHitNote(tag) {
  return '   ← `' + tag + '(…) on_click=`';
}

/** 给 `create.js` 用的形状：带 `kind` / `reason` / `snippet` 的 TODO 条目。 */
function detectClickOnView(text, file) {
  return scanClickOnView(text).map((h) => ({
    kind: 'click-on-view',
    file,
    line: h.line,
    reason:
      `\`${h.tag}(… on_click=…)\` —— \`on_click\` 只对 \`Pressable\` 有效` +
      `（标签表里只有 \`button\` / \`a\` 是 Pressable），\`${h.tag}\` 落到 View/Text 上会把点击**丢掉**`,
    snippet: `${h.tag}(…) on_click=`,
  }));
}

module.exports = { scanClickOnView, detectClickOnView, clickHitNote, PRESSABLE_TAGS };
