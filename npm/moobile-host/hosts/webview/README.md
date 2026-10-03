# moobile-template（`--host webview`：零 Expo、零 Metro 的**静态 Web** 宿主）

用 [moobile](https://github.com/XiLaiTL/moobile) 写的跨端应用，**宿主是一个静态站点**：
`npm run build` 把它打成 `dist/`，扔进任何静态服务器（或塞进 PWA / Tauri / Electron 外壳）就能跑。
界面与逻辑是 **MoonBit**（`app.mbt`），你不需要写 React 组件。

> 这是 `moobile-host init <目录> --host webview` 生成出来的样子。
> **应用侧（`moon.mod` / `moon.pkg` / `app.mbt`）与 `--host expo` / `--host rnw` 那两份逐字相同** ——
> 换的只是宿主，这正是"宿主是可替换件"。

## 与另外两个宿主差在哪

| | `expo` | `rnw` | **`webview`** |
|---|---|---|---|
| 入口 | `expo` 的 `registerRootComponent` | RN 的 `AppRegistry` | RN 的 `AppRegistry` |
| 打包 | Metro（Expo 预设） | Metro（`@react-native/metro-config`） | **esbuild**（一行 `alias`：`react-native` → `react-native-web`） |
| 服务 | `expo start`（dev server） | `react-native start` | **任意静态服务器**（自带一个 30 行的零依赖版） |
| 额外依赖 | Expo SDK | RNW + 裸 RN | **react / react-dom / react-native-web / esbuild** |
| 画布后端 | web→DOM 2D、android/iOS→Skia | windows→SVG | web→**DOM 2D**（只注册这一条） |
| 产出 | 三端（android / ios / web） | Windows 桌面 | **一个静态站点**（PWA / Tauri / Electron 的外壳都套得上） |

## 环境要求

只要两样，**不需要 Python**：

| 工具 | 下限 | 装 |
|---|---|---|
| [MoonBit](https://www.moonbitlang.com/download/) | `moon` 0.1.20260827 以上 | `curl -fsSL https://cli.moonbitlang.com/install/unix.sh \| bash` |
| Node.js | 20 以上 | 见 [nodejs.org](https://nodejs.org/) |

## 三条命令

```bash
npm install
npm run build        # moon build --target js → moobile-host build → esbuild 打进 dist/
npm run serve        # 起静态服务（零依赖），浏览器打开 http://127.0.0.1:8123/
```

`dist/` 里只有 `index.html` + `bundle.js` + 两张诊断用的 JSON（依赖图与产物指纹）——
没有 dev server、没有运行时下载。

## 诚实清单

1. **PWA 的安装/离线那些元数据**（manifest、service worker）**没做** —— 这个宿主给的是
   "能打成静态站点"这一步，套外壳（Tauri / Electron）与做 PWA 是它上面的下一层；
2. **只有 DOM 2D 那条画布后端**：`canvas-svg` 是桌面宿主的通道（那台机器上 Skia 没有后端），
   这里刻意不引 `react-native-svg`（实测会撞 `react` 的 peer 冲突）；
3. 打成的是 **dev 模式**的 bundle（约 6 MB 依赖图里那一大坨是 react-native-web）——
   上生产前把 `build-web.mjs` 里的 `process.env.NODE_ENV` 换成 `"production"` 并开 `minify`。
