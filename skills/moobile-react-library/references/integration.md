---
title: 接入顺序、过不来的通道与纪律
description: 照着做的六步、五条明确过不来的通道（各带状态与原因），以及"会静默出错"的纪律清单。
---

# 接入顺序、过不来的通道与纪律

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、接入顺序（照着做）

1. `npm install <组件库>`。它是**依赖**，不是「能力」：**不走 `regen`**，不进 `registry.generated.js`。
2. 在应用根写 `libgen.config.json`（形状见 `references/libgen.md` + 那三条声明）。
3. 跑 `npx moobile-host libgen`（**在宿主目录跑**；配置与 `node_modules` 都往上找）。
4. 应用 `moon.pkg` 里加一条 import：`"<模块名>/<ns>" @<ns>`（生成物 ④ 就是那个包的 `moon.pkg`）。
5. 宿主入口按这个顺序写，**顺序有讲究**：

```js
import { installHost, mountApp, registerLibrary } from 'moobile-host';
import { registerMd } from './libraries.generated.js';

installHost();                 // registerLibrary 要求 MOBILE_HOST 已存在
registerMd(registerLibrary);   // 生成的注册调用（组件 / jsonProps / events / platforms）
export default mountApp(app, { registry });
```

6. `npx moobile-host libgen --check` 进应用 CI；`node tools/libgen_probe.mjs` 是生成器规则自己的
   离线门。

⚠️ 漏了 `installHost()` → 真机上**直接抛**「`registerLibrary` 必须在 `installHost` 之后调用」；
web 上由于加载顺序不同**未必**同时炸，所以它属于「**只在真机露头**」的那一类
（`examples/apps/chat-app/App.js` 的注释里有完整记载）。

## 二、明确过不来的东西（别当成已支持）

| 通道 | 状态 | 为什么 |
|---|---|---|
| 渲染型回调（`itemRender` / `renderItem`） | ❌ **过不来** | prop 通道的值域只有 String / Bool / Int / Double + JSON 文本；而回调是**另一条通道**，它的契约是「返回**消息**」不是「返回节点」。两条解法（宿主侧注入默认渲染器 / 库侧新增 render prop 通道）**都还没做**（**D** 的 §5 T2b） |
| `prop_json` 的**值** | 🟡 编译期只检查**名字** | 生成物里它就是 `String`（`columns? : String`），值的形状与字段名写错**没人管**；antd-demo 里连 `value` 都要包一层 `jstr(...)`（**D** 的 §5 T2） |
| 多参数回调 | 🟡 只拿得到第一个参数 | vdom 侧处理器的形态是 `(v) => f(v)`；`onChange(value, option)` 的第二个参数要**宿主侧适配器**才拿得到 |
| 挂在**组件类型**上的 children（如 `Splitter`） | 🟡 只认了一部分 | 生成器有一条 `from: 'component-type'` 的路径，但 `Splitter` 那种要顺着 `typeof` 再跳一层才够 ⇒ 该组件的**面板是空的**（壳仍由组件库渲染）（`examples/apps/antd-demo/README.md` 的已知限制） |
| 样式的**交集** | 🟡 未量化 | 类型化样式是 RN 词汇表，落到组件库组件上只有**交集**有效；直通组件的样式照传，**用户自负**（**D** 的 §N5 / §5 T3） |

## 三、纪律：会静默出错的那几条

| 别做 | 会怎样 |
|---|---|
| 每次渲染重新 `registerLibrary` | React 认为「类型变了」→ 整棵子树卸载重挂，组件内部 state / 动画归零（输入框每敲一个字就失焦）。组件与适配器**只注册一次**（**M** / **C**） |
| 手改生成物 | `--check` 报「第 N 行起不一致」。要改行为 → 改 `libgen.config.json` / manifest 再重跑 |
| 指望生成物里出现大写函数名 | 生成物名字**必须小写**（`@md.markdown`）：`pub fn Markdown(...)` 是 **parse error**；关键字撞名加 `_`（`type_`） |
| 把「解不开」当没发生 | 跑 `libgen` 时报告里逐条点名 `unsupported`，并打印「⚠️ 有 N 处 extends 解不开（那些基类上的 prop 会缺）」—— 少一个可选参数**编译器一句话都不会说**。缺的 prop 走逃生口 `attrs=@html.Attrs::build().prop_str(...)`（**G** 的 `manifest.js` / `resolve.js` / `emit-moonbit.js`） |
| 认为「一个命名空间只能一个实现」 | 同一命名空间可以**按平台注册不同实现**（Web 用 antd、原生换一个 RN 实现），名字不变、换的是注册 —— 这也是名字不能绑死成编译期对象的原因（**D** 的 §N6） |

## 四、去哪看

- 机制总纲（N1–N7 + 缺口清单）→ `docs/design/DESIGN-COMPONENT-LIBRARY.md` §5
- 宿主契约、`libgen` 那两节 → `npm/moobile-host/README.md`
- 生成器本体与边界（每个文件头部）→ `npm/moobile-host/libgen/`
- 端到端证据：库本体试金石 `examples/apps/antd-spike/`（进 `tools/verify_all.sh`）；
  生成物的用法与已知限制 `examples/apps/antd-demo/`；真实 RN 库 + 真机 `examples/apps/chat-app/`
- `on_raw` / `Payload` 那条通道 → `vendor/rabbita/html/payload.mbt`；
  `prop_*` 那一组方法 → `vendor/rabbita/html/attrs.mbt`
- 现状 / 分数 / 未做清单 → `docs/STATUS.md`；仍然**没验证**的诚实清单 → `docs/HANDOVER.md` §6
