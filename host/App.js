import React, { useSyncExternalStore } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';

import * as Bridge from './moobile.js';

// React Native 里没有 window，更没有 rAF 的保证 —— 调度钩子由宿主提供。
const scheduleTask = (f) =>
  typeof queueMicrotask === 'function'
    ? queueMicrotask(f)
    : Promise.resolve().then(f);

const scheduleFrame = (f) =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => f())
    : setTimeout(f, 0);

// 宿主把 React、组件表和调度钩子注册给 moobile。
//
// 分工：MoonBit 决定"哪个 HTML 标签 → 哪个组件名"（moobile/render.mbt 的 map_tag），
// 这里只负责"那个名字对应哪个对象"。
globalThis.MOBILE_HOST = {
  react: React,
  components: { View, Text, Pressable, TextInput, ScrollView },
  scheduleTask,
  scheduleFrame,
};

// 暴露给验证脚本：不可移植节点（Children::RawHtml）的计数。
globalThis.__moobileUnsupported = Bridge.demo_unsupported;
globalThis.__moobileUnmapped = Bridge.demo_unmapped;
globalThis.__moobileUnmappedNames = Bridge.demo_unmapped_names;
globalThis.__moobileSnapshot = Bridge.demo_snapshot;
globalThis.__moobileElement = Bridge.demo_element;

// 挂载 + 同步画出首帧。
//
// 注意：**rabbita 自己的运行时在这里跑** —— 命令队列、微任务抽干、Emit/Cmd、
// 订阅、异步 effect 都是 rabbita 的实现（`internal/runtime/react_host.mbt`
// 只是把最后一跳从 `document.update` 换成"产出 VNode 交给 React"）。
// moobile 不重写 TEA，它只换挂载层。
Bridge.demo_start();

// DESIGN §4.3 的取舍：整个应用 == 一个根组件 + 一个订阅点。
// 每次重绘，MoonBit 侧已经把整棵树翻译成一个 React 元素。
export default function App() {
  useSyncExternalStore(Bridge.demo_subscribe, Bridge.demo_snapshot);
  return Bridge.demo_element();
}
