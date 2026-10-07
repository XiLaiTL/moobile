#!/usr/bin/env node
// drive.mjs —— **驱动** node-spike 并给出「节点寻址」的真读数（真 Chrome + CDP **真鼠标**）。
//
//   node examples/apps/node-spike/drive.mjs           # 全部动作，打印读数表
//   node examples/apps/node-spike/drive.mjs --keep    # 留 Chrome（排查用）
//
// ## 为什么动作在外面（不在应用里）
//
// 应用只画界面 + 挂按钮（见 `app.mbt` 文件头）。所有动作由这里用 CDP 发**真鼠标**事件 ⇒
// "点了之后真的滚了没有"这个读数才干净；顺带证明那几个按钮**真的可点**
// （如果点了 `COUNT` 不涨，说明点击没到 —— 这时后面的读数一律不算，脚本会当场说）。
//
// ## 八组读数（对应 app.mbt 文件头那张表）
//
//   ① `Attrs::id` 落没落到 DOM（地基）；①′ `on_node_scroll` 装载后补的初值对不对
//   ② 对照：`@nav.scroll_to`（fork 里已有的那个）到底动不动
//   ③ `@sub.scroll_to_node` 有没有把那一节**顶到容器上沿**（语义，不是"scrollTop>0"）；③′ 订阅跟不跟得上滚动
//   ④ `node_rect` / `node_scroll_top` 与**浏览器自己量的**对不对得上；④′ 滚回顶再量（证明读数不是常数）
//   ⑥ `Style::transform` 的浏览器矩阵（顺序敏感）⑦ `@sub.open_url` 真开了窗口没有
//   ⑧ `img` → RN `Image`（图片真的解码了 + `alt` 两处都在）
//
// ⚠️ **证伪**（把 `.id(...)` 去掉 / 把 `Image` 从宿主组件表里拿掉 / 关掉 `src → source` 改写
//    ⇒ 必须红）不在这里跑：它们要改源码重编，属于"人工证伪"，三组读数与真因都记在
//    `README.md` 与 `docs/FINDINGS.md`。

import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './serve-web.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEEP = process.argv.includes('--keep');
const CHROME =
  process.env.CHROME ||
  // ⚠️ Chrome 的路径**不许写字面量**（`check_public_leaks` 门会点名本机绝对路径），
  //    照 `tools/dom-dump.mjs` 的做法从环境变量拼。
  path.join(
    process.env.ProgramFiles || path.join(process.env.SystemRoot || '', '..', 'Program Files'),
    'Google/Chrome/Application/chrome.exe',
  );
const PROFILE = path.join(process.env.TEMP || '/tmp', 'chrome_node_spike_' + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ⚠️ 端口不能写死（Windows 会把整段端口保留给 Hyper-V/WSL，落在里面的谁都绑不上）。
// ⚠️ Windows 上动态 import **必须给 file:// URL**（给 `D:\...` 会报 ERR_UNSUPPORTED_ESM_URL_SCHEME）
const { freeCdpPort } = await import(new URL('../../../tools/cdp_port.js', import.meta.url).href);

const rows = [];
let bad = 0;
const say = (ok, msg) => {
  if (!ok) bad += 1;
  console.log((ok ? '  ✓ ' : '  ✗ ') + msg);
  return ok;
};

async function main() {
  const server = createStaticServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}/`;

  const cdp = await freeCdpPort();
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--remote-debugging-port=' + cdp,
      '--user-data-dir=' + PROFILE,
      '--window-size=900,760',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const kill = () => {
    try {
      execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: 'ignore' });
    } catch (e) {}
  };
  process.on('exit', kill);
  if (KEEP) console.log('（--keep：Chrome 留着，PID ' + chrome.pid + '，port ' + cdp + '）');

  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    await sleep(250);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${cdp}/json`)).json();
      page = targets.find((t) => t.type === 'page');
    } catch (e) {}
  }
  if (!page) throw new Error('连不上 CDP（端口被保留？见 tools/cdp_port.js 的文件头）');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const problems = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      problems.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      problems.push('log: ' + msg.params.entry.text);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      throw new Error('页面里抛了：' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    }
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  // ── 读界面上的读数行（口径与 app.mbt 的 view 绑死）────────────────────────────
  const text = async () => (await evalJs('document.body ? document.body.innerText : ""')) || '';
  const read = async () => {
    const t = await text();
    const num = (k) => {
      const m = t.match(new RegExp('COUNT ' + k + '=([0-9]+)'));
      return m ? Number(m[1]) : -1;
    };
    const rectLine = (t.match(/^RECT (\S+) x=(\S+) y=(\S+) w=(\S+) h=(\S+)$/m) || []).slice(1);
    return {
      scroll: num('scroll'),
      nav: num('nav'),
      measure: num('measure'),
      top: num('top'),
      rectNode: rectLine[0] || '-',
      rect: rectLine.length ? rectLine.slice(1).map(Number) : null,
      scrollTopLine: Number((t.match(/SCROLLTOP (\S+)/) || [])[1]),
      sub: num('sub'),
      subLast: (t.match(/SUB_LAST (\S+)/) || [])[1] || '-',
      subBoot: (t.match(/SUB_BOOT (\S+)/) || [])[1] || '-',
      note: (t.match(/NOTE (.+)/) || [])[1] || '-',
    };
  };
  const waitReady = async () => {
    for (let i = 0; i < 100; i++) {
      if ((await read()).scroll >= 0) return true;
      await sleep(100);
    }
    return false;
  };

  // ── 页面里量一个元素（**浏览器自己的**读数，用来与库的读数对账）──────────────
  const domRect = async (node) =>
    evalJs(`(() => {
      const el = document.getElementById(${JSON.stringify(node)});
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.left, y: b.top, w: b.width, h: b.height, tag: el.tagName, id: el.id };
    })()`);
  const domScrollTop = async (node) =>
    evalJs(`(() => {
      const el = document.getElementById(${JSON.stringify(node)});
      return el ? el.scrollTop : null;
    })()`);

  // ── **真鼠标**：CDP 的 Input 域（合成事件在这套宿主上不可信，见 skillpress M5 的教训）──
  const clickById = async (node) => {
    // ⚠️ **先把它滚进可视区再量**（站点 M5 那条教训原样搬过来）：`scrollIntoView` 会把
    //    **所有可滚祖先**都滚一遍 —— 包括**页面本身**。本试金石第一版就栽在这儿：
    //    ② 那一步（`@nav.scroll_to`）之后，按钮中心跑到了 **y=-3**，于是 ③ 点了个空，
    //    读数表现为"点了没反应"，而行凶的是**仪器**。（`elementFromPoint` 自证把它揪出来了。）
    await evalJs(`(() => {
      const el = document.getElementById(${JSON.stringify(node)});
      if (el) el.scrollIntoView({ block: 'center' });
      return 'ok';
    })()`);
    await sleep(150);
    const r = await evalJs(`(() => {
      const el = document.getElementById(${JSON.stringify(node)});
      if (!el) return null;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return { zero: true };
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      // **仪器自证**：那一点上到底是谁？（点了没反应时，先分清楚"点没到"与"点了没用"）
      const hit = document.elementFromPoint(x, y);
      return { x, y, hit: hit ? (hit.tagName + (hit.id ? '#' + hit.id : '') + ' 「' + (hit.textContent || '').trim().slice(0, 12) + '」') : 'null' };
    })()`);
    if (!r) return 'missing';
    if (r.zero) return 'zero-size';
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y, button: 'none', buttons: 0 });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: r.x, y: r.y, button: 'left', buttons: 1, clickCount: 1,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: r.x, y: r.y, button: 'left', buttons: 0, clickCount: 1,
    });
    return { x: r.x, y: r.y, hit: r.hit };
  };

  await send('Page.navigate', { url: BASE });
  if (!(await waitReady())) {
    // 起不来时先把**页面里的报错**打出来（否则只知道"没渲染"，不知道"为什么"）
    const probs = problems.length ? problems.slice(0, 3).join(' | ') : '（页面没报错）';
    const txt = (await evalJs('document.body ? document.body.innerText.slice(0, 120) : ""')) || '';
    throw new Error(`应用没渲染出来（检查 dist/ 是否 build 过）
  页面报错：${probs}
  页面文字：${JSON.stringify(txt)}`);
  }
  await sleep(500);

  console.log('node-spike —— 节点寻址的四组读数（真 Chrome + CDP 真鼠标）\n');

  // ── ① `Attrs::id` 落没落到 DOM：地基 ─────────────────────────────────────────
  console.log('① 具名节点与按钮在不在 DOM 里（`Attrs::id(...)` 这条通道的地基）');
  const wanted = ['pane', 'sec-1', 'sec-2', 'sec-3', 'go-sec-3', 'go-nav-sec-3', 'measure-sec-3', 'read-top'];
  const found = {};
  for (const n of wanted) found[n] = await domRect(n);
  for (const n of wanted) {
    say(!!found[n], `#${n} ${found[n] ? `= <${found[n].tag.toLowerCase()}> ` + `w=${found[n].w.toFixed(0)} h=${found[n].h.toFixed(0)}` : '**不在 DOM 里**'}`);
  }
  const paneBefore = await domRect('pane');
  const sec3Before = await domRect('sec-3');
  say(paneBefore && paneBefore.h > 0 && sec3Before && sec3Before.h > 0, `容器高 ${paneBefore && paneBefore.h}、第三节高 ${sec3Before && sec3Before.h}（容器得比内容矮才滚得动）`);
  say((await domScrollTop('pane')) === 0, `初始 scrollTop = ${await domScrollTop('pane')}（期望 0）`);

  // ── ①′ 订阅那条通道：**装载后补的那一次**（"首帧就有值"）──────────────────────
  //
  // ⚠️ 这一条必须放在**任何滚动之前**跑：它问的是"还没人滚的时候，订阅有没有先给一个值"。
  //    本仓在 `current_viewport` / `current_url` 上各栽过一次"订阅不补首帧"的账，所以新订阅要验它。
  console.log("");
  console.log('①′ `@sub.on_node_scroll("pane")`：装载后有没有**先补一次**当前值');
  const boot = await read();
  const bootScroll = await domScrollTop('pane');
  say(boot.sub >= 1, `没人滚的时候订阅已经推过一次（COUNT sub=${boot.sub}）`);
  const bootVal = Number(boot.subBoot);
  say(boot.subBoot !== '-' && Number.isFinite(bootVal), `SUB_BOOT = ${boot.subBoot}（不是 "-"，也不是空）`);
  say(Number.isFinite(bootVal) && Math.abs(bootVal - bootScroll) <= 0.5, `补的那一次与浏览器读到的 scrollTop 一致（${boot.subBoot} vs ${bootScroll}）`);
  rows.push(['①′ on_node_scroll 装载补值', '库订阅', `sub=${boot.sub}`, `boot=${boot.subBoot} vs DOM ${bootScroll}`]);

  // ── ② 对照：`@nav.scroll_to`（fork 里已有的那个）──────────────────────────────
  // ⚠️ 这一格**不设预测**：第一跑时我预测"它是死通道"，实测**它真的滚了**（0 → 1000），
  //    判据当场把我的预判否掉了。所以这里只做两件事：
  //      ① 断言**点击到了应用**（否则这一格没有意义 —— 仪器自证）；
  //      ② 把"滚了没有"如实打成读数，交给报告，而不是拿一个我先入为主的期望去卡它。
  console.log('\n② 对照：`@nav.scroll_to("sec-3")`（fork 里已有的 API）—— 只读数，不预设结论');
  const beforeNav = await read();
  await clickById('go-nav-sec-3');
  await sleep(600);
  const afterNav = await read();
  const navTop = await domScrollTop('pane');
  say(afterNav.nav > beforeNav.nav, `点击到了应用（COUNT nav ${beforeNav.nav} → ${afterNav.nav}）—— 否则下面那格不算数`);
  const navMoved = navTop !== 0;
  console.log(`     · pane.scrollTop = ${navTop} ⇒ @nav 这条路${navMoved ? '**动了**（它经 `AfterLayout` 在库侧自己做 DOM，不经过宿主 op）' : '**没动**'}`);
  rows.push(['② @nav.scroll_to("sec-3")', '真鼠标', `scrollTop=${navTop}`, navMoved ? '@nav 能用（消费者 import 不到它）' : '没动（读数为准）']);
  // 把容器滚回顶，让 ③ 从同一个起点开始（否则 ② 的位移会混进 ③ 的读数）
  await evalJs(`document.getElementById('pane').scrollTop = 0; 'ok'`);
  await sleep(300);

  // ── ③ `@sub.scroll_to_node`：**语义**——那一节顶到容器上沿 ────────────────────
  console.log('\n③ `@sub.scroll_to_node("sec-3", block="start")`：真滚了没有');
  const beforeGo = await read();
  const hit3 = await clickById('go-sec-3');
  await sleep(600);
  const afterGo = await read();
  if (afterGo.scroll === beforeGo.scroll) {
    console.log(`     ! 点击没到应用：那一点上是 ${typeof hit3 === 'object' ? hit3.hit : hit3}（按钮中心 ${typeof hit3 === 'object' ? Math.round(hit3.x) + ',' + Math.round(hit3.y) : '-'}）`);
  }
  const paneAfter = await domRect('pane');
  const sec3After = await domRect('sec-3');
  const scrolledTop = await domScrollTop('pane');
  say(afterGo.scroll > beforeGo.scroll, `点击到了应用（COUNT scroll ${beforeGo.scroll} → ${afterGo.scroll}）`);
  say(scrolledTop > 0, `pane.scrollTop = ${scrolledTop}（期望 > 0）`);
  // ⚠️ 仪器自己也要能扛住"元素不在"（第一版在这里**崩了**：`sec3After` 为 null ⇒ TypeError，
  //    报告整个丢掉）。崩了当然也算红，但**红在哪**看不见 —— 那正是本仓最嫌的一种红。
  if (!paneAfter || !sec3After) {
    say(false, `量不到 \`pane\` / \`sec-3\`（在不在 DOM 里？见上面 ①）⇒ 后面几条读数不成立`);
    rows.push(['③ @sub.scroll_to_node("sec-3")', '真鼠标', `scrollTop=${scrolledTop}`, 'sec-3 不在 DOM 里']);
  } else {
    const delta = Math.abs(sec3After.y - paneAfter.y);
    say(delta <= 2, `**那一节顶到容器上沿**：sec-3.top=${sec3After.y.toFixed(1)} vs pane.top=${paneAfter.y.toFixed(1)} ⇒ 差 ${delta.toFixed(1)}px（≤2）`);
    rows.push(['③ @sub.scroll_to_node("sec-3")', '真鼠标', `scrollTop=${scrolledTop}`, `sec-3.top − pane.top = ${delta.toFixed(1)}px`]);
  }

  // ── ③′ 订阅跟着滚动走吗（值 + 次数都要对）────────────────────────────────────
  {
    const r = await read();
    const st = await domScrollTop('pane');
    say(r.sub > boot.sub, `滚动之后订阅又推了（COUNT sub ${boot.sub} → ${r.sub}）`);
    say(Math.abs(Number(r.subLast) - st) <= 1, `SUB_LAST(${r.subLast}) 与浏览器读到的 scrollTop(${st}) 一致`);
    rows.push(['③′ on_node_scroll 跟滚动', '库订阅', `sub=${r.sub}`, `last=${r.subLast} vs DOM ${st}`]);
  }

  // ── ④ `node_rect` 与浏览器自己量的对账 ───────────────────────────────────────
  console.log('\n④ `@sub.node_rect("sec-3")` vs 页面里自己量的 `getBoundingClientRect()`');
  await clickById('measure-sec-3');
  await sleep(500);
  const m = await read();
  const dom = await domRect('sec-3');
  say(m.rectNode === 'sec-3', `库量的是 **sec-3**（读数行里的节点名 = ${m.rectNode}）—— 防"量了但量错节点"读成"量对了"`);
  if (m.rect && dom) {
    const d = [Math.abs(m.rect[0] - dom.x), Math.abs(m.rect[1] - dom.y), Math.abs(m.rect[2] - dom.w), Math.abs(m.rect[3] - dom.h)];
    const worst = Math.max(...d);
    say(worst <= 0.5, `四个数全对上（x=${m.rect[0]} y=${m.rect[1]} w=${m.rect[2]} h=${m.rect[3]} vs 浏览器 ${dom.x.toFixed(1)}/${dom.y.toFixed(1)}/${dom.w.toFixed(1)}/${dom.h.toFixed(1)}，最大差 ${worst.toFixed(3)}px）`);
    rows.push(['④ node_rect("sec-3")', '库读数', `y=${m.rect[1]}`, `与浏览器差 ${worst.toFixed(3)}px`]);
  } else {
    say(false, `没读到库的读数行或 DOM 矩形（rect=${JSON.stringify(m.rect)}）`);
  }

  // ── ④′ 读数**是活的**：把容器滚回顶，再量一次 ⇒ y 必须变 ──────────────────────
  console.log('\n④′ 让被测对象变一次（`pane.scrollTop = 0`）⇒ 再量，读数必须跟着变（防"缓存/常数"）');
  const yAfterScroll = m.rect ? m.rect[1] : null;
  await evalJs(`document.getElementById('pane').scrollTop = 0; 'ok'`);
  await sleep(300);
  await clickById('measure-sec-3');
  await sleep(500);
  const m2 = await read();
  const yAtTop = m2.rect ? m2.rect[1] : null;
  say(yAfterScroll !== null && yAtTop !== null && Math.abs(yAfterScroll - yAtTop) > 100, `sec-3 的 y：滚到底时 ${yAfterScroll} → 滚回顶后 ${yAtTop}（差 ${Math.abs((yAfterScroll || 0) - (yAtTop || 0)).toFixed(0)}px）`);
  rows.push(['④′ 滚回顶再量（同一节点）', '库读数', `y: ${yAfterScroll} → ${yAtTop}`, '读数跟着变 = 不是常数']);

  // ── ⑤ `node_scroll_top` 与浏览器自己量的对账 ─────────────────────────────────
  console.log('\n⑤ `@sub.node_scroll_top("pane")` vs `element.scrollTop`');
  await evalJs(`document.getElementById('pane').scrollTop = 137; 'ok'`);
  await sleep(900); // 应用每 400ms 读一次
  const st = await read();
  const domTop = await domScrollTop('pane');
  say(Math.abs(st.scrollTopLine - domTop) <= 0.5, `库读到 ${st.scrollTopLine}，浏览器读到 ${domTop}（差 ${Math.abs(st.scrollTopLine - domTop).toFixed(3)}px）`);
  rows.push(['⑤ node_scroll_top("pane")', '库读数', `${st.scrollTopLine}`, `浏览器 ${domTop}`]);

  // ── ⑥ `Style::transform`：真浏览器里的**矩阵**（顺序敏感那一条在这里证）────────
  //
  // 读的是 `getComputedStyle(el).transform` —— 浏览器把 `translateX(40px) scale(2)` 这类
  // 算成矩阵。判定用**数值容差**（浮点 + 浏览器自己的舍入），而不是字符串比较。
  console.log('');
  console.log('⑥ `Style::transform` 的浏览器矩阵（顺序敏感：同一组动作、换个顺序必须不一样）');
  const mats = await evalJs('(() => {' +
    'const out = {};' +
    'for (const id of ["tf-a", "tf-b", "tf-c"]) { const el = document.getElementById(id);' +
    'out[id] = el ? getComputedStyle(el).transform : null; }' +
    'return out;' +
    '})()');
  const nums = (m) => {
    const g = (m || '').match(/-?[\d.]+(?:e-?\d+)?/g);
    return g ? g.map(Number) : null;
  };
  const close = (a, b, tol) => a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol);
  const A = nums(mats && mats['tf-a']);
  const B = nums(mats && mats['tf-b']);
  const C = nums(mats && mats['tf-c']);
  say(!!A, `#tf-a 的计算变换 = ${mats && mats['tf-a']}`);
  say(close(A, [2, 0, 0, 2, 40, 0], 0.01), '先移后缩 ⇒ matrix(2,0,0,2,**40**,0)（位移**不被**缩放）');
  say(close(B, [2, 0, 0, 2, 80, 0], 0.01), '先缩后移 ⇒ matrix(2,0,0,2,**80**,0)（位移**被**缩放）');
  say(!!A && !!B && !close(A, B, 0.01), '**两者不同** ⇒ 顺序真的被保住了（相同就说明顺序被丢了）');
  say(close(C, [0, 1, -1, 0, 0, 0], 0.01), `rotate(90deg) ⇒ matrix(0,1,-1,0,0,0)（实测 ${mats && mats['tf-c']}）`);
  rows.push(['⑥ Style::transform', '真浏览器', `a=${JSON.stringify(A)}`, `b=${JSON.stringify(B)}`]);

  // ── ⑦ `@sub.open_url`：外链动作（把 `window.open` 换成记录器）────────────────────
  //
  // ⚠️ 站点那边今天**内容里没有外链** ⇒ 这条分支在站点上**没有端到端读数**，
  //    所以它落在这儿：断言"**调用发生了、载荷是那一条 URL**"。
  //    （与剪贴板那条同一个口径：证的是**我们这一侧**，不是"浏览器真的开了个标签页"。）
  console.log('');
  console.log('⑦ `@sub.open_url`：点了之后 `window.open` 收到了什么');
  await evalJs('(() => { window.__opened = []; window.open = (u, t) => { window.__opened.push({ u, t }); return {}; }; return "ok"; })()');
  const opened = await clickById('open-ext');
  await sleep(600);
  const got = JSON.parse((await evalJs('JSON.stringify(window.__opened)')) || '[]');
  say(opened !== 'missing', '点到了 OPEN-EXT 那个按钮');
  say(got.length === 1, '**调了一次 window.open**（实测 ' + got.length + ' 次）');
  say(got.length === 1 && got[0].u === 'https://example.com/moobile-ext-link', `载荷是那一条 URL（实测 ${JSON.stringify(got[0] && got[0].u)}）`);
  say(got.length === 1 && got[0].t === '_blank', `开的是**新窗口**（target = ${JSON.stringify(got[0] && got[0].t)}）`);
  rows.push(['⑦ @sub.open_url', '真鼠标', `window.open × ${got.length}`, `${got[0] ? got[0].u : '-'}`]);

  // ── ⑧ `img`：图片真的画出来了吗（真浏览器）────────────────────────────────────
  //
  // ⚠️ 这一段**改过一次判据**，两次都值得记：
  //   · 第一版按 HTML 的直觉写（"DOM 里有个 `<img>`，读它的 src/naturalWidth/alt"）——
  //     而当时宿主用的是 `react-native-web` 的 `Image`，它在 DOM 里是
  //     `div(背景图) + 隐藏 <img>` 三层 ⇒ 判据全红，功能却是好的。**判据要照宿主的事实写，不照直觉写。**
  //   · 第二版照着那个三层结构写，绿了。可那份绿是**假的**：RNW 的 `Image` **根没有高度**，
  //     站点正文里那种"不写尺寸的图"排出来是 **720×0**（宽占满、高为零）—— 页面上什么都看不见，
  //     而"元素在 / naturalWidth 对"两条**照样绿**。真因是 RN 语义要求调用方给尺寸，
  //     而内容里的 `![alt](x.png)` 根本不写尺寸。
  //   ⇒ 修法是**宿主侧**的：web 上用**真正的 `<img>`**（`npm/moobile-host/index.js` 的 `WebImage`），
  //     有 src 就有高度、alt 也原生。原生 RN 那边仍然是 RN 的 `Image`（没有 DOM），
  //     所以**原生的 `img` 仍然要显式尺寸** —— 这条别读成"两端都自适应了"。
  //
  // 判据（五条，各自独立）：① `Attrs::id` 落到那个元素上；② `src` 走到了 `<img src>`；
  // ③ 浏览器**真的解码**了（`naturalWidth > 0`，空壳也"存在"）；④ `alt` 在（读屏与兜底文案）；
  // ⑤ 它**真的占了版面**（宽高都 > 0 —— 就是这一条把上面那个 720×0 抓出来的）。
  console.log('');
  console.log('⑧ 图片：`img`（`src → source{{uri}}` → web 宿主渲染成真 `<img>`）');
  const pic = await evalJs('(() => {' +
    'const el = document.getElementById("pic-1");' +
    'if (!el) return null;' +
    'const r = el.getBoundingClientRect();' +
    'return { tag: el.tagName, src: (el.getAttribute("src") || "").slice(0, 40),' +
    ' nat: el.complete ? el.naturalWidth : -1, alt: el.getAttribute("alt"),' +
    ' w: Math.round(r.width), h: Math.round(r.height) };' +
    '})()');
  say(!!pic, `\`#pic-1\` 在（${pic ? '落成了 <' + pic.tag.toLowerCase() + '>' : '（没有）'}）`);
  say(!!pic && pic.src.startsWith('data:image/png'), `它的 \`src\` 是那张图（${pic ? pic.src : '-'}…）`);
  say(!!pic && pic.nat > 0,
    `**浏览器真的解码了它**（naturalWidth = ${pic ? pic.nat : '?'}）—— 不是个空壳`);
  say(!!pic && pic.alt === '一张试金石图', `\`alt\` 在（${pic ? JSON.stringify(pic.alt) : '-'}）`);
  say(!!pic && pic.w > 0 && pic.h > 0, `它**真的占了版面**（${pic ? pic.w + '×' + pic.h + 'px' : '?'}）`);
  rows.push(['⑧ img', '真浏览器', `naturalWidth=${pic ? pic.nat : '?'}`, `${pic ? pic.w + '×' + pic.h : '?'}px · alt ✓`]);

  // ── 报告 ────────────────────────────────────────────────────────────────────
  console.log('\n───── 读数表 ─────');
  for (const r of rows) console.log('  ' + r.join('  |  '));
  console.log(`\n页面里的 JS 错误/异常：${problems.length} 条`);
  if (problems.length) console.log('  ' + problems.slice(0, 5).join('\n  '));
  say(problems.length === 0, '页面无 JS 报错');

  console.log(bad === 0 ? '\nnode-spike：全部读数成立' : `\nnode-spike：${bad} 条不成立`);
  server.close();
  if (!KEEP) kill();
  process.exit(bad === 0 ? 0 : 1);
}

await main();
