# zhouyi-reader —— 《御纂周易折中》阅读器（moobile 版）

**这个应用是从 `interest/yi` 迁移过来的**，不是手写的：

```bash
npx moobile-host create --from-rabbita <yi 项目> examples/apps/zhouyi-reader \
  --name zhouyi-reader --rn 0.83 --host-dep file:../../../npm/moobile-host
```

生成的**迁移报告**在 [`MIGRATION.md`](MIGRATION.md)（同一份数据的机器可读形态在
`migration.generated.json`）—— **改这个应用之前先读它的 §4「必须人工处理」**：
那里逐条写了哪些是自动改的、哪些是人改的、哪些还没做。

## 环境要求

只要两样，**不需要 Python**：

| 工具 | 下限 | 装 |
|---|---|---|
| [MoonBit](https://www.moonbitlang.com/download/) | `moon` 0.1.20260827 以上 | `curl -fsSL https://cli.moonbitlang.com/install/unix.sh \| bash` |
| Node.js | 20 以上 | 见 [nodejs.org](https://nodejs.org/) |

跑 Android 另需 Android SDK（`adb` 在 `PATH` 里）。

## 跑起来

```bash
npm install
npm run web          # 或 npm run android
```

> ⚠️ 在本仓库里跑时 `moobile-host` 指的是 `file:../../../npm/moobile-host`（本地包），
> 因为库自身还没发 `0.4.0`。生成给**别人**的项目里那一条是 registry 版本号。

## 验收（真浏览器，99 项）

```bash
npx expo start --web --port 8081      # 另开一个终端
node verify.mjs http://localhost:8081/
```

判据是**真 Chrome 里的 99 项断言**：首屏 / 数据装载 / **罗盘画出像素 + 拖拽后画面变化 +
轻点外环进卦** / 搜索 → 过滤网格 / 点卦卡 → 详情页（真爻辞）/ 样式落到了元素上 /
**底部三块折叠（21 项：常显 + 默认折叠 + 点开出现正文里那句具体的话 + 箭头 ▸→▾ + 再点收起）** /
无 console 错误。

> **折叠那 21 条做过证伪**：把 `more_section` 的 `if open` 改成 `if true`（永远展开）→ **39 / 45**（当时的总数），
> 红的正好是"默认折叠"与"再点一次收起"那六条。只断言"点开出现了"会漏掉**半受控**
> （`<details>` 自带状态，写成"能开不能收"照样能过前三条）。
截图落在 `shot-zhouyi-reader.png`。

## 真机（Android）验收，29 项

```bash
# ① 起模拟器（AVD 名 moobile64）  ② Metro 在 8081（同一条命令服务原生与 web）
cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
node device_check.mjs
```

判据见 [`device_check.mjs`](device_check.mjs)（**29 / 29**）：包与 Metro 是同一份 / 首屏罗盘 / 画布几何
（由文本锚点反推，且**不溢出屏宽**）/ 拖拽后不崩且画布重绘 / **轻点外环进卦** / 输入通道 /
**底部折叠区块（滚下去能看到正文、收起来又看不到）** / 无原生崩溃。

> 折叠那几条的判据在真机上**必须绕一下**：`uiautomator` 只 dump **可见节点**，
> 展开后新插进来的正文落在屏幕**下面**，不滚过去它根本不在 dump 里。
> 所以判据是"**边滚边把长文本收成集合、再做差集**"：展开后比折叠态多 **14** 条，收起后多 **0** 条。

这一套还**逼出了库侧的一处真 bug**：`gesture-rn.js` 里 `start` 与 `move` 用了两个参照系
（起点错、增量对），表现为"拖 45° 只转 5°"。真因、量到的数字与修法见
[`../../../docs/FINDINGS.md`](../../../docs/FINDINGS.md) 的 Android 补记（第六节）。

⚠️ 它用的是**本应用自己的 APK**（Skia 是原生依赖，借不到别人的壳）。
⚠️ **验不到**"输入中文 → 点卦卡"：`adb shell input text` 打不出中文（实测 `%E4%B9%BE` 会原样落成
字面量）——那条链路由 web 判据覆盖，脚本里也把这件事显式打了出来。

## 迁移动过的"架构级"的地方

（细节与理由在 `MIGRATION.md`；这里是一页索引）

| 项 | 原实现（rabbita + 浏览器） | 现在 | 为什么 |
|---|---|---|---|
| **样式** | `class=` + 476 行 CSS | 生成的 `styles/styles.mbt`（104 个样式函数） | RN 没有 CSS；`class=` 在 moobile 里**编得过但没效果**（静默失效） |
| **画布** | 渲染后去 DOM 找 `#bagua-canvas` 再画 | `bagua_ops(model)` 纯函数 → `@canvas.canvas` | 绘制指令变成模型的可断言产物 |
| **拖拽 / 点击** | `on_mousedown/move/up` + `locationX` | `@gesture.attrs(on_pan=…, on_tap=…)` | 坐标在 RN 上拿不到（见库文档的手势边界补记） |
| **点击元素** | `div(on_click=…)` | `button(on_click=…)`（**手改 5 处**） | `on_click` 只对 `Pressable` 有效；`div` → `View` 会把点击**丢掉**且不报错 |
| **数据** | 自己的后端提供 `/reader_data.json` | **编译期嵌进产物**（`data_reader.mbt`） | 原生端没有"站点根"；且库的 http 只认完整 URL |
| **响应式** | CSS `min(94vw, 720px)` | `@sub.current_viewport()`（**首帧读一次**）+ `@sub.on_resize`（变化时推）→ Model 的 `vp_w` → 画布边长 | RN 没有 CSS；边长还决定手势坐标怎么换算。★ 只订阅是不够的：**两端都不补发初始值** ⇒ 读不到宽度时画布一直画在回落值 **360**（在 1400px 的窗口里小得离谱，且无报错）—— 第十一轮库侧补了"读一次"那条 API |
| **画布的 web 后端** | 浏览器自带 canvas | `registerWebCanvas()`（`moobile-host/canvas-web`，DOM 2D） | 没注册时组件通道会 fail-fast，而 React 会把**整页卸掉** |
| **画布的矢量/桌面后端** | —— | `registerSvgCanvas()`（`moobile-host/canvas-svg` + `react-native-svg`） | Skia **没有 Windows 后端**；SVG 是 RNW 上唯一现成的矢量通道，而它同时支持 web —— 所以这条**在本机就验过**（`EXPO_PUBLIC_CANVAS=svg`）|
| **页面根（两件事）** | `body`/`html` 的 CSS + 浏览器自己的**文档级滚动** | `div(page().flex(1))` + `@html.node("scroll", …)` | ★ **两个都只在真机上现形**：`page()` 生成出来却没人挂（浏览器自带 body 样式兜着）、RN 的 `View` 不滚动（DOM 自己会滚）。实测：真机上滚 30 次界面纹丝不动，而同一页面 web 判据 45/45。判据已写进库：`lib/migrate/app-audit.js` + `tools/migrate_app_audit.mjs` |
| **三块折叠** | `<details>/<summary>` 的**自身状态** | `open_more : Array[Bool]` + `ToggleMore(i)` + 按钮/条件渲染 | 那两个标签在标签表里是**明确排除**的（RN 没有那个语义）；状态进 Model 才可断言 |

## 第四个宿主：桌面窗口（Electron）

同一份产物装进一个**真窗口**（**本机不需要 VS 工具链**）：
[`../zhouyi-reader-electron/`](../zhouyi-reader-electron/)（`node verify.mjs` —— 起窗口 +
把**本目录这 99 条判据**附着打上去，报 97/0）。

| 桌面路线 | 答的问题 | 本机 |
|---|---|---|
| `../zhouyi-reader-desktop/`（`--host rnw`） | 同一份产物能不能进 **React Native 的原生宿主** | ⏳ 窗口要 VS 2026 + SDK 22621 |
| `../zhouyi-reader-electron/` | **桌面端能不能真的跑起来给人用** | ✅ 真窗口 |

## 还没做的（诚实清单）

1. **桌面端（RNW）没跑**：本机缺 VS 2026 + SDK 22621 —— 见
   [`../../../docs/design/DESKTOP-RNW.md`](../../../docs/design/DESKTOP-RNW.md)。
   ⚠️ 但它的**画布后端已经写好并在 web 上验过**（`canvas-svg.js`：同一条 24 项判据全过），
   所以剩下的只是**宿主工程 + 工具链**，不是"桌面端还差实现"。
2. ~~卦详情页的折叠交互没写断言；`more_view` 还是保底桩~~ → **已做**：三块折叠改成受控
   （`open_more` 进 Model），web 21 条 + 真机 9 条断言，并做过证伪。
3. **依赖祖先条件类的后代选择器样式**（`.rel-link.sel .rl-label` 这类）静态判定不了 ——
   报告里点了名（`MIGRATION.md` §2.1）。
4. **Android 验不到的**：输入中文 → 点卦卡（`adb shell input text` 打不出中文），
   该链路由 web 判据覆盖；`device_check.mjs` 里也把这件事显式打了出来。
