# moobile

> **用 MoonBit 写一次 UI，跑在 Android / iOS / Web。**

moobile 是 [rabbita](https://github.com/moonbit-community/rabbita)（MoonBit 的 TEA 声明式 UI 框架）
的 **React 渲染后端**：`Model` / `Msg` / `update` / `view` 与 `@html` DSL 都不变，
只把最后一跳从"操作 DOM"换成"产出 React 元素"。于是同一份 MoonBit 代码，
经 React Native 上 Android / iOS，经 react-native-web 上浏览器。

布局、排版、文字引擎全部由 React / RN 负责 —— moobile 不自己实现渲染。

| | |
|---|---|
| **MoonBit 包** | `moon add XiLaiTL/moobile@0.2.2` |
| **宿主（JS）** | `npm install moobile-host`（React Native / Expo） |
| 已实测 | Web ✅ ｜ Android 真机 ✅（Android 14 / x86_64） |
| 未实测 | iOS（宿主工程可生成，本机无法构建验证）｜ 桌面（未提供宿主） |
| 目标平台 | 只支持 `js` 目标（库本身编到 JS，再交给 React） |
| 许可 | Apache-2.0（内含 rabbita fork，见 [`THIRD-PARTY-NOTICE.md`](THIRD-PARTY-NOTICE.md)） |

---

## 1. 快速上手

三段：**MoonBit 写应用** → **宿主接上** → **跑**。

### 1.1 MoonBit 侧

```toml
# app/moon.mod
name = "you/myapp"

version = "0.1.0"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.2.2",
}
```

```moonbit
// app/moon.pkg
import {
  "XiLaiTL/moobile" @moobile,     // 库本体
  "XiLaiTL/moobile/style",        // 类型化样式（写视图的入口）
  "XiLaiTL/moobile/html",         // @html DSL
  "XiLaiTL/moobile/cmd",          // Cmd / Emit
  "XiLaiTL/moobile/sub",          // Sub（订阅：定时器、传感器…）
}

options(
  link: {
    "js": { "format": "esm", "exports": [ "app" ] },
  },
)
```

> 要用到的包就这五条。fork 住在 `vendor/rabbita/`，但**使用者看不到那一层**：
> 根上的 `html/` `cmd/` `sub/` `http/` 是**转发包**（由 `tools/gen_forwarders.py` 生成），
> 所以 `XiLaiTL/moobile/html` 这种短路径照旧可用。

```moonbit
fn view(m : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(
      @style.Style::new().font_size(16.0).padding_horizontal(@style.px(12.0)),
    ),
    [ @html.button(on_click=emit(Bump), "+1") ],
  )
}

/// 应用入口：交出句柄表（start / snapshot / subscribe / element）。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}
```

`update` 与 rabbita 同款：`(Model, Msg, Emit[Msg]) -> (Model, Cmd)`，
还可以挂 `subscriptions?` 做持续数据流（定时器、传感器…）。
首帧之前就要干的事（例如"先从本地库读回清单"）用 `handlers_with_init(init=..., update~, view~)`。

### 1.2 宿主侧（React Native / Expo）

```js
// App.js —— 全部手写代码就这几行
import { mountApp } from 'moobile-host';
import { app } from './myapp.js';                    // MoonBit 编译产物
import { registry } from './registry.generated.js';  // npx moobile-host regen 生成

export default mountApp(app, { registry });
```

`MOBILE_HOST` 契约（React、5 个基础组件、调度钩子、后端地址）、契约版本比对、
能力注册表都在这个包里。没有能力依赖时 `mountApp(app)` 就够。

### 1.3 跑起来

```bash
moon build --target js
cp _build/js/debug/build/<你的模块>/<你的模块>.js <Expo 工程>/myapp.js
cd <Expo 工程> && npx expo start --port 8081     # 浏览器打开 http://localhost:8081
# 真机/模拟器：adb reverse tcp:8081 tcp:8081 之后扫码或用 expo run:android
```

完整的可跑示例（本地库 + 网络同步 + 多页面 + 一个 MoonBit 写的后端）：
[`examples/apps/todo-app/`](examples/apps/todo-app/)。

---

## 2. 能力边界

上手前值得看一眼 —— 尤其是**不报错但没效果**的那几行。

| 项 | 现状 |
|---|---|
| 支持的标签 | 42 条 HTML 标签有映射（`div`→`View`、`span`→`Text`…）；`img` `video` `audio` `canvas` `svg` `table` `iframe` `select` `details` `summary` `dialog` `marquee` **明确不支持** |
| 未收录标签 | 兜底渲染成 `View`（不崩），但会被计数，便于你发现迁移漏项 |
| 样式 | 类型化：`Attrs::styles(Style::new().font_size(16.0))`。**`class=` 与 `style="…"` 在 RN 上不生效**（不报错，只是没效果） |
| 事件 | `click`→`onPress`、`input`→`onChangeText` 这类映射可用，**落点由宿主决定**（可覆盖，组件库的回调靠这个接上）；老的 `on_*` 处理器在 React 后端**载荷是零值**（能写、不崩、拿不到坐标）；**要真实值就用 `Attrs::on_raw` + `@html.Payload` 提取器**（`text()` / `json()` / `num()` / `bool()` / `field()`），受控组件走这条 |
| 第三方组件库 | 标签写 `库名:组件名`（如 `antd:Button`）就**直通**宿主注册的 React 组件，props 走 `Attrs::prop_*`（结构化值传 JSON 文本），回调走 `on_raw` 拿真实值。antd 6 已在 Web 宿主上端到端跑通（[试金石](examples/apps/antd-spike/)，26 项，含受控 `Input` 的回填） |
| 副作用 / 订阅 | `Cmd`（`@cmd.perform` 等）与 `subscriptions?` 都可用；持续型原生流建议走 `@sub.custom_sub` |
| 原生能力 | 生态里有现成 RN / Expo 包的（数据库、剪贴板、文件、相机…）→ 在 MoonBit 里写绑定即可，**不需要写 Kotlin/Swift**；需要自研原生模块时才要 |
| 平台 | 库与 RN 版本无关；换平台通常等于**换一个宿主**，而不是改库 |

已提供的能力（宿主侧实现 + MoonBit 入口）：

| 能力 | 提供者 | MoonBit 入口 | 说明 |
|---|---|---|---|
| `db` 本地数据库 | `expo-sqlite` | `XiLaiTL/moobile/sqlite` | Android 走预编译 AAR；Web 官方标 alpha，本库只用**异步 API** |

能力清单**不手写**：`npm install <包>` 之后跑 `npx moobile-host regen`，
它会读 `package.json` 生成注册表，并在启动时核对（缺什么就点名报错）。

---

## 3. 工作原理

```
   你的 MoonBit 应用        Model / Msg / update / view   ← 与 rabbita 同款 TEA 写法
        │
        │  视图用 @html DSL；样式用 @style（类型化，不是 CSS 字符串）
        ▼
   rabbita 运行时（vendor fork）   VNode 树 + Cmd / Sub + 事件派发 + 异步 effect
        │
        │  moobile 的翻译层：① 标签表 ② 事件映射 ③ 样式 map → RN style
        ▼
   React 元素（React.createElement 的产物，不是 DOM 节点、也不是 HTML 字符串）
        │
        ├──► React Native ──────► Android / iOS 原生视图
        └──► react-native-web ──► 浏览器 DOM
```

四条设计取舍（决定了上面这张图）：

1. **不实现渲染** —— 布局、排版、文本引擎交给 React / RN。
2. **只换挂载层** —— `Cmd` / `Emit` / 订阅 / 异步 effect 仍由 rabbita 自己的运行时执行。
3. **样式必须走类型化通道** —— RN 没有 CSS 类、也不吃 CSS 字符串。
4. **事件解码是可替换的策略** —— DOM 事件在 RN 上拿不到，所以解码点做成查表，
   换来的是"不崩、可降级"，不是"载荷等价"。

---

## 4. 例子、文档与贡献

| 想做什么 | 去哪 |
|---|---|
| 看一个真应用怎么写 | [`examples/apps/todo-app/`](examples/apps/todo-app/)（含 MoonBit 后端 [`examples/services/todo-server/`](examples/services/todo-server/)） |
| 用第三方 React 组件库（antd 等） | [`docs/design/DESIGN-COMPONENT-LIBRARY.md`](docs/design/DESIGN-COMPONENT-LIBRARY.md)（机制与缺口）｜试金石 [`examples/apps/antd-spike/`](examples/apps/antd-spike/)（怎么跑、判据） |
| 把库接进自己的项目（宿主包细节、契约、兼容表） | [`npm/moobile-host/README.md`](npm/moobile-host/README.md) |
| 跑起来 / 排错 / 环境 | [`DEV.md`](DEV.md) |
| 改这个库（构建、验证、发版、文档规矩） | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| 架构与契约（分层、宿主契约、发布形态） | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| 为什么这么设计 / 实测过什么 | [`docs/FINDINGS.md`](docs/FINDINGS.md)、[`docs/design/`](docs/design/) |
| 我们对 rabbita 改了什么（14 个 patch） | [`FORK.md`](FORK.md) |
| 接下来打算做什么 | [`PLAN.md`](PLAN.md) |
| 全部文档的三条路线 | [`docs/README.md`](docs/README.md) |

---

## 5. 许可证与第三方

**Apache License 2.0**，见 [`LICENSE`](LICENSE)。

本模块内含 [rabbita](https://github.com/moonbit-community/rabbita) 的 fork
（同为 Apache-2.0，来源版本 0.15.4）：版权声明、修改声明与分发形态见
[`THIRD-PARTY-NOTICE.md`](THIRD-PARTY-NOTICE.md)，改动明细见 [`FORK.md`](FORK.md)。
