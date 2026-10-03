# zhouyi-reader-electron —— 第四个宿主：**桌面窗口（Electron）**

同一份 MoonBit 产物（`../zhouyi-reader/moobile.js`）装进一个**真窗口**。
**本机不需要 VS 工具链** —— 这是它存在的理由：目标里"三端实测"的桌面那一格，
`--host rnw`（React Native 原生窗口）要 VS 2026 + SDK 22621，而这台机器上没有。

```bash
cd examples/apps/zhouyi-reader && npm run build     # ① 编产物（应用自己的事）
cd ../zhouyi-reader-electron
npm install                                          # ② electron / esbuild / react-native-web（没有 expo、没有 metro）
node verify.mjs                                      # ③ 起窗口 + 把应用那 97 条判据**打在这个窗口上**（约 4 分钟）
npm start                                            # 想自己点一点：起窗口，不带判据
```

> ⚠️ **装 Electron 的坑**：npm 的 postinstall 会被镜像跳过（`added 13 packages in 1s`，
> 但 `node_modules/electron/dist/electron.exe` 不存在）。手动补一次：
> ```bash
> ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
> ```

## 两条桌面路线**不是二选一**

| 路线 | 答的问题 | 判据 | 本机 |
|---|---|---|---|
| `examples/apps/zhouyi-reader-desktop/`（`--host rnw`） | "同一份产物能不能进 **React Native 的原生宿主**" | 5 项（打包产物里有本应用真串 + 宿主接线） | ⏳ 窗口要 VS 2026 + SDK 22621 |
| **本目录**（Electron） | "**桌面端能不能真的跑起来给人用**" | **17 项**（含"应用那 97 条判据在窗口里全过"） | ✅ 起真窗口 |

## `verify.mjs` 验什么（17 项，四层）

1. **窗口**：Electron 进程起来、CDP 上有 page target、标题是应用名、
   渲染进程里**没有 Node 能力**（`nodeIntegration:false` + 沙箱 ⇒ `require` 不可用）；
2. **产物**：依赖图里没有 expo / Metro / 原生 `react-native`；`dist/artifact.json` 的指纹
   = 磁盘 `moobile.js` 的 sha256，而且**窗口里的页面**报的是同一个指纹、宿主标记是 `electron`；
3. ★ **同一套界面判据打在窗口上**：`PROBE_CDP_URL=<窗口的 CDP>` 跑
   `../zhouyi-reader/verify.mjs`（那份脚本支持"**附着模式**"：不自己起浏览器、也不导航）——
   它必须报 **97 / 0**（附着模式下它自己的"响应式"那 2 条会 SKIP，见下）；
4. **真窗口的响应式**：再起一个**更小的窗口**（`ELECTRON_WIN_W=420`），断言画布边长
   跟着真实窗口宽度走（≈ min(94vw, 720)）、**不是那个回落值 360**。

> 为什么响应式要单独在宿主侧验：应用那份判据里那一段用 CDP 的
> `Emulation.setDeviceMetricsOverride` 改视口 —— 那是**浏览器夹具**的能力；附着到别人的宿主上时
> "窗口多大"是**宿主的事**，模拟出来的视口不算数。⇒ 桌面端用**两个真窗口**验。

## 实测踩到的四个坑（都写进了代码注释与 FINDINGS 十三续）

| 坑 | 现象 | 处置 |
|---|---|---|
| **隐藏窗口被降频** | 界面判据里"点一下应当出现"整批红，点击效果**慢一拍** | `main.js` 四个开关关掉节流；★ 判据改成"**点完等页面真的变了**"，而不是固定 sleep |
| **CDP 模拟视口 ≠ 真窗口** | "窗口收窄到 400px"在 Electron 红 | 附着模式下 SKIP，改由宿主用两个真窗口验 |
| **位图分辨率跟着 dpr 走** | dpr 1.5 上下，"同一张图"的像素哈希对不上 | 判据的快照带上 `bw/bh`；响应式那段挪到像素比较之后 |
| **首帧字体定型** | 首次进某模式的图与第二次不同（第二、三次相同） | 基准取**稳定态**（先走一趟往返再量） |
| **隐藏窗口不合成帧** | `Page.captureScreenshot` **一直不返回** ⇒ 汇总行打不出来 | 截图加 6 秒硬上限（它只是证据，不是判据） |

## 诚实清单

1. **只验到"窗口跑起来 + 界面判据全过"**：打包成安装包（electron-builder / forge）、
   自动更新、原生菜单栏、多窗口都**没做**；
2. **窗口的显示缩放是 150%**（本机），所以 CSS 视口 ≠ 物理窗口尺寸；
   "同一模式下画面稳不稳定"那条判据是**稳定态之间**比（首帧差异的成因写在 FINDINGS 里）；
3. 这个宿主**还没有进脚手架**（`--host electron`）—— 现在它是手写示例，
   下一步才是把它做成第四个宿主档（与 `hosts/webview/` 同源 + 叠加主进程文件）。
