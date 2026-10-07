---
name: moobile-react-library
description: 把别人已经写好的 React / React Native 组件库（antd、markdown 渲染器这类）接进 moobile 应用 —— libgen 一条命令与它的四份产物、`--check` 判据、registerLibrary 的四个面，以及三处「类型定义在撒谎」必须由人声明（`content` / `defaultExports` / `platforms`）。
whenToUse: 你要在 moobile 应用里用一个现成的第三方 React / RN 组件库（antd、antd-mobile、@ant-design/react-native、react-native-markdown-display…），要写 `libgen.config.json`、跑 `libgen`、接生成物，或排查「真机启动即抛」「组件渲染成空盒子」「回调不触发」时用。要自己**写**一个组件（宿主侧 React 实现 + 注册）是另一件事，用 `moobile-custom-component`。
---

# moobile-react-library —— 用现成的 React / RN 组件库

**只解决一件事**：把**别人已经写好**的组件库接进来。你的活是**声明与生成**，**不写组件代码**。
动手前先跑这两条，确认手上的生成物是**这一版**代码的：

```bash
cd examples/apps/antd-demo/host && npx moobile-host libgen --check   # 生成物与 manifest 一致？
node tools/libgen_probe.mjs                                          # 生成器自己的规则（假包探针，离线）
```

## 一、先分清这活归谁

| 情形 | 归谁 |
|---|---|
| 组件**已经有了**（antd / markdown 渲染器…），你只做声明与生成 | **本 skill**（写配置 + 跑 `libgen`） |
| **没人给你这个组件**，要自己写宿主侧 React 实现并注册 | 用 `moobile-custom-component` |
| 一般的「不报错但错」（样式、布局、标签、手势） | 用 `moobile-pitfalls` |

## 二、三条慢变的事实（错了都不报）

| 事实 | 错了会怎样 | 细则 |
|---|---|---|
| 组件库标签是 `命名空间:组件名`，**含冒号才直通** | 忘了写冒号**不报错**，回落渲染成 `View`，只有计数会点名 | `references/channel.md` |
| **三处声明**（`content` / `defaultExports` / `platforms`）猜不出来，必须由人写 | 各自有各自的炸法，且**有一处只在真机露头** | `references/libgen.md` |
| 组件库是**依赖**，不是「能力」 | 走 `regen` / 进 `registry.generated.js` 就错了 | `references/integration.md` |

## 三、机制：一条命名空间直通的窄通道

| 你写的标签 | 去哪 | 计不计诊断 |
|---|---|---|
| `div` / `span` / `button`（表内） | 标签表 → 宿主基础组件 | 不动 |
| **`antd:Button`（含冒号）** | **原样直通**给宿主注册表 `MOBILE_HOST.components` | **不计数** |
| `img` / `table`（表外、无冒号） | 回落 `View` | `unmapped +1` |

- 写错名字 / 库没装 → **启动时抛**并列出已注册的名字，**不会静默渲染成空盒子**。
- 第三方名字**不进**那张可移植标签表 ⇒ `unmapped()` 这个断言在接入之后**仍然有效**。
- 不想用生成器时手写一行 `@html.node("antd:Button", …)` 也可以，组件库侧一行代码都不用写
  → `references/channel.md`。

## 四、接一个库 = 一份配置 + 一条命令

```bash
cd <应用>/host && npx moobile-host libgen          # 生成
cd <应用>/host && npx moobile-host libgen --check  # 只校验（生成物被手改就红，进 CI）
```

- 产物**四份**（manifest / 宿主注册调用 / MoonBit DSL 包 / 那个包的 `moon.pkg`）。
  ⚠️ 宿主包 README 那节写「三份」，**少列了一份**，**以代码与工具自己的打印为准**。
- **为什么必须同源**：宿主侧认的是**名字**、MoonBit 侧发的也是名字，两边各写一份清单就是等着漂；
  `--check` 就是这件事的判据 —— 任一侧被手改都会报「第 N 行起不一致」。
- 配置形状与三处声明的逐条实测 → `references/libgen.md`。

## 五、三件事必须由人声明（类型定义在撒谎）

| 声明 | 不写会怎样 |
|---|---|
| `content` | 字符串子节点变成 `<Text>` **元素** → 真机报 `Input data should be a String`（每字一次） |
| `defaultExports` | 启动即抛「列了 `Markdown`，但模块里没有这个导出」 |
| `platforms` | 默认 `["web"]` ⇒ 在真机上**启动即抛**平台闸门错 |

- 共同规矩：**类型定义说不准的事由人声明，声明错了就报错**（不猜、不回落）。
- ⚠️ `defaultExports` 的错**只在真机（Hermes）露头** —— web/node 上打包器的 ESM interop
  恰好看得见具名导出 ⇒ 「无头判据全绿」**推不出**「真机也对」。

## 六、`registerLibrary` 的四个面

组件登记 ｜ 结构化 prop（`jsonProps` 适配器）｜ 事件名（`events['<ns>:*']`）｜ 平台闸门 + Provider
—— 写在**一个函数**里，因为它们是**同一个决定**；分散到四处就会出"注册了组件、忘了事件"的半接状态。
⚠️ **`platforms` 在 `registerLibrary` 里没有默认值**：**不传就完全不过闸门** —— 「默认 `['web']`」
是 `libgen` 配置装载那一侧的默认，**以 `npm/moobile-host/core.js` 的代码为准**
→ `references/register-library.md`。

## 七、过不来的东西与纪律（别当成已支持）

- ❌ **渲染型回调**（`itemRender` / `renderItem`）**过不来**：回调是另一条通道，契约是「返回**消息**」。
- 🟡 `prop_json` 的**值**编译期只查名字 ｜ 多参数回调只拿第一个参数 ｜ 挂在**组件类型**上的 children
  只认了一部分 ｜ 样式的**交集**未量化。
- 纪律：**组件与适配器只注册一次**（每次渲染重新注册 ⇒ 整棵子树重挂、state 归零）；
  **手改生成物**必被 `--check` 抓到；生成物名字**必须小写**；`libgen` 报 `unsupported` 要当回事，
  缺的 prop 走逃生口 `attrs=@html.Attrs::build().prop_str(...)`。
- 五条通道的完整状态与原因、以及"去哪看" → `references/integration.md`。
