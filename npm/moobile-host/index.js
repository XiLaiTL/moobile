// moobile-host —— moobile（MoonBit 跨端 UI）在 React Native / Expo 上的**宿主预设**。
//
// 这个文件现在是薄薄一层：**契约的装配都在 `core.js`**（平台无关），
// 这里只负责三件 RN 特有的事：
//   1. 组件表用 RN 的 5 个基础组件（`View` / `Text` / `Pressable` / `TextInput` / `ScrollView`）；
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
 * 标签表的值域：`render.mbt` 的 42 条标签全部映射到这 5 个组件名上。
 * 少一个，对应标签就会在渲染时**点名报错**（`js_host_component`）。
 *
 * 注意这是**内置的 5 个**，不是全部：`MOBILE_HOST.components` 还装着
 * 各组件库的命名空间键（`antd:Button` 之类），那部分由 `registerLibrary` 写入。
 */
export const COMPONENTS = { View, Text, Pressable, TextInput, ScrollView };

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
 * `options.components` 会**并到内置 5 个之上**（而不是替换）—— 于是既可以覆盖
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
    components: { ...COMPONENTS, ...(components || {}) },
    // 平台替代物（`MOBILE_HOST.native`）—— 见 native-rn.js 与 vendor/rabbita/cmd/host_native.mbt
    native: withNative(native),
    apiBase: apiBase || DEFAULT_API_BASE,
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
