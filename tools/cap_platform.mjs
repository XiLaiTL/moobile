#!/usr/bin/env node
// cap_platform.mjs —— 能力包的「哪端可用」矩阵 + 一致性门（`PLAN.md` §3.6 的 N5）。
//
// ## 为什么需要它
//
// vendor 里的能力包（`sub/` `clipboard/` `nav/` `dialog/`）是 **DOM 实现**：
// 在 RN 上 `document` 不存在 → 这些能力**要么抛、要么静默不做**。
// 而"哪些能用、哪些不能、不能的替代物是什么"过去**只散在注释里** —— 会漂。
//
// 本工具把那张表变成**机器校验的**：表在代码里（下面两个常量），
// 但**代码变了而表没改 → 门红**。这正是 F1（迁移动检报告）要的口径：
// **把静默失效变成可见的**。F1 还没做，这张表就是它的数据源。
//
// ## 它校验什么
//
// ① **公开 API 覆盖**：四个包里每个 `pub fn` 都必须在 `PUBLIC_API` 里有条目
//    （新增一个能力却忘了标"哪端可用" → 红）；
// ② **反向覆盖**：表里的条目必须在代码里真的存在（改了名 → 红，不许留幽灵条目）；
// ③ **DOM 清单**：四个包里扫出来的每条 `@dom.<链路>` 都必须在 `DOM_INVENTORY` 里
//    （**新引入一条浏览器依赖 → 红**，逼着做一次平台判断）；
// ④ **可达性**：`exposed` 字段必须与"根上有没有转发包"一致
//    （`clipboard/ nav/ dialog/` 消费者 import 不到 —— 这条过去只在文档里说过）。
//
// 用法：
//   node tools/cap_platform.mjs           # 校验（CI / 提交前）
//   node tools/cap_platform.mjs --list    # 打印矩阵，供人读

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const PKGS = ['sub', 'clipboard', 'nav', 'dialog'];

/** 平台状态取值。`ok` = 该端可用；`host-cap` = 已接宿主能力通道；`todo` = 有替代物但没接；
 *  `web-only` = 无替代物；`plumbing` = 与平台无关的管道（订阅器本身/消息类型）。 */
const STATUS = new Set(['ok', 'host-cap', 'todo', 'web-only', 'plumbing']);

/**
 * 消费者能不能 import 到这个包 —— 判据是**根上有没有同名转发包**（生成物）。
 * ⚠️ 显式写死而不是从 note 里嗅探：嗅探那种写法脆，而且"改了文案就换了语义"。
 * 这条对应 `PLAN.md` §7 的**决策点 17**（要不要暴露 `clipboard/ nav/ dialog/`）——
 * 一旦拍板要暴露，转发包会出现，这里必须**同批**改成 true。
 */
const EXPOSED = { sub: true, clipboard: false, nav: false, dialog: false };

/**
 * 公开 API × 平台。`replacement` 只有 `todo` 才必填 —— 那是"下一步接什么"。
 * ⚠️ `web` 一列不写：这些包本来就是给浏览器写的，**全部 `ok`**。
 */
const PUBLIC_API = {
  sub: {
    every: { rn: 'ok', note: '标准 JS 全局（setInterval），RN 本来就有' },
    on_animation_frame: { rn: 'ok', note: '标准 JS 全局（requestAnimationFrame），同上' },
    on_visibility_change: { rn: 'host-cap', note: '宿主能力 native.visibility（RN → AppState）；真机验过' },
    on_resize: { rn: 'host-cap', note: '宿主能力 native.geometry（RN → Dimensions）；载荷走 subscribe_json 严格解。真机**未**验' },
    current_viewport: { rn: 'host-cap', note: '读一次当前视口（同步）：宿主能力 native.geometry.**read()**（RN → Dimensions.get），问不到回退 DOM（`window.innerWidth`）—— 与 on_resize 的订阅互补（两端都不补发初始值）。第十一轮补，起因：应用读不到窗口宽度 ⇒ 画布一直画在回落值上' },
    on_scroll: { rn: 'web-only', note: '⚠️ **不是「待接」，是语义不成立**：Web 上它报文档级滚动，RN 没有文档级滚动（滚动在 ScrollView 内部、是组件 prop）→ 替代物在**组件通道**，宿主能力换不掉一个不存在的语义。现在装载时**明确 abort**，不再静默给 0' },
    on_url_changed: { rn: 'host-cap', note: '不是能力注册表，是**既有的** Scheduler 注入器：sub 把注入器交给宿主，宿主调 Context::inject_url_changed 驱动。有 DOM 时同时挂 popstate（Web 老行为不变）；**没有 DOM 时一个 DOM API 都不碰**（原来无条件挂 popstate → RN 上装载就抛）' },
    on_url_request: { rn: 'host-cap', note: '同 on_url_changed（注入器）；同源判断的基准 URL 走 Context::get_origin —— 原来读 window.location.href，RN 上没有 location 会抛' },
    on_key_down: { rn: 'web-only', note: '移动端没有全局键盘' },
    on_key_up: { rn: 'web-only', note: '同上' },
    on_mouse_move: { rn: 'web-only', note: '触屏没有 hover/指针移动；手势走 RN responder' },
    custom_sub: { rn: 'plumbing', note: '通用扩展点，行为由应用自己写的 loader 决定' },
    batch: { rn: 'plumbing', note: '纯组合' },
    'Sub::to_map': { rn: 'plumbing', note: '运行时内部用' },
  },
  clipboard: {
    copy: { rn: 'todo', replacement: 'expo-clipboard', note: '⚠️ 本包在根上**没有转发包**，消费者 import 不到（见 PLAN §7 决策点 17）' },
    paste: { rn: 'todo', replacement: 'expo-clipboard', note: '同上' },
  },
  nav: {
    back: { rn: 'web-only', note: 'RN 没有浏览历史栈；⚠️ 本包没有转发包，消费者 import 不到' },
    forward: { rn: 'web-only', note: '同上' },
    load: { rn: 'web-only', note: 'RN 没有地址栏' },
    reload: { rn: 'web-only', note: '同上' },
    push_url: { rn: 'web-only', note: '同上' },
    replace_url: { rn: 'web-only', note: '同上' },
    scroll_to: { rn: 'todo', replacement: 'ScrollView.scrollTo', note: '⚠️ 按元素 id 定位（get_element_by_id）在 RN 上没有对应物' },
    scroll_to_top: { rn: 'todo', replacement: 'ScrollView.scrollTo', note: '' },
    scroll_to_bottom: { rn: 'todo', replacement: 'ScrollView.scrollTo', note: '' },
    scroll_to_pos: { rn: 'todo', replacement: 'ScrollView.scrollTo', note: '按坐标，最接近的一档' },
    scroll_by_pos: { rn: 'todo', replacement: 'ScrollView.scrollTo', note: '按坐标增量' },
  },
  dialog: {
    show: { rn: 'web-only', note: 'HTML `<dialog>` + showModal；RN 侧要的是 Modal 组件，形状不同（见 I 轨道的组件通道）' },
    close: { rn: 'web-only', note: '同上' },
    request_close: { rn: 'web-only', note: '同上' },
  },
};

/**
 * 四个包扫出来的 DOM 链路 → 分类。键是 `接收者.末端方法`（`window.set_interval` 这种）。
 * 类别：`ok` 标准 JS 全局 / `host-cap` 已接宿主能力 / `todo` 有替代物未接 /
 *      `web-only` 无替代物 / `raw` 只是接收者（`@dom.window()` 本身）。
 *
 * `rnFails` 是**在 RN 上会怎样** —— 这一轴才是"静默失效"的判据，取值：
 *   `ok`     RN 上正常
 *   `throw`  会抛（`document` 不存在 → ReferenceError；`window.location` 无此属性 → TypeError）
 *   `silent` **不抛，给错值** —— 最危险的一类
 *
 * ⚠️ 判定依据是 RN 自己的 `Libraries/Core/setUpGlobals.js`：它做 `global.window = global`，
 *    **但从不定义 `document`**。所以：
 *      · `@dom.window()` 拿得到（= globalThis），`@dom.document()` 直接 ReferenceError；
 *      · `window.innerWidth` / `scrollY` 这类**属性**在 globalThis 上不存在 → `undefined`
 *        → 按 `-> Int` 接住就是 0 —— **不抛、静默给错值**；
 *      · `window.location` / `window.history` 是对象属性，`undefined.href` → TypeError（抛）。
 *    **反直觉的结论**：更危险的不是"C 类无替代物"，而是"B 类有替代物但当前静默"的那两条。
 */
const CLASSES = new Set(['ok', 'host-cap', 'todo', 'web-only', 'raw', 'guard']);

/** 在 RN 上会怎样 —— 三值见 DOM_INVENTORY 的说明。 */
const RN_FAILS = new Set(['ok', 'throw', 'silent']);

const DOM_INVENTORY = {
  sub: {
    'window': { cls: 'raw', rnFails: 'ok', note: '接收者本身 —— RN 做了 `global.window = global`，拿得到' },
    'window.set_interval': { cls: 'ok', rnFails: 'ok', note: 'every（globalThis.setInterval）' },
    'window.clear_interval': { cls: 'ok', rnFails: 'ok', note: 'every' },
    'window.request_animation_frame': { cls: 'ok', rnFails: 'ok', note: 'on_animation_frame' },
    'window.cancel_animation_frame': { cls: 'ok', rnFails: 'ok', note: 'on_animation_frame' },
    'window.inner_width': { cls: 'host-cap', rnFails: 'ok', note: '`on_resize`（订阅）与 `current_viewport`（**读一次**）的 **Web 回退**路径；RN 上两条都走宿主能力 geometry（`subscribe` / `read`）—— 而读这一次**还额外先问 `host_has_dom()`**：RN 的 `window` 存在但 `innerWidth` 是 undefined，直接读会静默给 0' },
    'window.inner_height': { cls: 'host-cap', rnFails: 'ok', note: '同 inner_width' },
    'window.scroll_x': { cls: 'web-only', rnFails: 'throw', note: 'on_scroll：RN 上语义不成立，现在**装载时就 abort 报错**（不再静默给 0）' },
    'window.scroll_y': { cls: 'web-only', rnFails: 'throw', note: '同 scroll_x' },
    'window.current_url': { cls: 'guard', rnFails: 'ok', note: '受 host_has_dom 保护：RN 上走 Context::get_origin（on_url_request）或由宿主注入（on_url_changed），**不会走到这里**' },
    'window.add_event_listener': { cls: 'guard', rnFails: 'ok', note: 'popstate 受 host_has_dom 保护；scroll 那一支在 RN 上会先 abort（也走不到）；resize 已改走宿主能力' },
    'document': { cls: 'todo', rnFails: 'throw', note: '接收者本身；RN 上 `document` 未定义 → ReferenceError' },
    'document.hidden': { cls: 'host-cap', rnFails: 'ok', note: 'on_visibility_change（RN → AppState）—— 走宿主能力，不碰 document' },
    'document.add_event_listener': { cls: 'todo', rnFails: 'throw', note: 'visibilitychange=已接宿主能力；keydown/keyup/mousemove=Web-only（会抛）' },
    'document.query_selector': { cls: 'web-only', rnFails: 'throw', note: '滚动位置助手里的 query_selector("html")' },
  },
  clipboard: {
    'window.write_text': { cls: 'todo', rnFails: 'throw', note: 'navigator.clipboard → expo-clipboard；RN 上 navigator 不存在' },
    'window.read_text': { cls: 'todo', rnFails: 'throw', note: '同上' },
  },
  nav: {
    'window.history_go_back': { cls: 'web-only', rnFails: 'throw', note: 'RN 无浏览历史栈（location/history 都不存在）' },
    'window.history_go_forward': { cls: 'web-only', rnFails: 'throw', note: '同上' },
    'window.load_url': { cls: 'web-only', rnFails: 'throw', note: 'RN 无地址栏' },
    'window.reload_url': { cls: 'web-only', rnFails: 'throw', note: '同上' },
    'window.push_url': { cls: 'web-only', rnFails: 'throw', note: '同上' },
    'window.replace_url': { cls: 'web-only', rnFails: 'throw', note: '同上' },
    'window.current_url': { cls: 'web-only', rnFails: 'throw', note: '同上' },
    'window.scroll_to': { cls: 'todo', rnFails: 'silent', note: 'ScrollView.scrollTo（scrollTo 在 globalThis 上不存在 → 不抛，静默无操作）' },
    'window.scroll_to_top': { cls: 'todo', rnFails: 'silent', note: '同上' },
    'window.scroll_to_bottom': { cls: 'todo', rnFails: 'silent', note: '同上' },
    'window.scroll_by': { cls: 'todo', rnFails: 'silent', note: '同上' },
    'document.get_element_by_id': { cls: 'todo', rnFails: 'throw', note: 'nav：按 id 定位元素，RN 上要改成 ref' },
  },
  dialog: {
    'document': { cls: 'web-only', rnFails: 'throw', note: 'RN 上没有 document' },
    'document.get_element_by_id': { cls: 'web-only', rnFails: 'throw', note: 'dialog：HTML dialog 元素；RN 侧是 Modal 组件' },
  },
};

// ── 校验 ──

let fail = 0;
const bad = (msg) => {
  fail += 1;
  console.log(`  FAIL ${msg}`);
};

/** 扫一个包里 `pub fn` 的名字（保留 `Type::name` 形态）。 */
function publicFns(pkg) {
  const dir = path.join(ROOT, 'vendor', 'rabbita', pkg);
  const out = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.mbt') || f.includes('test')) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(/^pub fn\s+([A-Za-z_0-9:]+)/gm)) out.add(m[1]);
  }
  return out;
}

/** 尾部这些方法是"后处理"，不是 DOM 能力本身，归一时去掉。 */
const TRAILER = new Set(['wait', 'to_option', 'unwrap', 'to_string', 'as_event_target', 'to_event_target']);
const DOM_RE = /@dom\.([A-Za-z_0-9]+(?:\(\)\.[A-Za-z_0-9]+)*)/g;

function domInventory(pkg) {
  const dir = path.join(ROOT, 'vendor', 'rabbita', pkg);
  const out = new Set();
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.mbt') || f.includes('test')) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of src.matchAll(DOM_RE)) {
      const parts = m[1].replace(/\(\)/g, '').split('.');
      if (/^[A-Z]/.test(parts[0])) continue; // 类型引用（@dom.MouseEvent 之类）
      while (parts.length > 1 && TRAILER.has(parts[parts.length - 1])) parts.pop();
      out.add(parts.length === 1 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`);
    }
  }
  return out;
}

function check() {
  console.log('cap_platform —— 能力包的「哪端可用」矩阵');

  for (const pkg of PKGS) {
    const fns = publicFns(pkg);
    const table = PUBLIC_API[pkg];
    if (!table) {
      bad(`${pkg}: 表里没有这个包`);
      continue;
    }
    // ① 代码 → 表
    for (const fn of fns) {
      if (!(fn in table)) {
        bad(`${pkg}::${fn} 是公开 API，但 PUBLIC_API 里没有它 —— 新增能力必须同时标"哪端可用"`);
      }
    }
    // ② 表 → 代码
    for (const api of Object.keys(table)) {
      if (!fns.has(api)) bad(`${pkg}::${api} 在表里但代码里找不到（改了名？幽灵条目？）`);
      const e = table[api];
      if (!STATUS.has(e.rn)) bad(`${pkg}::${api} 的 rn 状态 '${e.rn}' 不是允许值（${[...STATUS].join('/')}）`);
      if (e.rn === 'todo' && !e.replacement) bad(`${pkg}::${api} 标成 todo，但没写 replacement —— "待接"必须说清接什么`);
    }
    // ③ DOM 清单：扫 → 表
    const dom = domInventory(pkg);
    const inv = DOM_INVENTORY[pkg] || {};
    for (const k of dom) {
      if (!(k in inv)) {
        bad(`${pkg}: 代码里有 \`@dom.${k}\` 但 DOM_INVENTORY 里没登记 —— 新引入的浏览器依赖必须做一次平台判断`);
      }
    }
    // ④ DOM 清单：表 → 扫
    for (const k of Object.keys(inv)) {
      if (!dom.has(k)) bad(`${pkg}: DOM_INVENTORY 里的 '${k}' 代码里已经没有了（陈旧条目）`);
      const cls = inv[k].cls;
      if (!CLASSES.has(cls)) bad(`${pkg}: '${k}' 的类别 '${cls}' 不是允许值（${[...CLASSES].join('/')}）`);
      if (!RN_FAILS.has(inv[k].rnFails)) {
        bad(
          `${pkg}: '${k}' 的 rnFails '${inv[k].rnFails}' 不是允许值（${[...RN_FAILS].join('/')}）` +
            ` —— 每条都要说清"在 RN 上会抛还是会静默"`,
        );
      }
    }
    // ⑤ 可达性：声明必须与"根上有没有转发包"一致（对应 PLAN §7 决策点 17）
    const exposed = fs.existsSync(path.join(ROOT, pkg, 'moon.pkg'));
    if (exposed !== EXPOSED[pkg]) {
      bad(
        `${pkg}: 可达性与声明不一致 —— 根上${exposed ? '有' : '没有'}转发包，` +
          `而 EXPOSED 写的是 ${EXPOSED[pkg]}。` +
          `（拍了决策点 17 就要同批改这里）`,
      );
    }
  }

  if (fail) {
    console.log(`\n失败 ${fail} 项`);
    process.exit(1);
  }
  console.log('  一致：公开 API 与 DOM 清单都被登记过');
  console.log(`\n合计：${PKGS.reduce((n, p) => n + Object.keys(PUBLIC_API[p]).length, 0)} 个公开 API、` +
    `${PKGS.reduce((n, p) => n + Object.keys(DOM_INVENTORY[p]).length, 0)} 条 DOM 链路`);

  // 单独报"静默"那一类 —— 这是最该被看见的，别埋在表里。
  // 反直觉但实测成立：更危险的不是"C 类无替代物"（那会抛），而是"B 类有替代物但当前静默"。
  const silent = [];
  const throws = [];
  for (const pkg of PKGS) {
    for (const [k, e] of Object.entries(DOM_INVENTORY[pkg])) {
      if (e.rnFails === 'silent') silent.push(`${pkg}.${k}`);
      else if (e.rnFails === 'throw') throws.push(`${pkg}.${k}`);
    }
  }
  console.log(`\nRN 上**静默给错值**（不抛，最难发现）${silent.length} 条：${silent.join(', ')}`);
  console.log(`RN 上**会抛**（吵，反而好查）${throws.length} 条：${throws.join(', ')}`);
}

function list() {
  const mark = { ok: '✅ 可用', 'host-cap': '✅ 已接宿主能力', todo: '🟡 待接', 'web-only': '❌ Web-only', plumbing: '— 管道' };
  for (const pkg of PKGS) {
    const exposed = fs.existsSync(path.join(ROOT, pkg, 'moon.pkg'));
    console.log(`\n### ${pkg}${exposed ? '' : '   ⚠️ 消费者 import 不到（根上无转发包，见 PLAN §7 决策点 17）'}`);
    for (const [api, e] of Object.entries(PUBLIC_API[pkg])) {
      const rep = e.replacement ? `  → 接 ${e.replacement}` : '';
      console.log(`  ${mark[e.rn].padEnd(18)} ${api.padEnd(22)}${rep}`);
    }
  }
}

if (process.argv.includes('--list')) list();
else check();
