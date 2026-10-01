# 可行性验证记录

> 本文件记录 moobile 设计所依赖的**全部实测数据**，每条附验证方式与原始输出。
> 目的：让每个决策都有可复现的依据，而不是印象。

**验证环境**

| 项 | 值 |
|---|---|
| 日期 | 2026-09 |
| MoonBit 工具链 | `moon 0.1.20260827 (d0aaa07 2026-08-27)` |
| 宿主 | Windows / Git Bash（MSYS），gcc 15.1.0 (MinGW64) |
| 样本项目 | `interest/yi`（RabiTa 0.15.4 / async 0.21.0） |
| 依赖源码位置 | `yi/zhouyi_reader/.mooncakes/moonbit-community/rabbita` |

---

## A. RabiTa 的结构边界

### A1. `Html` 只是 `VNode` 的包装，且暴露原始树

**方式**：读 `rabbita/html/html.mbt`

```moonbit
#alias(T)
pub(all) struct Html(@vdom.VNode) derive(Eq)

pub fn Html::to_virtual_dom(self : Html) -> @vdom.VNode {
  self.0
}
```

**结论**：可拿到原始树用于自定义渲染。这是 moobile 的接入点。

---

### A2. `VNode` 只有 4 个构造器

**方式**：读 `rabbita/internal/vdom/vdom.mbt`

```moonbit
#warnings("-unused_constructor")
pub enum VNode {
  Elem(String, Props, Children[VNode], namespace_uri~ : String?)
  Text(String)
  Frag(Array[VNode])
  Thunk(Int, () -> VNode)
}
```

**结论**：翻译函数是 4 分支递归。**这是本方案工作量最小的证据。**

---

### A3. `Props` 已含独立的结构化样式表

**方式**：读 `rabbita/internal/vdom/vdom.mbt:114`

```moonbit
pub struct Props {
  handlers : Map[String, (Event, &Scheduler) -> Unit]
  attrs : Map[String, String]
  props : Map[String, @variant.Variant]
  styles : Map[String, String]
}
```

**结论**：样式**已经是**每元素一份的结构化 map。

**附带发现（约束）**：`Variant` 只能承载原始类型，装不下自定义样式结构：

```moonbit
pub(all) enum Variant {
  Boolean(Bool); Integer(Int); Floating(Double); String(String)
}
```

→ 因此结构化样式必须走 `styles` 通道，不能走 `props` 通道。

---

### A4. 结构化样式的写入与消费路径是活的

**方式**：读 `rabbita/html/attrs.mbt:64` 与 `internal/vdom/diff.mbt`

写入：
```moonbit
pub fn Attrs::style(self : Attrs, key : String, value : String) -> Attrs {
  self.0.styles[key] = value
}
```

消费（含**增量 diff**）：
```moonbit
// diff.mbt:641-652
for key, _ in old.props.styles {
  if !new.styles.contains(key) { stylesheet.remove_property(key) |> ignore }
}
for key, value2 in new.styles {
  if old.props.styles.get(key) is Some(value1) { ... }
  else { stylesheet.set_property(key, value2) }
}
```

**结论**：非 DOM 后端可直接消费 `Map[String, String]`，**无需选择器匹配 / 层叠 / 优先级 / 继承**。

**⚠️ 已知坑**：`div(style=[...])` 便捷参数**不走**这条路：

```moonbit
// html/html_utils.mbt:2
fn push_style(style : Array[String], attrs : Attrs) -> Unit {
  if style.length() > 0 {
    ignore(attrs.attribute("style", style.join(";")))   // ← 拼成 attribute 字符串
  }
}
```

→ 使用结构化通道必须通过 `attrs=Attrs::build().style(k, v)`。这是唯一可能需要顺手修的地方。

---

### A5. `div` 的完整签名（元素 API 面）

**方式**：读 `rabbita/html/html.mbt:219`

```moonbit
pub fn[C : IsChildren] div(
  style? : Array[String] = [], id? : String, class? : String, title? : String,
  hidden? : Bool, on_click? : Cmd,
  on_mousedown? : Emit[Mouse], on_mouseup? : Emit[Mouse],
  on_scroll? : Emit[Scroll], on_keydown? : Emit[Keyboard], on_keyup? : Emit[Keyboard],
  attrs? : Attrs, children : C,
) -> Html
```

**结论**：元素已接受 `style?` 与 `attrs?`。**"改造元素"这一步不必要。**

---

### A6. 标签总数

**方式**：统计 `html/*.mbt` 中 `VNode::elem("<tag>"` 的字面量

```bash
grep -rhoE 'VNode::elem\("[a-z0-9]+"' html/*.mbt | sed 's/.*("//;s/"//' | sort -u | wc -l
# → 116
```

**结论**：`rabbita/html` 支持 **116 个标签**。

---

### A7. 挂载层依赖的 DOM 原语（12 个）

**方式**：全量枚举 `internal/vdom/*.mbt` 的 `.method(` 调用

```
8 insert_before      5 create_text_node   3 add_event_listener   1 remove_attribute
6 remove_child       3 set_attribute      2 set_node_value       1 create_element_ns
6 append_child       3 create_element      3 create_comment       1 create_document_fragment
```

**结论**：挂载接口面 = **12 个原语**。`diff.mbt` 共 766 行，但对外依赖仅此。

---

### A8. `dom/` 是纯绑定

**方式**：`ls rabbita/dom/` → 70+ 文件；抽样 `canvas_rendering_context2d.mbt`

```moonbit
#cfg(target="js")
#external
type CanvasRenderingContext2D

#cfg(target="js")
extern "js" fn checked_to_canvas_rendering_context_2d(value : @js.Value) -> ...
```

**结论**：全部是 `extern "js"` + `#cfg(target="js")`，无实现逻辑。

---

### A9. `rabbita` 根包传递依赖 vdom 与 js（拆包的依据）

**方式**：读 `rabbita/moon.pkg`

```
import {
  "moonbit-community/rabbita/html",
  "moonbit-community/rabbita/internal/runtime",
  "moonbit-community/rabbita/internal/vdom",      ← 
  "moonbit-community/rabbita/js",                 ← 
  ...
}
```

**结论**：`elmish` / `cell` 等状态 API 在根包，而根包传递依赖 DOM 耦合层。
→ **要"裁剪"，必须拆包（或最小 fork）。这是唯一需要动 RabiTa 的地方。**

---

## B. 编译目标验证

### B1. RabiTa 核心 + Html 树可编到 native ✅

**方式**：隔离模块（`/tmp/rbtest`），包内实现完整 Elm 架构并编译

```moonbit
enum Msg { Inc; Dec }
struct Model { count : Int } derive(Eq)
fn update(model, msg, _emit) -> (Model, @cmd.Cmd) { ... }
fn view(model, emit) -> Html { div([h1(...), button(on_click=emit(Inc), "+")]) }
pub fn app() -> @rabbita.App { @rabbita.elmish(model={count: 0}, update~, view~) }
```

```
$ moon build --target native probe
Finished. moon: ran 1 task, now up to date (3 warnings, 0 errors)
```

**结论**：**TEA 状态机 + `Val` + `Html` 树 DSL 均不依赖 DOM。**

---

### B2. `rabbita/dom` 编 native 失败 ❌（反向对照）

```
$ moon build --target native probe2      # import { "moonbit-community/rabbita/dom" }
Error: [4032]
Error: [4021]
Failed with 0 warnings, 2 errors.
```

**结论**：边界精确 —— 只有 `dom` / `js` 锁死 JS。

---

### B3. yi 的 frontend 无法编 wasm-gc

```
$ moon build --target wasm-gc frontend
Error: Package 'zhouyi/zhouyi_reader/frontend' does not support target
       backend 'wasm-gc'. Supported backends: [js]
```

**根因**：`rabbita/js/moon.pkg` 声明 `options(targets: { "*": [ "js" ] })`，`rabbita/dom` 依赖它，传递性锁死。

**结论**：**Wasm 救不了 UI。** 且就算能编，Wasm 无 DOM，`extern "js"` 与 canvas 绑定仍需重写。

---

### B4. `moon build --target` 可选值

```
possible values: wasm, wasm-gc, js, native, llvm
```

无 `android` / `ios`。移动端不靠 target，靠 native 产物交给 NDK / Xcode 交叉编译。

---

## C. MoonBit ↔ 宿主 的互操作能力

### C1. `#export_name` 产出稳定 C 符号 ✅

**方式**：最小 `foreign_library` 包 + `#export_name`，编译后检查生成 C

```c
// 生成的 api.c
int32_t zhouyi_add(int32_t _M0L5valueS1) { ... }        // 非 static，外部链接
moonbit_string_t zhouyi_hex_name(moonbit_string_t _M0L1sS2) { ... }
```

`moon build --target native` 的**链接阶段失败**（`LNK1561: 入口点必须定义`），与官方文档所述一致
（*native 后端不支持将 `foreign_library` 包导出为可链接库产物*）—— **但 C 源码在失败前已生成。**

**结论**：绕法 = **让 App 自己的构建系统编译这份 C**（Android: CMake+NDK；iOS: Xcode）。
`Nanaloveyuki/ajni` 正是此法。

---

### C2. 端到端 FFI 通路验证 ✅

**方式**：用 gcc 编译生成的 C + `~/.moon/lib/runtime/` 的 runtime 源码，链接成共享库，并用 C 宿主真实调用

```bash
$ gcc -shared -O1 api.o runtime.c utf.c env.c sync_io.c backtrace.c -D_CRT_RAND_S \
      -I~/.moon/include -o test.dll
$ nm -g test.dll | grep zhouyi
000000000000011d T zhouyi_add
00000000000000f0 T zhouyi_hex_name

$ ./test.exe
zhouyi_add(41)        = 42
zhouyi_hex_name("乾") = 3 个 UTF-16 码元 -> U+5366 U+003A U+4E7E    # "卦:乾"
```

**结论**：
- MoonBit → C ABI → 任意宿主（含 Dart FFI）**通路成立**
- `moonbit_string_t` 是 **UTF-16**（`typedef uint16_t *moonbit_string_t`），
  与 Dart `String` 内部表示一致 → 中文过边界近乎零转换成本
- 需注意引用计数约定（被调用者持有参数所有权）+ 启动调用 `moonbit_init()`

---

### C3. MoonBit JS 输出可直接作为 ES 模块被 import ✅

**方式**：最小包 + `options("link": { "js": { "format": "esm" } })` + `#export_name`

```js
// _build/js/debug/build/core/core.js
function _M0FP33exp5rcore4core18gua__qi__ring__len() { return 60; }
export { _M0FP33exp5rcore4core18gua__qi__ring__len as guaQiRing }
```

**结论**：React Native 跑 JS，MoonBit 编 JS —— **同一运行时**。
逻辑层可直接 `import`，**无 FFI、无桥接、无序列化、无跨平台编译**。
这是 RN 相对 Flutter 的结构性优势。

---

### C4. MoonBit were 输出零宿主依赖 ✅

**方式**：最小包编 `wasm-gc`，用 Node 检查

```js
IMPORTS: []
EXPORTS: [{ "name": "hex_add", "kind": "function" }]
```

```js
const inst = new WebAssembly.Instance(mod, {});   // 空 imports 即可实例化
inst.exports.hex_add(41)   // => 42
```

**结论**：纯计算包（如数据模型）的 wasm 产物**完全自包含**。
官方文档警示的 `spectest.print_char` 类宿主函数依赖仅出现在使用 `println`/`env` 的包上。

**备注**：纯 `wasm`（非 gc）后端本机编译失败，报 `prelude.mi: No such file or directory`
—— 属本地 SDK 未预编译 `wasm` bundle 的环境问题，非语言限制。已验证的是 `wasm-gc`。

---

## D. yi 项目的规模实测

### D1. Canvas API 面（仅 18 个）

**方式**：`grep -oE 'ctx\.[a-z_]+'` 全量统计

```
16 begin_path    9 stroke      8 close_path   3 translate   2 restore   1 set_stroke_style
12 arc           9 line_to     7 set_line_width  2 save     2 fill_rect 1 set_font
 8 fill          6 move_to     2 rotate          1 scale    1 fill_text 1 set_fill_style
```

**未使用**：渐变 / 阴影 / 虚线 / 贝塞尔 / `globalAlpha` / `measureText` / 像素读回。

**结论**：罗盘是纯绘制指令，**无布局需求**。可映射到任意 2D canvas（含 Flutter `CustomPainter`、Skia）。
文字宽度是**估算**而非测量（`label_w`：`s.length() * size * 1.02`，注释自述"无 measure_text"）。

---

### D2. CSS 规则与选择器构成

**方式**：解析 `backend/index.html` 的 `<style>` 块，按花括号扫描（含单行规则）

| 类型 | 数量 |
|---|---|
| **规则总数** | **198**（200 个 `{` 减去 2 个 `@media`） |
| 单类 `.foo` | 105 |
| 后代/子 `.a .b`、`.a > b` | 64 |
| 复合类 `.a.b` | 17 |
| 伪类/伪元素（`:hover` `::before` `[open]` `:last-child`） | 11 |
| 其他（`body`） | 1 |

**注意**：CSS 混用两种书写风格 —— 66 条多行规则 + 其余单行。
（初次统计漏了单行规则，得 64；修正后为 198。）

**关键样本**：
- `.m-yao-line.hl.yin` —— 三态复合（阴阳 × 变爻 × 高亮）
- `.m-ann > summary::before` + `.m-ann[open] > summary::before` —— 伪元素 + 属性选择器
- `.m-fold` —— **同一件事的另一实现**：MoonBit 直接渲染文本 `if is_open { "▾" } else { "▸" }`
  → **折叠箭头存在两套写法，移植时需统一**

---

### D3. 样式与逻辑的耦合面

**方式**：`grep -c 'class='` 与去重统计

| 项 | 值 |
|---|---|
| class 属性引用 | 122 处（`main.mbt` 112 + `colorring.mbt` 10） |
| 不同 class 名 | **90** |
| 内联 `style=` 属性 | **0** —— MoonBit 完全不发内联样式 |

**动态样式机制**：纯 class 切换，如

```moonbit
let line_cls = (if yang { "m-yao-line yang" } else { "m-yao-line yin" }) +
  (if is_bian { " bian" } else { "" }) +
  (if hl && !is_bian { " hl" } else { "" })
```

**结论**：**class 名就是逻辑与表现之间的契约**。表现层可在不碰 MoonBit 的前提下整体替换。

---

### D4. 配色重复定义 ⚠️

CSS `:root` 变量 vs MoonBit 常量，**逐字节相同但两处定义**：

| CSS 变量 | MoonBit 常量 | 值 |
|---|---|---|
| `--paper-0` | `c_paper` | `#f6efe0` |
| `--ink-0` | `c_ink` | `#1a1410` |
| `--ink-3` | `c_ink3` | `#7a6851` |
| `--vermilion-0` | `c_vermilion` | `#8a2518` |

**原因**：canvas 无法读取 CSS 自定义属性，绘制代码需字面量颜色。
**无任何机制保证同步。**

---

### D5. 资产同步机制

**方式**：`md5sum` 比对 + 读 `sync_webdist.ps1`

```
962095dcef8643e9c68c1956ed52bd8f  zhouyi_reader/backend/index.html
962095dcef8643e9c68c1956ed52bd8f  zhouyi_desktop/webdist/index.html
```

`sync_webdist.ps1` 拷贝三项：
`backend/index.html`（结构壳 + 全部 CSS）、`_build/js/release/.../frontend.js`、`assets/reader_data.json`

**结论**：`zhouyi_reader/backend/index.html` 同时是 HTML 与 CSS 的**唯一源头**。

---

### D6. 移动端适配的既有基础

**方式**：读 `_cdp_test.js` + `index.html`

- 已用 CDP `Emulation.setDeviceMetricsOverride` 在 **390×844 / DPR 3 / mobile:true** 下验证过渲染（模拟，非真机）
- `index.html` 已有 `viewport` meta、`touch-action: manipulation`、760px 与 640px 两级 `@media`
- `prepare_canvas` 正确处理 `devicePixelRatio`（`720 * d` 设 canvas 尺寸 + `ctx.scale(ratio)`）

---

## E. 生态包核实

### E1. `tiye/react@0.4.0` —— MoonBit 的 React 绑定

**方式**：读 mooncakes 文档 + GitHub 源码（`Respo/react.mbt`）

**机制**（`src/react.mbt`）：
```moonbit
extern "js" fn react_create_element(
  tag : String, props : @dom.JsObjectObscure, children : FixedArray[@dom.JsObscure],
) -> @dom.JsObscure =
  #| (tag, props, children) => globalThis.React.createElement(tag, props, ...children)

fn[T] any_to_js_value(v : T) -> JsObscure = "%identity"
fn[T] any_from_js_value(v : JsObscure) -> T = "%identity"
```

依赖：`tiye/dom-ffi@0.4.0`、`tiye/respo_css@0.1.7`、`moonbitlang/async@0.20.3`

**覆盖度**：核心渲染 / SSR（含 React 19.2 流式）/ 组件（memo、lazy、Suspense、Activity、ErrorBoundary）/ Hooks（含 `use_sync_external_store`、`use_async_action_state`）/ 54 个元素助手 / SVG / 12 类事件 / CSS-in-MoonBit。CI 含真实 Chromium 一致性测试。

**限制**：
- ⚠️ 自述 **"early project … Not recommended for production use"**
- ❌ **是 react-dom，不是 react-native**：`render(vdom, parent : @dom.Element)` 需 DOM 父节点；`tag` 是**字符串**
- 模块体系：MoonBit 与 ES Module 相互独立，JS 对象需挂到 `window`/`globalThis`

**结论**：证明 MoonBit↔React 桥可行；但**不能直接用于移动端**。

---

### E2. `tiye/respo_css@0.1.7` —— CSS-in-MoonBit 值层

```moonbit
pub(all) struct RespoStyle(Array[(String, String)]) derive(Eq, Default)
```

**值层类型化**：20+ 个 `Css*` 枚举，含 **`CssDisplay::Grid`** 与 **`CssPosition::Sticky`**。

**SCSS 式嵌套**（`tiye/react` 的 `static_style`）：
```moonbit
let style_demo : String = static_style(
  [("&", respo_style(margin=4 |> Px, background_color=Hsl(200, 90, 96)))],
)
```
- `&` 嵌套；`contained_static_style` 支持 `@media`
- `#callsite(autofill(loc))` → 由源码位置生成**确定性类名**
- SSR 安全：无 document 时只返回类名，不注入

**限制**：`RespoStyle` 是 **CSS 形状**（属性名是字符串），非目标中立 —— 后端仍需属性映射。

---

### E3. React Native 侧的约束（外部核实）

| 项 | 状态 | 来源 |
|---|---|---|
| 非 React 创建原生视图的公开 API | ❌ 无（旧 `UIManager.createView` 已入 C++） | RN 新架构讨论 |
| CSS `display: grid` | ⚠️ Yoga 进行中（PR 系列 "CSS Grid 1/9"），stable 不可依赖 | react/yoga PR #1893 |
| `position: sticky` | ❌ 原生不支持，需三方库 | `nandorojo/sticky` |
| 伪元素 `::before` | ❌ 无 | — |
| `linear-gradient` | ⚠️ 需 `expo-linear-gradient` 等 | — |
| 自定义渲染器（备选） | ✅ `react-reconciler` 是独立 npm 包 | npm |
| 逻辑层复用 | ✅ 同 JS 运行时，直接 import | 见 C3 |

**已否决参考**：MoonBit 编译到 Dart / Kotlin / Swift 的 `--target=X` 方向
（[官方论坛讨论](https://taolun.moonbitlang.com/t/topic/1117)）社区共识为不现实。

---

## F. 已否决方案的论证链

供后续回溯，避免重复评估。

| 方案 | 否决依据 |
|---|---|
| Proton 桌面壳 → 移动 | `supported_targets = "+native"`，keywords `desktop-app`；README 仅 Windows/Linux/macOS |
| 给 RabiTa 写 canvas 后端 | `diff.mbt` 直调 DOM 且全库**无任何布局代码**（搜 `layout`/`computed_style`/`getBoundingClientRect`/`text_wrap` 均为空）→ 边界在**布局之下**，补全等于写浏览器引擎 |
| RabiTa → wasm | B3（`+js` 锁死）+ Wasm 无 DOM |
| Flutter canvas 直渲 | 同上；且 Flutter 的 canvas 是 Dart 侧能力，C 侧无法构造 widget |
| Html 树 → 序列化 → Flutter | Flutter widget 是 Dart 对象，C/MoonBit 侧无创建 API；且失去同运行时优势（对比 C3） |
| `flutter_html` 类库白嫖 | 项目 CSS 依赖 grid / sticky / 伪元素 / 渐变，渲染类库普遍不支持；能正确渲染者本质是浏览器引擎，不如直接用 WebView |
| React Native 直接建视图（绕过 React） | E3 第一行 |
| MoonBit 编译成 Dart/Kotlin/Swift | F 末条 |

---

## G. RabiTa 的能力澄清（避免低估）

**RabiTa 不是"只生成 HTML"**，它是一个完整框架：

| 能力 | 内容 |
|---|---|
| TEA / Elm 架构 | `elmish` / `cell` / `create_state` / `create_resource` |
| **增量响应式** | `Val[T]` + `map2..map9` / `assoc` / `switch` / `enumerate`，**带相等性判断的变更传播** |
| 副作用 | `cmd`：`batch` / `delay` / `perform` / `attempt` / `effect` |
| 订阅 | `sub` |
| 网络 | `http` 客户端、`websocket` |
| 路由 | `nav` + `url`（含单测的 URL 解析器） |
| 图形 | `svg`（完整 attrs + 构建器）、`html/canvas` |
| 系统 | `dialog`、`clipboard` |
| **SSR** | `render_to_string` / `hydrate` / `hydrate_root`（`server` 包，target `native+wasm`） |
| 体积 | README 称 ~15 KB min+gzip（含流式 VDOM diff 与标准库） |

**可移植性边界**：

| 层 | 目标 | 实测 |
|---|---|---|
| `rabbita` 核心（TEA + `Val` + cmd/sub） | js+native+wasm | ✅ |
| `rabbita/html`（Html 树 DSL） | js+native+wasm | ✅ |
| `internal/vdom`（树 + diff + SSR） | js+native+wasm | ✅ |
| `svg` / `http` / `websocket` / `nav` / `url` | js+native+wasm | ✅ |
| **`rabbita/dom`**（70+ 文件 DOM 绑定） | **仅 js** | ❌ |
| **`rabbita/js`** | **仅 js** | ❌ |

**类比**：RabiTa 现在的位置 = **"有 react-dom，还没有 react-native"**。
React 从 2013 到 2015 的 RN 出现，中间即此状态。RN 做的事正是"保留组件/状态模型，另写 mount 后端"。
