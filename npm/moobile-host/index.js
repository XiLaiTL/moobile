// moobile-host —— moobile（MoonBit 跨端 UI）在 React Native / Expo 上的**宿主**。
//
// 这个文件承担三件事，也是这个包存在的全部理由：
//   1. 把 `MOBILE_HOST` 的四个基本成员装好（React / 组件表 / 两个调度钩子）；
//   2. **契约版本比对**：库与宿主各自声明自己实现的契约版本，不等就当场报错；
//   3. 装**能力注册表**（`registry.generated.js`，由 `moobile-host regen` 从依赖生成）。
//
// 为什么宿主是一个 npm 包而不是抄进项目里：宿主是给 JS/RN 开发者用的，
// `npm install` 本来就是他们的动作；可独立版本化、进 lockfile、被 Metro 原生解析。
// 详见 `PLAN.md` §3.7（H1 / H6 / H7）。

import React, { useSyncExternalStore } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';

/**
 * `MOBILE_HOST` 契约版本。**改契约形状就必须 +1**，库侧同名的常量是
 * `@moobile.host_contract_version`（`app.mbt`）。
 */
export const CONTRACT = 1;

/**
 * 标签表的值域：`render.mbt` 的 42 条标签全部映射到这 5 个组件名上。
 * 少一个，对应标签就会变成 `undefined`。
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

/** React Native 里没有 window，也没有 rAF 的保证 —— 调度钩子由宿主提供。 */
const scheduleTask = (f) =>
  typeof queueMicrotask === 'function'
    ? queueMicrotask(f)
    : Promise.resolve().then(f);

const scheduleFrame = (f) =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => f())
    : setTimeout(f, 0);

/**
 * 装 `globalThis.MOBILE_HOST`。
 *
 * ⚠️ **必须在 MoonBit 侧构造应用之前调用** —— `mount` 会立刻求值并排队初始命令，
 * 那时宿主还没装好。`mountApp` 已经按这个顺序做了。
 */
export function installHost(options = {}) {
  const extra = options.components || {};
  globalThis.MOBILE_HOST = {
    react: React,
    components: { ...COMPONENTS, ...extra },
    apiBase: options.apiBase || DEFAULT_API_BASE,
    scheduleTask,
    scheduleFrame,
  };
  return globalThis.MOBILE_HOST;
}

/**
 * 契约版本比对。不匹配就**说出两个版本号**，而不是让某个函数莫名其妙是 undefined。
 */
function checkContract(handles) {
  if (typeof handles !== 'object' || handles === null) {
    throw new Error(
      'moobile-host: 应用入口没有返回句柄表。应当写成 `export function app() { return @moobile.handlers(...) }`。',
    );
  }
  if (handles.contract !== CONTRACT) {
    throw new Error(
      `moobile-host: 契约版本不匹配 —— 库=${handles.contract}，宿主=${CONTRACT}。` +
        '请把 moobile-host 与 MoonBit 包（XiLaiTL/moobile）升到同一代。',
    );
  }
}

/**
 * 装能力注册表，并**核对每个声明了的能力真的装上了**。
 *
 * 注册表的每一项形如：
 * ```js
 * { name: 'db', provider: 'expo-sqlite', install: installDb }
 * ```
 * 核对失败会点名：能力名 + 提供它的包 —— 于是"缺能力"从
 * `Cannot read properties of undefined` 变成一句能照着做的话。
 */
export function installCapabilities(registry = []) {
  const installed = [];
  for (const cap of registry) {
    if (typeof cap.install === 'function') {
      cap.install({ apiBase: globalThis.MOBILE_HOST.apiBase });
    }
    const value = globalThis.MOBILE_HOST[cap.name];
    if (value === undefined || value === null) {
      throw new Error(
        `moobile-host: 能力 \`${cap.name}\` 声明由 \`${cap.provider}\` 提供，但安装后 ` +
          `MOBILE_HOST.${cap.name} 仍然是空的。检查那个包是否真的装了、以及 install 是否抛错。`,
      );
    }
    installed.push(cap.name);
  }
  return installed;
}

/**
 * 挂载一个 moobile 应用，返回 React 根组件。
 *
 * ```js
 * import { mountApp } from 'moobile-host';
 * import { app } from './moobile.js';
 * import { registry } from './registry.generated.js';   // npx moobile-host regen 生成
 *
 * export default mountApp(app, { registry });
 * ```
 *
 * 没有能力依赖的应用可以省掉 registry：`mountApp(app)`。
 */
export function mountApp(app, options = {}) {
  installHost(options);
  // ⚠️ 顺序：先装 MOBILE_HOST，再构造应用（见 installHost 的注释）。
  const handles = app();
  checkContract(handles);
  installCapabilities(options.registry);
  handles.start();

  // 调试/测试钩子：句柄表挂到全局，验证脚本可以拿它做诊断
  // （`unsupported` / `unmapped` 是库侧的诊断计数）。**不是稳定 API。**
  globalThis.__moobileApp = handles;

  // DESIGN §4.3 的取舍：整个应用 == 一个根组件 + 一个订阅点。
  // 每次重绘，MoonBit 侧已经把整棵树翻译成一个 React 元素。
  function MoobileRoot() {
    useSyncExternalStore(handles.subscribe, handles.snapshot);
    return handles.element();
  }
  MoobileRoot.handles = handles;
  return MoobileRoot;
}

export { React, useSyncExternalStore };
