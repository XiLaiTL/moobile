# moobile

> **用 MoonBit 写一次 UI，交给 React / React Native 渲染 —— Web 与 Android 一套代码。**

moobile 是给 [rabbita](https://github.com/moonbit-community/rabbita)（MoonBit 的 TEA 声明式 UI 框架）
**换一个渲染后端**：保留它的 `Model` / `Msg` / `update` / `view` 与 `@html` DSL，
把最后一跳从"操作 DOM"换成"产出 React 元素"。于是同一份 MoonBit 代码，
经 React Native 上安卓/iOS，经 react-native-web 上浏览器。

**状态**：地基通了 —— 模块可编译、**外部模块可依赖**、Web 端到端 **26/26**、
真机（Android 14 模拟器）验证过、**R1 文本排版判决通过**（见 `docs/FINDINGS.md`）。
**正题（把 `interest/yi`《御纂周易折中》阅读器搬上来）还没开始** —— 计划见 [`PLAN.md`](PLAN.md)。

> ⚠️ **还没发布到 mooncakes.io**（发布演练见 `PLAN.md` T7.4）。
> 现在想试用，走 §1.1 的**本地工作区**方式。
>
> **怎么读这份文档**：使用者看 §1 → §2；想理解为什么这么设计看 §3；要改这个库看 §4。

---

## 1. 快速上手

### 1.1 把库加进来

**今天（未发布）：把它当本地依赖**，用 `moon.work` 工作区（这也是 `_tools/ext_probe/`
那个"外部模块冒烟测试"用的办法，可以直接抄它）：

```bash
mkdir myapp && cd myapp
cat > moon.work <<'EOF'
members = [
  "D:/ai_project/interest/moobile",   # ← 本库所在的路径
  "app",
]
EOF
```

```toml
# app/moon.mod
name = "you/myapp"

version = "0.1.0"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.1.0",   # 版本号在工作区解析时被忽略
}
```

**发布之后**：`moon add XiLaiTL/moobile@0.1.0`，其余一样。

### 1.2 MoonBit 侧：写视图 + 导出四件套

```moonbit
// app/moon.pkg
import {
  "XiLaiTL/moobile" @moobile,     // ← 库本体就是模块根包
  "XiLaiTL/moobile/style",
  "XiLaiTL/moobile/html",
  "XiLaiTL/moobile/cmd",
}

options(
  link: {
    "js": {
      "format": "esm",
      "exports": [ "start", "snapshot", "subscribe", "element" ],
    },
  },
)
```

```moonbit
fn view(m : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(
      @style.Style::new().font_size(16.0).padding_horizontal(@style.px(12.0)),
    ),
    [ @html.button(on_click=emit(Bump), ["+1"]) ],
  )
}

pub fn start() -> @moobile.Mount { @moobile.mount(init, update, view) }
pub fn snapshot() -> Int { /* Mount::snapshot */ }
pub fn subscribe(f : (Int) -> Unit) -> () -> Unit { /* Mount::subscribe */ }
pub fn element() -> @moobile.JsValue { /* Mount::element */ }
```

> **为什么四件套要应用自己写**：导出的函数必须是**单态**的，而 `mount` 对 `Model`/`Msg` 泛型。
> 样板见 `demo/main.mbt`（30 行）。

### 1.3 JS 侧：30 行宿主

```js
import * as Bridge from './myapp.js';

globalThis.MOBILE_HOST = {
  react: React,
  components: { View, Text, Pressable, TextInput, ScrollView },  // 必须恰好提供这 5 个
  scheduleTask,   // 微任务
  scheduleFrame,  // rAF（RN 里没有 window）
};

Bridge.start();

export default function App() {
  useSyncExternalStore(Bridge.subscribe, Bridge.snapshot);
  return Bridge.element();
}
```

参考实现就在 `host/App.js`（一个根组件 + 一个订阅点，仅此而已）。

### 1.4 跑起来

```bash
moon build --target js
cp _build/js/debug/build/app/app.js <你的 Expo 工程>/myapp.js
cd <你的 Expo 工程> && npx expo start --port 8081
# 浏览器 http://localhost:8081 ；模拟器/真机先 `adb reverse tcp:8081 tcp:8081`
```

本仓库的 `build.sh` 做的就是上面这两步（`demo` 的产物 → `host/moobile.js`）。
环境、真机流程、排错、**禁区** → [`DEV.md`](DEV.md)。

---

## 2. 能力边界（上手前先看这张表）

| 项 | 现状 |
|---|---|
| 标签 | **42 条**有映射（`render.mbt` 的 `tag_table()`）；**12 条明确排除**并写明理由（`excluded_tags()`）：`img` `video` `audio` `canvas` `svg` `table` `iframe` `select` `details` `summary` `dialog` `marquee` |
| 未收录标签 | 兜底成 `View`（不崩），但**会计数** —— `unmapped_tag_count()`，验证脚本断言为 0 |
| 不可移植节点 | `Children::RawHtml` 会被跳过并计数（`unsupported_count()`） |
| 事件载荷 | `Mouse` / `Keyboard` / `Scroll` 在 React 后端**一律是零值**：能写、不崩、**拿不到坐标**。真实手势要接 RN 手势通道（`PLAN.md` T3.4） |
| target | **只支持 `js`**（`moon check --target native` 会失败，见 `docs/ARCHITECTURE.md` §4.4-3） |
| 样式 | 类型化 `StyleValue`；`class=` 与 `style="…"` 在 RN 上**不生效**（前者 RN 无类名，后者会被类型化样式覆盖）—— **这两件不报错，只是没效果** |
| 宿主组件 | 必须提供 `View` `Text` `Pressable` `TextInput` `ScrollView` 五个；缺哪个，对应标签就变 `undefined` |

**这些边界是可测量的**：`node _verify.js` 把"未收录标签 = 0""不可移植节点 = 0""布局无溢出"都做成了断言。

---

## 3. 原理

```
   你的 MoonBit 应用
   Model / Msg / update / view          ← 与 rabbita 完全同款的 TEA 写法
        │
        │  视图用 @html DSL 写；样式用 @style（类型化，不是 CSS 字符串）
        ▼
┌────────────────────────────────────────┐
│  VNode 树 + Cmd / Sub 运行时            │  vendor 的 rabbita
│  （事件派发、订阅、异步 effect 都在这跑）│  （fork：15 个 patch，见 FORK.md）
└────────────────────────────────────────┘
        │
        │  moobile/render.mbt —— 翻译层，只做三件事：
        │    ① 标签表：42 条 HTML 标签 → RN 组件名（div→View、span→Text…）
        │    ② 事件映射：click→onPress、input→onChangeText…（要结合目标标签判断）
        │    ③ 样式 map → RN 的 style 对象
        ▼
┌────────────────────────────────────────┐
│  React 元素                             │  ← React.createElement(...) 的产物，
│  （不是 DOM 节点，也不是 HTML 字符串）   │     直接交给 React 渲染
└────────────────────────────────────────┘
        │  宿主 host/App.js（约 30 行）把它交给 React
        ├──────────────►  React Native  ──────►  Android / iOS 原生视图
        └──────────────►  react-native-web ──►  浏览器 DOM
```

### 谁负责什么

| 层 | 在哪 | 归属 |
|---|---|---|
| 宿主（JS） | `host/` —— Expo + React + RN + react-native-web | 应用侧 |
| **FFI 边界** | 模块根 `host.mbt` —— 全套代码里 `%identity` 不安全性**唯一的集中地** | 我们 |
| **翻译层** | 模块根 `render.mbt` —— 标签表 42 条 + 排除表 12 条 + 样式/事件映射 | 我们 |
| **TEA 挂载** | 模块根 `app.mbt` —— `mount(model, update, view) -> Mount` | 我们 |
| vendor 运行时 | `internal/runtime/react_host.mbt` —— 把最后一跳换成"产出 React 元素" | 我们（fork 新增） |
| 树 / DSL / 样式 | `internal/vdom/`、`html/`、`cmd/`、`sub/`、`dom/`（vendor）+ 公开包 `style/` | vendor + 我们 |

### 四条设计原则（决定了上面这张图的样子）

1. **不实现渲染。** 布局、排版、文本引擎全部交给 React / RN。
   凡是 RN 已有的能力，moobile 只用不造（设计文档 §10 原则 1）。
2. **只换挂载层。** `Cmd` / `Emit` / 订阅 / 异步 effect **仍由 rabbita 自己的运行时执行** ——
   所以 `on_click=emit(Msg)` 这种照抄 yi 的写法可以直接跑。
3. **样式必须走类型化通道。** RN 没有 CSS 类、也不吃 CSS 字符串，
   所以样式写成 `Attrs::styles(@style.Style::new().font_size(16.0))`；
   "长度必须带单位、无单位量必须是数字"这类规则由**类型**保证。
4. **事件解码是策略，不是硬编码。** DOM 事件在 RN 上拿不到，
   于是把 13 处解码点做成**可替换的查表**：换掉一张表，`on_input` 这类处理器就换了语义
   —— 换来的是"**不崩、可降级**"，不是"载荷等价"。

---

## 4. 开发者相关

### 4.1 仓库结构

**我们自己的**（git 跟踪）：

| 路径 | 是什么 |
|---|---|
| `moon.pkg` + `host.mbt` `render.mbt` `app.mbt` `store.mbt` `schedule.mbt` | **库本体**（模块根包） |
| `style/` | **公开包**：类型化样式层（使用者写视图的入口） |
| `demo/` | 演示应用（待办 + R1 排版样本） |
| `host/` | Expo 宿主：`App.js` + 一个根组件 |
| `_tools/` | 环境脚本 + `vendor_sync.sh` / `patches/`（见 4.3） |
| `_verify.js` `_r1.js` | 验证与测量脚本 |
| `_r1/` | R1 的测量产出与原始数据 |

**第三方（rabbita fork）不进仓**：`html/` `cmd/` `dom/` `js/` `internal/` `sub/` `svg/` … 共 16 个目录
是**生成物**。

### 4.2 开发与验证

**全新 clone 的第一件事**（第三方代码不在仓里，不跑这步 `moon check` 会报找不到包）：

```bash
bash _tools/vendor_sync.sh --apply     # 拉 rabbita@0.15.4 → 铺开 → 打 patch → 统一行尾
```

日常：

```bash
moon check --target js        # 类型检查
./build.sh                    # 产物 → host/moobile.js
cd host && npx expo start     # Web 预览 http://localhost:8081（或手机扫码）

node _verify.js               # Web 端到端 26 项断言（需 Metro 在 8081）
bash _tools/check_external.sh # 外部模块可用性：别的模块能不能依赖这个库
bash _tools/vendor_sync.sh --check   # 断言「工作区 == 上游 + patch」（提交前/CI）
bash _tools/lf_normalize.sh --check  # 行尾检查
```

### 4.3 第三方代码怎么来的（生成式 vendor）

| 项 | 做法 |
|---|---|
| 版本 | `_tools/vendor.lock` 的 `RABBITA_VERSION=0.15.4`（注册表制品，不可变） |
| 改动 | `_tools/patches/*.patch`（15 个，共约 983 行） |
| 生成 | `_tools/vendor_sync.sh --apply`（`--capture` 回写、`--from <版本>` 试升级） |
| 为什么必须铺在模块根 | MoonBit 的 `internal` 可见性按包路径前缀判 —— 放 `vendor/` 子目录会让 `internal/vdom` 对模块根包不可见 |
| ⚠️ 改了要回写 | 第三方目录是 gitignore 的，`git status` **不会**提醒你漏了 `--capture` |

逐条说明、上游版本现状与升级演练 → [`FORK.md`](FORK.md)。

### 4.4 许可证与第三方

**Apache License 2.0**（见 [`LICENSE`](LICENSE)）。

本模块内含 [rabbita](https://github.com/moonbit-community/rabbita) 的 fork（同为 Apache-2.0，
来源版本 0.15.4，我们做了 15 处修改）—— 版权声明、修改声明与分发形态见
[`THIRD-PARTY-NOTICE.md`](THIRD-PARTY-NOTICE.md)，改动明细见 [`FORK.md`](FORK.md)。

---

## 5. 文档导航

| 文档 | 内容 |
|---|---|
| [`PLAN.md`](PLAN.md) | **剩余工作计划**：分阶段待办、完成判据、风险与决策点 |
| [`DEV.md`](DEV.md) | **环境与运行手册**：工具链、磁盘布局、Web/安卓怎么起、排错表、禁区 |
| [`FORK.md`](FORK.md) | **对 rabbita 改了什么**：15 个 patch 逐条说明 + 跟版/升级流程 + 上游化提案 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | **架构总览 + 发布成库的可行性**：分层与契约、依赖闭包、发布体检 |
| [`docs/FINDINGS.md`](docs/FINDINGS.md) | **实现侧实测结论**：R1 判决、样式差集、DOM 缝隙普查、逐条发现（原 README） |
| [`docs/DESIGN.md`](docs/DESIGN.md) | 设计文档（主）：定位、架构、路线图、未决问题 |
| [`docs/EVIDENCE.md`](docs/EVIDENCE.md) | 设计期可行性证据：实测数据、复现方式、已否决方案的论证链 |
