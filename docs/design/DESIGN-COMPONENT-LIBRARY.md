# DESIGN-COMPONENT-LIBRARY —— 让第三方 React 组件库成为一等公民

> **状态：🟡 机制已落地 + 端到端跑通；三项能力未做（见 §5）。**
>
> - ✅ 库侧改造 + 宿主包拆分 + `registerLibrary` 已落地；
> - ✅ **端到端证据**：antd 6.6.4 跑通，`20/20`（`examples/apps/antd-spike/host/verify.mjs`）；
> - 🟡 未做：事件**载荷**提取（受控组件回填）、结构化 prop 的**类型化**、浏览器/真机实测；
> - ❌ 不做：把第三方组件名直接塞进 `render.mbt` 的 42 条标签表（理由见 §1.2）。

相关：`README.md`（能力边界）· [`../ARCHITECTURE.md`](../ARCHITECTURE.md)（分层与契约）· [`../FINDINGS.md`](../FINDINGS.md)（实测记录）· [`../../FORK.md`](../../FORK.md)（vendor 改动）

---

## 0. 一页结论

| 问题 | 答案 |
|---|---|
| 能不能接第三方 React 组件库？ | **能，而且不需要动渲染架构** —— 因为我们本来就是把最后一跳交给 React（`createElement` 的 `tag` 参数就是一个**组件对象**，不是 RN 的内置名字） |
| 卡在哪？ | 三处**窄通道**：标签表是封闭的（组件名出不去）、`Attrs` 只有 HTML 属性名（组件库的 props 进不来）、事件名映射写死在 MoonBit（落点错了不会有人告诉你） |
| 改动量 | 库本体 ~120 行（`render.mbt` / `host.mbt` / `app.mbt` / vendor 一个文件）+ 宿主包一次拆分；**没有新依赖** |
| 代价是什么？ | 三条已知缺口：结构化 prop 走 JSON 文本（非类型化）、事件载荷还是不透明的、每个库要在宿主侧写一行适配器声明 |
| 证据在哪？ | `node examples/apps/antd-spike/host/verify.mjs` → `20/20 通过`（离线，无浏览器/无 Metro） |
| 契约变化 | `MOBILE_HOST` 契约 `1 → 2`（`components` 键空间开放 + `events` + `wrapRoot` + `platform`）→ **库与宿主包必须同代发布** |

---

## 1. 问题定义：什么叫"支持一个组件库"

### 1.1 四个必要条件（判据）

"能渲染一个 `<Button>`"不等于"能用这个组件库"。四条全成立才算：

| # | 条件 | 不成立时的表现 |
|---|---|---|
| **N-1** | **名字能到达宿主**：MoonBit 里写的组件名，能让宿主选出正确的组件对象 | 渲染成一个空盒子 |
| **N-2** | **值能到达组件**：字符串 / 布尔 / 数值 / **结构化数据**（`columns`、`dataSource`、`options`） | 组件渲染了，但是空的、或用了默认值 |
| **N-3** | **回调能回到 `update`**：组件库的回调名（`onClick` / `onChange`）与我们的处理器接上，**并带回值** | 点了没反应，或值回不来（受控组件用不了） |
| **N-4** | **环境能表达**：Provider 包裹（`ConfigProvider` / `NavigationContainer`…）、平台可用性（Web-only 的库不能在原生上假装能跑） | 组件在"环境不完整"下静默降级 |

另有两条**反例要求**，它们和上面四条同等重要：

- **R-a 错了必须点名**：名字写错、库没装，要在**启动时**抛一句能照着做的话；
  回落成 `View` 是**最坏**的选择 —— 它把"没接上"变成"渲染了个空盒子"，查起来毫无线索。
- **R-b 不许悄悄改变已有语义**：内建标签（`div`/`span`/`button`）的行为、42 条标签表的
  "未收录就计数"诊断，都不能因为引入组件库而改变。

### 1.2 被否掉的方案：把第三方组件名塞进标签表

`render.mbt` 的 42 条表有一条**唯一的收录判据**："两端都有等价物"。
它的产出不只是一张映射，还有**诊断价值**：表外的标签会被计数（`unmapped()`），
于是"迁移时漏了哪个标签"是**一个可以断言的数字**。

把 `antd:Button` 这类平台相关的名字混进去，等于把这张表从
"可移植子集 + 诊断"降级成"一张越滚越长的别名表" —— 诊断价值当场归零。
所以第三方组件走**命名空间直通**（§2.1），与那张表**正交**。

---

## 2. 机制设计（N1–N7）

### N1 标签命名空间：`库名:组件名`，与标签表正交

**设计**：`map_tag` 变成三档，顺序固定：

| 档 | 输入 | 产出 | 计数 |
|---|---|---|---|
| 1 | 命中 42 条表（`div`/`span`/`button`…） | 宿主基础组件名（`View`/`Text`/`Pressable`…） | 不动 |
| 2 | **含冒号**（`antd:Button`、`paper:Card`） | **原样直通**，交给宿主注册表解析 | **不计数** |
| 3 | 其余（`img` / `table` 这种表外 HTML） | `View` + 计数 | `unmapped +1` |

**为什么用冒号**（而不是 `x-` 前缀）：`x-foo` 在 HTML 里是**自定义元素**的既有写法，
和档 3 的语义会撞车；冒号在 HTML 标签名里**不合法**，于是"这是不是外部组件"一眼可辨，
42 条表的语义一个字都不用改。

**为什么档 3 保持"回落 + 计数"**：那是迁移诊断，不能变成崩溃；
而**档 2 不计数**是因为它本来就该在表外 —— 这两个语义必须分开，
否则一引入组件库，`unmapped()` 这个断言就废了。

**✋ 一个仍然生效的安全网**：忘了写命名空间时（写 `Card` 而不是 `antd:Card`），
它会落进档 3 —— 渲染成 `View` **但计数会被点名**。诊断没有丢。

**改写点**：`render.mbt` 的 `map_tag` / `is_library_tag` / `component_namespace_sep`。

### N2 宿主组件注册表：一个决定，四个面

**设计**：`MOBILE_HOST.components` 的键空间**开放**，命名空间键由 `registerLibrary` 写入：

```js
import * as antd from 'antd';
registerLibrary({
  namespace: 'antd',
  module: antd,                                    // 自动挑出组件导出（antd 挑到 71 个）
  platforms: ['web'],                              // ← 平台闸门
  jsonProps: { Table: ['columns', 'dataSource'] }, // ← 结构化 prop 白名单
  events: { click: 'onClick' },                    // ← 事件落点（库级通配 antd:*）
  wrap: (el) => React.createElement(antd.ConfigProvider, null, el),  // ← Provider
});
```

这四件事写在**一个函数**里，因为它们是同一个决定的四个面（"这个库怎么接进来"）——
分散到四个地方就会出现"注册了组件、忘了事件"这种半接状态。

**平台闸门（N-4）**：`platforms` 与宿主的 `platform` 在**注册时**对账，不匹配**当场抛**。
反面做法是"注册了但在原生上渲染成空白" —— 那种错误的发现成本极高。

**为什么自动挑组件**：`module` 里混着组件与门面（`theme` 是对象、`version` 是字符串）。
判据保守：**函数**或**带 `$$typeof` 的对象**（`memo` / `forwardRef` / Context）。
实测 antd 6.6.4 挑出 **71** 个（`Affix`/`Alert`/`Anchor`/`App`/`AutoComplete`/`Avatar`…），
脚本会把数量与名字打出来，便于人核对。

**⚠️ 组件身份必须稳定**：适配器与组件对象**只在这里建一次**。
若每次渲染重新注册，React 会看到"类型变了"→ 把整棵子树卸载重挂，
组件库内部的 state / 动画全部归零 —— 这类 bug 表现为"输入框每敲一个字就失焦"。

### N3 prop 通道：四条具名方法 + 一条 JSON 约定

**设计**（vendor 的 `html/attrs.mbt`，此前 `attribute`/`property` 是**包内私有**）：

```moonbit
@html.Attrs::build()
  .prop_str("type", "primary")        // String
  .prop_bool("danger", true)          // Bool
  .prop_num("percent", 60.0)          // Double
  .prop_int("numberOfLines", 3)       // Int
  .prop_json("columns", columns_json) // 结构化：JSON 文本，宿主解析
```

**为什么不开"对象"这种值类型**：`variant` 只有 4 个构造器，加一个"任意 JS 对象"
会同时污染两个后端（RN 与 DOM 的序列化语义根本不同），也会破坏
"样式必须走类型化通道"那条既有取舍。**结构化值在边界上就是一段字符串**，
真相由宿主侧的 `jsonProps` 白名单决定 —— 这不是偷懒，是分工：

- MoonBit 侧不知道 antd 也不该知道，它只负责把值送出去；
- **只有宿主知道哪个键是结构化的**（`columns` 是，`title` 不是）；
- 盲 `JSON.parse` 会把真字符串吃掉（`title="[1,2]"`），所以必须白名单。

**顺带改掉的一个小病灶**：以前**无条件**写 `style: {}`。对 RN 无害，
但对组件库是"凭空多一个 prop"（有的库拿 `style != null` 做判断）。现在空样式不写这个键。

### N4 事件通道：落点由宿主决定（三级优先）

**设计**：`map_event` 的解析顺序是

1. `MOBILE_HOST.events["标签"]` —— 精确到组件（`antd:Button`）；
2. `MOBILE_HOST.events["库:*"]` —— 整个库一把（`antd:*`），由 `registerLibrary` 写入；
3. `MOBILE_HOST.events["*"]` —— 整个宿主一把（宿主预设，例如"DOM 宿主：click → onClick"）；
4. **默认表**（MoonBit 侧）—— RN 基础组件的语义：`click → onPress`、`input → onChangeText`。

**为什么落点必须在宿主**：`click` 落在 RN 的 `Pressable` 上是 `onPress`、落在 antd 的
`Button` 上是 `onClick` —— 这不是"事件语义"的差别，而是"**手里这个组件对象接受什么 prop**"
的差别，只有拿着组件对象的宿主回答得了（我们这边只有个组件名）。

**顺手修掉一个真 bug**：兜底从 `"on" + event` 改成 camelCase（`change → onChange`）。
原来的写法产出 `onchange`，而 React 对它的反应是**明确拒绝**：

```
Unknown event handler property `onPress`. It will be ignored.        ← 实测输出（阶段 2 负例）
Invalid event handler property `onchange`. Did you mean `onChange`?  ← react-dom 的文案
```

也就是说那些处理器**根本不会被接上**，不是 README 里写的"载荷是零值"那么轻。
多词事件（`mouseleave`）恢复不出正确大小写，逐个列了名（`onMouseLeave`）。

**仍然没做的（§5 T1）**：**载荷**还是零值/不透明。`onChange` 能触发，
但拿不到用户输入的内容 —— 受控组件因此**还不能用**。这是 N-3 只完成了一半的地方，
必须说清楚，不能靠"20/20 全绿"掩盖。

### N5 样式边界：typed style 是 RN 词汇表

`@style.Style` 的词表取自 **RN 的 style props**（flexbox + 有限属性集）。
在 DOM/antd 上，**只有交集部分有效**：

| 类型 | 例子 | 在 antd 组件上 |
|---|---|---|
| 两边同名的 camelCase | `padding` / `marginBottom` / `backgroundColor` / `fontSize` | ✅ 数字会被 React DOM 补 `px` |
| RNW 专有 | `paddingHorizontal` / `marginVertical` | ❌ 不是合法 CSS，被忽略 |
| RN 专有 | `shadowOffset` 之类的对象值 | ❌ |

**当前策略**：直通组件的样式**照传**（用户自己知道自己在哪个平台上），
但**空样式不写键**（§N3）。**该量化而尚未量化**：交集到底多大 —— 见 §5 T3。

### N6 平台矩阵：一个命名空间，多个实现

同一个 `antd:` 命名空间可以**按平台注册不同实现**，`platforms` 闸门保证"装错平台"在启动时就说清楚：

| 平台 | 可用实现 | 事实（`npm view`，2026-09） |
|---|---|---|
| Web（react-dom） | **`antd` 6.6.4** | peer `react >= 18`；我们用 React 19.2.3，**无需** `v5-patch-for-react-19` |
| 移动 Web | `antd-mobile` 5.43.0 | peer `react ^16.8 \|\| … \|\| ^19` |
| Android / iOS（RN） | `@ant-design/react-native` 5.4.3 | peer `react-native >= 0.67.5` + **`react-native-gesture-handler` + `react-native-reanimated`**（原生依赖要走 prebuild） |

**取舍**：`antd`（桌面 Web）在 RN 原生上**不可能**工作 —— 它是 `react-dom` 的库。
所以"在 Android 上用 antd"只有两条路：换 RN 实现（上表第三行），
或者**声明 `platforms: ['web']` 让它在原生构建里报错**。后者是默认，因为它诚实。

### N7 契约、诊断与验证

| 项 | 变化 |
|---|---|
| 契约版本 | `1 → 2`（`app.mbt` / `core.js` 两边各自声明，宿主持有句柄表时比对，不等就**同时报出两个版本号**） |
| 新增契约成员 | `events`（可选）、`wrapRoot`（可选）、`platform`；`components` 的**键空间**开放 |
| 启动期报错 | 命名空间组件查不到 → 抛错并列出**已注册的名字**（`js_host_component`） |
| 诊断计数 | `unmapped()` / `unsupported()` **语义不变**（第三方组件不进这两个计数） |
| 验证入口 | `bash tools/verify_all.sh` 新增一项（离线可跑，几秒）；`--with-e2e` 不变；真机那套与本题无关 |

---

## 3. 落地清单（改了哪些文件、为什么）

| 层 | 文件 | 改动 | 为什么 |
|---|---|---|---|
| L2 翻译 | `render.mbt` | `map_tag` 三档 + `is_library_tag`；`map_event` 三级优先 + camelCase 兜底；空样式不写 `style` | 名字与事件落点要能到宿主（N1/N4/N5） |
| L1 FFI | `host.mbt` | `js_host_component` **点名报错**；新增 `js_event_override` | R-a 反例要求 + 宿主策略（N4/N7） |
| L3 挂载 | `app.mbt` | 契约版本 `1 → 2` | 契约形状变了（N7） |
| L5 DSL | `vendor/rabbita/html/attrs.mbt` | 新增 5 个公开 prop 方法（落到 patch `01-html-attrs-style-api`） | 任意 prop 通道（N3）；**只开写口、不开读口** |
| L0 宿主 | `npm/moobile-host/core.js` | **新增**：平台无关的契约装配 + `registerLibrary` + `mountRoot` + `mountAppCore` | 契约不该焊死 RN（N2） |
| L0 宿主 | `npm/moobile-host/index.js` | 变薄：只剩 RN 预设 | 同上 |
| L0 宿主 | `npm/moobile-host/package.json` | `files` 加 `core.js`；`react-native` / `react-dom` 改**可选** peer | 非 RN 宿主不必为了一个契约装一个平台 |
| 判据 | `examples/apps/antd-spike/**` | **新增**试金石（独立模块，走公开 import 路径） | 证据（§4） |
| 构建 | `moon.work` | 加入 `antd-spike` | 必须吃**本地源码**，否则拿到的是已发布的旧库 |
| 验证 | `tools/verify_all.sh` | 新增一项门（`node_modules` 缺失则 SKIP） | 唯一验证入口 |

**没有新增任何依赖**：库本体零新增，宿主包零新增（antd 是试金石自己的依赖）。

---

## 4. 端到端证据：antd

```bash
cd <仓库根> && moon build --target js
cd examples/apps/antd-spike/host && npm install && node verify.mjs
# → 20/20 通过
```

**为什么可以不带浏览器**（这是设计的一部分，不是偷工）：两条链路各有更省的判据 ——
"组件真的被构造出来了"用 **SSR 出 HTML** 断言类名与数据；"事件回到 `update`"用
**jsdom + 真实点击**看 DOM 变没变。浏览器/真机要验的是**样式与手势**，那是另一件事（§5 T3）。

| 断言组 | 覆盖的设计条款 | 关键证据 |
|---|---|---|
| 注册 71 个 antd 组件 | N2 | `registerLibrary` 自动挑出组件导出 |
| `.ant-btn` / `.ant-card` / `.ant-tag` / `.ant-progress` 出现 | N1 + N2 | 是 **antd 自己**渲染的 DOM，不是我们的兜底 |
| Table 表体出现 `10` / `20` / `30` | N2 + N3 | `columns`/`dataSource` 的 **JSON 文本被宿主解析**成数组 |
| `ConfigProvider` 包裹生效 | N4(环境) | `wrap` 在根组件外，class 前缀仍是 `ant-` |
| 内置标签路径照常 | R-b | `div`/`span`/`button` 仍走老路 |
| 诊断计数 `unsupported=0` / `unmapped=0` | N1 | 直通标签**不进**未收录计数 |
| 点 antd 按钮 → `条数 3→4`、表格 `3→4` 行 | N-3 | 事件回到 MoonBit `update` 并重渲染 |
| (a) 写错名字 → 点名报错（独立进程） | R-a | 报出 `antd:Botton` + 已注册名单 |
| (b) 不给事件覆盖 → 点击无效（且 React 亲口说 `onPress` 被忽略） | N4 | **反证**：证明落点确实是宿主决定的 |
| (c) 只给宿主级 `"*"` 覆盖 → 点击有效 | N4 三级优先 | 兜底那一级真的起作用 |

### 4.1 试金石踩到的坑（带真因）

| # | 现象 | 真因 | 解法 |
|---|---|---|---|
| 1 | `act is not a function` | 本机 `NODE_ENV=production`，而 React 的 **production 构建不含 `act`**（只有开发构建有） | 脚本在**任何 import 之前**把 `NODE_ENV` 钉成 `development` |
| 2 | `Cannot set property navigator of #<Object> which has only a getter` | Node 24 起 `globalThis.navigator` 是**只读 getter** | `Object.defineProperty` 覆盖 |
| 3 | `ERR_UNSUPPORTED_ESM_URL_SCHEME: Received protocol 'd:'` | Windows 上 dynamic `import()` 不吃裸绝对路径 | `pathToFileURL(ARTIFACT).href` |
| 4 | 按文本找"清空"按钮找不到 | antd 对**两个汉字**的按钮自动 `autoInsertSpace`（`清空` → `清 空`） | 断言前归一化空白 |
| 5 | "表格 0 行"断言失败 | 空数据时 antd 仍渲染一行 `.ant-table-placeholder` | 数行时排除占位行 |
| 6 | 负例把整个进程带崩 | 那次挂载**注定要抛**，而 `ReactHost` 还会在稍后的 frame 里**再抛一次**（无人接） | 负例**单独起进程**（一个进程没法既崩溃又继续跑用例） |

第 6 条值得单独记住：**"注定会崩的用例"必须与其它用例隔离**，
否则报出来的是一句与当前用例无关的错误，排查方向会被带偏。

---

## 5. 缺口与下一步（按优先级，每条带判据）

### T1 事件载荷：让受控组件可用 —— ✅ **已实现**（2026-09）

**曾经的现状**：`on_change` 能触发，但载荷是零值/不透明（`html/event_decoders.mbt` 的透传表），
用户输入的内容拿不到 —— `Input` / `Select` / `DatePicker` 这些**受控组件用不了**。

**落地形态**（vendor patch **27**，新增文件 `vendor/rabbita/html/payload.mbt`，整文件限定 js）：

```moonbit
@html.node("antd:Input",
  @html.Attrs::build()
    .prop_str("value", model.draft)                    // 出：Model → 组件
    .on_raw("change", e => emit(SetDraft(e.text()))),  // 回：组件 → Model（**真实值**）
  [])
```

| 提取器 | 覆盖的载荷形态 |
|---|---|
| `Payload::text()` | 字符串/数字/布尔直接给（**RN 的 `onChangeText` 走这条**）；事件对象读 `target.value` / `nativeEvent.text` |
| `Payload::json()` | 组件库回调递来的**业务值**（数组、对象）—— `Select` 的选项、`Table` 的选中行 |
| `Payload::num()` / `bool()` | 数值 / `target.checked` |
| `Payload::field(name)` | 任意属性，可继续 `field` 下去（提取器没覆盖到的形状自己走） |

**三条设计取舍**（都写进了文件头）：

1. **不碰旧的 `on_*` 签名** —— 它们是对 DOM 的承诺，改了会波及 `svg/`、全部标签助手与既有应用。
   这是**平行**通道，不是替换。
2. **载荷不透明**：同一个回调在 DOM 上给事件对象、在 RN 上可能**直接给字符串**、
   在组件库里给业务值 —— 提取器把这三种形态都覆盖，于是**同一份视图代码两端可用**。
3. **提取器永不抛错**（形状对不上给 `""` / `0` / `false`）：载荷形状是运行时才知道的事，
   让它崩掉等于把"库版本不匹配"变成"白屏"。

**判据（已进试金石，3 条，判据是"值对上了"而不是"事件触发了"）**：
在 antd `Input` 里打字 → ① 回显出现**该文本**；② `input.value` 仍等于 Model 的值（受控回填）；
③ 第二次输入同样到达（不是碰巧）。
另有一条**对照**：不给任何事件覆盖时 `change` **仍能**到达 Model（camelCase 兜底的功劳），
而 `click` 到不了（默认落点是 RN 的 `onPress`）—— 这条把"哪些回调必须声明覆盖"讲清楚了。

⚠️ **已知限制（没做，也不假装做了）**：**回调只取第一个参数** ——
处理器在 vdom 侧的形态是 `(v) => f(v)`，所以 antd `onChange(value, option)` 这类
多参数回调只拿得到第一个。需要更多参数时，在宿主侧用适配器把它们拼成一个值。
另外 RN 原生上的手势坐标仍走 RN 手势通道（与本文无关的独立课题）。

### T2 结构化 prop 的类型化 + "平级 DSL 包"

**现状**：`columns` / `dataSource` 是手写 JSON 字符串，编译期零检查（schema 也不查）。
**设计**：`prop_json` 的入参从 `String` 换成能**序列化**的 MoonBit 值（`ToJson`），
或用 `derive(ToJson)` 的类型 + 一层薄包装。
**判据**：试金石的 `columns` 写成结构化值，改错字段名**编译期**就红。

#### T2b（= `PLAN.md` §3.8 的 I3）让组件在**写法上**与 `@html` 平起平坐

**这不是我们发明的形态，rabbita 自己就有先例**：`vendor/rabbita/svg/svg.mbt`（68 个 `pub fn`）
是一个**独立包**，与 `@html` 平级，写法就是 `@svg.rect(x~=0, y~=0, width~=100, fill="red", children)`。
"一个组件库 = 一个平级 DSL 包"于是只是把这个既有形态复制到第三方库上。

| | 今天 | 生成之后 |
|---|---|---|
| 写法 | `@html.node("antd:Button", @html.Attrs::build().prop_str("type","primary"), "加一条")` | `@antd.button(type_="primary", danger=true, on_click=emit(Bump), "加一条")` |
| 与 `@html.button(...)` 的关系 | 形状不同（要自己拼 Attrs、传字符串标签） | **同款形状**（具名可选参数 + children） |
| 写错 prop 名 | 静默无效 | 编译错误 |

✅ **形状可行性已实测**：`examples/apps/antd-spike/generated_shape_probe.mbt`
（`moon check --target js` **0 错误**）证明四件事 ——
`@html.IsChildren` 可作消费方的 **trait 约束**；`attrs?` + 具名可选参数 + `children : C` 的签名能编；
可选参数能用 `match` 逐条落到 `Attrs::prop_*`；产出的 `@html.Html` 能直接塞进 `@html.div([...])`。
**未做的是"自动生成"这件事本身**（以及 prop 值类型能精确到哪一档）。

⚠️ **一条语法硬约束（同批实测）**：`@antd.Button()` 这种大写写法**做不到** ——
`pub fn Button(...)` 是 parse error（`unexpected token '(', you may expect '::'`），
因为大写开头在 MoonBit 里是**类型名**；要大写只能先 `pub struct Button` 再 `Button::new(...)`，
比小写更长。所以生成物的名字**必须小写**（与 `@html.div` / `@svg.rect` 一致）。

**"平起平坐"成立到哪一层**（别读多）：

| 层次 | 成立？ | 说明 |
|---|---|---|
| **写法平级** | ✅ | 同款具名参数、同款 children、可混进同一棵树（已实测） |
| **包结构平级** | ✅ | `@antd` 与 `@html`、`@svg` 是同一层的兄弟包 |
| **身份平级** | ❌ **刻意不做** | antd 组件**不进** 42 条标签表、不计入 `unmapped` —— 那张表是"两端都有等价物"的可移植子集，混进平台相关的第三方名字就毁了它的诊断价值（§1.2） |

**底下仍然是"字符串标签 + 命名空间"**，只是生成器把它抹掉了 —— 而且**必须留着**：
"这个名字指向哪个真实实现"仍然由宿主的注册表决定，平台矩阵（§N6）才能成立。
如果组件在编译期被绑死成某个对象，那"同一份视图在 Web 用 antd、在 Android 用另一套"就没了。


### T3 样式交集量化 + 浏览器/真机实测

**现状**：只看结构，没看样式；也没有真机数据。
**判据**：① 跑一次 headless Chrome（`tools/verify_web.js` 那套 CDP 已有），
断言 antd 的 CSS-in-JS 真的生效（计算样式，不是类名）；
② 给 `@style.Style` 的每个属性标一列"DOM 上是否有效"，产出交集表（**数字，不是感觉**）。

### T4 跨平台矩阵的自动化

**现状**：`platforms` 由人写在适配器里；"同一份视图在 Android 上长什么样"没验证过。
**设计**：把 `registerLibrary` 的声明接进 `moobile-host regen`（它已经会读 `package.json`
生成能力注册表），让"装了 `@ant-design/react-native` 就自动生成一份 RN 侧声明"。
**判据**：`regen` 生成的注册表里出现组件库项；`platforms` 传错时**启动即报错**（已有）。

### T5 组件库适配器目录

**现状**：试金石的 `registerLibrary` 调用写在 `verify.mjs` 里（约 20 行）。
**设计**：`npm/moobile-host/libraries/antd.js` 这类**可选**适配器（与 `capabilities/db.js` 同构），
`regen` 按依赖自动接。**判据**：新项目 `npm install antd` + `regen` 之后，
MoonBit 侧直接写 `antd:Button` 就能跑，**宿主侧零手写**。

### T6 落地形态：**一条应用侧命令**（= `PLAN.md` 的 I2 / I3 / I5）

T1–T5 里那些"生成"的东西**收敛成一条命令**（暂名 `npx moobile-host libgen`），三段一条流水线：

```
应用装好的组件库（node_modules/**/*.d.ts）
        │  ① 抽"组件 → prop 名 + 类别"                      ← I2
        ▼
   manifest（JSON：入库、可 diff、可手改兜底）
        │  ② 宿主侧注册调用（components / jsonProps / events / wrap / platforms）   ← I5
        │  ③ MoonBit DSL 包（`@antd.button(...)` 这种平级 DSL）                     ← I3
        ▼
   应用侧生成物（入库 + `--check`）
```

**为什么必须"一条命令、一份 manifest、两个产物"**：宿主侧认的是**名字**
（`MOBILE_HOST.components["antd:Button"]`），MoonBit 侧发的也是**名字**（标签字符串）。
两边各写一份清单就是等着漂 —— 同源于一份 manifest 是"两侧不会对不上"的**机制保证**，
不靠人记得同步。**判据**：`--check` 能发现任一侧被手改。

**形态选择**（`PLAN.md` 决策点 15，倾向 **应用侧命令**）：

| 形态 | 否掉/保留的理由 |
|---|---|
| 应用侧命令（**选它**） | ① 不依赖脚手架（否则"写错 prop 会编译报错"这种便宜收益被远景的 E 卡住）；② **必须能重跑** —— 升级组件库后清单会变；③ 输入（`.d.ts` + `node_modules`）只有 Node 侧拿得到 |
| 我们预生成并发布 `XiLaiTL/moobile-antd` | **留作后手**：代价是"每个库 × 每个版本"都要我们发一个包、耦合到我们的发版节奏；真被大量使用时再上 |
| 只在脚手架里跑一次 | **明确否掉**：脚手架只在 `create` 那一刻存在，把生成逻辑藏进去 = 用户升级后生成物**悄悄漂掉** |

**与脚手架（E）的关系**：**E 消费 I，不实现 I**（`PLAN.md` E8）——
脚手架只做三件事：把命令写进 `scripts` 与 CI 的 `--check`、在 README 里写"升级后重跑"、
让 `create` 勾选组件库时开箱可用。**依赖方向是 E → I**。

**生成物是"承诺面"，必须自带版本**：生成文件的头部写生成器版本 + 组件库版本；
`--check` 进 CI；手改要写在标记区外（否则下次重跑被覆盖）。
这样我们将来改命名约定时，用户重跑会**立刻看见 diff**，而不是静默变样。

### T7 生成器到底难不难：**实测读数**（= `PLAN.md` 的 I2）

不靠感觉，靠量测：`node examples/apps/antd-spike/host/manifest_probe.mjs`（可复现，几秒跑完）。

| 指标 | 读数（antd 6.6.4 / react 19.2.3） |
|---|---|
| 组件目录（`<name>/index.d.ts`） | **79** |
| 有 Props 接口的 | **73** |
| 直接 prop 字段合计 | **1260**（平均 **17.3** 个/组件）← 清单总量是"一份 JSON"，不是一个项目 |
| 带 `extends` 的组件 | **33 / 73** ← **坑在这里** |
| 最大的接口 | `ConfigProviderProps` 96 个字段 |

**浅解析（正则 + 花括号配对，不需要 TypeScript）的分类结果**：

| 类别 | 字段数 | 落地方式 |
|---|---|---|
| `scalar` / `bool` | 248 / 160 | `prop_str` / `prop_bool` —— **直接可用** |
| `union` / `array` / `object` | 111 / 31 / 3 | `prop_json` |
| `reactnode` / `css` / `function` | 109 / 69 / 108 | `prop_json` 或字符串（**有损**，要在清单里标注） |
| `event`（`React.MouseEventHandler` 这类） | 24 | 事件通道 |
| **"命名类型"桶** | **397（32%）** | 见下：一跳救回 230 个 |
| ├ 一跳可分类 | **230** | antd 本地 **564** 个 `type` 别名 + **503** 个 `interface` |
| ├ 需拆工具类型 | 16 | `NonNullable` / `Partial` / `LiteralUnion` / `any` |
| └ 跨组件 / 外部类型 | ~151（**12%**） | 标 `unsupported` **并在报告里点名**（不是失败） |

**结论：约 88% 的 prop 能被自动分类**（863 直接 + 246 一跳/拆包装），
剩下的 12% 有明确的去处。**生成器本身的算法很浅**，难的不是算法。

#### 三处真正的难度（都有解法，两处是"决策"而非"技术"）

1. **继承**（**最意外、也最要命**）：`ButtonProps extends BaseButtonProps, MergedHTMLAttributes`，
   而 `MergedHTMLAttributes = Omit<React.HTMLAttributes & React.ButtonHTMLAttributes & React.AnchorHTMLAttributes, …>`。
   这些**继承来的 prop**（`onClick` / `href` / `className` / `style` / `aria-*`）恰恰是最常用的 ——
   而它们的真相源 `@types/react` **不在场**（实测：antd 不依赖它，纯 JS 应用也没有 `typescript` /
   `@types/react` / `@types/react-dom`）。
   **解法**：自备一份"React 公共属性"小表（`on*` + `className`/`style`/`id`/`title`/`href`/`aria-*`/`data-*`，
   React 的 HTML 属性面很稳定）+ 若项目里有 `@types/react` 就顺手用上；
   **并且默认对清单外的名字放行** —— 清单本来就不完整，严报会对 `onClick` / `href` 大面积误报
   （这就是 §5 T7 与 I2 判据里"继承来的 prop 必须**不**被误报"那条的由来）。
2. **类型要多跳**：32% 的字段类型是命名类型。一跳（别名 + interface）救回 230/397，
   拆工具类型再收 16 个，剩下 12% 标 `unsupported`。**不需要 TypeScript 编译器**就能拿到 88%；
   TS API（决策点 12(b)）是"要不要最后那 12% 的准确度"的开关，**不是前置条件**。
3. **跟版与"生成物是承诺面"**（工程，不是算法）：见 §5 T6 末段（生成器版本进产物头部 + `--check` 进 CI）。

#### 工作量估计（量级，不是承诺）

| 步骤 | 估计 | 依据 |
|---|---|---|
| manifest 抽取 + 分类 | **1 天** | 原型已跑通（`manifest_probe.mjs`，~180 行） |
| 别名 / 工具类型多跳 + "React 公共属性"小表 | **0.5–1 天** | 规则少而机械；小表本身是一次性整理 |
| MoonBit 包装生成 | **0.5 天** | 形状已实测可编译（`generated_shape_probe.mbt`） |
| 宿主注册调用生成 + `--check` + 门 | **0.5 天** | 纯 JSON 产出，比 MoonBit 那半简单 |
| **合计** | **2.5–3 天** | 到"antd 上可用的 `libgen`"；最不确定的一环（浅解析够不够）已被本次量测消掉 |

**长尾不阻塞**：`Locale` / 跨组件 props / `Table` 泛型列的精确类型 —— 标 `unsupported` 即可，
它们本来就该由人手写（`prop_json` 那条路一直开着）。

#### 取样时立刻暴露的 3 条规则（= "看起来做出来了" 与 "做对了" 的差别）

把 Button / Table / Input 的清单按生成器会写的形状打印一遍（2026-09 实测），
原型当场给出三条必须写进生成器的规则：

| # | 现象 | 规则 |
|---|---|---|
| 1 | `Input` 挑到的接口是 **`GroupProps`** 而不是 `InputProps` —— 因为"字段最多的那个 `*Props`"这个启发式挑错了（一个组件目录里有多个 Props 接口） | **别靠"哪个接口大"来挑**：组件清单的真相源是**宿主侧自动发现的导出名**（`registerLibrary` 已经给出 71 个），按导出名去对 `XProps`。顺带把 `Input.Group` 这类**复合子组件**正确地排除在顶层清单外 |
| 2 | `button` 的 `type`/`size`/`shape`/`variant` 落在 `named`（它们是 `ButtonType`/`SizeType`… 别名）；`iconPosition` 因为写的是 `'start' \| 'end'` 被判成 `json` | 别名多跳（已量：一跳收 230/397）+ **联合字面量算 `str`（枚举），不是 `json`** —— 否会把一整个枚举塞进 JSON 通道 |
| 3 | `_skipSemantic` 这种 `@private` 的内部 prop 也进了清单 | 跳过 `_` 前缀与 `@private` 标注的字段（`prefixCls`/`rootClassName` 这类内部 prop 也应标记为"不建议使用"而不是删掉） |

**这三条都不是架构问题，是规则问题** —— 但它们是"生成器看起来能跑"与"生成器真的可用"之间的差距，
所以写在这里，免得实现时又踩一遍。

**最省的第一步**（如果 I2 想更晚做）：先生成**只带组件名**的包装
（`@antd.button(attrs? : Attrs, children)`），prop 仍旧手写 `Attrs::build().prop_str(...)`。
拿到的是"与 `@html` 同款写法"，代价是 prop 名仍然没有编译期检查 ——
**但它把"写法平级"和"prop 校验"解耦了**，可以分开上线。



### 明确未覆盖（别把 20/20 读成"antd 全部可用"）

表单校验、弹层、虚拟滚动、受控双向绑定、性能（有 Table 时的全树 diff 代价）**都没测**。

---

## 6. 与既有设计的关系

| 既有文档 | 本文与它的关系 |
|---|---|
| `README.md` §2 能力边界 | 本文把"能不能用第三方组件库"从**没写**变成**有机制、有证据、有缺口清单** |
| `ARCHITECTURE.md` §2.1 宿主契约 | 契约从"4 件套"扩展到"4 件套 + 3 个可选项"，版本 `1 → 2` |
| `docs/design/DESIGN.md` §4.3（一个根组件 + 一个订阅点） | **不变**：组件库组件是普通 React 组件，挂在同一棵树里，它们自己的 hooks/state 照常工作 |
| `docs/design/DESIGN.md` 原则 1（不实现渲染） | **加强**：连"组件实现"都不用我们写，这是选 React 后端的最大红利 |
| `FORK.md` §2 patch 01 | 新增的 5 个 prop 方法落在同一个 patch（同一个文件、同一个主题：`Attrs` 的属性 API） |

---

## 附：怎么复现本文的每一句话

```bash
cd <仓库根>

# §0 / §4：端到端证据
moon build --target js
cd examples/apps/antd-spike/host && npm install && node verify.mjs     # 期望 20/20

# §N7：这一项已进唯一验证入口
cd <仓库根> && bash tools/verify_all.sh                                # 期望全 PASS（含"组件库接入"）

# §3：vendor 改动（生成式 vendor，改了 fork 就必须回写）
bash tools/vendor_sync.sh --check && bash tools/py.sh tools/gen_forwarders.py --check

# §N6：平台事实（2026-09 实测）
npm view antd version peerDependencies
npm view @ant-design/react-native version peerDependencies
```
