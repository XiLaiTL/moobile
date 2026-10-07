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

产物 sha256 `e9ff4a4c5209405d…`（`dist/bundle.js` 2231 KB · `moobile.js` 766 KB）。

| 组 | 问什么 | 读数 |
|---|---|---|
| ① | `Attrs::id("…")` 落没落到 DOM 的 `id` | ✅ `#pane` / `#sec-1..3` / 四个按钮**全在**（都是 `<div>`，尺寸正常）。这条是整条通道的地基 —— RNW 的 props 白名单丢掉属性是**静默**的 |
| ② | 对照：fork 里已有的 `@nav.scroll_to("sec-3")` | ⚠️ **它真的滚了**（`scrollTop` 0 → **1000**）—— 见下面「我预判错了一条」 |
| ③ | `@sub.scroll_to_node("sec-3", block="start")` | ✅ `scrollTop` 0 → **1000**，且 **sec-3.top − pane.top = 0.0px**（语义是「那一节**顶到容器上沿**」，不是「scrollTop>0」） |
| ④ | `@sub.node_rect("sec-3")` vs 浏览器自己量的 | ✅ 四个数**全对上，最大差 0.000px**（x=12 y=274 w=854 h=500） |
| ④′ | 读数**是活的**吗（防「缓存 / 常数」） | ✅ 把容器滚回顶再量：`y` 274 → **1274**（差 1000px） |
| ⑤ | `@sub.node_scroll_top("pane")` vs `element.scrollTop` | ✅ 137 vs 137，**差 0.000px** |

其它：页面 **0 条 JS 错误/异常**；全程**真鼠标**（`Input.dispatchMouseEvent` 三连），不是合成事件
（合成事件在这套宿主上不可信，见 skillpress M5 那笔账）。

## 证伪（判据自己会红 —— 必须真红过一次才算数）

把 `app.mbt` 里 `section()` 上的 **`.id(name)` 去掉**（其余一字不动）→ 重建 → 再跑驱动：

- **12 条不成立**；① 里 `#sec-1 / #sec-2 / #sec-3` 三条直接报 **「不在 DOM 里」**；
- ③ `COUNT scroll` **没涨**、`pane.scrollTop` 仍为 **0**（「点了没反应」那种症状被当场抓住）；
- 页面 1 条异常，堆栈**点名到 `abort_missing_node`**（`sub/node.mbt`）—— 也就是说
  「节点不在」这条路**不是静默**，而是带着「检查 `Attrs::id(...)`」的说明炸出来。

还原之后 sha256 与上面那个**逐字节相同**（`e9ff4a4c5209405d…`），复跑恢复全绿 ——
两边读数都记在这里，**"改回来了"这件事本身也有证据**。

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
- **容器级滚动订阅还没做**：这一版只有**一次性读** `node_scroll_top`；「滚到哪高亮到哪」要的是**订阅**，
  应用侧今天只能自己轮询（`@sub.every`，代价同 `hosttheme` 那条 2 秒轮询）。见 `node.mbt` 文件头「还没做的三样」。
- **只认 `id`，不接受 CSS 选择器**：选择器语法是 web 的东西（放进来等于给「可移植子集」开后门），
  而且拼错是**静默找不到**。
- 本试金石 import 了 `@nav`（`XiLaiTL/moobile/vendor/rabbita/nav`）**只为 ② 那格对照**；
  根上没有转发包、消费者 import 不到它 —— 这本身就是「别指望它」的理由之一。
- 试金石**不进口任何门**（它不是 `verify_all.sh` 的一条）：它要 Chrome + `npm install`，
  与 `canvas-spike` / `route-spike` 同类。要不要接进入口由后面按需定。
