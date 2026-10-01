// verify.mjs —— antd 全组件 demo 的**判据**（PLAN §3.8 的 I2/I3 的验收）。
//
//   cd host && node verify.mjs            # 人跑
//   cd host && node verify.mjs --quiet    # 只出汇总
//
// ## 为什么它**不在** `tools/verify_all.sh` 里（这是刻意的，不是忘了）
//
// 两者测的**不是同一个东西**：
//   · `verify_all.sh` 里那条"antd 试金石（26 项）"测的是**库本体**（标签直通 / 契约 /
//     宿主包 / 载荷通道）—— 那些是 vendor 补丁与 `MOBILE_HOST` 契约的行为，改库就可能红，
//     而且离线几秒就能跑完，属于"库的门"。
//   · 这一份测的是**应用侧生成物**（`libgen` 产出的 manifest / DSL / 宿主注册）——
//     它跟着 antd 的版本走，只有装了 antd 的机器能跑。按设计稿 T6，
//     生成物的 `--check` 属于**应用的 CI**，不是库的门。
// 混在一起会让"门红了"分不清是库退化了还是 antd 升级了 —— 那种门最后会被人无视。
//
// ## 判据（三类，都必须能抓住设计错误）
//
// ① **覆盖**：`generated/antd.manifest.json` 里的**每一个**组件都真的被渲染出来了。
//    做法不是"数一数页面上有几个组件"，而是：gallery 每个格子带 `data-demo`，
//    而格子名单直接来自 manifest —— 少一个组件就是断言失败。
//    还有一条对照：**manifest 里没有的名字不得出现在格子里**（防止手写格子偷偷加组件）。
// ② **交互**：受控组件打字 → Model 收到**该文本**；点击 → Model 变化 → DOM 跟着变。
//    判据是"值对上了"，不是"事件触发了"（I1 那条判据的延续）。
// ③ **两侧同源**：宿主注册表的键集合 == manifest 的组件集合（含复合子组件）。
//
// ⚠️ 前置：仓库根 `moon build --target js`（本脚本直接吃 `_build/` 的产物，**不拷副本** ——
//    "拷了一份旧的"是本仓库踩过的坑）。

process.env.NODE_ENV = 'development';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..'); // examples/apps/antd-demo
const ROOT = path.resolve(HERE, '../../../..'); // 仓库根
const QUIET = process.argv.includes('--quiet');

const MANIFEST = path.join(APP, 'generated', 'antd.manifest.json');
if (!fs.existsSync(MANIFEST)) {
  console.error(
    '找不到 generated/antd.manifest.json —— 先跑一次生成器：\n' +
      '  cd host && node ../../../../npm/moobile-host/bin/cli.js libgen',
  );
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const MANIFEST_TOP = Object.keys(manifest.components).sort();
const MANIFEST_ALL = [];
for (const n of MANIFEST_TOP) {
  MANIFEST_ALL.push(n);
  for (const s of Object.keys(manifest.components[n].subcomponents || {})) MANIFEST_ALL.push(`${n}.${s}`);
}

const ARTIFACTS = [
  '_build/js/debug/build/XiLaiTL/moobile-antd-demo/moobile-antd-demo.js',
  '_build/js/release/build/XiLaiTL/moobile-antd-demo/moobile-antd-demo.js',
].map((p) => path.join(ROOT, p));
const ARTIFACT = ARTIFACTS.find((p) => fs.existsSync(p));
if (!ARTIFACT) {
  console.error('找不到 MoonBit 产物。先在仓库根跑：moon build --target js');
  console.error('找过：\n  ' + ARTIFACTS.map((p) => path.relative(ROOT, p)).join('\n  '));
  process.exit(2);
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  if (!QUIET) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  <- ' + detail : ''}`);
}

// ── jsdom 必须在 import antd / react-dom **之前**装好 ────────────────────────
// （antd 与 rc-* 在模块初始化时就读 `window` / `document`；装晚了它们会走"服务端分支"，
//   测的就不是同一套代码。这条与试金石同源，见那边的注释。）
const { JSDOM, VirtualConsole } = await import('jsdom');
// 关掉 jsdom 的"未实现"噪音：`Watermark` 要 canvas，而 jsdom 没有 ——
// 它会往 console 打一大段 "Not implemented: HTMLCanvasElement.prototype.getContext" 堆栈，
// 把 24 条判据的输出淹掉。**不是把错误藏起来**：那件事已经在判据里明说了
// （`SSR_ELSEWHERE.Watermark` 的 why），而且它的替代断言照样会红。
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err) => {
  if (/Not implemented/.test(String(err && err.message))) return;
  console.error('jsdom:', err && err.message);
});
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node 24 起 `globalThis.navigator` 是只读 getter，只能 defineProperty 覆盖
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
// ⚠️ 这份清单比试金石那份长 —— 因为这里的组件多得多，踩到的全局也更多。
//    实测漏一个 `SVGElement` 的代价：jsdom 挂载阶段 antd 的 Trigger（Tooltip/Popover 用）
//    在 `findDOMNode` 里 `instanceof SVGElement` → ReferenceError，
//    而那个错误是在**卸载引用**时抛的，堆栈里连"哪个组件"都没有。
//    所以这里按"jsdom 有什么就给什么"来铺，而不是按需要逐个补。
for (const k of [
  'HTMLElement', 'SVGElement', 'Element', 'Node', 'DocumentFragment', 'Text', 'Comment',
  'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'InputEvent',
  'UIEvent', 'WheelEvent', 'DragEvent', 'TouchEvent', 'AnimationEvent', 'TransitionEvent',
]) {
  if (dom.window[k]) globalThis[k] = dom.window[k];
}
// 然后是**兜底**：把 jsdom 有、而 globalThis 还没有的浏览器全局统统搬过来。
//
// 为什么不再一个个列：这份 demo 挂了 71 个组件，走过的 antd 代码路径比试金石多得多 ——
// 逐个补的循环是这样的：`SVGElement` → `MutationObserver` → `ShadowRoot` → …，
// 每次都只能等下一次运行才知道还缺谁（而且报错都发生在**卸载引用 / 副作用**里，
// 堆栈里连哪个组件都没有）。一次铺平，比追着补快得多。
for (const k of Object.getOwnPropertyNames(dom.window)) {
  if (k in globalThis) continue;
  try {
    globalThis[k] = dom.window[k];
  } catch {
    /* 只读/不可枚举的跳过即可 */
  }
}
// jsdom 的 getComputedStyle 收到第二个参数就抛 "Not implemented"（rc 的 getScrollBarSize 会那么调）
const jsdomGCS = dom.window.getComputedStyle.bind(dom.window);
dom.window.getComputedStyle = (el) => jsdomGCS(el);
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
// jsdom 没实现 matchMedia / ResizeObserver，antd 的响应式与尺寸探测要用 ——
// 这两个是**测试替身**，不是我们代码的一部分（报告里说明）。
dom.window.matchMedia ||= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
});
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
dom.window.ResizeObserver ||= ResizeObserverStub;
globalThis.ResizeObserver = dom.window.ResizeObserver;
// jsdom 有 MutationObserver，但它挂在 window 上、不一定在 globalThis —— Table/Watermark 会用
if (!globalThis.MutationObserver && dom.window.MutationObserver) {
  globalThis.MutationObserver = dom.window.MutationObserver;
}
// 真浏览器才有；这里给个最小替身（**是测试替身，不是我们代码的一部分**）
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ReactMod = await import('react');
const React = ReactMod.default;
const act = ReactMod.act ?? React.default.act;
const { renderToStaticMarkup } = await import('react-dom/server');
const { createRoot } = await import('react-dom/client');
const core = await import('moobile-host/core.js');
const demo = await import(pathToFileURL(ARTIFACT).href);
const { registerAntd } = await import(pathToFileURL(path.join(HERE, 'libraries.generated.js')).href);

// ── 宿主：纯 DOM（没有 RN）── 与试金石同一套事件表 ──────────────────────────
const DOM_COMPONENTS = {
  View: 'div',
  Text: 'span',
  Pressable: 'button',
  TextInput: 'input',
  ScrollView: 'div',
};
const DOM_EVENTS = {
  '*': {
    click: 'onClick',
    input: 'onChange',
    change: 'onChange',
    focus: 'onFocus',
    blur: 'onBlur',
    submit: 'onSubmit',
  },
};

/** 装宿主 + 注册组件库，返回实际注册的键。**每次挂载都重装**（用例之间不互相污染）。 */
function install() {
  core.installHostCore({
    components: { ...DOM_COMPONENTS },
    events: DOM_EVENTS,
    platform: 'web',
    scheduleTask: (f) => queueMicrotask(f),
    scheduleFrame: (f) => setTimeout(f, 0),
  });
  return registerAntd(core.registerLibrary);
}

function handlesOf() {
  const handles = demo.app();
  core.checkContract(handles);
  handles.start();
  return handles;
}

// ── 阶段 0：SSR + 覆盖 ───────────────────────────────────────────────────────
if (!QUIET) console.log(`\n产物：${path.relative(ROOT, ARTIFACT)}`);
const registered = install();
const handles = handlesOf();
const ssr = renderToStaticMarkup(handles.element());

/** SSR 里抽出所有 `data-demo="X"` 的格子名。 */
function cellsIn(html) {
  const out = [];
  for (const m of html.matchAll(/data-demo="([^"]+)"/g)) out.push(m[1]);
  return out;
}
const ssrCells = cellsIn(ssr);

check(
  '宿主注册了 manifest 里的全部组件键（含复合子组件）',
  registered.length === MANIFEST_ALL.length &&
    MANIFEST_ALL.every((n) => registered.includes(`antd:${n}`)),
  `注册 ${registered.length} 个 / manifest ${MANIFEST_ALL.length} 个`,
);

// 覆盖判据：**manifest 的顶层组件**每一个都要有格子（子组件不单独成格，它们长在父格子里）
const missingCells = MANIFEST_TOP.filter((n) => !ssrCells.includes(n));
check(
  `覆盖：manifest 的 ${MANIFEST_TOP.length} 个组件都有 gallery 格子`,
  missingCells.length === 0,
  missingCells.length ? `缺：${missingCells.join(', ')}` : `${ssrCells.length} 个格子`,
);
// 对照（反向）：格子里不许出现 manifest 不知道的名字 —— 防止手写格子偷偷加组件
const unknownCells = [...new Set(ssrCells)].filter((n) => !MANIFEST_TOP.includes(n));
check(
  '对照：格子里没有 manifest 不知道的组件名',
  unknownCells.length === 0,
  unknownCells.length ? `多出：${unknownCells.join(', ')}` : '一致',
);

// 每个格子里面都得有 **antd 自己渲染出来的 DOM**（不是空盒子）
//
// 例外表：**只有这些**允许"格子存在但没有 ant- 类名"，且每一条都写清为什么。
// 放宽断言是禁止的 —— 这一条的存在意义就是"组件真的渲染了"，所以例外必须逐条给理由。
const NO_CLASS_OK = {
  ConfigProvider: '它只提供 context，自己不出 DOM（内容由 children 渲染）',
};
// **改判**（不是放宽）：这几个在 SSR 里本来就没有 DOM，但它们在 jsdom 阶段**必须**出现 ——
// 于是把断言搬到那边，并逐条写清为什么。放宽断言是禁止的（会把 bug 藏起来）；
// 改判成一条更贴切的断言则可以。
const SSR_ELSEWHERE = {
  Tour: {
    why: 'portal：`open` 时渲染到 document.body，SSR 不支持 portal',
    desc: 'document.body 里出现 .ant-tour',
    probe: (body) => !!body.querySelector('.ant-tour'),
  },
  Watermark: {
    why: '它的可见产出是 canvas 图层，而 jsdom **没有实现 canvas**（getContext 抛 Not implemented）',
    desc: '把 children 渲染出来了（说明组件确实跑了；canvas 那一层在 jsdom 里做不出来）',
    probe: (_body, container) => container.textContent.includes('水印区域'),
  },
};
const emptyCells = [];
for (const name of new Set(ssrCells)) {
  const re = new RegExp(`data-demo="${name}"[\\s\\S]*?(?=data-demo="|$)`, 'g');
  const chunk = (ssr.match(re) || []).join('');
  const hasAnt = /class="[^"]*ant-/.test(chunk);
  if (!hasAnt && !NO_CLASS_OK[name] && !SSR_ELSEWHERE[name]) emptyCells.push(name);
}
check(
  '每个格子里都有 antd 渲染出的 DOM（类名 ant-*）',
  emptyCells.length === 0,
  emptyCells.length
    ? `空盒子：${emptyCells.join(', ')}`
    : `${new Set(ssrCells).size} 个格子；无 DOM 的例外 ${Object.keys(NO_CLASS_OK).length} 个，` +
        `改判到 jsdom 的 ${Object.keys(SSR_ELSEWHERE).length} 个（${Object.keys(SSR_ELSEWHERE).join(',')}）`,
);

// 结构化 prop（JSON 通道）：表格里的数字必须来自 MoonBit
check(
  'JSON 通道生效：表格里能看到来自 MoonBit 的 10/20/30',
  ssr.includes('>10<') && ssr.includes('>20<') && ssr.includes('>30<'),
);
// 初始状态面板（判据的锚点）
check(
  '状态面板渲染出来了（data-demo-state）',
  ssr.includes('data-demo-state="1"'),
);

// ── 阶段 1：jsdom 挂载 + 交互 ────────────────────────────────────────────────
install();
const handles2 = handlesOf();
const Root = core.mountRoot(handles2);
const container = document.createElement('div');
container.id = 'demo-root';
document.body.appendChild(container);
const root = createRoot(container);
await act(async () => {
  root.render(React.createElement(Root));
});

/** 按文本找元素（归一化空白：antd 给两个汉字的按钮插空格）。 */
const norm = (s) => (s || '').replace(/\s+/g, '');
const byText = (scope, sel, text) =>
  [...scope.querySelectorAll(sel)].find((el) => norm(el.textContent).includes(norm(text)));

async function click(el, label = '') {
  assert.ok(el, `要点的元素不存在${label ? `（${label}）` : ''}`);
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    await new Promise((r) => setTimeout(r, 30));
  });
}

/** 驱动受控输入：React 用自己的 value tracker，直接改 el.value 它看不见。 */
const setNativeValue = (el, value) => {
  const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  desc.set.call(el, value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
};

const stateText = (key) =>
  document.querySelector(`[data-state="${key}"]`)?.textContent ?? '';

check('jsdom 挂载成功（真 React 调和，不是 SSR 字符串）', container.querySelectorAll('.ant-btn').length > 0,
  `${container.querySelectorAll('.ant-btn').length} 个 ant-btn`);

// ① 受控文本：打字 → Model 收到该文本 → 回填
const inputEl = container.querySelector('input.ant-input');
check('antd Input 渲染出来了', !!inputEl);
if (inputEl) {
  await act(async () => {
    setNativeValue(inputEl, '你好，antd');
    await new Promise((r) => setTimeout(r, 30));
  });
  check('① 打字后 Model.draft 是该文本', stateText('draft') === '你好，antd', `draft=${stateText('draft')}`);
  check('① DOM 的 input.value 仍等于 Model 的值（受控回填）', inputEl.value === '你好，antd', `value=${inputEl.value}`);
}
check('① 回执里出现 Input.onChange', stateText('log').includes('Input.onChange'), stateText('log').slice(0, 60));

// ② 点击 antd 按钮 → Model.rows+1 → 表格跟着变（JSON prop 是活的）
const rows = () => container.querySelectorAll('.ant-table-tbody tr:not(.ant-table-placeholder)').length;
const before = rows();
await click(byText(container, '.ant-btn', '加一条'), '加一条');
check(
  `② 点「加一条」→ 表格 ${before} → ${before + 1} 行（结构化 prop 跟着 Model 走）`,
  rows() === before + 1,
  `${rows()} 行`,
);

// ③ Switch（布尔载荷：`e.bool()`）
const switchEl = container.querySelector('.ant-switch');
if (switchEl) {
  await click(switchEl, 'Switch');
  check('③ 点 Switch → Model.on 变 true', stateText('on') === 'true', `on=${stateText('on')}`);
} else {
  check('③ antd Switch 渲染出来了', false);
}

// ④ Checkbox（事件对象载荷：`e.field("target").field("checked")`）
const cbEl = container.querySelector('.ant-checkbox-input');
if (cbEl) {
  await click(cbEl, 'Checkbox');
  check('④ 点 Checkbox → Model.agree 变 true（从事件对象里挖出 target.checked）', stateText('agree') === 'true', `agree=${stateText('agree')}`);
} else {
  check('④ antd Checkbox 渲染出来了', false);
}

// ⑤ Radio.Group（值回调载荷）
const radios = [...container.querySelectorAll('.ant-radio-input')];
if (radios.length) {
  await click(radios[0], 'Radio.Group 选项一');
  check('⑤ 选 Radio → Model.picked 变 "sh"', stateText('picked') === 'sh', `picked=${stateText('picked')}`);
} else {
  check('⑤ antd Radio.Group 渲染出来了', false);
}

// ⑥ Tabs（onChange 带 activeKey）
const tabEls = [...container.querySelectorAll('.ant-tabs-tab')];
if (tabEls.length >= 2) {
  await click(tabEls[1], 'Tabs 第二页');
  check('⑥ 切 Tabs → Model.tab 变 "two"', stateText('tab') === 'two', `tab=${stateText('tab')}`);
} else {
  check('⑥ antd Tabs 渲染出来了', false);
}

// ⑦ Pagination（数值载荷，含 Int 转换）
const page2 = container.querySelector('.ant-pagination-item-2');
if (page2) {
  await click(page2, 'Pagination 第 2 页');
  check('⑦ 翻页 → Model.page 变 2', stateText('page') === '2', `page=${stateText('page')}`);
} else {
  check('⑦ antd Pagination 渲染出来了', false);
}

// ⑧ 表单提交（复合子组件 `Form.Item` + onFinish）
const submitBtn = byText(container, '.ant-btn', '提交表单');
if (submitBtn) {
  await click(submitBtn, '提交表单');
  check('⑧ Form 提交 → onFinish 回调回来了', stateText('log').includes('Form.onFinish'), stateText('log').slice(-40));
} else {
  check('⑧ antd Form + Form.Item 渲染出来了', false);
}

// ⑨ 弹层：portal 类组件在 jsdom 里**真的**进 document.body
await click(byText(container, '.ant-btn', '打开 Modal'), '打开 Modal');
check(
  '⑨ Modal 打开后进 document.body（portal 生效）',
  document.querySelectorAll('.ant-modal').length > 0,
  `${document.querySelectorAll('.ant-modal').length} 个 .ant-modal`,
);
await click(byText(document, '.ant-modal .ant-btn', 'OK') || document.querySelector('.ant-modal .ant-btn-primary'), 'Modal 确定');
check('⑨ 点 Modal 的确定 → Model.modal_open 回到 false', stateText('modal_open') === 'false' || !document.querySelector('.ant-modal-wrap[style*="display: block"]'), '');

await click(byText(container, '.ant-btn', '打开 Drawer'), '打开 Drawer');
check(
  '⑨ Drawer 打开后进 document.body（portal 生效）',
  document.querySelectorAll('.ant-drawer').length > 0,
  `${document.querySelectorAll('.ant-drawer').length} 个 .ant-drawer`,
);

// ⑨b 改判过来的两条：SSR 里没有 DOM，但挂载后必须出现
for (const [name, spec] of Object.entries(SSR_ELSEWHERE)) {
  const ok = spec.probe(document, container);
  check(`⑨b ${name} 挂载后：${spec.desc}`, ok, ok ? '' : spec.why);
}

// ⑩ Rate（数值载荷）
const stars = [...container.querySelectorAll('.ant-rate-star')];
if (stars.length >= 4) {
  // antd 的 Rate 把点击/悬停落在 `li.ant-rate-star` 内部的 div 上（半星/整星两块区域），
  // 直接点 `li` 不会触发 onChange（实测踩到）。
  await click(stars[3].querySelector('div') || stars[3], 'Rate 第 4 颗星');
  check('⑩ 点第 4 颗星 → Model.rate 变 4（数值载荷）', stateText('num').startsWith('4'), `num=${stateText('num')}`);
} else {
  check('⑩ antd Rate 渲染出来了', false);
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} 通过` +
    (failed.length ? `，失败：\n  - ${failed.map((f) => f.name).join('\n  - ')}` : ''),
);
process.exit(failed.length ? 1 : 0);
