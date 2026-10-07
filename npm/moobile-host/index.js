// moobile-host —— moobile（MoonBit 跨端 UI）在 React Native / Expo 上的**宿主预设**。
//
// 这个文件现在是薄薄一层：**契约的装配都在 `core.js`**（平台无关），
// 这里只负责三件 RN 特有的事：
//   1. 组件表用 RN 的 6 个基础组件（`View` / `Text` / `Pressable` / `TextInput` / `ScrollView` / `Image`）；
//      ⚠️ `Image` 是 2026-10-07 加的（对标表 #10 图片）：`img` 在 `render.mbt` 的标签表里
//      映射到它，而**没登记的名字会在渲染时点名报错**（这正是那条约定的价值：不静默）。
//      ⚠️ 加一个键**不是**"顺手多放一个组件"：`Image` 在 RN 与 RNW 都是核心导出 ✓，
//      两端都认 `source={{uri}}` ✓ —— 这两条是它能进内置表的前提（别的标签要按这条自查）。
//   2. 后端地址的默认值按平台给（RN 里没有"同源"这回事）；
//   3. 平台名取自 `Platform.OS`。
//
// 为什么值得这么拆：`import 'react-native'` 一出现，这个包就只能给 RN 用 ——
// 而 `MOBILE_HOST` 契约本身跟 RN 没有任何关系。拆开之后，"antd + react-dom"
// 这类纯 Web 宿主可以只用 `moobile-host/core.js`，不必为了一个契约装一个平台。
//
// 契约版本比对、能力注册表、组件库注册（`registerLibrary`）都在 core 里 —— 见其说明。

import React, { useSyncExternalStore } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import {
  CONTRACT,
  checkContract,
  defaultScheduleFrame,
  defaultScheduleTask,
  detectPlatform,
  installCapabilities,
  installHostCore,
  isComponent,
  mountAppCore,
  mountRoot,
  registerLibrary,
} from './core.js';
// 平台替代物：浏览器 API 在 RN 上拿什么顶（`MOBILE_HOST.native`）。
// Web 宿主不装这个 —— 库侧问不到就回退 DOM，所以 Web 行为不受影响。
import { withNative } from './native-rn.js';
// 手势通道的默认实现：把内置组件包成"手势可用"的版本（契约见该文件头）。
// 默认装载是刻意的 —— 决策点 19 的"库优先"判据要求**零配置**。
import { withGestureComponents } from './gesture-rn.js';

export {
  CONTRACT,
  checkContract,
  installCapabilities,
  registerLibrary,
  isComponent,
  detectPlatform,
  mountRoot,
  React,
  useSyncExternalStore,
};

/**
 * 标签表的值域：`render.mbt` 的标签全部映射到这 6 个组件名上。
 * 少一个，对应标签就会在渲染时**点名报错**（`js_host_component`）。
 *
 * 注意这是**内置的 6 个**，不是全部：`MOBILE_HOST.components` 还装着
 * 各组件库的命名空间键（`antd:Button` 之类），那部分由 `registerLibrary` 写入。
 */
/**
 * **Web 上的 `Image`：真正的 `<img>` 元素**（2026-10-07，做站点图片那条通道时加的）。
 *
 * ## 为什么不直接用 `react-native-web` 的 `Image`（实测，不是偏好）
 *
 * RNW 的 `Image` 的结构是三层：根 `<div>` + 里面一层 **`position:absolute` 的背景图** + 一层
 * 视觉上藏起来的 `<img>`（无障碍用）。**根自己没有高度** ⇒ RN 的语义要求调用方给
 * `width` / `height`（RN 上不给尺寸本来也画不出来）。而站点正文里的图**尺寸是内容的事**
 * （`![alt](x.png)` 里根本不写尺寸）⇒ 实测结果是那一格排出来 **720×0**：
 * 宽占满一栏、**高为 0** ⇒ 页面上什么都看不见，而 DOM 里"图片元素在"、`naturalWidth` 也对
 * —— 判据只查"有没有图"的话，这条**会假绿**（这一格就是这么被抓出来的）。
 *
 * 真正的 `<img>` 没有这个问题：给 `src` 就有高度（浏览器按原图比例排），`alt` 也是原生的，
 * 顺带拿到懒加载 / 解码提示 / 右键另存 / 搜索引擎。而这些都是**站点**要的，RN 上一样都没有。
 *
 * ⚠️ **只换 web**：原生 RN 上没有 DOM ⇒ 那边仍然是 RN 的 `Image`（`Platform.OS !== 'web'`）。
 *    代价照写：**原生的 `img` 仍然需要调用方给尺寸**（RN 语义，不是本包的锅）——
 *    这条记在 `render.mbt` 标签表那一段与 FINDINGS 里，别读成"两端都自适应了"。
 */
const WebImage = (props) => {
  const { source, accessibilityLabel, resizeMode, children, ...rest } = props;
  // RN 的 `source` 有两种形状：`{uri}`（库侧 `src → source` 的改写结果）与裸字符串。
  const uri = typeof source === 'string' ? source : (source && source.uri) || undefined;
  // ⚠️ 这里**黑名单**而不是白名单：白名单会"安静地吃掉"我们不知道的键（比如库将来传的
  //    `data-*`、`loading`），而多传一个键在 `<img>` 上的代价只是浏览器忽略它。
  return React.createElement('img', {
    ...rest,
    src: uri,
    alt: props.alt ?? accessibilityLabel ?? '',
  });
};

export const COMPONENTS = {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  // web → 真 `<img>`；原生 → RN 的 `Image`（见上面 WebImage 的说明）
  Image: Platform.OS === 'web' ? WebImage : Image,
};

/**
 * 后端地址的默认值。
 *
 * RN 里没有"同源"这回事（`fetch('/todos')` 没有意义），所以地址必须由宿主给。
 * Android 模拟器里 `127.0.0.1` 指向模拟器自己，宿主机是 `10.0.2.2`；
 * 真机也可以改用 `adb reverse tcp:8787 tcp:8787`，那时两种写法都通。
 */
export const DEFAULT_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8787'
    : 'http://127.0.0.1:8787';

/**
 * 装 `globalThis.MOBILE_HOST`（RN 预设）。
 *
 * ⚠️ **必须在 MoonBit 侧构造应用之前调用** —— `mount` 会立刻求值并排队初始命令，
 * 那时宿主还没装好。`mountApp` 已经按这个顺序做了。
 *
 * `options.components` 会**并到内置 6 个之上**（而不是替换）—— 于是既可以覆盖
 * 基础组件，也可以只加组件库的键。
 */
export function installHost(options = {}) {
  const {
    components,
    apiBase,
    platform,
    scheduleTask,
    scheduleFrame,
    native,
    ...rest
  } = options;
  return installHostCore({
    react: React,
    // ★ 内置 6 个组件**默认包成"手势可用"的版本**（`gesture-rn.js`，PanResponder、零新依赖）。
    // 理由（决策点 19 的"库优先"判据第 2 条 = 零配置）：`@gesture.attrs(on_pan=…)` 挂到任意
    // 元素上就该直接有效，不该要求应用自己写 responder 胶水。
    // 没挂手势的元素行为**一字不变**（包装只在真有 `onPan`/`onTap` 时才去抢响应者）；
    // 包装出来的组件在模块级缓存里 —— 每次渲染新建会让 React 把子树卸载重挂。
    components: withGestureComponents({ ...COMPONENTS, ...(components || {}) }),
    // 平台替代物（`MOBILE_HOST.native`）—— 见 native-rn.js 与 vendor/rabbita/cmd/host_native.mbt
    native: withNative(native),
    // ⚠️ 用 `??` 而不是 `||`：**空串是合法值，意思是"同源"**。
    //    用 `||` 的话 `apiBase: ''` 会被当成"没给"，回退到 127.0.0.1:8787 ——
    //    而应用侧的相对路径（`/reader_data.json`）就永远打不到自己那个站点根上。
    //    实测症状：页面显示「加载失败」而 curl 同一个 URL 是 200，且**宿主没报任何错**。
    apiBase: apiBase ?? DEFAULT_API_BASE,
    platform: platform || Platform.OS,
    scheduleTask: scheduleTask || defaultScheduleTask,
    scheduleFrame: scheduleFrame || defaultScheduleFrame,
    ...rest,
  });
}

/**
 * 挂载一个 moobile 应用，返回 React 根组件。
 *
 * ```js
 * import { mountApp, registerLibrary } from 'moobile-host';
 * import { app } from './moobile.js';
 * import { registry } from './registry.generated.js';   // npx moobile-host regen 生成
 *
 * export default mountApp(app, { registry });
 * ```
 *
 * 要在挂载**之前**注册组件库（`registerLibrary` 需要 `MOBILE_HOST` 已存在，
 * 而 `mountApp` 里才装）—— 两种写法都行：
 * ```js
 * import { installHost, registerLibrary, mountApp } from 'moobile-host';
 * installHost();                       // 先装
 * registerLibrary({ namespace: 'antd', module: antd, platforms: ['web'] });
 * export default mountApp(app);        // mountApp 再装一次是幂等的（同参数）
 * ```
 */
export function mountApp(app, options = {}) {
  return mountAppCore(app, options, installHost);
}
