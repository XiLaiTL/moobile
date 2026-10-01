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
| 0.3.x（未发布） | 0.3.x（未发布） | **2** —— 加了 `events` / `wrapRoot` / `platform`，`components` 键空间开放 |

契约版本写在两边：`app.mbt` 的 `host_contract_version` 与 `core.js` 的 `CONTRACT`。
**改契约形状必须同时 +1**；不同代混用会在挂载时**同时报出两个版本号**。

## 发布（维护者）

本机默认 registry 是淘宝镜像（只读），**发布必须显式指向官方**：

```bash
npm publish --registry=https://registry.npmjs.org/     # package.json 里也写了 publishConfig
```
