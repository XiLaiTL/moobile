#!/usr/bin/env node
// report_region_check.mjs —— **`MIGRATION.md` 两个区（生成区 / 手写区）的判据门**
//
//   node tools/report_region_check.mjs
//
// ## 为什么必须有这条门
//
// `MIGRATION.md` 是**两种东西**混在一起："迁移当天的生成物" + "人手补记"（真实应用里就有五条
// 编号补记，价值很高）。混在一起于是**两头都疼**：
//   · 重新生成 ⇒ **把人的补记冲掉**（真实的、不可逆的损失）；
//   · 不重新生成 ⇒ 报告里的数字**一直漂**（实测漂过 4 处）。
// 2026-10-23 拍板：**分区** —— 生成区每次重写、手写区**逐字节保留**（`create.js` 的
// `GENERATED_*` / `HAND_*` 标记与 `reportWithHandRegion`）。
//
// ## 判据（每条都能单独红）
//
//   ① 新生成的报告**两个区各恰好一个**（标记成对、不嵌套、顺序是"生成区在前"）；
//   ② 手写区**有默认内容**（不是空壳 —— 空的"手写区"等于没告诉用户往哪写）；
//   ③ ★ **重新生成不冲掉手写区**：把一份"带手写补记的旧报告"喂进去再生成一次，
//      补记**逐字节**还在（这条是整条门的**目的**，别的都是它的守卫）；
//   ④ ★ **老格式（没有标记）不丢东西**：喂一份"迁移当天那种没有标记的报告" ⇒
//      它**整份**被保留进手写区，并带一句"请人工搬走要紧的补记"；
//   ⑤ 生成区**不含**手写区的标记（否则整个分区会因为"标记套标记"而错位）；
//   ⑥ 真实应用那份 `MIGRATION.md`（如果存在）**必须已经是分区格式**，且手写区非空
//      —— 不然"规则"只在夹具里成立、真文件还是老样子（本仓库栽过"只在夹具上验过"）。
//
// ## 证伪
//
//   `MOBILE_REPORT_DROP_HAND=1`（假装"没保留手写区"）⇒ 判据 ③ 必须红。
//   这个开关**只为这条门存在**，别在产物生成里用。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const C = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/create.js'));
const M = C.REPORT_MARKERS;

let pass = 0;
let fail = 0;
const say = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  ok ? pass++ : fail++;
};
const countOf = (hay, needle) => hay.split(needle).length - 1;

// ── 夹具：一份"生成区正文"（像 renderReport 的输出，但小得多、且自带可识别的串）──
const BODY_V1 = '# 迁移报告 —— `fixture` → `out`\n\n## 0. 一句话\n\n第一版生成物。\n';
const BODY_V2 = '# 迁移报告 —— `fixture` → `out`\n\n## 0. 一句话\n\n**第二版**生成物（数字变了）。\n';
/** 人手补记（要"逐字节"保住的东西：中英文、标点、反引号、空行、末尾空格都没有）。 */
const HAND = '> ⚠️ **本地补记（人手写的）**\n>\n> 1. 第一件事（2026-10-02）：某个坑，判据 `node verify.mjs`。\n> 2. 第二件事：`code` 与"引号"都要原样保住。\n';

// ── ① 两个区各恰好一个 ──────────────────────────────────────────────────────
{
  const t = C.reportWithHandRegion(BODY_V1, '');
  say(
    countOf(t, M.GENERATED_START) === 1 && countOf(t, M.GENERATED_END) === 1,
    `① 生成区标记成对出现一次（开始 ${countOf(t, M.GENERATED_START)} / 结束 ${countOf(t, M.GENERATED_END)}）`,
  );
  say(
    countOf(t, M.HAND_START) === 1 && countOf(t, M.HAND_END) === 1,
    `① 手写区标记成对出现一次（开始 ${countOf(t, M.HAND_START)} / 结束 ${countOf(t, M.HAND_END)}）`,
  );
  const gi = t.indexOf(M.GENERATED_START);
  const hi = t.indexOf(M.HAND_START);
  say(gi >= 0 && hi > gi, '① 顺序是"生成区在前、手写区在后"（读的人先看当前事实、再看人的补记）');
  // ⑤ 生成区里不许出现手写区标记
  const genBody = t.slice(t.indexOf(M.GENERATED_END) === -1 ? 0 : gi, t.indexOf(M.GENERATED_END));
  say(
    !genBody.includes(M.HAND_START) && !genBody.includes(M.HAND_END),
    '⑤ 生成区里**没有**手写区的标记（标记套标记会让下一次解析错位）',
  );
}

// ── ② 手写区有默认内容 ──────────────────────────────────────────────────────
{
  const t = C.reportWithHandRegion(BODY_V1, '');
  const got = C.extractHandRegion(t);
  say(got.text.trim().length > 20, `② 第一次生成时手写区**有内容**（${got.text.trim().length} 字符，不是空壳）`);
  say(/本地补记/.test(got.text), '② 而且那句模板话点明了"这是人手写的地方"');
}

// ── ③ ★ 重新生成不冲掉手写区（这条是整条门的目的）────────────────────────────
{
  const first = C.reportWithHandRegion(BODY_V1, '');
  // 模拟"人往里写了补记"
  const edited = first.replace(C.extractHandRegion(first).text.trim(), HAND.trim());
  const second = C.reportWithHandRegion(BODY_V2, edited);
  const back = C.extractHandRegion(second).text;
  say(
    back.includes(HAND.trim()),
    `③★ 重新生成之后，人的补记**逐字节还在**（${HAND.trim().length} 字符 vs 回来 ${back.trim().length} 字符）`,
  );
  say(
    second.includes('**第二版**生成物'),
    '③ 而同一次生成里，生成区**换成了新的**（不然"不冲掉"就变成"什么都没更新"）',
  );
  say(
    countOf(second, HAND.trim()) === 1,
    '③ 补记**没有重复**（复制粘贴式保留会留下一份旧的 + 一份新的）',
  );
}

// ── ④ ★ 老格式（没有标记）不丢东西 ──────────────────────────────────────────
{
  const legacy = '# 迁移报告 —— 老格式\n\n## 0. 一句话\n\n迁移当天生成的。\n\n> ⚠️ **本地补记（人手写的）**：三条要紧的话。\n> 1. 甲；2. 乙；3. 丙。\n';
  const t = C.reportWithHandRegion(BODY_V2, legacy);
  const got = C.extractHandRegion(t);
  say(
    got.text.includes('三条要紧的话') && got.text.includes('甲；2. 乙；3. 丙'),
    '④★ 老报告（没有标记）**整份**被保留进手写区 —— 一个字都没丢',
  );
  say(
    /原样保留[\s\S]*一个字都没删/.test(got.text) && /搬进本区顶部/.test(got.text),
    '④ 并且带一句"这是上一版报告、请人工搬走要紧的补记"（不静默）',
  );
  say(t.includes('**第二版**生成物'), '④ 生成区仍然是新的那一版');
}

// ── ⑥ 真实应用那份已经是分区格式，且手写区非空 ───────────────────────────────
{
  const apps = fs.existsSync(path.join(ROOT, 'examples/apps')) ? fs.readdirSync(path.join(ROOT, 'examples/apps')) : [];
  const files = apps
    .map((a) => path.join(ROOT, 'examples/apps', a, 'MIGRATION.md'))
    .filter((f) => fs.existsSync(f));
  if (!files.length) {
    console.log('SKIP  判据 ⑥（没有生成物的 MIGRATION.md）');
  } else {
    for (const f of files) {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/');
      const text = fs.readFileSync(f, 'utf8');
      const g = countOf(text, M.GENERATED_START) === 1 && countOf(text, M.GENERATED_END) === 1;
      const h = countOf(text, M.HAND_START) === 1 && countOf(text, M.HAND_END) === 1;
      say(g && h, `⑥★ 真报告已经是分区格式：${rel}（生成区 ${g ? '✓' : '✗'} / 手写区 ${h ? '✓' : '✗'}）`);
      if (h) {
        const hand = C.extractHandRegion(text).text;
        say(hand.trim().length >= 50, `⑥ 它的手写区**非空**（${hand.trim().length} 字符）—— 分区不是摆设`);
      }
    }
  }
}

// ── 证伪：假装"没保留手写区" ⇒ 判据 ③ 必须红 ─────────────────────────────────
{
  const first = C.reportWithHandRegion(BODY_V1, '');
  const edited = first.replace(C.extractHandRegion(first).text.trim(), HAND.trim());
  const prev = process.env.MOBILE_REPORT_DROP_HAND;
  process.env.MOBILE_REPORT_DROP_HAND = '1';
  let dropped;
  try {
    dropped = C.reportWithHandRegion(BODY_V2, edited);
  } finally {
    if (prev === undefined) delete process.env.MOBILE_REPORT_DROP_HAND;
    else process.env.MOBILE_REPORT_DROP_HAND = prev;
  }
  const survived = C.extractHandRegion(dropped).text.includes(HAND.trim());
  say(
    !survived,
    `证伪：把"保留手写区"那一步停掉 ⇒ **同一条判据（③）变红**（补记${survived ? '居然还在' : '没了 ✓'}）` +
      ' —— 说明这条判据量的确实是"保留"这件事，不是"报告里有一块文字"',
  );
}

console.log(`\nreport_region_check: 通过 ${pass} 失败 ${fail}`);
process.exit(fail ? 1 : 0);
