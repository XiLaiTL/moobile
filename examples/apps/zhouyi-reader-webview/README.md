# zhouyi-reader-webview —— 第三个宿主：**零 Expo、零 Metro 的静态 Web**

《御纂周易折中》阅读器的**同一个 MoonBit 产物**（`../zhouyi-reader/moobile.js`），
打进一个静态站点。**应用侧一个字节都没改** —— 与 `--host expo` / `--host rnw` 的差别
全在宿主文件里（入口、打包器、外壳）。

```bash
cd examples/apps/zhouyi-reader && npm run build     # ① 编产物（应用自己的事）
cd ../zhouyi-reader-webview
npm install                                          # ② react / react-dom / react-native-web / esbuild —— 没有 expo
node verify.mjs                                      # ③ 打包 + 起静态服务 + 跑应用那 99 条判据（约 4 分钟）
```

想只看界面：`node build.mjs && node serve.mjs` → 打开 `http://127.0.0.1:8123/`。

## 这个宿主与另外两个差在哪

| | Expo 宿主（`../zhouyi-reader/`） | 桌面（`../zhouyi-reader-desktop/`） | **这里** |
|---|---|---|---|
| 入口 | `expo` 的 `registerRootComponent` | RN 的 `AppRegistry` | RN 的 `AppRegistry` |
| 打包 | Metro（Expo 预设） | Metro（`@react-native/metro-config`） | **esbuild**（一行 `alias`：`react-native` → `react-native-web`） |
| 服务 | `expo start`（dev server） | `react-native start` | **静态服务器**（自带 30 行零依赖版） |
| 画布后端 | web→DOM 2D / android→Skia | windows→SVG | **DOM 2D** |
| 产出 | 三端 | Windows 桌面（要 VS 2026） | **一个静态站点**（PWA / Tauri / Electron 的外壳都能套） |

## `verify.mjs` 验什么（15 项，三层）

1. **打包面**：esbuild 输入清单里**一个 expo / Metro 包都没有**、原生 `react-native`
   本体没被卷进来（只有 `react-native-web`）、产物是 `index.html` + `bundle.js`；
2. **产物面**：服务端那份 `artifact.json` 的 sha256 == 磁盘上 `../zhouyi-reader/moobile.js`
   的 sha256，而且 bundle 里嵌了同一个指纹（⇒ 浏览器吃的**就是这一次编的产物**）；
3. **界面面**：把**应用自己那 99 条判据**（`../zhouyi-reader/verify.mjs`）**原样**指向这个
   静态服务的 URL —— 首屏 / 罗盘画像素 / 拖拽重绘 / 轻点进卦 / 搜索 → 网格 / 点卦卡进详情 /
   详情页五个折叠族与三个状态族 / 无 console 错误。它必须报 **99 / 0**（少一条也算红）。

★ 第 3 层是这条门的重点：**换宿主之后界面行为一样**，而不是"能渲染出一个壳"。
从头另写一套断言等于又造一份会漂的实现 —— 所以这里是 `spawn` 那个脚本、读它的汇总行。

⚠️ 两个实测踩到的坑（都写在代码注释里）：
`spawnSync` 会**阻塞事件循环**，而静态服务就跑在本进程里 → 子进程里的页面永远加载不出来
（表现是"这条门很慢"，8 分钟没输出）；子进程用它自己的 CDP 端口，而**上一轮残留的 Chrome**
会占着那个端口、还指着上一轮的地址。

## 诚实清单

1. **外壳没做**：这里给的是"能打成静态站点"这一步。PWA 的 manifest / service worker、
   Tauri / Electron 的壳都是它上面的下一层（`--host webview` 的生成物 README 里也这么写）；
2. **只有 DOM 2D 那条画布后端**：`canvas-svg` 是桌面宿主的通道，这里刻意不引
   `react-native-svg`（实测会撞 `react@19.2.0` vs RN 0.87 的 peer 冲突）；
3. 打的是 **dev 模式** bundle（约 6 MB，大头是 react-native-web）—— 上生产要换
   `NODE_ENV=production` + `minify`（`build.mjs` 里那两行）。
