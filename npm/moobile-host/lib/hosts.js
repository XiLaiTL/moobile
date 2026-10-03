// hosts.js —— **宿主的注册表**：`--host <id>` 到"该换成哪些文件"的映射。
//
// ## 为什么这件事要单独一个文件
//
// SCAFFOLD §3.3 写过"支持一个新平台 = **换一个宿主**，不是改库"。
// 但"换宿主"落到生成器上具体是什么？——**换掉那几个宿主文件，应用侧一个字节都不动**：
//
//   moon.mod / moon.pkg / app.mbt   ← 两种宿主下**逐字相同**（这条有门在断言，见 tools/desktop_host_probe.mjs）
//   package.json / App.js / index.js / app.json / metro.config.js / .gitignore / README.md
//                                   ← 这些是**宿主文件**，随 `--host` 而变
//
// ## `expo` 与 `rnw` 的真实差别（都不是风格问题）
//
// | | `expo` | `rnw` |
// |---|---|---|
// | 入口 | `registerRootComponent(App)`（`expo` 包提供） | `AppRegistry.registerComponent(...)`（RN 自带） |
// | Metro 配置 | `expo/metro-config` | `@react-native/metro-config` |
// | RN 版本 | Expo SDK 钉的（当前 ~57 → 0.86.3） | **RNW 钉的**（0.83.2 → RN 0.83.x） |
// | 画布后端 | `canvas-web` / `canvas-skia` | `canvas-svg`（Windows 上 Skia 没有后端） |
// | `app.json` | `{ expo: { name, slug, android } }` | `{ name, displayName }` |
//
// **RN 版本由宿主决定、库不绑版本** —— 所以"桌面要另一套 RN"不是妥协，是设计里就有的自由度。

const path = require('path');

/** 宿主文件集住在哪儿（`npm/moobile-host/hosts/<id>/`，随包发布）。 */
const HOSTS_DIR = path.join(__dirname, '..', 'hosts');

/**
 * @typedef {{id: string, label: string, filesDir: string|null, platforms: string[], why: string}} Host
 */

/** @type {Record<string, Host>} */
const HOSTS = {
  expo: {
    id: 'expo',
    label: 'Expo（android / ios / web 一次到位）',
    // `null` = **模板本身就是这个宿主**（`examples/apps/template/`），不需要额外文件集。
    filesDir: null,
    platforms: ['android', 'ios', 'web'],
    why: '默认档：一个宿主出三端，画布走 DOM 2D（web）与 Skia（原生）',
  },
  rnw: {
    id: 'rnw',
    label: '裸 RN + react-native-windows（Windows 桌面）',
    filesDir: path.join(HOSTS_DIR, 'rnw'),
    platforms: ['windows'],
    why:
      '桌面要另一套 RN（RNW 0.83.2 钉 RN 0.83.x，而 Expo 57 钉 0.86.3）→ 不带 Expo 的裸 RN 宿主；' +
      '画布走 SVG（Windows 上 Skia 没有后端、也没有 DOM canvas）',
  },
  webview: {
    id: 'webview',
    label: '静态 Web 外壳（零 Expo、零 Metro；PWA / Tauri / Electron 的底座）',
    filesDir: path.join(HOSTS_DIR, 'webview'),
    platforms: ['web'],
    // ⚠️ 模板本身就是 Expo 宿主，所以有些文件是**模板有、这个宿主不该有**的。
    //    宿主文件集只会**覆盖**同名文件，不会删 —— 不显式 drop 的话，生成物里会留着
    //    `app.json` / `metro.config.js`（Expo 的配置），用户会以为还得装 Expo
    //    （实测：第一次 `init --host webview` 就是这么生成出来的）。
    drop: ['app.json', 'metro.config.js'],
    why:
      '要的是**静态产物**而不是 dev server：`npm run build` 打成 `dist/`，扔进任何静态服务器就能跑。' +
      '打包走 esbuild（一行 `alias` 把 `react-native` 指到 `react-native-web`），入口用 RN 自己的 ' +
      '`AppRegistry` —— dev server、Metro、Expo 一个都不需要',
  },
};

/** 所有宿主 id（顺序即 `--help` 里的展示顺序）。 */
const HOST_IDS = Object.keys(HOSTS);

/**
 * 解析 `--host` 的值。
 *
 * 别名是有代价的（`desktop` 与 `rnw` 指同一个东西，文档里就会漂），所以这里**只认一个名字**，
 * 不认识的直接报错并列出可选项 —— 比"猜一个最接近的"强（那是把拼写错误变成静默降级）。
 */
function resolveHost(id) {
  const key = (id || 'expo').trim();
  if (!HOSTS[key]) {
    const err = new Error(
      `不认识的 --host \`${id}\`。可选的：${HOST_IDS.map((h) => `\`${h}\`（${HOSTS[h].label}）`).join(' · ')}`,
    );
    err.hosts = HOST_IDS;
    throw err;
  }
  return HOSTS[key];
}

module.exports = { HOSTS, HOST_IDS, HOSTS_DIR, resolveHost };
