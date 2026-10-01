// moobile-host/core —— `MOBILE_HOST` 契约的**平台无关**装配。
//
// 为什么把它从 `index.js` 里拆出来：`index.js` 直接 `import 'react-native'`，
// 于是"想在一个不是 RN 的宿主里跑 moobile"（例如 antd + react-dom 的 Web 宿主）
// 会被一个**平台包**卡住 —— 而契约本身与 RN 毫无关系（它只要求四样东西：
// React、组件表、两个调度钩子、后端地址）。拆开之后：
//
//   · 本文件只依赖 React；
//   · RN 的组件表留在 `index.js`，当作**一个预设**（`installHost`）。
//
// 契约版本见 `CONTRACT`，与 MoonBit 侧的 `@moobile.host_contract_version` 一一对应
// （`app.mbt`）。**改形状就必须两边同时 +1。**

import React, { useSyncExternalStore } from 'react';

/**
 * `MOBILE_HOST` 契约版本。
 *
 * 版本史：
 * - `1` —— 四件套：`react` / `components` / `scheduleTask` / `scheduleFrame`（+ `apiBase`）。
 * - `2` —— 组件库接入：`components` 允许命名空间键（`antd:Button`）、新增可选 `events`
 *   （事件 prop 名覆盖）、新增可选 `wrapRoot`（Provider 包裹）、新增 `platform`（平台闸门）。
 */
export const CONTRACT = 2;

/** React Native 里没有 window，也没有 rAF 的保证 —— 调度钩子由宿主给，这里给通用默认值。 */
export const defaultScheduleTask = (f) =>
  typeof queueMicrotask === 'function'
    ? queueMicrotask(f)
    : Promise.resolve().then(f);

export const defaultScheduleFrame = (f) =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(() => f())
    : setTimeout(f, 0);

/**
 * 没有显式声明时的平台推断。
 *
 * 为什么需要"平台"这个概念：同一个 MoonBit 视图，在 Android 上要用 RN 的组件、
 * 在 Web 上才可能用 antd —— 而**哪个库在哪个平台可用**是组件库自己的属性。
 * 于是让宿主声明平台、让库适配器声明它支持哪些平台，两边在 `registerLibrary` 里对账。
 */
export function detectPlatform() {
  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || ''))
    return 'android';
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || ''))
    return 'ios';
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return 'web';
  return 'unknown';
}

/**
 * 装 `globalThis.MOBILE_HOST`（平台无关版本）。
 *
 * ⚠️ **必须在 MoonBit 侧构造应用之前调用** —— `mount` 会立刻求值并排队初始命令，
 * 那时宿主还没装好。`mountAppCore` 已经按这个顺序做了。
 *
 * `components` 的键空间是**开放**的：既有内置的 5 个名字（View / Text / Pressable /
 * TextInput / ScrollView），也有命名空间的库组件（`antd:Button`）。
 * 前者由 `render.mbt` 的标签表映射，后者由标签**直通**（标签里带冒号）。
 */
export function installHostCore(options = {}) {
  const {
    react = React,
    components = {},
    events = {},
    apiBase = '',
    scheduleTask = defaultScheduleTask,
    scheduleFrame = defaultScheduleFrame,
    platform = detectPlatform(),
    // ★ `reset: true` —— **从一份干净的宿主开始**，不与已装的那份合并。
    //
    // 为什么需要它（真机之外的一条门逼出来的）：合并是**全局**的（见下面那段），
    // 于是"我想装一个**没有**事件覆盖的宿主"这件事**表达不出来** —— 上一次装进去的
    // `"*": { click: "onClick" }` 还在，测试却以为自己装的是空表。
    // 实测代价：`antd-spike` 的负例 (b)「不给事件覆盖时点 antd 按钮应当无效」一直是绿的 ——
    // 不是因为设计生效，而是因为它跑在前面那些用例**已经**把覆盖装进去了；
    // 而它之所以长期没被发现，是因为它的 `moobile-host` 副本是**陈旧的**（旧版是整体替换，
    // 天然干净）。副本一刷新，这条门立刻红。（两件事都记在 `docs/FINDINGS.md`。）
    //
    // 语义上它就该存在：**应用**要的是"重复调用别把已注册的冲掉"（下面那段），
    // **测试**要的是"每次从干净状态开始"。两个诉求方向相反，用一个开关分开才是诚实的。
    reset = false,
    ...rest
  } = options;
  // ⚠️ **幂等：已经装过就合并，不能把 `MOBILE_HOST` 整个换掉。**
  //
  // 为什么（实测出来的真 bug）：文档推荐的写法是
  //     installHost() → registerLibrary({…}) → mountApp(app)
  // 而 `mountApp` 内部会**再调一次** `installHost`。原来是 `globalThis.MOBILE_HOST = {…}`
  // —— 整个对象被替换，第一步注册的组件全丢，于是渲染到它时库侧报
  // "宿主没有注册组件 `moobile:Canvas`"。文档那句"mountApp 再装一次是幂等的（同参数）"
  // 与实现不符（`index.js` 的注释一直这么写）。
  // 生成路径（`mountApp(app, { registry })`）不受影响：它的注册发生在 install **之后** ——
  // 所以只有"手写 registerLibrary"这条路会踩，而 `canvas-skia` 正是手写的。
  const prev = reset ? null : globalThis.MOBILE_HOST;
  globalThis.MOBILE_HOST = {
    ...(prev || {}),
    react,
    components: { ...((prev && prev.components) || {}), ...components },
    events: { ...((prev && prev.events) || {}), ...events },
    apiBase,
    scheduleTask,
    scheduleFrame,
    platform,
    wrapRoot: prev && prev.wrapRoot ? [...prev.wrapRoot] : [],
    ...rest,
  };
  return globalThis.MOBILE_HOST;
}

/** 契约版本比对。不匹配就**说出两个版本号**，而不是让某个函数莫名其妙是 undefined。 */
export function checkContract(handles) {
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

// ── 组件库接入 ────────────────────────────────────────────────────────────────

/** 自动挑组件时**排除**的名字：它们是包的门面/工具，不是能放进视图的组件。 */
const NON_COMPONENT_EXPORTS = new Set([
  'default',
  'version',
  'install',
  'theme',
  'unstableSetRender',
]);

/**
 * 一个导出值"是不是能放进视图的 React 组件"。
 *
 * 判据刻意保守：**函数**（函数组件 / 类组件 / `forwardRef` 的产物）
 * 或**带 `$$typeof` 的对象**（`memo` / `forwardRef` / `lazy` / Context）。
 * 于是 `theme`（普通对象）、`version`（字符串）这类会被排除。
 */
export function isComponent(value) {
  if (typeof value === 'function') return true;
  return typeof value === 'object' && value !== null && value.$$typeof !== undefined;
}

/**
 * 结构化 prop 的适配器：把宿主收到的**字符串**解析回对象/数组再交给组件库。
 *
 * 为什么需要它：MoonBit 侧的 prop 值域只有 String / Bool / Int / Double
 * （`@html.Attrs::prop_str` 那一族），而 `Table` 的 `columns`、`Select` 的 `options`
 * 是结构化的。于是约定：**结构化的键用 `prop_json` 传 JSON 文本，由宿主解析**。
 *
 * 为什么"解析"这件事必须在宿主、并且要有白名单：只有宿主知道**哪个键**是结构化的
 * （`columns` 是，`title` 不是）—— 盲parse 会把真字符串（`title="[1,2]"`）吃掉。
 *
 * 适配器的身份在这一刻固定下来（每次注册只建一次），
 * 于是 React 的 diff 不会因为"每帧换了个组件类型"而整棵重挂 —— 见 `registerLibrary` 的说明。
 */
function jsonPropAdapter(namespace, name, Base, keys) {
  const parse = (key, raw) => {
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `moobile-host: ${namespace}:${name} 的 prop \`${key}\` 走的是 JSON 通道，` +
          `但收到的不是合法 JSON：${String(raw).slice(0, 80)}（${err.message}）`,
      );
    }
  };
  return function MoobileJsonPropsAdapter(props) {
    let out = props;
    for (const key of keys) {
      if (key in props) {
        if (out === props) out = { ...props };
        out[key] = parse(key, props[key]);
      }
    }
    return React.createElement(Base, out);
  };
}

/**
 * 注册一个 React 组件库，让它在 MoonBit 侧以 `库名:组件名` 的形式可用。
 *
 * ```js
 * import * as antd from 'antd';
 * registerLibrary({
 *   namespace: 'antd',
 *   module: antd,
 *   platforms: ['web'],                       // 平台闸门：不在 web 上就直接报错
 *   jsonProps: { Table: ['columns', 'dataSource'] },
 *   events: { click: 'onClick' },             // 该库的组件接受哪些事件 prop
 *   wrap: (el) => React.createElement(ConfigProvider, null, el),
 * });
 * ```
 *
 * 四件事都在这里做掉，因为它们是**同一个决定**的四个面（"这个库怎么接进来"）：
 * 1. **组件登记**：`MOBILE_HOST.components['<ns>:<Name>']`；
 * 2. **结构化 prop**：给需要 JSON 通道的组件套一层解析适配器；
 * 3. **事件名**：写进 `MOBILE_HOST.events['<ns>:*']`（库级通配，见 MoonBit 侧的三级优先）；
 * 4. **平台闸门 + Provider**：不支持当前平台就**在启动时抛**，而不是渲染成空白。
 *
 * ⚠️ 组件对象与适配器都**只在这里建一次**。若每次渲染重新注册，
 * React 会看到"类型变了"，把整棵子树卸载重挂 —— 组件库内部的 state / 动画会归零。
 *
 * @returns {string[]} 实际注册的组件名（便于启动日志与验证脚本断言）。
 */
/**
 * 从模块导出里取一个名字，**支持点号路径**（复合子组件）。
 *
 * 为什么需要它：React 组件库的层级结构一大半靠复合子组件表达 —— `Form.Item`、
 * `Layout.Header`、`Radio.Group`、`Input.TextArea`。它们在模块里是
 * `mod.Form.Item` 这样的**嵌套属性**，不是顶层导出；而 MoonBit 侧写的标签是
 * `"antd:Form.Item"`（一个字符串），所以注册表必须能按这个名字拿到组件对象。
 *
 * 取值顺序：
 *   1. 直接命中（`mod['Form.Item']` —— 万一某个库真有这么个导出名）；
 *   2. 按 `.` 逐段下钻（`mod.Form` → `.Item`）；
 *   3. **`viaDefault` 时从 `default` 上取**（见下）。
 * 取不到就返回 `undefined`，由调用方**点名报错**（不回落、不猜）。
 *
 * ## 第 3 条为什么存在（**类型定义会谎报导出**）
 *
 * `react-native-markdown-display` 的类型定义里写着 `export const Markdown: MarkdownStatic;`
 * 而它的 JS **只有** `export default Markdown;`（具名导出那一串里没有 `Markdown`）。
 * 于是"按类型定义生成的清单"与"运行时的模块命名空间"对不上：
 *
 *     moobile-host: registerLibrary("md") 里列了 `Markdown`，但模块里没有这个导出。
 *
 * ——这条是**真机上报出来的**（web/node 上 Metro 的 interop 恰好能看见具名导出，
 * 所以这条错只在 RN 上露头；类型定义骗的是所有人，不只是我们）。
 *
 * ⚠️ 为什么不自动回落：`default` 上盲取等于**猜**，而猜错是"注册了另一个组件"，
 *    症状比"启动即报错"坏得多。所以这个回落必须由人声明（`libgen.config.json` 的
 *    `defaultExports`）—— 与 `content`（children 是不是原始字符串）同一条规矩：
 *    **类型定义说不准的事，由人声明，声明错了就报错。**
 */
function resolveExport(mod, name, viaDefault = false) {
  if (!mod) return undefined;
  if (name in mod) return mod[name];
  if (viaDefault) {
    const d = mod.default;
    if (d === undefined || d === null) return undefined;
    const parts = name.split('.');
    // ① `default` 上真有这个名字 —— CJS 的 `module.exports = { Button, … }` 经 ESM interop 后
    //    就是这个形状（具名导出全挂在 `default` 上）。
    let cur = d;
    let hit = true;
    for (const part of parts) {
      const isObj = cur !== null && cur !== undefined && (typeof cur === 'object' || typeof cur === 'function');
      if (isObj && part in cur) cur = cur[part];
      else {
        hit = false;
        break;
      }
    }
    if (hit && cur !== undefined) return cur;
    // ② 声明说的是"**这个名字就是 default 导出**"（`export default Markdown` —— 它的名字
    //    不在自己身上，`Mod.Markdown` 永远是 undefined）。
    //    ⚠️ 只有单段名字能这么落：`Form.Item` 这种点号路径落到 default 本身没有意义，
    //    真出错时报错比乱绑一个组件好。
    if (parts.length === 1) return d;
    return undefined;
  }
  if (!name.includes('.')) return undefined;
  let cur = mod;
  for (const part of name.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function registerLibrary(spec) {
  const host = globalThis.MOBILE_HOST;
  if (!host) {
    throw new Error(
      'moobile-host: registerLibrary 必须在 installHost 之后调用（MOBILE_HOST 还没装）。',
    );
  }
  const {
    namespace,
    module: mod,
    components,
    jsonProps = {},
    events = {},
    // 「这个组件要从模块的 `default` 导出上取」（数组或映射都收）—— 由人来声明，
    // 因为**类型定义会谎报导出**（`Markdown` 就是：类型里写着具名导出，JS 只有 default）。
    // 详见 `resolveExport` 的说明：不自动回落，是因为盲取 `default` 是"猜"。
    defaultExports = [],
    platforms,
    wrap,
    quiet = false,
  } = spec;
  const viaDefault = new Set(
    Array.isArray(defaultExports) ? defaultExports : Object.keys(defaultExports || {}),
  );
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('moobile-host: registerLibrary 需要 namespace（例如 "antd"）。');
  }
  if (!mod && !components) {
    throw new Error(
      `moobile-host: registerLibrary("${namespace}") 既没给 module 也没给 components。`,
    );
  }
  if (platforms && !platforms.includes(host.platform)) {
    throw new Error(
      `moobile-host: 组件库 \`${namespace}\` 声明只在 [${platforms.join(', ')}] 上可用，` +
        `而当前平台是 \`${host.platform}\`。\n` +
        '  要么换一个支持该平台的实现（同一命名空间可以按平台注册不同的库），' +
        '要么把用到它的视图改成按平台分支。',
    );
  }

  // 挑组件。**两种形状都收** —— 这条是实测逼出来的：写手写组件的人（第一个就是
  // `canvas-skia.js` 里的 Skia 画布）必然传对象，而原来只认数组。
  //   · `components: ['Button', …]` + `module` → 按名字从模块里挑（`module` 的常规用法）；
  //   · `components: { Canvas: MyCanvas }`     → 直接给实现（**手写组件**的常规写法，
  //     不该逼使用者再包一层 `module: { Canvas: … }`）。
  // ⚠️ 只认数组时，传对象会走到 `for…of` 上，在 Hermes 里报的是
  //    `TypeError: iterator method is not callable` —— **完全看不出是"形状不对"**
  //    （实测：真机上第一次注册手写组件就撞上，栈里只有 registerLibrary）。
  let picked;
  if (components && !Array.isArray(components)) {
    if (typeof components !== 'object') {
      throw new Error(
        `moobile-host: registerLibrary("${namespace}") 的 \`components\` 形状不对（拿到 ${typeof components}）。\n` +
          "  两种合法形状：① 名字数组 + `module`；② 实现映射 `{ Button: MyButton }`。",
      );
    }
    picked = { ...components };
  } else if (components) {
    if (!mod) {
      throw new Error(
        `moobile-host: registerLibrary("${namespace}") 给的是**名字数组**（${JSON.stringify(components)}），` +
          "但没给 `module` —— 名字要从模块里挑，没有模块就没得挑。\n" +
          "  要么补 `module`，要么把 `components` 写成实现映射 `{ 名字: 组件 }`。",
      );
    }
    picked = {};
    for (const name of components) {
      const value = resolveExport(mod, name, viaDefault.has(name));
      if (value === undefined) {
        throw new Error(
          `moobile-host: registerLibrary("${namespace}") 里列了 \`${name}\`，但模块里没有这个导出。` +
            (name.includes('.')
              ? `\n  它是一个**复合子组件**（点号路径）：确认 \`${name.split('.')[0]}\` 上真的有 \`${name.split('.').slice(1).join('.')}\`。`
              : '') +
            `\n  另一种常见原因：**类型定义说有具名导出，而 JS 里只在 \`default\` 上** ——` +
            `\n  （实测：react-native-markdown-display 的 \`Markdown\` 就是这样）。确认之后在` +
            `\n  \`libgen.config.json\` 里写 \`"defaultExports": ["${name}"]\` 再重跑 libgen。`,
        );
      }
      picked[name] = value;
    }
  } else {
    picked = {};
    for (const [name, value] of Object.entries(mod)) {
      if (NON_COMPONENT_EXPORTS.has(name)) continue;
      if (!isComponent(value)) continue;
      picked[name] = value;
    }
  }

  const registered = [];
  for (const [name, Base] of Object.entries(picked)) {
    const keys = jsonProps[name];
    const key = `${namespace}:${name}`;
    host.components[key] = keys && keys.length ? jsonPropAdapter(namespace, name, Base, keys) : Base;
    registered.push(key);
  }

  if (Object.keys(events).length > 0) {
    const wildcard = `${namespace}:*`;
    host.events[wildcard] = { ...(host.events[wildcard] || {}), ...events };
  }

  if (typeof wrap === 'function') {
    host.wrapRoot.push(wrap);
  }

  if (!quiet && typeof console !== 'undefined') {
    console.log(
      `moobile-host: 组件库 \`${namespace}\` 注册了 ${registered.length} 个组件` +
        `（平台 ${host.platform}）${registered.length ? '：' + registered.slice(0, 8).join(', ') + (registered.length > 8 ? ', …' : '') : ''}`,
    );
  }
  return registered;
}

/**
 * 把句柄表包成一个 React 根组件（并在外面套上各库声明的 Provider）。
 *
 * DESIGN §4.3 的取舍：整个应用 == **一个根组件 + 一个订阅点**。
 * 每次重绘，MoonBit 侧已经把整棵树翻译成一个 React 元素。
 *
 * `wrapRoot` 里每一项的签名是 **`(element) => element`** —— 收到的是已经构造好的
 * 元素，返回包好的元素（`registerLibrary({ wrap })` 的约定与此相同）。
 */
export function mountRoot(handles) {
  function MoobileRoot() {
    useSyncExternalStore(handles.subscribe, handles.snapshot);
    return handles.element();
  }
  let Root = MoobileRoot;
  for (const wrap of globalThis.MOBILE_HOST.wrapRoot || []) {
    const Inner = Root;
    Root = function MoobileRootWrapped() {
      return wrap(React.createElement(Inner));
    };
  }
  Root.handles = handles;
  return Root;
}

/**
 * 完整挂载序列（**与组件表无关**的那一半）：
 * 装宿主 → 构造应用 → 比对契约 → 装能力 → 抽干首帧 → 包成根组件。
 *
 * `install` 由调用方给：`index.js` 给的是 RN 预设，DOM 宿主给的是自己的组件表。
 */
export function mountAppCore(app, options = {}, install = installHostCore) {
  const { registry, ...hostOptions } = options;
  install(hostOptions);
  // ⚠️ 顺序：先装 MOBILE_HOST，再构造应用。
  const handles = app();
  checkContract(handles);
  installCapabilities(registry);
  handles.start();

  // 调试/测试钩子：句柄表挂到全局，验证脚本可以拿它做诊断
  // （`unsupported` / `unmapped` 是库侧的诊断计数）。**不是稳定 API。**
  globalThis.__moobileApp = handles;

  return mountRoot(handles);
}

export { React, useSyncExternalStore };
