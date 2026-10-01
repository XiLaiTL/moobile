// 宿主侧的**全部手写代码** —— 就这些。
//
// 契约实现（`MOBILE_HOST`、组件表、调度钩子、后端地址）、契约版本比对、
// 能力注册表的安装与核对，都在 `moobile-host` 包里。
//
// `moobile.js` 是 MoonBit 的构建产物，由 `npm run build` 生成（不用手写、不要提交）。
// `registry.generated.js` 由 `npx moobile-host regen` 从 package.json 的依赖生成 ——
// 加能力 = `npm install` 那个包 + 重跑 regen，不要手改。
// `libraries.generated.js` 由 `npx moobile-host libgen` 从组件库的类型定义生成 ——
// 接一个组件库 = 写 `libgen.config.json` + 跑 libgen，不要手改。
//
// ★ 2026-10-02：**组件库那段手写代码没有了**。以前这里是手写的 `registerLibrary` 调用，
//   里面套一层 `Markdown: ({ markdown, ...rest }) => createElement(Markdown, rest, …)`
//   适配器（把 prop 接回 `children`，因为我们的字符串子节点会被包成 `<Text>`）。
//   现在两件事都归生成器：
//     · 它认得 `PropsWithChildren<…>` 这种泛型包裹（洞一），所以 `children` 参数会生成；
//     · `children` 是**原始字符串**（`libgen.config.json` 的 `content` 声明，洞二），
//       于是内容走 `children` prop —— 它本来就是普通 prop，**不需要宿主适配层**。
//   接一个组件库现在就是"写 libgen.config.json + 跑一条命令"，宿主侧一行都不用写。
import { installHost, mountApp, registerLibrary } from 'moobile-host';
import { app } from './moobile.js';
import { registry } from './registry.generated.js';
import { registerMd } from './libraries.generated.js';

// ── 一个**现成的 RN 组件库**：markdown 渲染器 ──────────────────────────────────
//
// LLM 的回复基本都是 markdown，而"把 markdown 画成视图"不是我们该自己写的东西 ——
// 组件库接入机制就是为这件事准备的（与 antd 那条完全同一条路：命名空间 + 组件表）。
// MoonBit 侧写 `@md.markdown(merge_style=true, 文本)` 就落在下面这个组件上。
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
//
// `registerMd` 是生成物（`libraries.generated.js`）：它按 manifest 显式列出组件、
// JSON 通道与事件表。**名字两边同源**（MoonBit 侧 `@md.markdown` 与这里的注册表
// 出自同一份 `generated/md.manifest.json`），所以不存在"两边各写一份清单然后漂"。
installHost();
registerMd(registerLibrary);

export default mountApp(app, { registry });
