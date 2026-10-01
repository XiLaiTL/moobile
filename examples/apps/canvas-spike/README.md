# canvas-spike —— canvas 通道的试金石（P3 T3.2 欠的那份设计 + 它的证据）

```bash
cd examples/apps/canvas-spike/host
npm install          # 只有 canvaskit-wasm（真 Skia 的 WASM 版）
node verify.mjs      # 26 项判据（含 2 个证伪诱饵）
node verify.mjs --keep   # 顺带把 PNG 证据写到 docs/evidence/canvas-r1/
```

**结论一句话**：`<canvas>` 不需要新通道 —— 它就是**组件通道 + `prop_json` + 宿主侧一个 Skia 适配组件**；
"画出来对不对"已经用**真 Skia**（CanvasKit，和 RN Skia 是同一个引擎）在**本机**验过了，
判据是**384 个像素采样点逐一对照卦爻数据**；而契约的两端（MoonBit 编码器 ↔ 宿主包解码器/翻译器）
**逐条对账过**，载荷逐字节相同、出图像素逐点相同。
**原生侧（RN 的 Skia 组件挂载 + 真机）与文字字形没验**，边界见文末 §5。

---

## 1. 要解决的问题

`PLAN.md` §3.6 的诚实标注里，`canvas` 是**被显式排除**的 12 个标签之一
（`render.mbt` 的 `excluded_tags()`：`("canvas", "RN 无 canvas —— 接 react-native-skia（设计文档阶段 4）")`）。
今天在手机上写 `<canvas>` 的实际后果是：**回落成一个空 `View` + 进 `unmapped_tag_count` 计数** ——
画不出东西，也不报错。

设计文档早就把这是"唯一例外"这件事写死了（`docs/design/DESIGN.md` §R3）：

> RN 无 canvas，需 `react-native-skia` 并单独搭桥。**这是唯一"一张标签表搞定"不成立的地方。**

但**方案一直没定**：`docs/plan/PLAN-2026Q3-yi-port.md` §4 的 T3.2 原文是
"**这是本阶段的设计核心，先写方案再动手**"，而那份方案从没写过（P3 五个复选框至今全空）。
本目录就是补上它。

## 2. 设计：通道形态

### 2.1 不新开通道 —— 复用组件通道（I 轨道）

`examples/apps/antd-demo/antd/components.generated.mbt` 头部已经写着这套机制：

> 底层仍然是"字符串标签 + 命名空间"（`@html.node("antd:X", …)`）
> 结构化值走 **JSON 文本**（`Attrs` 的值域只有 String / Bool / Int / Double）。宿主按 manifest 的 `jsonProps` 做 `JSON.parse`。

canvas 要的东西**恰好就是**"一个结构化 prop"：绘制指令列表。所以三个角色是：

```
`XiLaiTL/moobile/canvas`（**已落地**）
  DrawOp 数组 → 紧凑 JSON 文本
     │  @html.Attrs::build().prop_json("ops", …)   ← 既有机制，antd 的 Table.columns 走的就是它
     ▼
组件通道：@canvas.canvas(ops, w, h) → @html.node("moobile:Canvas", …)   ← 命名空间标签，不计入 unmapped
     │  宿主按 registerSkiaCanvas({ skia }) → registerLibrary({ components, jsonProps: { Canvas: ['ops'] } }) 解析
     ▼
宿主包 `moobile-host/canvas-ops`（纯翻译器）+ `canvas-skia`（React 桥）
  ops[] → Skia 元素树（Path / Rect / Text + transform）
     ▼
@shopify/react-native-skia 的 <Canvas>              ← 真机上真正渲染的东西
```

**为什么不是"给标签表加一个 canvas"**（T3.2 当初列的另一条路）：那条被 `DESIGN-COMPONENT-LIBRARY.md`
§391 明确否掉了 ——

> antd 组件**不进** 42 条标签表、不计入 `unmapped` —— 那张表是"两端都有等价物"的可移植子集，
> 混进平台相关的第三方名字就**毁了它的诊断价值**。

canvas 是**平台相关**的（Web 有原生 canvas，RN 要 Skia），把它塞进"两端都有等价物"的表里，
那张表就不再能回答"哪些标签是安全的"这个问题了。

### 2.2 op 词汇表：**有界**，18 条

词汇表不是拍的，是 `interest/yi/zhouyi_reader/frontend/{colorring,main}.mbt` 的**全量实测**：

| canvas 调用 | 次数 | | canvas 调用 | 次数 |
|---|---|---|---|---|
| `begin_path` | 16 | | `translate` | 3 |
| `arc` | 12 | | `save` / `restore` | 2 / 2 |
| `stroke` / `line_to` | 9 / 9 | | `rotate` | 2 |
| `fill` / `close_path` | 8 / 8 | | `fill_rect` | 2 |
| `set_line_width` | 7 | | `set_stroke_style` / `set_font` / `set_fill_style` / `scale` / `fill_text` | 各 1 |
| `move_to` | 6 | | **合计** | **18 种** |

配合 `DESIGN-FEASIBILITY.md` §D1 的另一条实测（**无渐变 / 无阴影 / 无虚线 / 无贝塞尔 /
无 `globalAlpha` / 无 `measureText` / 无像素读回**），结论是：映射到 Skia **只需要**
path + fill + stroke + transform + text，不需要那些高级 API。

**编码**：op 是**短标签数组**（`["m", x, y]`），不是对象。六十四卦那一档实测：

| 层级 | op 数 | 紧凑数组 | 啰嗦对象 |
|---|---|---|---|
| 两仪 | 54 | 1.4 KB | — |
| 四象 | 151 | 4.2 KB | — |
| 八卦 | 446 | 13.5 KB | — |
| **六十四卦** | **5335** | **181.2 KB** | 260.8 KB（省 31%） |

这 181 KB 是**要整个进一个 prop** 的，所以短标签不是洁癖。

## 3. canvas → Skia 的四个语义坑（都是实测踩出来的）

前三条是 canvas 语义与 SVG/Skia 声明式树的错位，第四条是 canvas 的**可变状态**模型。

1. **整圆不能写一条 SVG 弧**。`arc(cx,cy,r,0,2π)` 是整圆，而 SVG 的 `A` 是两点之间的弧 ——
   起点终点相同 → **什么都不画**。罗盘每次画纬线和外圈都要 `arc(…,0,2π)`，所以必须拆成两段半圆。
   定位性证据（judge ⑥c）：同起终点的单条 `A` 包围盒宽 **0**，拆两段宽 **600**。
2. **没有当前点时，`arc()` 要自己补起点**。canvas 里 `arc()` 在无当前点时会新开一条子路径
   （≈ `moveTo(弧起点)`）。漏了这条，SVG 路径就**以 `A` 开头** —— 没有起点，Skia / 浏览器把起点当 `(0,0)`。
   **本文件第一版就漏了这条**，被全覆盖像素断言抓出来（见 §4.2）。
3. **有当前点但不在弧起点上时，要补一条直线**（canvas 的隐式连线语义）。罗盘每个扇区都自己算了起点，
   所以本样本不触发它 —— 但桥必须有，否则换个调用序就画出多余或缺失的边。
4. **`fill()` 不吃掉路径**：紧接着的 `stroke()` 描的是**同一条**路径。所以适配器要产出**两个**元素
   （同 `d`、各带一种 paint），而不是一个元素带两个属性。

变换的落地方式：canvas 的 `save/translate/rotate/scale/restore` 是**可变状态**，Skia 的元素树是**声明式**的。
桥的做法是把当前累积变换挂到**每个元素自己的 `transform` prop** 上（RN Skia 的绘制节点都接受 `transform`），
于是 `save/restore` 退化成"存/取快照"，树保持扁平。

## 4. 判据与证据（32 项，`node verify.mjs`）

### 4.1 七组

| 组 | 回答什么问题 | 项数 |
|---|---|---|
| ① 词汇表覆盖 | 实测的 18 个调用，契约里是不是都有？ | 3 |
| ② 载荷大小 | 塞进一个 prop 有多大？ | 2 |
| ③ 形状（stub） | ops → 元素树逐条对不对（含负例：不许静默） | 11 |
| ④ 真引擎出图 | 真 Skia 回放不崩、画出了东西 | 1 |
| ⑤ 像素对数据 | **384 个采样点**的颜色 == 由卦爻数据独立推出的颜色；圆外是纸色；外圈金线真的画出来了；径向逐像素 + 5 条环带边界 | 4 |
| ⑥ 证伪 | 上面的断言**抓不抓得住错** | 4 |
| ⑦ **跨语言对账** | MoonBit 编出来的载荷 ⇄ 宿主包的解码器/翻译器/真 Skia：条数、逐条数值、**逐字节**、**像素逐点** | 6 |

### 4.2 跨语言对账（第 ⑦ 组）：契约两端各一份实现

库侧编码器（MoonBit）与宿主侧解码器/翻译器（JS）是**两个实现** —— "两份实现就是等着漂"。
所以第 ⑦ 组让**同一段程序两边各写一遍**（`spike.mbt` ↔ `host/probe_program.mjs`，都由 yi 的真实图元组成），
然后：条数一致 → 逐条比 tag 与数值（容差 `1e-9`）→ 各自出图比像素。

结果：**57 条 op 逐条相同**、两边载荷**逐字节相同**、两份载荷出图 **40000 个像素 0 个不同**。

⚠️ 但判据用的是**语义比较（容差 1e-9）而不是文本相等**：契约是"JSON 数字"，不是"某一种数字写法"。
"逐字节相同"是这一轮**量出来的观察**（MoonBit 的 `Double::to_string` 与 JS 的 `JSON.stringify` 在样本上一致），
哪天某个值写法不同了，语义比较仍然绿 —— 那是对的，而文本对账会降级成"看一眼"而不是断言。

### 4.3 最重要的一条教训：**采样点的选择也是一种断言强度**

第一版 ⑤ 只采了 **18 个点**（6 扇区 × 3 环）—— **全中**。改成**全部 384 个点**（64 × 6）后立刻红了 10 个，
顺着查下去就是 §3 的第 2 条坑（`arc` 缺隐式起点）：**纬线圈被画到了错误的位置**，
恰好穿过某些扇区的环带，把那几个采样点染成金色。

**18 个点"全中"和 384 个点"全中"不是一回事。** 前者只证明"我挑的地方对"，后者才证明"没有系统性错位"。

### 4.4 证伪做了什么

| 诱饵 | 期望 | 实测 |
|---|---|---|
| 改一条爻码（扇区 7 ↔ 卦 25 无妄，初爻 1→0） | 那个采样点必须变色 | `(401,315)` 253,250,240 → 26,20,16 ✅ |
| 把 `arc` 的逆时针标志全部反过来 | 画面必须变 | 40.3 万个像素不同（77.7%）✅ |
| 同起终点的单条 `A` | 包围盒为空 | 宽 0（拆两段 = 600）✅ |

另外 ⑥ 特意加了一条**定位性检查**（`6a-pre`）：先断言"被翻的那一卦**确实**落在被采样的那个扇区里"。
第一版诱饵我按"扇区 7 = 卦 7"翻，翻错了卦 → 画面当然没变，而看起来像"断言抓不住错"。
**诱饵自己也要被验证** —— 否则你会把"测试写错了"误读成"实现是对的"。

## 5. 这个 spike **没有**证明什么（边界，别读成已验证）

1. **RN 原生侧的组件挂载没验**。这里回放的是**真 Skia 引擎**（CanvasKit），共享 path / paint / transform 语义；
   但 React 那一层（`<Canvas>` 组件挂载、reconciler、`transform` prop 的接受形状）**没跑过**。
   要验它得 `expo prebuild` + 重建 APK + 模拟器截图。
2. **Skia 会带进两个额外原生依赖**（`npm view @shopify/react-native-skia@2.12.0 peerDependencies` 实测）：

   ```
   react >=19 ✅（宿主是 19.2.3）   react-native >=0.78 ✅（宿主是 0.86.3）
   react-native-worklets >=0.7.0    ← 新增原生依赖
   react-native-reanimated >=4.0.0  ← 新增原生依赖
   ```

   这条**文档里没有**，而它正是 P3 当初挂的 Q1 风险（"如果成本失控，要重新评估状态模型与 RN 导航/手势库如何共存"）。
   另外它自带 `canvaskit-wasm@0.41.0`，所以 Web/本机这条路是现成的。
3. **手势（T3.4）与坐标换算（T3.5）没做**。罗盘现在只是"画出来"，还不能拖、不能点选。
4. **文字只验到元素形状，没验字形**。CanvasKit 是 wasm，没有系统字体管理器；本机是从系统字体目录里
   找到中文黑体（`msyh.ttc`）才画得出字的（`--keep` 的 PNG 里有中文标签）。
   找不到字体时这一步记 **SKIP**（不是 PASS）；几何判据的采样点全在 `r ≤ 300`，标签在 `r ≥ 303`，两者不重叠，
   所以文字是否渲染**不影响**几何判据。
5. **`scale` 没有被真实样本覆盖**（罗盘不用它），只有单测；D1 全项目统计里它出现 1 次。
6. **性能没有基线**。六十四卦是 838 个 Path 元素、5335 条 op；每帧重建这棵树在真机上多大代价，
   `D` 轨道整条未开始 → **没有判据可谈**。

## 6. 目录

| 文件 | 是什么 |
|---|---|
| `../canvas/`（库包） | **契约的库侧**：18 条指令 + `OpCtx` + `canvas()`，7 项 `moon test` |
| `npm/moobile-host/canvas-ops.js` | **契约的宿主侧**：词汇表 + 解码（形状校验）+ 指令→元素树翻译器 |
| `spike.mbt` | 对账探针：yi 的真实图元（`annulus_sector` / `ttext`）1:1 抄成指令 |
| `host/probe_program.mjs` | **镜像程序**：与 `spike.mbt` 是同一条规格的 JS 实现 |
| `host/compass.mjs` | **真实样本**：yi 的六十四卦色环 1:1 抄成 op 列表（逐段对应关系写在文件头） |
| `host/play.mjs` | 把元素树**真画出来**（CanvasKit），读回像素 |
| `host/verify.mjs` | **32 项**判据（六组 + 跨语言对账，含证伪诱饵） |
| `host/hexagrams.json` | 64 卦摘录（只取 序号/卦名/卦画 三列，出处写在文件里） |
| `docs/evidence/canvas-r1/*.png` | 四个层级的罗盘渲染结果（视觉证据） |

⚠️ **它不进 `tools/verify_all.sh`**：要 `node_modules`（`canvaskit-wasm`）。
定位与 `host-swap-spike` 一致：**需要本机资源，手动跑**。离线门那条链刻意不依赖浏览器/wasm 运行时。

## 7. 下一步（按依赖顺序）

1. ~~**库侧落地**~~ ✅ **已完成**：库包 `canvas/`（18 条指令 + `OpCtx` + `canvas()`，7 项测试）
   与宿主包两个入口（`canvas-ops` / `canvas-skia`）都在树里。
2. **原生验证**（下一个未知量）：`expo prebuild` → 重建 APK → `adb shell wm size` + 截图断言。
   ⚠️ prebuild 会把 Gradle 改回 9.3.1，之后**必须重跑** `bash tools/android_env_setup.sh`（T3.1 的坑）。
   要验的是三件本机验不了的事：`<Canvas>` 的**组件挂载**、`transform` prop 的接受形状、**文字字形**。
3. **手势**（T3.4）与**坐标换算**（T3.5）：注意 T3.4 的警告 ——
   **别去修 rabbita 的 `Mouse`**（RN 上它返零值），另开手势通道。
4. **性能**：六十四卦是 838 个 Path 元素、5335 条 op，每帧重建这棵树在真机上多大代价 ——
   而 `D` 轨道整条未开始，**现在没有判据**。

## 8. 这一轮的收尾状态

| 层 | 状态 |
|---|---|
| 设计（T3.2 欠的那份） | ✅ 定案：**不新开通道** |
| 库侧 `canvas/` | ✅ 18 条指令 + `OpCtx` + `canvas()`，`moon test` 7/7 |
| 宿主侧 | ✅ `canvas-ops`（纯翻译器）+ `canvas-skia`（React 桥，应用传入 Skia） |
| 绘制语义 | ✅ 真 Skia 出图 + 384 采样点对数据 + 3 个证伪 |
| 载荷契约 | ✅ 跨语言逐条对账，载荷**逐字节相同**、出图**像素逐点相同** |
| 真机 | ❌ **未验**（组件挂载 / 文字字形） |
| 手势、坐标换算 | ❌ 未做 |

---

## 9. 真机验证（Android，2026-10-01）

```bash
# 前置：模拟器在跑 + Metro 在跑 + 一台**带临时接线的** APK 已装（见下）
cd examples/apps/canvas-spike/host && node device_check.mjs
```

**结果：7 / 7 全过。**

| 判据 | 实测 |
|---|---|
| ① 挂载（界面 token） | `画布 ops=9`（库侧产出了指令、节点进了 React 树） |
| ② **真绘制**（截图像素） | 品红 **4016 px**（圆环）· 绿 **1600 px**（实心方块）—— 界面别处不用这两个色，所以"有它们"= "Skia 真的画了" |
| ③ 证伪（切到无画布那屏） | 品红 **0** · 绿 **0** |
| ④ 运行时 | logcat 无 JS 致命错误 |

顺带确认了 **Skia 原生库真的链上了**（logcat 里出现 `RNSkia: JniSkiaManager`）。

### 9.1 复现所需的"临时接线"（**画布是可选特性，不该进模板**）

`demo` 与模板是 **T1 锁步**的（模板是真源、demo 是它的产物），所以给 demo 加依赖会**直接让 T1 变红**。
本轮的处置是**临时接线 → 验证 → 回滚**，配方如下（4 处改动）：

```js
// ① host/package.json：npm install --no-audit @shopify/react-native-skia react-native-reanimated react-native-worklets
// ② host/App.js（★ 顺序要紧：registerLibrary 需要 MOBILE_HOST 已存在）
import { installHost, mountApp } from 'moobile-host';
import { registerSkiaCanvas } from 'moobile-host/canvas-skia';
import * as Skia from '@shopify/react-native-skia';
installHost();
registerSkiaCanvas({ skia: Skia });     // 不传 makeFont：探针里没有文字指令
export default mountApp(app, { registry });
// ③ examples/apps/todo-app/moon.pkg：import "XiLaiTL/moobile/canvas" @canvas
// ④ ui.mbt：加一个 canvas_probe()（画纸色底 + 品红整圆环 + 绿方块）+ 一行 `画布 ops=N` token
```

```bash
bash tools/build.sh                       # 编 MoonBit 产物进宿主
npx expo prebuild -p android --no-install
bash tools/android_env_setup.sh           # ★ prebuild 之后必跑（它会修 Gradle 版本 / ABI / 镜像 / local.properties）
NODE_OPTIONS=--preserve-symlinks ./gradlew assembleDebug -PreactNativeArchitectures=x86_64
```

⚠️ `NODE_OPTIONS=--preserve-symlinks` 是**本机特有**的一条：产物被联接到了 E:（D: 满），
不设它 RN 的 codegen 会报 "this and base files have different roots"。没有联接就不需要它。
完整来龙去脉（磁盘满 / 联接 / 命名规则 / 两个真 bug）见 `docs/FINDINGS.md` 的真机补记。

### 9.2 仍然**没有**验的

- **文字字形**：探针里**故意没有** `fill_text` 指令（否则必须给 `makeFont`）。所以"canvas 上画中文"
  这条路**没上过真机**。
- **手势**（T3.4）与 `devicePixelRatio` 换算（T3.5）：罗盘仍"画得出、拖不动"。
- **iOS**：仍无验证（口径见 `docs/STATUS.md` §2.2）。
- **性能**：真机上每帧重建这棵树多大代价 —— `D` 轨道未开始，**没有判据**。
