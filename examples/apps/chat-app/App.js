// 宿主侧的**全部手写代码** —— 就这些。
//
// 契约实现（`MOBILE_HOST`、组件表、调度钩子、后端地址）、契约版本比对、
// 能力注册表的安装与核对，都在 `moobile-host` 包里。
//
// `moobile.js` 是 MoonBit 的构建产物，由 `npm run build` 生成（不用手写、不要提交）。
// `registry.generated.js` 由 `npx moobile-host regen` 从 package.json 的依赖生成 ——
// 加能力 = `npm install` 那个包 + 重跑 regen，不要手改。
import { installHost, mountApp, registerLibrary } from 'moobile-host';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';
import React from 'react';
import Markdown from 'react-native-markdown-display';

// ── 一个**现成的 RN 组件库**：markdown 渲染器 ──────────────────────────────────
//
// LLM 的回复基本都是 markdown，而"把 markdown 画成视图"不是我们该自己写的东西 ——
// 组件库接入机制就是为这件事准备的（与 antd 那条完全同一条路：命名空间 + 组件表）。
// MoonBit 侧写 `@html.node("md:Markdown", attrs, 文本)` 就落在下面这个组件上。
//
// 为什么选 `react-native-markdown-display`：
//   · **纯 JS**（依赖只有 `markdown-it` / `css-to-react-native` 这些 JS 包）——
//     带原生模块的话，换一个组件库就要重建 APK；
//   · 它渲染的是 `react-native` 的原语（`View` / `Text`），所以**同一份代码在 RNW(web) 上
//     也是这套** —— 不需要为 web 换一个 markdown 实现。
//
// ⚠️ 它**不是**能力（不进 `registry.generated.js`）：能力是"装一个 npm 包 + regen"那条路
//    （本地库 / 网络…），而组件库走的是**宿主注册表**（`registerLibrary`）—— 两套机制。
//
// ⚠️ **顺序有讲究，实测踩过**：`registerLibrary` 要求 `MOBILE_HOST` **已经装好**，
//    而 `MOBILE_HOST` 是在 `mountApp` 里才装的。所以必须先显式 `installHost()` 一次
//    （`mountApp` 之后**还会再装一次**，那是幂等的合并），否则真机上直接抛：
//      `moobile-host: registerLibrary 必须在 installHost 之后调用（MOBILE_HOST 还没装）`
//    —— 而这在 web 上**未必**同时炸（打包/加载顺序不同），所以它属于"只在真机露头"的那一类。
installHost();
registerLibrary({
  namespace: 'md',
  // ⚠️ **这里必须有一个适配层，不能直接 `module: { Markdown }`** —— 2026-10-02 真机实测：
  //    我们的组件通道里，**字符串子节点会被包成 `<Text>`**（那是 RN 的规矩：裸字符串不能当
  //    `View` 的子节点，见 `render.mbt` 的 `render_node`）。于是 markdown 组件收到的是
  //    **一个 React 元素**而不是字符串，`markdown-it` 当场抛
  //        Error: Input data should be a String
  //    ——14 次/流的刷屏，而界面上只是"AI 那条空着"，看不出是这条。
  //
  //    所以：MoonBit 侧把文本走**prop**（`prop_str("markdown", …)`），宿主侧用这层适配成
  //    组件要的 `children`。这与 `jsonProps`（给结构化 prop 套解析器）是同一个手法：
  //    **形状对不上的组件，在宿主侧套一层**，而不是去改库的渲染规则。
  components: {
    Markdown: ({ markdown, ...rest }) =>
      React.createElement(Markdown, rest, markdown === undefined ? '' : String(markdown)),
  },
  platforms: ['android', 'ios', 'web'],
  quiet: true,
});

export default mountApp(app, { registry });
