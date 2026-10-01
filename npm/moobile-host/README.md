# moobile-host

[moobile](https://github.com/XiLaiTL/moobile)（用 MoonBit 写 UI、交给 React Native 渲染）在
**React Native / Expo** 上的宿主。

它只做四件事：

1. 装 `globalThis.MOBILE_HOST`（React、基础组件表、事件表、两个调度钩子、后端地址、平台名）；
2. **契约版本比对** —— 库与宿主各自声明自己实现的契约版本，不等就当场报错并说出两个版本号；
3. 装**能力注册表**（本地数据库等），并核对每一项真的装上了；
4. **注册组件库**（`registerLibrary`）—— 让第三方 React 库的组件在 MoonBit 里以
   `antd:Button` 这种命名空间标签可用。

## 两个入口：核心与预设

| 入口 | 依赖 | 给谁用 |
|---|---|---|
| `moobile-host` | 需要 `react-native` | RN / Expo 应用（`installHost` 的组件表就是 RN 的 5 个基础组件） |
| `moobile-host/core.js` | **只需要 `react`** | 任何其它宿主（纯 Web/react-dom、自定义渲染器…）—— 契约与 RN 无关 |

`react-native` 与 `react-dom` 都是**可选** peer：只用 `core.js` 的话不必为了一个契约装一个平台。

## 用法

```js
// App.js —— 整个宿主侧就这几行
import { mountApp } from 'moobile-host';
import { app } from './moobile.js';            // MoonBit 侧编译产物
import { registry } from './registry.generated.js';

export default mountApp(app, { registry });
```

MoonBit 侧只需要一个导出：

```moonbit
pub fn app() -> @moobile.JsValue {
  @moobile.handlers_with_init(init=init_app, update~, view~)   // 或 handlers(...)
}
```

## 生成一个项目（`moobile-host init`）

```bash
npx moobile-host init my-app
cd my-app && npm install && npm run web
```

拷模板 → 按应用名做**纯字符串替换**（没有模板语言）→ **断言"名字替换干净"**：
残留（含 `moobile_template` 这类派生写法）或锚点不对（`moon.mod` / `package.json` /
`app.json` 里的名字不是请求的那个）就**一个文件都不写** —— 半个项目比报错更难查。

| 参数 | 说明 |
|---|---|
| `--name <应用名>` | 目录名与包名不同时用；只允许小写字母 / 数字 / 连字符 |
| `--force` | 目标目录非空时也往里写（只覆盖同名文件） |
| `--dry-run` | 只列出将要写哪些文件、替换成什么，不落盘 |

模板的真源是仓库的 `examples/apps/template/`；发布时 `publish.sh` 会按发布规矩把它拷进包里
（`init` 跑在别人的机器上，模板必须随包走）。

## 把 MoonBit 产物搬进宿主目录（`moobile-host build`）

```bash
moon build --target js && npx moobile-host build     # 生成出来的项目里，`npm run build` 就是这两步
```

**为什么不能写成一句 `cp`**（实测，2026-09）：产物路径**不是模块名的函数，而是模块在构建根里
身份的函数** —— 工作区成员是 `_build/js/<profile>/build/<作者>/<模块>/<模块>.js`，
独立模块（空目录里 `moon new`）是平铺的 `_build/js/<profile>/build/<模块>.js`。
写死任何一条，都会在"仓库里能跑"与"用户机器上能跑"之间错一边。

所以这条命令**发现**产物：先按预测路径找，不中就在构建根里按文件名扫；
**匹配到多个就报错并列出候选**（歧义是要人看一眼的信号，不是可以猜的）。

`--release` / `--out <文件>` / `--module <名字>` / `--print-path` 见 `--help`。

## 子命令面（冻结）

| 子命令 | 做什么 | 状态 |
|---|---|---|
| `init` | 从模板生成一个项目 | ✅ |
| `build` | 把 MoonBit 产物搬进宿主目录 | ✅ |
| `regen` | 从依赖生成能力注册表 | ✅ |
| `libgen` | 组件库生成（manifest + MoonBit DSL + 宿主注册） | ✅ 见下一节 |
| `doctor` | 环境自检（缺什么直接说装什么） | ⏳ 名字已冻结 |
| `upgrade` | 读 `moon.mod` + `package.json` 列出要改的版本 | ⏳ 名字已冻结 |

名字冻结的理由：这个 CLI 是**共同战场**（脚手架与组件库生成器都要往里加命令），
先定名字与产物路径，两边就不会各写一半。

## 生成组件库的清单与包装（`moobile-host libgen`）

```bash
cd host && npx moobile-host libgen          # 生成
cd host && npx moobile-host libgen --check  # 只校验（进 CI：生成物被手改就红）
```

它读应用**装好的**组件库（`node_modules/<lib>/**/*.d.ts`），一条流水线出三份产物：

```
① generated/<ns>.manifest.json   组件 → prop 名 + 类别（入库、可 diff、可手改兜底）
② host/libraries.generated.js    registerLibrary(...) 的调用（components / jsonProps / events / wrap / platforms）
③ <ns>/components.generated.mbt  MoonBit DSL 包（`@antd.button(type_="primary", danger=true, on_click=…, "加一条")`）
```

**三份同源于一份 manifest** —— 宿主侧认的名字与 MoonBit 侧发的标签因此不可能对不上，
而 `--check` 就是这件事的判据（任一侧被手改都会红）。产物路径与其余选项写在应用根的
`libgen.config.json` 里（路径**相对该文件**，不必管命令是在哪一层跑的）。

**为什么这个工具住在 npm 包里**：它的输入是 `.d.ts` 与 `node_modules`，只有 Node 侧拿得到。
**它刻意不起 TypeScript**：浅解析（花括号配对 + 小解析器）在 antd 6.6.4 上能覆盖
71 个组件 / 9317 个 prop，~~0.6s~~ 半秒左右跑完；解不开的会在报告里**逐条点名**，不是静默丢。

示例（真跑起来的）：[`examples/apps/antd-demo/`](../../examples/apps/antd-demo/) ——
用生成的 DSL 把 antd 的 71 个组件全渲染出来，24 条判据。

## 接入一个 React 组件库（契约 ≥ 2）

```js
import { installHost, registerLibrary, mountApp } from 'moobile-host';
import * as antd from 'antd';

installHost();                     // registerLibrary 需要 MOBILE_HOST 已存在
registerLibrary({
  namespace: 'antd',
  module: antd,                                     // 自动挑出组件导出（antd 6.6.4 → 71 个）
  platforms: ['web'],                               // 平台闸门：不匹配**在启动时**报错
  jsonProps: { Table: ['columns', 'dataSource'] },  // 结构化 prop：宿主 JSON.parse 后交给组件
  events: { click: 'onClick' },                     // 事件落点（写进 events['antd:*']）
  wrap: (el) => React.createElement(antd.ConfigProvider, null, el),   // Provider 包裹
});
export default mountApp(app);
```

MoonBit 侧就是普通标签，只是名字带命名空间：

```moonbit
@html.node("antd:Button", @html.Attrs::build()
  .prop_str("type", "primary")                       // 任意 prop（HTML 里没有的名字也能写）
  .prop_json("columns", columns_json)                // 结构化值：JSON 文本
  .on_click(_ => emit(Bump)), "加一条")
```

三个设计要点（详见
[`docs/design/DESIGN-COMPONENT-LIBRARY.md`](https://github.com/XiLaiTL/moobile/blob/main/docs/design/DESIGN-COMPONENT-LIBRARY.md)）：

- **名字写错 / 库没装 → 启动时点名报错**（列出已注册的名字），不会静默渲染成空盒子；
- **事件落点是宿主的责任**：`click` 在 RN 基础组件上是 `onPress`、在 antd 上是 `onClick`
  —— 只有拿着组件对象的宿主知道，所以别指望"默认就能通"；
- **组件与适配器只注册一次**：每次渲染重新注册会让 React 认为"类型变了"，
  整棵子树卸载重挂，组件库内部的 state / 动画会归零。

⚠️ **未做**：事件**载荷**还是不透明的（`onChange` 能触发，但取不到用户输入的值），
所以受控组件暂时用不了 —— 见设计稿 §5 T1。

## 画布（`<canvas>` 的平台替代物，Skia）

`render.mbt` 的标签表**明确排除** `canvas`（RN 没有它）。库侧的做法不是"新开一条通道"，
而是把绘制指令说成一段 JSON，走**上面那条组件通道**；宿主这边把指令翻成 Skia 元素树。

```js
import * as Skia from '@shopify/react-native-skia';   // ← 应用自己装（见下）
import { installHost, mountApp } from 'moobile-host';
import { registerSkiaCanvas } from 'moobile-host/canvas-skia';

installHost();
registerSkiaCanvas({ skia: Skia });        // 注册 moobile:Canvas（默认 platforms: android/ios）
export default mountApp(app);
```

```moonbit
let ctx = @canvas.OpCtx::new()
ctx.set_fill_style("#f6efe0")
ctx.fill_rect(0.0, 0.0, 720.0, 720.0)
ctx.set_stroke_style("#b8902f")
ctx.set_line_width(2.5)
ctx.begin_path()
ctx.arc(360.0, 360.0, 300.0, 0.0, 2.0 * @math.pi)   // 整圆：宿主会拆成两段 SVG 弧
ctx.stroke()
@canvas.canvas(ctx.take(), 720.0, 720.0)
```

四条要知道的事：

1. **绘制指令是 18 条有界词汇**，与 canvas 的 18 个调用一一对应（`begin_path` / `move_to` /
   `line_to` / `arc` / `close_path` / `fill` / `stroke` / `fill_rect` / `set_line_width` /
   `set_fill_style` / `set_stroke_style` / `set_font` / `fill_text` / `save` / `restore` /
   `translate` / `rotate` / `scale`）。`OpCtx` 的方法名与 DOM 的 `CanvasRenderingContext2D`
   **逐字相同** —— 所以把既有 canvas 代码迁过来是**换一个类型**，函数体不用动。
2. **宿主包不依赖 Skia**。它带 `reanimated` + `worklets` 两个**原生依赖**，装不装是应用的决定；
   所以是应用 `import` 进来传给 `registerSkiaCanvas`。`moobile-host` 只提供翻译器
   （`moobile-host/canvas-ops`，纯函数，也能单独拿来用）。
3. **文字要字体**：RN Skia 的 `<Text>` 需要一个 `SkFont`，而"用哪个字体"是应用的资源决定，
   宿主不替你猜 → 传 `makeFont`，不传而指令里又有文字就**当场抛**（不静默跳过文字）。
4. **平台闸门默认是 `['android','ios']`**（与 `registerLibrary` 的默认 `['web']` 相反）——
   Skia 只跑原生。Web 上要同样的画面走 CanvasKit，那是另一条注册（`platforms: ['web']`）。

判据与已知边界（**真机上的组件挂载还没验**）见
[`examples/apps/canvas-spike/`](https://github.com/XiLaiTL/moobile/tree/main/examples/apps/canvas-spike)。

### 两个容易踩的形状（2026-10 实测补）

**① `installHost()` 是幂等的** —— 已经装过再装一次会**合并**，不会把之前注册的组件冲掉。
所以「先装 → 注册组件库 → 再 `mountApp`」这条顺序是安全的：

```js
installHost();
registerLibrary({ namespace: 'antd', module: antd, platforms: ['web'] });
export default mountApp(app);          // 内部还会再装一次，注册保留
```

（在这之前它其实**不**幂等：实现把 `MOBILE_HOST` 整个换掉，手动注册的组件全丢，
渲染到它时报「宿主没有注册组件 `X`」。生成路径 `mountApp(app, { registry })` 一直没有这个问题，
因为它注册发生在 install 之后 —— 所以这个坑只在**手写 `registerLibrary`** 时出现。）

**② `components` 收两种形状**：

| 写法 | 含义 |
|---|---|
| `components: ['Button', 'Table']` + `module` | 按**名字**从模块里挑（常规用法） |
| `components: { Canvas: MyCanvas }` | 直接给**实现**（**手写组件**的写法，例如把 Skia 画布接进来） |

形状真不对时，报错会说清两种合法写法 —— 而不是丢一个 `iterator method is not callable`。

## 手势（挂在任意元素上的拖动 / 点按）

**零配置**：`installHost()`（RN 预设）会把 5 个内置组件包成"手势可用"的版本，
所以应用侧 `@gesture.attrs(on_pan=…)` 直接就有效，**不用装任何东西、不用注册**。
（画布那条通道相反 —— Skia 是应用自己的依赖，必须显式 `registerSkiaCanvas`。）

契约是**库侧**定义的（`gesture/gesture.mbt`），宿主只负责把它兑现出来：

| 字段 | 语义 |
|---|---|
| `x` / `y` | **元素内**坐标 —— 相对**挂手势的那个元素** |
| `dx` / `dy` | **从按下那一刻起算**的位移（不是谁的 `translationX`） |
| `ax` / `ay` | 页面/窗口坐标（RN 的 `pageX/pageY`） |
| `phase` | `start` / `move` / `end` / `cancel` |
| `pointers` | 手指数（**诚实报数**，多指时是 2、3……） |

不变量：`start` 恰一次且在最先（`end`/`cancel` 恰一次且在最后、互斥）、
起点 `dx/dy` 恒为 0、**整条手势在同一个参照系里**。

⚠️ 最后那条是**宿主侧做了归一化才成立**的，别以为它是白来的：

- **原生**的 `locationX/locationY` 是"**手指底下最深那个 view**"的局部坐标，而且**会中途换**
  （实测从子元素上按下：`x` 序列 `[6, 7, 79, 89, …]` —— 头两个是那个文字自身的坐标系）。
  所以原生侧**自己量元素原点**（`measure` 的 `pageX/pageY`），用 `pageX/pageY − 原点` 算 `x/y`。
- **web** 反而**不能**这么改：RNW 的 `measure` 给的是**视口**坐标、触摸的 `pageX/pageY` 是
  **文档**坐标，页面一滚两者就不同源。所以 web 保持用 RNW 的 `locationX/locationY`（它本来就对）。

**谁能让步**（同一条策略的两处体现，Android 上**两处都要**）：
挂了 `on_pan` 的元素 → **不让**别人半途抢走（`onPanResponderTerminationRequest: false`
+ `onShouldBlockNativeResponder: true`）；只挂 `on_tap` → **让**（可点元素必须把滚动让给外层
`ScrollView`，否则列表里放一个可点行就把滚动锁死了）。

判据：web `examples/apps/gesture-spike/`（40 项，含边界）、真机 `examples/apps/gesture-edges/`（18 项）。
**两端都要跑** —— 上面那条"原生参照系"的坑在 web 上完全看不见。

## 能力注册表（`registry.generated.js`）

不要手写它，**从依赖生成**：

```bash
npx moobile-host regen          # 读 package.json，写 registry.generated.js
npx moobile-host regen --check  # CI 用：不一致就非零退出
```

加能力 = `npm install` 那个包 + 重跑 `regen`。生成物是**静态 import**（Metro 不能靠运行时
拼字符串 import），并在注释里列出"识别了什么、哪些没装"。

运行时还会再核对一遍：注册表里声明了 `db`，但 `MOBILE_HOST.db` 装完是空的 →
报错会点名 `db` 与提供它的 `expo-sqlite`，而不是让你对着
`Cannot read properties of undefined` 猜。

## 后端地址

RN 里没有"同源"这回事，`fetch('/todos')` 没有意义：地址由宿主给（`MOBILE_HOST.apiBase`），
默认 Android 走 `http://10.0.2.2:8787`、其余走 `http://127.0.0.1:8787`。
真机可以改用 `adb reverse tcp:8787 tcp:8787`。

## 兼容性

| moobile（MoonBit 包） | moobile-host | MOBILE_HOST 契约 |
|---|---|---|
| 0.2.x | 0.2.x | 1 |
| 0.3.x（**已发布** 2026-10-01） | 0.3.x（**已发布**） | **2** —— 加了 `events` / `wrapRoot` / `platform`，`components` 键空间开放 |

⚠️ **两个包必须同代升**：只升一边会在挂载时**同时报出两个契约版本号**（下面那句就是它的行为）。

契约版本写在两边：`app.mbt` 的 `host_contract_version` 与 `core.js` 的 `CONTRACT`。
**改契约形状必须同时 +1**；不同代混用会在挂载时**同时报出两个版本号**。

## 发布（维护者）

本机默认 registry 是淘宝镜像（只读），**发布必须显式指向官方**：

```bash
npm publish --registry=https://registry.npmjs.org/     # package.json 里也写了 publishConfig
```
