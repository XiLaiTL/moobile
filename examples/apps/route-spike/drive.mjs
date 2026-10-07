#!/usr/bin/env node
// drive.mjs —— **驱动** route-spike 并给出三条通道的真读数（真 Chrome + CDP）。
//
//   node examples/apps/route-spike/drive.mjs              # 全部动作，打印读数表
//   node examples/apps/route-spike/drive.mjs --keep       # 留 Chrome（排查用）
//
// ## 为什么动作在外面（不在应用里）
//
// 应用**只订不做**（见 app.mbt 文件头）。所有动作由这里用 CDP / 页面脚本发出去 ⇒
// 应用里数到的每一条都只能是**宿主或浏览器**推上来的，而不是"我自己 push 给自己"。
// 这也是这个文件存在的理由：它替"应用"动手，好让读数干净。
//
// ## 读数怎么读
//
// 应用把三个计数渲染成 `COUNT <通道>=<次数>` 三行文字（见 app.mbt 的 view）——
// 这里就抠这三行 + 事件行。**不靠肉眼看界面**。
//
// ## ⚠️ 两组动作的性质不同，报告里要分开写
//
//   · **真事件**：`pushState` / 改 hash / `history.back()` / 点 `<a href>` 都是浏览器**真的**发生的事；
//   · **合成事件**：`visibilitychange` 这一组是**自己 dispatch** 的（见 `--how` 那几行）——
//     它验的是"**监听器接上了没有 + 载荷方向对不对**"，**不是**"真切后台会不会来"。
//     真后台那一条要真机 / 真窗口切换，本脚本给不了，别把这两件事混着读。

import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './serve-web.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEEP = process.argv.includes('--keep');
const CHROME =
  process.env.CHROME ||
  // ⚠️ Chrome 的路径**不许写字面量**：`check_public_leaks` 门会点名"盘符 + Program Files"
  // （本机绝对路径，会跟着仓库一起公开出去）。照 `tools/dom-dump.mjs` 的做法从环境变量拼。
  path.join(
    process.env.ProgramFiles || path.join(process.env.SystemRoot || '', '..', 'Program Files'),
    'Google/Chrome/Application/chrome.exe',
  );
const PROFILE = path.join(process.env.TEMP || '/tmp', 'chrome_route_spike_' + Date.now());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 端口不能写死（Windows 会把整段端口保留给 Hyper-V/WSL，落在里面的谁都绑不上）。
// ⚠️ Windows 上动态 import **必须给 file:// URL**（给 `D:\...` 会报 ERR_UNSUPPORTED_ESM_URL_SCHEME）
const { freeCdpPort } = await import(
  new URL('../../../tools/cdp_port.js', import.meta.url).href,
);

const rows = [];
function row(action, kind, counts, note) {
  rows.push({ action, kind, ...counts, note });
}

async function main() {
  // ① 静态服务（借实例自己的 serve-web.mjs —— 判据读的就是它服务的那份 dist/）
  const server = createStaticServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const BASE = `http://127.0.0.1:${port}/`;

  // ② Chrome + CDP
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
    return r.result?.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  // ③ 读一次界面上的判据行
  const read = async () => {
    const t = (await evalJs('document.body ? document.body.innerText : ""')) || '';
    const num = (chan) => {
      const m = t.match(new RegExp('COUNT ' + chan + '=([0-9]+)'));
      return m ? Number(m[1]) : -1; // -1 = 行都没渲染出来（应用没起来）
    };
    const hits = t
      .split('\n')
      .filter((l) => /^(url_changed|url_request|visibility) \|/.test(l.trim()))
      .map((l) => l.trim());
    return {
      href: (await evalJs('location.href')) || '?',
      boot: (function () { const a = t.split('BOOT_URL ')[1]; if (!a) return '?'; return a.split(String.fromCharCode(10))[0].trim(); })(),
      url: num('url_changed'),
      req: num('url_request'),
      vis: num('visibility'),
      push: num('push'),
      visLast: (t.match(/VIS_LAST (\S+)/) || [])[1] || '?',
      last: hits[0] || '-',
    };
  };
  const waitReady = async () => {
    for (let i = 0; i < 100; i++) {
      const r = await read();
      if (r.url >= 0) return true;
      await sleep(100);
    }
    return false;
  };
  const snapshot = async (after) => {
    await sleep(after);
    return await read();
  };

  // ④ 首屏：**带深链**加载（`#/s/foo`）—— 问"首屏之前就存在的 URL 有没有被推上来"
  await send('Page.navigate', { url: BASE + '#/s/foo' });
  if (!(await waitReady())) throw new Error('应用没渲染出来（检查 dist/ 是否 build 过）');
  {
    const r = await snapshot(600);
    row('① 首屏（URL 自带 #/s/foo）', '真', r, `首屏放不推；同步读 current_url() = ${r.boot}`);
  }

  // ①′ **等应用自己推**（`Tick` 第一跳 = 1.5s）。⚠️ 必须**放在最前**：此刻还没有别的动作 ⇒
  //     涨的那一次只可能是"动作通道 push + 库补的回声"（第一版把它放在后面，读数被后面的
  //     hash 改动淹掉、分不清是哪一次 —— 仪器自己没设计严）。
  {
    const r = await snapshot(1800);
    row('①′ 应用自己 push（等 1.5s 定时器）', '真', r, '回声：地址栏应变 /#/s/from-cmd');
    console.log('     · 动作通道 push 的载荷   : ' + r.last);
  }

  // ⑤ pushState（同源、同文档）
  await evalJs(`history.pushState({}, '', '#/s/bar'); 'ok'`);
  {
    const r = await snapshot(400);
    row('② pushState("#/s/bar")', '真', r, 'pushState 不产生 popstate');
  }

  // ⑤′ replaceState（同文档、不留历史条目）
  await evalJs(`history.replaceState({}, '', '#/s/bar2'); 'ok'`);
  {
    const r = await snapshot(400);
    row('②′ replaceState("#/s/bar2")', '真', r, '同 pushState：不产生 popstate');
  }

  // ⑥ 改 location.hash
  await evalJs(`location.hash = '#/s/baz'; 'ok'`);
  {
    const r = await snapshot(400);
    row('③ location.hash="#/s/baz"', '真', r, '只有 hashchange 还是也有 popstate？');
  }

  // ⑥′ 装饰参数放在 hash 里（`#/s/baz?s=sec-2`）—— 问：它落在 `query` 还是 `fragment` 里？
  //     这条直接决定"hash 模式下装饰参数该写哪儿"（`url.query` 在 hash 模式下是空的）。
  await evalJs(`location.hash = '#/s/baz?s=sec-2&v=raw'; 'ok'`);
  {
    const r = await snapshot(400);
    row('⑥′ hash 里带查询串', '真', r, '看 query / frag 两格各是什么');
  }


  // ⑦ history.back() → 这是 popstate 的经典来源
  await evalJs(`history.back(); 'ok'`);
  {
    const r = await snapshot(500);
    row('④ history.back()', '真', r, 'popstate ⇒ 期望这里涨');
  }

  // ⑧ history.forward()
  await evalJs(`history.forward(); 'ok'`);
  {
    const r = await snapshot(500);
    row('⑤ history.forward()', '真', r, '');
  }

  // ⑨ 点一个同文档的 <a href="#/s/qux">
  await evalJs(`(() => {
    const a = document.createElement('a');
    a.href = '#/s/qux'; a.id = 'probe-anchor'; a.textContent = 'go';
    document.body.appendChild(a); a.click(); return 'ok';
  })()`);
  {
    const r = await snapshot(500);
    row('⑥ 点 <a href="#/s/qux">', '真', r, '同文档导航');
  }

  // ⑥″ **应用自己推**（`Tick` 定时器第一跳，不依赖点击）—— 一次读三件事：
  //     ① 地址栏变 + `url_changed` 涨（**回声**生效）；
  //     ② 载荷与 popstate 那一路**逐字段同形**（下面把两行并排打出来对照）。
  const beforeTick = await read();
  await sleep(2600);
  {
    const r = await snapshot(200);
    row('⑥″ 应用自己 push（1.5s 定时器）', '真', r, '派发前 url_changed=' + beforeTick.url);
    console.log('     · 动作通道 push 的载荷   : ' + r.last);
    const back = rows.find((x) => x.action.includes('history.back')) || {};
    console.log('     · popstate（back）的载荷 : ' + (back.last || '(没拿到)'));
  }

  // ⑨′ 点应用里那个「PUSH(@sub.push_url)」—— 问：**应用自己 push 时，通道推不推**？
  //     （这是"路由的 push 侧今天有没有通道"的直接读数；fork 里有 @nav，根上没有转发包）
  // ⚠️ 点的是 **`[tabindex="0"]` 那一层**（RNW 把可点元素渲成它）—— 点里面的文字叶子
  //    是不会触发的（第一版就这么点的，读数表现为"点击没到"，见 docs/FINDINGS.md 本轮补记）
  const pushed = await evalJs(`(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.textContent.trim() === 'PUSH(@nav.push_url)');
    if (!el) return 'missing';
    // ⚠️ RNW 的可点元素走 **Pressability**（指针序列），光 dispatch 一个 click 不一定会被认。
    //    这里把 pointerdown/mousedown/pointerup/mouseup/click 整条序列按顺序发一遍。
    const r = el.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, buttons: 1 };
    const ev = (type, Ctor) => el.dispatchEvent(new Ctor(type, type.startsWith('pointer') ? { ...opts, pointerId: 1, isPrimary: true, pointerType: 'mouse' } : opts));
    try { ev('pointerdown', PointerEvent); } catch (e) {}
    ev('mousedown', MouseEvent);
    try { ev('pointerup', PointerEvent); } catch (e) {}
    ev('mouseup', MouseEvent);
    ev('click', MouseEvent);
    return 'clicked';
  })()`);
  {
    const r = await snapshot(700);
    row('⑨′ 点 PUSH(@nav.push_url)', '真', r, pushed === 'clicked' ? '应用侧 push' : '没找到按钮：' + pushed);
    if (pushed !== 'clicked' || r.push === 0) {
      // 仪器自证：点没到就把它自己的现场打出来（DOM 里到底有什么可点的层）
      const dbg = await evalJs(`(() => {
        const tabs = [...document.querySelectorAll('[tabindex="0"]')];
        const holder = [...document.querySelectorAll('*')].find(e => e.textContent.trim() === 'PUSH(@nav.push_url)');
        return JSON.stringify({
          tabindexCount: tabs.length,
          tabTexts: tabs.map(t => (t.textContent || '').trim().slice(0, 24)),
          holderTag: holder ? holder.tagName + '.' + holder.className.slice(0, 40) : null,
          holderParentTab: holder && holder.closest('[tabindex]') ? holder.closest('[tabindex]').getAttribute('tabindex') : null,
          holderOuter: holder ? holder.outerHTML.slice(0, 160) : null,
        });
      })()`);
      console.log('     · 现场：' + dbg);
    }
  }


  // ⑩ visibilitychange（**合成**）：先验监听器接没接上、载荷方向对不对
  const before = await read();
  await evalJs(`(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    return 'ok';
  })()`);
  {
    const r = await snapshot(400);
    row('⑦ visibilitychange（合成：hidden=true）', '合成', r, `派发前 visibility=${before.vis}`);
  }
  await evalJs(`(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    return 'ok';
  })()`);
  {
    const r = await snapshot(400);
    row('⑧ visibilitychange（合成：hidden=false）', '合成', r, '载荷方向');
  }

  // ⑪ CDP 冻结页面（另一条"像真后台"的路，成不成都要读数）
  const frozen = await send('Page.setWebLifecycleState', { state: 'frozen' });
  {
    const r = await snapshot(600);
    row('⑨ Page.setWebLifecycleState(frozen)', '真(CDP)', r, frozen.error ? 'CDP 报错：' + frozen.error.message : 'CDP 接受');
  }
  await send('Page.setWebLifecycleState', { state: 'active' });

  // ⑫ 打印
  console.log('\n══ route-spike 读数（真 Chrome ' + (await evalJs('navigator.userAgent')) + '）══\n');
  console.log('动作'.padEnd(30) + '  ' + '性质'.padEnd(8) + 'url_chg url_req vis  点Push  地址栏（浏览器说的）');
  for (const r of rows) {
    console.log(
      r.action.padEnd(30) +
        '  ' +
        r.kind.padEnd(8) +
        String(r.url).padStart(6) +
        String(r.req).padStart(12) +
        String(r.vis).padStart(11) +
        String(r.push).padStart(6) +
        '  ' +
        r.href.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''),
    );
  }
  console.log('\n最终 VIS_LAST = ' + (await read()).visLast);
  console.log('首屏同步读 @sub.current_url() = ' + (await read()).boot + '   ← 与地址栏对照（它证明"进来时我在哪"拿得到）');
  if (problems.length) {
    console.log('\n⚠️ 页面里的异常/错误 ' + problems.length + ' 条：');
    for (const p of problems.slice(0, 6)) console.log('   · ' + p);
  } else {
    console.log('\n页面异常/错误：0 条');
  }

  ws.close();
  server.close();
  if (!KEEP) kill();
  else console.log('\n（--keep：Chrome 留着，pid=' + chrome.pid + '，CDP 端口 ' + cdp + '）');
}

await main();
