# node-spike —— 节点寻址的试金石

> **一句话**：给一个**具名节点**（`Attrs::id("sec-3")`），能不能**滚到它**、能不能**量它**。
> 站点右栏那个「本页目录」要的两件事（点一下跳过去 + 滚到哪高亮到哪）卡的就是这一层 ——
> 缺的不是滚动函数（web 有 `scrollIntoView`、RN 有 `ScrollView.scrollTo`），是**句柄**。

```bash
cd examples/apps/node-spike
npm install             # esbuild / react / react-native-web / moobile-host（file: 依赖）
npm run build           # moon build --target js + moobile-host build + build-web.mjs
node drive.mjs          # 真 Chrome + CDP **真鼠标**，打印读数表
node drive.mjs --keep   # 留 Chrome（排查用）
```

驱动脚本**不靠肉眼看界面**：它抠应用渲染出来的 `COUNT …` / `RECT …` / `SCROLLTOP …` 几行，
再与它自己用 `getBoundingClientRect()` / `element.scrollTop` 量到的值**对账**。

---

## 读数（2026-10-07，真 Chrome headless + CDP 真鼠标，本机）

产物 sha256 `3f3344bac6a06b11…`（`dist/bundle.js` 2276 KB · `moobile.js` 792 KB）。

⚠️ 这个 sha 是**产物指纹**（页面与 `dist/artifact.json` 里也是它）：读数所属的那一次构建
**由它指认**，而不是靠"我刚才跑过"这句话。改一行库源码、重走一遍流水线，它就会变
（实测：把 `img` 的 `src → source` 改写关掉 ⇒ `de06370f733cfa5e…`）。

| 组 | 问什么 | 读数 |
|---|---|---|
| ① | `Attrs::id("…")` 落没落到 DOM 的 `id` | ✅ `#pane` / `#sec-1..3` / 四个按钮**全在**（都是 `<div>`，尺寸正常）。这条是整条通道的地基 —— RNW 的 props 白名单丢掉属性是**静默**的 |
| ② | 对照：fork 里已有的 `@nav.scroll_to("sec-3")` | ⚠️ **它真的滚了**（`scrollTop` 0 → **1000**）—— 见下面「我预判错了一条」 |
| ③ | `@sub.scroll_to_node("sec-3", block="start")` | ✅ `scrollTop` 0 → **1000**，且 **sec-3.top − pane.top = 0.0px**（语义是「那一节**顶到容器上沿**」，不是「scrollTop>0」） |
| ④ | `@sub.node_rect("sec-3")` vs 浏览器自己量的 | ✅ 四个数**全对上，最大差 0.000px**（x=12 y=274 w=854 h=500） |
| ④′ | 读数**是活的**吗（防「缓存 / 常数」） | ✅ 把容器滚回顶再量：`y` 274 → **1274**（差 1000px） |
| ⑤ | `@sub.node_scroll_top("pane")` vs `element.scrollTop` | ✅ 137 vs 137，**差 0.000px** |
| ⑤′ | `@sub.on_node_scroll("pane", …)`：**装载后先补一次**当前值 | ✅ 没人滚的时候 `COUNT sub=1`、`SUB_BOOT=0`，与浏览器读到的 `scrollTop` **一致** |
| ⑤″ | 同上：滚动时推得动 | ✅ 滚到 1000 后 `COUNT sub 1→4`、`SUB_LAST=1000` 与 `element.scrollTop` **一致** |
| ⑥ | `Style::transform` 的浏览器矩阵（**顺序敏感**） | ✅ 先移后缩 ⇒ `matrix(2,0,0,2,**40**,0)`；先缩后移 ⇒ `matrix(2,0,0,2,**80**,0)`（**两者不同** ⇒ 顺序保住了）；`rotate(90deg)` ⇒ `matrix(0,1,-1,0,0,0)` |
| ⑦ | `@sub.open_url("…")`：点了之后窗口真的开了吗 | ✅ `window.open` **被调用 1 次**、载荷就是那条 URL、`target="_blank"`（驱动脚本自己替换 `window.open` 记下调用） |
| ⑧ | `img`（对标表 #10 图片） | ✅ 5 个各自独立的读数：`#pic-1` **就是那个 `<img>`**（`Attrs::id` 落在它身上）；它的 `src` 是那张图；`naturalWidth = 2`（浏览器**真的解码了**）；`alt` 在；它**真的占了版面**（24×24px） |

其它：页面 **0 条 JS 错误/异常**；全程**真鼠标**（`Input.dispatchMouseEvent` 三连），不是合成事件
（合成事件在这套宿主上不可信，见 skillpress M5 那笔账）。

## 证伪（判据自己会红 —— 必须真红过一次才算数）

把 `app.mbt` 里 `section()` 上的 **`.id(name)` 去掉**（其余一字不动）→ 重建 → 再跑驱动：

- **12 条不成立**；① 里 `#sec-1 / #sec-2 / #sec-3` 三条直接报 **「不在 DOM 里」**；
- ③ `COUNT scroll` **没涨**、`pane.scrollTop` 仍为 **0**（「点了没反应」那种症状被当场抓住）；
- 页面 1 条异常，堆栈**点名到 `abort_missing_node`**（`sub/node.mbt`）—— 也就是说
  「节点不在」这条路**不是静默**，而是带着「检查 `Attrs::id(...)`」的说明炸出来。

还原之后 sha256 与上面那个**逐字节相同**，复跑恢复全绿 ——
两边读数都记在这里，**"改回来了"这件事本身也有证据**。

### 证伪二：把 `Image` 从宿主组件表里拿掉（2026-10-07）

`npm/moobile-host/index.js` 的 `COMPONENTS` 里删掉 `Image`（库、应用**一字不动**）→ 重打 →
应用**当场炸**，报的是**点名**的话：

```
Error: moobile: 宿主没有注册组件 "Image"（MOBILE_HOST.components 里没有这个键）。
已注册 6 个：View, Text, Pressable, TextInput, ScrollView, moobile:Canvas
```

⇒ 「没登记的名字**不许静默**」这条约定是真的在管事，不是文档里的漂亮话。

### 证伪三：关掉 `img` 的 `src → source` 改写（2026-10-07）

把 `render.mbt` 里 `if tag == "img" && k == "src"` 那个分支短路掉 → 重走流水线 →
⑧ 的 5 条里**红 3 条**（`background-image` 空、`naturalWidth = -1`、隐藏 `<img>` 的 `alt = null`），
而 `#pic-1` 与尺寸那两条**照样绿** —— 这正是"判据要各自独立"的意思：只断言"DOM 里有个图片元素"
会漏掉这一整类 bug。

⚠️ **这次证伪第一次跑是"假的"**：我改了库源码、跑了 `moon build`、跑了 `build-web.mjs`，
读数**照样全绿**。真因：`./moobile.js` 是 `moobile-host build` 从 `_build/` **拷**过来的一份，
`moon build` 只更新 `_build/` —— 少跑一步拷贝，就**悄悄打的是上一版代码**，连打印的 sha 都一起是旧的。
⇒ 于是给 `build-web.mjs` 补了一道**新鲜度自查**（拿 `moobile-host build --print-path` 问出真正的
产物路径，比 mtime，旧了就中止退出 2，并明说"别用再打一次绕过去"）。这道门自己也证伪过：
`touch` 一下 `_build/` 里的产物 ⇒ 立刻红（`--allow-stale` 才放行）。

## ⚠️ ⑧ 这一格改过两次判据 —— 而第二次暴露的是**真问题**（2026-10-07）

第一次：按 HTML 的直觉写（"DOM 里有个 `<img>`，读它的 `src`/`naturalWidth`/`alt`"），
全红，而功能是好的 —— 因为当时宿主用的是 `react-native-web` 的 `Image`，它在 DOM 里是
`div(背景图) + 视觉上藏起来的 <img>` 三层。**判据要照宿主的事实写。**

第二次：照着那个三层结构写，绿了。可那份绿是**假的**：RNW 的 `Image` **根没有高度**
（RN 的语义要求调用方给 `width`/`height`），而站点正文里的 `![alt](x.png)` **不写尺寸** ——
实测那一格排出来是 **720×0**：宽占满一栏、**高为零**，页面上什么都看不见，
而"元素在""naturalWidth 对"两条**照样绿**。

⇒ 修法在**宿主**那一侧（`npm/moobile-host/index.js`）：**web 上用真正的 `<img>`**
（`WebImage`：有 `src` 就有高度、`alt` 原生、顺带懒加载/右键另存/搜索引擎），
原生 RN 那边仍是 RN 的 `Image`（没有 DOM）⇒ **原生的 `img` 仍然需要调用方给尺寸**，
这条是**已知缺口**，别读成"两端都自适应了"。

判据也因此加了第五条：**"它真的占了版面"（宽高都 > 0）** —— 就是这一条把 720×0 抓出来的。
站点侧同一格的读数（真图片元素、`src` 取得到、字节数与语料逐字节相同）在
`skillpress/_scratch/image-check.mjs`。

## ⚠️ 我预判错了一条（这一格留着当常设对照）

我先写的判词是：「`@nav.scroll_to` 走的是**没有实现**的 op 路 ⇒ 它什么都不做」。
**第一跑就把它否掉了**：`pane.scrollTop` 0 → 1000，它**真的滚了**。

真因（读了 `vendor/rabbita/nav/op.mbt` 之后才清楚）：`@nav` 里**滚**那几个 op 是**库侧自己实现的**
（`AfterLayout` + DOM，不经过宿主），而 **`push` / `load` / `reload` 那几个没有实现**
（落进 `_ => raise Unhandled`，被运行时吞掉）—— 那才是 route-spike 量到「`@nav.push_url` 静默 no-op」的原因。
**两件事别混成一句「nav 全是死的」。**

那为什么还要 `@sub` 这一套？三条**实测出来的差别**（不是设计偏好）：

1. **消费者 import 不到 `@nav`**：根上**没有** `nav/` 转发包 ⇒ 站点（`skillpress/shell`）import 的只有
   `@moobile` / `@html` / `@cmd` / `@sub` / `@style`，那个能跑的 API 对它**不可达**；
2. **它只有「滚」、没有「量」**：跟读高亮要的是「某一节现在在哪」（`node_rect`）与「容器滚到哪了」
   （`node_scroll_top`）；
3. **它不经能力通道**：RN 上没有 DOM ⇒ 库侧那条路直接抛；本套走 `node` 能力的 `invoke`，与 `url` 那条动作通道同形。

## 边界（**别读大**）

- **RN 原生未验**：`node` 能力的动作（`scrollTo` / `measure` / `scrollTop`）今天**没有任何宿主登记**
  ⇒ RN 上会 `abort`（不静默）。动作名与载荷形状写在 `vendor/rabbita/sub/node.mbt` 与
  `tools/cap_platform.mjs` 里，等 RN 要接时照着登记即可。
- **容器级滚动订阅已经做掉了**（`@sub.on_node_scroll`：文档级捕获阶段的 `scroll` + 按 `id` 过滤 +
  装载后有界补一次初值，见 ⑤′/⑤″）—— 这里原来写的是"还没做、只能自己轮询"，**那句话已经不成立**。
  还差的一样是**条件渲染的节点**（今天假定它会渲染出来，只是可能晚几十毫秒；重试额度用完就报错）。
- **只认 `id`，不接受 CSS 选择器**：选择器语法是 web 的东西（放进来等于给「可移植子集」开后门），
  而且拼错是**静默找不到**。
- 本试金石 import 了 `@nav`（`XiLaiTL/moobile/vendor/rabbita/nav`）**只为 ② 那格对照**；
  根上没有转发包、消费者 import 不到它 —— 这本身就是「别指望它」的理由之一。
- 试金石**不进口任何门**（它不是 `verify_all.sh` 的一条）：它要 Chrome + `npm install`，
  与 `canvas-spike` / `route-spike` 同类。要不要接进入口由后面按需定。
