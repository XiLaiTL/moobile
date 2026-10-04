// cdp_port.js —— 给"起一个 Chromium 开 CDP"这件事挑一个**真的绑得上**的端口。
//
// ## 为什么不能写死一个端口号（2026-10-23 实测，Windows）
//
// 三个验界面的脚本原来各自钉死/半钉死一个端口：
//   · `tools/verify_web.js`                     → 9231
//   · `examples/apps/zhouyi-reader/verify.mjs`  → 9244
//   · `examples/apps/zhouyi-reader-webview/verify.mjs` → 从 9246 起往上找"没人应答"的
//
// 它们在别的机器上都好使，而在**这台**机器上一个都起不来：
//
//     $ netsh int ipv4 show excludedportrange protocol=tcp
//         8664 - 9697（连着的十几段）… 50000 - 50059
//
// Windows 会把整段端口**保留**给 Hyper-V / WSL / Docker 那类东西（范围每次重启都可能变），
// 落在保留段里的端口**任何进程都绑不上**。Chrome 的报错只写在它自己的 stderr 里，而脚本
// 把它丢进了 `stdio: "ignore"`，所以我们只看得到后果：
//
//     ERROR:net\socket\tcp_socket_win.cc(530)] bind() returned an error:
//       以一种访问权限不允许的方式做了一个访问套接字的尝试。 (0x271D)
//     ERROR:content\browser\devtools\devtools_http_handler.cc(311)]
//       Cannot start http server for devtools.
//
// 后果**完全不像端口问题**：脚本连不上 CDP、页面上什么都没有 ⇒ 看起来像"界面坏了"
// （本轮就是这个形状：Web 宿主那条门的 12 项全过，而"应用自己那 103 条判据"一条都没跑，
// 报的是"连不上 CDP —— 没有汇总行"）。
//
// ## 判据：**绑一下**试试，而不是"问它有没有人应答"
//
// "没人应答" ≠ "绑得上"—— 上面那段就是反例。Chrome 需要的动作就是 `bind`，
// 所以这里直接做那个动作：绑得上 ⇒ 交给 Chrome；绑不上（被保留 / 被别的 Chrome 占着）⇒ 换下一个。
//
// ⚠️ 保留段是**重启会变**的，所以别把范围也钉死在一段很窄的区间里：
//    这台机器上 9244~9697 整段都不可用，`from` 给 9244 就是"扫了一千多个端口才出去"。
//    下面从 from 起扫到 12000 —— 实测在这台机器上会落到 9698。

const net = require('net');

/** 能不能**绑**上这个端口（这才是 Chrome 真正需要的那一步，不是"有没有人应答"）。 */
function canBind(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    try {
      srv.listen(port, '127.0.0.1');
    } catch {
      resolve(false);
    }
  });
}

/**
 * 找一个绑得上的端口。
 *
 * 起点按 pid 偏一点：三个脚本可能同时在跑（`verify_all.sh --with-e2e` 里就有两条要起 Chrome），
 * 都从同一个号往上扫的话会**同时**看中同一个空端口（探完就关，两边都以为拿到了）。
 */
async function freeCdpPort(from = 9244, to = 12000) {
  const start = from + (process.pid % 200);
  for (let p = start; p <= to; p++) {
    if (await canBind(p)) return p;
  }
  for (let p = from; p < start; p++) {
    if (await canBind(p)) return p;
  }
  throw new Error(`cdp_port: ${from}-${to} 里一个端口都绑不上（端口保留段是不是整段被占了？）`);
}

module.exports = { freeCdpPort, canBind };
