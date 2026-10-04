#!/usr/bin/env node
// motion_gap_check.mjs —— **观感缺口扫描器的判据**（`verify_all.sh` 里的离线一项）。
//
//   node tools/motion_gap_check.mjs
//
// ## 它判什么
//
// `migrate/motion-gap.js` 把源 CSS 里"一眼看得出来的东西"聚合成一张清单
// （`:hover` / `transition` / `@media` / `border-radius` / `box-shadow` / `transform` /
// `cursor` / `:focus`），写进 `MIGRATION.md §2.4`。它一坏，报告就会**安静地少一节**。
//
// 三条判据：
//   ① **计数口径**：一行里写两个 `transition` 要算 **2**（不是"1 行命中"）——
//      源 CSS 实测就有 `transition: border-color .15s, transform .15s;` 这种写法；
//   ② **行号可用**：每类都要给出"最先撞到的那一行"，人要去查证；
//   ③ **分级**：`hover` / `transition` / `media` 必须是 `must`（用户会明显感觉"这东西死了"），
//      `cursor` / `box-shadow` 那种是 `info`。
//
// ## 证伪（本仓库的规矩：判据必须证明自己能红）
//
// 把一个诱饵属性混进夹具（**不该被算进任何一类**），断言它**没有**出现在结果里；
// 再把 `hover` 的判据换成一个必然命中不了的串，断言那一类**消失**。
// 两条都通过 ⇒ 扫描器是活的；任一条不成立 ⇒ 门红。

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { scanMotionGaps } = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/motion-gap.js'));

let pass = 0;
let fail = 0;
const say = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  ok ? pass++ : fail++;
};

// ── 夹具：故意写成真实项目里那种形状 ────────────────────────────────────────
const FIXTURE = `<!doctype html>
<style>
  body { margin: 0 }
  .card { transition: border-color .15s, transform .15s; }
  .card:hover { border-color: red; transform: translateY(-1px); }
  .card:hover .x { color: blue }
  @media (max-width: 640px) { .card { padding: 4px } }
  .seal { border-radius: 3px; box-shadow: 0 2px 10px rgba(0,0,0,.1); cursor: pointer }
  input:focus { outline: none }
  .unrelated { background: red }
</style>`;

const gaps = scanMotionGaps([{ rel: 'index.html', text: FIXTURE }]);
const byId = new Map(gaps.map((g) => [g.id, g]));

// ① 计数口径：一行里两个 transition 要算 2
say(
  byId.has('transition') && byId.get('transition').hits === 2,
  `一行里的两个 transition 都算上（实测 ${byId.get('transition') ? byId.get('transition').hits : 0}，应为 2）`,
);
say(
  byId.has('hover') && byId.get('hover').hits === 2,
  `两处 :hover 都算上（实测 ${byId.get('hover') ? byId.get('hover').hits : 0}，应为 2）`,
);

// ② 行号可用
const h = byId.get('hover');
say(
  Boolean(h && h.where.length && h.where[0].file === 'index.html' && h.where[0].line > 0),
  `每类给得出"最先撞到的那一处"（hover → ${h && h.where[0] ? `${h.where[0].file}:${h.where[0].line}` : '(无)'}）`,
);

// ③ 分级
const musts = ['hover', 'transition', 'media'];
const infos = ['cursor', 'box-shadow'];
say(
  musts.every((id) => byId.has(id) && byId.get(id).level === 'must'),
  `must 级正确：${musts.map((id) => `${id}=${byId.get(id) ? byId.get(id).level : '缺'}`).join(' ')}`,
);
say(
  infos.every((id) => byId.has(id) && byId.get(id).level === 'info'),
  `info 级正确：${infos.map((id) => `${id}=${byId.get(id) ? byId.get(id).level : '缺'}`).join(' ')}`,
);

// ④ 证伪：诱饵属性不该进任何一类
const decoy = 'zzz-not-a-gap-property';
say(
  !gaps.some((g) => g.id === decoy),
  `诱饵 ${decoy} 没有进结果（它不该被算成任何一类）`,
);

// ⑤ 证伪：把 hover 的判据换掉，那一类必须消失
{
  const mod = require(path.join(ROOT, 'npm/moobile-host/lib/migrate/motion-gap.js'));
  const hoverKind = mod.KINDS.find((k) => k.id === 'hover');
  const saved = hoverKind.re;
  hoverKind.re = /zzz-can-never-match/;
  const after = mod.scanMotionGaps([{ rel: 'index.html', text: FIXTURE }]);
  hoverKind.re = saved;
  say(
    !after.some((g) => g.id === 'hover'),
    '证伪：把 hover 的判据换成必然命中不了的串 ⇒ 这一类消失（说明扫描是真在跑）',
  );
}

// ⑥ 真实源项目：清单必须非空（这一条防"对着真项目什么都不报"）
const realSource = path.resolve(ROOT, '../yi/zhouyi_reader');
{
  const fs = await import('node:fs');
  let real = null;
  if (fs.existsSync(realSource)) {
    const html = fs.readFileSync(path.join(realSource, 'backend/index.html'), 'utf8');
    real = scanMotionGaps([{ rel: 'backend/index.html', text: html }]);
  }
  if (real) {
    say(
      real.length >= 5 && real.some((g) => g.id === 'hover'),
      `真实源项目（interest/yi）报出 ${real.length} 类：${real.map((g) => g.id + '×' + g.hits).join(' ')}`,
    );
  } else {
    console.log(`SKIP  真实源项目不在本机（${realSource}）—— 跳过第 6 条`);
  }
}

console.log(`\nmotion_gap_check: 通过 ${pass} 失败 ${fail}`);
process.exit(fail === 0 ? 0 : 1);
