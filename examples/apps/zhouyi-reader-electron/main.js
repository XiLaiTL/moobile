// main.js —— Electron 宿主：**一个真窗口**，里面装的就是静态 Web 那份产物。
//
// ## 它在三端里的位置
//
// | 端 | 宿主 | 本机能不能跑到"真窗口/真机" |
// |---|---|---|
// | web | Expo / 静态站点 | ✅ 真 Chrome |
// | Android | 裸 RN + Skia | ✅ 模拟器（APK） |
// | **桌面** | `--host rnw`（裸 RN + react-native-windows） | ❌ **要 VS 2026 + SDK 22621** |
// | **桌面（本文件）** | **Electron**（Chromium + Node） | ✅ **本机就能起窗口** |
//
// 两条桌面路线**不是二选一**，它们答的是不同的问题：
//   · `rnw` 那条答的是"**同一份产物能不能进 React Native 的原生宿主**"（判据在
//     `examples/apps/zhouyi-reader-desktop/verify.mjs`，5 项：打包产物里有本应用的真串）；
//   · 这条答的是"**桌面端能不能真的跑起来给人用**"—— 起窗口、渲染、点得动、滚得动。
//
// ## 为什么复用静态 Web 的产物（而不是再写一套）
//
// 桌面外壳要的就是"一个能装静态站点的壳"。所以这里**不重写任何东西**：
// `build.mjs` 与 `../zhouyi-reader-webview/build.mjs` 是同一条流水线
// （esbuild + 一行 `alias`: `react-native` → `react-native-web`），
// 打出来的 `dist/` 既能扔进静态服务器，也能直接 `loadFile` 进这个窗口。
//
// ## 窗口与调试端口
//
// `--remote-debugging-port` 由 `verify.mjs` 通过环境变量传进来 —— 于是**同一套界面判据
// 可以附着到这个窗口上**（`PROBE_CDP_URL`），不必为桌面再写一遍断言。
const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DIST_INDEX = path.join(__dirname, 'dist', 'index.html');
// 调试端口：`0` / 空 = 不开（正常给人用时不必开）
const DEBUG_PORT = process.env.ELECTRON_DEBUG_PORT || '';

if (DEBUG_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', String(DEBUG_PORT));
  app.commandLine.appendSwitch('remote-allow-origins', '*');
}

// ⚠️★ **不能省的三行：Chromium 会给"看不见的窗口"降频**。
//
// 判据跑的时候窗口是 `show:false`（`ELECTRON_HEADLESS=1`，免得跑测试还弹窗），而
// Chromium 对**隐藏/被遮挡**的窗口会**节流渲染与定时器** —— 表现极具误导性：
// 界面判据里"点一下应当出现"的那几条**全部红**，而同一次点击的效果**在下一次断言时才出现**
// （看起来像"点击延迟一拍"）。实测第一次跑就是这个症状：`verify.mjs` 76/99。
// 三个开关各自关掉一档节流（渲染器降频 / 后台定时器 / 遮挡判定），
// `webPreferences.backgroundThrottling:false` 是第四档。**它们是"能不能无人值守跑判据"的前提。**
//
// （同样的道理在 Chrome 那条路上不成立：`--headless=new` 的页面不是"隐藏窗口"，
//   所以那边一直没暴露这个问题 —— 换宿主的坑又一例。）
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

/** 起窗口。`show:false` 时先不显示，等 `ready-to-show` —— 免得白屏闪一下。 */
function createWindow({ show = true, width = 1200, height = 900 } = {}) {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    backgroundColor: '#efe5d0', // 与应用的纸色一致：窗口出现前不留白闪
    title: '御纂周易折中',
    webPreferences: {
      // ⚠️ 应用是纯前端（数据编译期嵌进产物、零网络），所以**一个 Node 能力都不给**：
      //    `nodeIntegration:false` + `contextIsolation:true` 是 Electron 的默认安全姿态，
      //    这里显式写出来，免得下一个人以为"反正是本地文件，放开也没事"。
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // 见上面那三行 switch：**隐藏窗口不许降频**，否则判据里的点击会"慢一拍"
      backgroundThrottling: false,
    },
  });
  win.once('ready-to-show', () => {
    if (show) win.show();
    console.log(`[electron] 窗口就绪：${width}×${height} · ${DIST_INDEX}`);
  });
  // 外链走系统浏览器（应用里现在没有外链，但把规矩先立在这儿）
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(DIST_INDEX);
  return win;
}

app.whenReady().then(() => {
  if (!fs.existsSync(DIST_INDEX)) {
    console.error(
      `[electron] 找不到 ${DIST_INDEX}\n  先跑一次 \`node build.mjs\`（它需要 ../zhouyi-reader/moobile.js）`,
    );
    app.exit(2);
    return;
  }
  createWindow({
    // `ELECTRON_HEADLESS=1` 时不弹窗（CI / 无人值守跑判据用）—— 窗口照样渲染，
    // 判据读的是 CDP 里的页面，不是"看得见"。
    show: process.env.ELECTRON_HEADLESS !== '1',
    width: Number(process.env.ELECTRON_WIN_W || 1200),
    height: Number(process.env.ELECTRON_WIN_H || 900),
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
