# gesture-spike —— 手势通道的试金石（PLAN §7 决策点 19 的证据）

```bash
cd examples/apps/gesture-spike/host
npm install          # esbuild + react-native-web + react-native-gesture-handler
node verify.mjs      # 15 项（含证伪）
```

**一句话结论**：`PanResponder` 与 `react-native-gesture-handler`（RNGH）**在我们的 RNW(web) 宿主上都能跑、
都给元素内坐标、位置都精确跟手**；差别在**依赖成本**与**`translationX` 的语义**（RNGH 默认带激活阈值）。
**建议：通道形状照旧（元素级组件 + 载荷），实现先用 `PanResponder`（零依赖）**，
并把 RNGH 留作"要高级手势时"的可替换实现 —— 前提是**契约里把位移语义写死**（见 §4）。

---

## 1. 它回答什么（以及为什么不能靠读文档回答）

决策点 19 要在这三条里选：① PanResponder ② RNGH ③ 两者并存。而这里有三个**未知量**：

1. **RNGH 在 react-native-web 宿主上跑不跑？** —— 包里有 **275 个 `.web.js` 文件**
   （`GestureHandlerRootView.web.js` / `GestureComponents.web.js` / …），但"包里有 web 实现"
   ≠"在我们的 RNW + esbuild 别名下能挂载并收到事件"。网上还能搜到"web 上跑不起来"的讨论。
2. **`PanResponder` 在 RNW 上给不给元素内坐标？** —— responder 系统 RNW 也实现了，
   零新依赖这条很吸引人，但"能点"≠"能拖且坐标对"。
3. **RNGH 的 `translationX` 与 DOM 的"按下即起算"一致吗？** —— 这条直接决定
   "把 yi 的 `e.offset.x` 换成 `e.translationX`"对不对。

## 2. 判据（不是"能拖"）

| # | 判据 | 为什么是它 |
|---|---|---|
| ① | 三种实现都**挂载成功**、页面无 console.error / 未捕获异常 | 挂载失败就没有后面的事 |
| ② | 都收到 **begin → update×N → end**（N≥3） | 排除"一次抖动被当成拖动" |
| ③ | 起点是**元素内坐标**（0..边长） | 只断言"回调被调了"抓不住"坐标全 0"——而那正是 moobile 现在在 RN 上的毛病 |
| ④ | **位置跟着指针走**（用各自最强的位置字段，≈ 实际位移 ±3px） | 这条才是"跟手" |
| ⑤ | 证伪：**空白处拖 → 三方都不该有事件** | 证明上面的事件确实来自那三个盒子 |

## 3. 实测结果（15 项全过）

| | RNGH（默认） | RNGH `minDistance(0)` | PanResponder |
|---|---|---|---|
| 挂载（RNW web，esbuild） | ✅ | ✅ | ✅ |
| begin / update / end | 1 / 5 / 1 | 1 / 7 / 1 | 1 / 6 / 1 |
| 元素内坐标 | ✅ `x=48, y=48`（96px 方块） | ✅ 同 | ✅ `locationX/Y=48, 48` |
| 位置跟手 | ✅ `absoluteX` 差 **40** | ✅ **40** | ✅ `pageX` 差 **40** |
| `translationX`（end） | **20** ← 落后 20 | **40** ✅ | 无此字段 |
| 新依赖 | **1 个原生依赖**（RNGH） | 同左 | **0** |
| 打包器要求 | 需提供 `__DEV__` 与 `global`（见 §5） | 同左 | 无 |

**三条要点**：

1. **RNGH 在 web 上确实能跑**（前提是 §5 那两条打包器设置）—— 网上的"跑不起来"多半是 `.web.js`
   解析或全局变量没配。我们的真实宿主是 Metro/Expo，**它自带这两条**，所以真实宿主不受影响。
2. **`translationX` 不是"按下即起算"**：默认 Pan 有**激活阈值**，跨过它之前一直是 0
   （实测：鼠标走了 40px，`tx` 只有 20）。**要它从按下起算，必须显式 `minDistance(0)`** ——
   实测加上之后 `tx` 精确等于 40。这条如果不知道，罗盘的拖拽会"起步少一截"。
3. **`PanResponder` 不掉队**：元素内坐标、位置精度都与 RNGH 同级，且**零新依赖**。
   ⚠️ 但它跑在 **JS 线程**（RNGH 的手势可跑在 UI 线程）—— 这条**没测**（要真机 + 忙的 JS 线程），
   见 §6 的边界。

## 4. 结论：通道形状不变，实现先用 PanResponder

**契约（两条实现必须给出同一套语义，应用不该知道用的是谁）**：

| 字段 | 语义 |
|---|---|
| `x` / `y` | **元素内坐标**（与 DOM 的 `offsetX/offsetY` 同义） |
| `absoluteX` / `absoluteY` | 屏幕坐标 |
| `dx` / `dy` | **从按下那一刻起算**的位移 —— ⚠️ **由宿主算**，不能直接把 RNGH 的 `translationX` 漏出去（它有激活阈值，语义不同） |
| `phase` | `start` / `move` / `end` / `cancel` |

**为什么先用 PanResponder**：零新依赖（RNGH 是原生依赖，且 moobile 的画布那半**已经**带进了
`reanimated` + `worklets`）、已实测两端可用、坐标与位移都精确。
**为什么留 RNGH 的口**：多指 / pinch / rotate / 长按那类手势它更强，且能把手势处理放 UI 线程。
**换实现不该动应用代码** —— 所以宿主侧要做成一层可替换的注册（与画布通道同一个套路）。

`minDistance(0)` 这条是**采用 RNGH 时的硬性配置**，写进契约的备注里：不设它，
`translationX` 与"按下起算"就不是一回事。

## 5. 打包器要求（实测踩出来的）

在**裸 esbuild** 下，RNGH 一装载就报错，两条都得补（Metro / Expo **自带**，我们的真实宿主不受影响；
受影响的是 `host-swap-spike` 那类自建打包）：

```js
resolveExtensions: ['.web.js', ...],                       // ① 不配这条会挑到原生实现（摸 NativeModules）
banner: { js: 'var __DEV__ = true; var global = globalThis;' },  // ② __DEV__ / global 两个自由变量
```

## 6. 这个 spike **没有**证明什么（边界）

1. **只测了 web 宿主（RNW）**。原生侧的结论（性能、手势与原生视图的交互、UI 线程 vs JS 线程）
   要 `expo prebuild` + 重建 APK + 真机，**没测**。
2. **没测多指**（pinch / rotate）—— 那正是 RNGH 的强项，也是"要不要为它付原生依赖"的关键；
   要另做一次实验。
3. **没测"JS 线程忙时的手感"**：罗盘拖拽会触发整棵视图重算（MoonBit → React 元素），
   而 `PanResponder` 与渲染都在 JS 线程 —— 这条是真机上最可能翻车的地方，**现在没有判据**。
4. **没测手势与滚动容器的冲突**（RN 的 responder 是"抢占"模型，外面套 `ScrollView` 时行为不同）。
