# FORK.md —— 我们对 rabbita 的改动清单

> **为什么有这个文件**：moobile 把 `moonbit-community/rabbita@0.15.4` vendor 进了本模块
> （原因见 `README.md` 的「fork 配方」）。当前策略是 **vendor 跟版**，
> 因此必须有一份**精确、可重放**的改动清单 —— 否则 rabbita 一发版就得靠考古。
>
> 这份清单同时也是将来上游化的提案基础。
>
> 记录日期：2026-09（对应 rabbita 0.15.4）

---

## 0. vendor 方式

| 项 | 做法 |
|---|---|
| 位置 | 模块根下（`html/` `cmd/` `dom/` `internal/` …），与我们自己的 `moobile/` `style/` `demo/` 平级 |
| 模块名 | `XiLaiTL/moobile`（原 `moonbit-community/rabbita`） |
| 为什么必须在同一模块 | `internal` 包的可见性是**按模块**判的；只有同模块才能 import `internal/vdom` |
| 关键约束 | **`internal/` 必须直接在模块根下**（嵌在 `vendor/internal/` 里会被判为不可见） |

## 1. 跟版时的重放步骤（机械化，无脑可做）

```bash
# 1) 移除旧 vendor（保留我们自己的目录与文件）
rm -rf html cmd sub nav url svg server clipboard dialog common variant \
       http websocket dom js internal
rm -f *.mbt moon.pkg README.mbt.md

# 2) 从新版 rabbita 拷入
R=<新版 rabbita 源码目录>
for d in clipboard cmd common dialog dom html http internal js nav server sub svg url variant websocket; do
  cp -r "$R/$d" .
done
cp $R/*.mbt . && cp $R/moon.pkg . && cp $R/README.mbt.md .

# 3) 删掉生成物（moon info 会重生成）；保留手写的 js.mbti
find html cmd common dom internal js nav server sub svg url variant websocket \
     -name "pkg.generated.mbti" -delete

# 4) 改模块名前缀（67 处，全在 moon.pkg）
for d in <同上列表>; do
  grep -rl 'moonbit-community/rabbita' "$d" | xargs -r sed -i 's|moonbit-community/rabbita|XiLaiTL/moobile|g'
done
sed -i 's|moonbit-community/rabbita|XiLaiTL/moobile|g' moon.pkg *.mbt

# 5) ★ 修根包别名：路径改名后推导出的别名会从 @rabbita 变成 @moobile，
#    但代码里写的是 @rabbita。显式补上别名即可（只有 2 处）。
#    ⚠️ 模式串**必须带结尾引号**：`XiLaiTL/moobile` 是 `XiLaiTL/moobile/html` 等
#       所有子包路径的前缀，不带引号会一次性改坏一大片。
grep -rl '"XiLaiTL/moobile"' --include=moon.pkg . | grep -v '^./host/' \
  | xargs -r sed -i 's|"XiLaiTL/moobile"|"XiLaiTL/moobile" @rabbita|g'
#    改完复查这两处（其余子包别名都是从末段推导的，不受影响）：
#      html/moon.pkg 与 server/moon.pkg 的 `for "test"` / 主 import 段

# 6) 然后按下面 §2 逐条重放语义改动
moon check --target js && moon test --target js -p XiLaiTL/moobile/internal/vdom
```

> ⚠️ 第 1 步只会删掉 **vendor 自己的目录**。我们自己的 `moobile/`、`style/`、`demo/`、
> `host/`、`_tools/`、`_r1/` 与根下几个 `.mbt` 之外的脚本**都不在删除列表里**，
> 唯一会被连带删掉的是 `internal/runtime/react_host.mbt`（§2.7）—— 记得重放它。
> `style/` 自 T0.0 起就在**模块根下**（不在 `internal/` 里），所以不再受影响。

## 2. 语义改动清单（必须逐条确认，不能只靠 sed）

### 2.1 `style/` —— **新增包**（不属于 rabbita）

`StyleValue` + `Style` + 关键字枚举。这是 moobile 自己的类型化样式层，
**故意不含** `grid` / `sticky` / 伪元素构造器。
自 T0.0 起它是**公开包**（原来叫 `internal/style/`）：使用者要能在自己的模块里写
`@style.Style::new().font_size(16.0)`，所以不能躺在 `internal/` 底下。

### 2.2 `internal/vdom/vdom.mbt`

| # | 改动 | 说明 |
|---|---|---|
| A | `Props.styles` 类型：`Map[String, String]` → `Map[String, @style.StyleValue]` | 加宽成类型化值 |
| B | `Event` 类型：`#cfg(target="js") type Event = @dom.Event` → `#external pub type Event` | **解耦**：不再别名 `@dom.Event`，且对外可命名 |
| C | 新增 `dom_event` / `pub as_dom_event` | 边界强转（`%identity`），DOM 侧用 |
| D | 新增 `Props::empty / styles / on / attr / prop / styles_map / attrs_map / props_map / each_handler` | `Props` 字段是私有的，外部包既读不到也注册不了事件；这组是必要的对外入口 |

### 2.3 `internal/vdom/diff.mbt`

| # | 改动 |
|---|---|
| A | 2 处 `add_event_listener`：`(slot.val)(event, …)` → `(slot.val)(dom_event(event), …)` |
| B | 样式消费：`stylesheet.set_property(key, value)` → `set_property(@style.css_property_name(key), value.to_css())`（2 处） |

### 2.4 `internal/vdom/ssr.mbt`

| # | 改动 |
|---|---|
| A | `write_styles_attr` 的 `styles` 参数类型加宽，并按 `css_property_name` + `to_css()` 输出 |

### 2.5 `html/`

| # | 文件 | 改动 |
|---|---|---|
| A | `attrs.mbt` | 删除 `Attrs::style(key : String, value : String)`，换成 `Attrs::styles(s : @style.Style)` |
| B | `attrs.mbt` | `using @dom {type Event}` → `using @vdom {type Event}`（含删掉 `#cfg(not(js)) type Event = Unit`） |
| C | `event_decoders.mbt` | **新增文件**：`EventDecoders` 解码表 + `dom_decoders()` + `passthrough_decoders()` + `pub let event_decoders`；`moon.pkg` 里把该文件限定为 js |
| D | `attrs_event.mbt` | **13 处**解码点改为查表：7 个 `on_*_event` 的 `event.to_xxx_event().unwrap()`、3 处 `on_input/change/beforeinput`、`on_submit/on_reset` 的 `msg(@vdom.as_dom_event(event))` |
| E | `html_utils.mbt` | 新增 `pub let form_value_from_event : Ref[(Event) -> String]` + `dom_form_value`；`current_form_value` 改收 `Event` |
| F | `html_utils.mbt` | 2 处 `prevent_default()` / `target()` → 先 `@vdom.as_dom_event(event)`；`push_mousedown/mouseup/keydown/keyup/scroll` 的载荷改查表 |
| G | `packages` | `html/moon.pkg` 加 `style`、`moonbitlang/core/ref` |

> **为什么用"一张表"而不是"逐个修"**：普查（`_r1/dom_survey.txt`）显示
> `html/` + `svg/` 里共 45 处 `@dom.`，其中**同一形状的 panic 有 13 个**
> （mouse / keyboard / focus / drag / clipboard / composition / wheel /
> input / submit / Mouse / Keyboard / Scroll …）。
> 只修 mouse 那一处等于把同样的雷留给其余 12 个 ——
> 而 **yi 的罗盘拖拽（`on_mousedown/move/up` 读 `Mouse` 坐标）正好踩在里面**。
>
> **换来的语义要说清楚**：是"**不崩、可降级**"，不是"载荷等价"。
> `Mouse`/`Keyboard`/`Scroll` 在 React 后端一律返回**零值**，
> 读取它们的处理器会拿到 0 —— 真实手势数据要接 RN 手势系统（设计文档 R2）。

### 2.6 `svg/`

| # | 改动 |
|---|---|
| A | `attrs.mbt`：`Attrs::style(key, value)` → `Attrs::styles(s : @style.Style)` |
| B | `moon.pkg` 加 `style` |

### 2.7 `internal/runtime/react_host.mbt` —— **新增文件**（moobile 的 React 后端）

约 220 行,照搬 `host_browser.mbt`，只把最后一跳从 `document.update(vnode)` 换成 `(self.frame)(output.read())`；
另加：可注入的 `schedule_task` / `schedule_frame`（RN 没有 `window`）、同步 `start()`、`on_frame` 注册、诊断计数器。
`internal/runtime/moon.pkg` 的 `options(targets:)` 加 `"react_host.mbt": ["js"]`。

### 2.8 `moon.mod`

新增依赖（rabbita 原有的）：`moonbitlang/async@0.21.0`、`hackwaly/moonback@0.8.1`、`moonbitlang/x@0.5.1`。

---

## 3. 上游化提案（将来用）

按"最小、可独立接受"的顺序：

1. **`Event` 不要别名 `@dom.Event`** —— 让 `vdom` 拥有一个不透明的 `Event`，DOM 侧在边界转。
   收益：`Props` 的公开签名不再含 `@dom`；外部包可以正常注册事件处理器。
   （我们实测：不改这个，外部包**根本没法写 handler**。）
2. **几处 DOM 事件解码做成可替换策略**（`form_value_from_event` / `mouse_event_from_dom`）。
   `mouse` 那处现在在**任何非浏览器宿主上都会 panic**，不只是 RN。
3. **`Props` 补一组访问器/构造器**（`empty` / `style` / `on` / `attr` / `each_handler`），
   理由同上：字段私有导致非 DOM 后端无法使用这个类型。
4. **`internal/vdom` 拆成 `tree` + `dom` 两个包** —— 让树这一层彻底不依赖 `dom`。
   （我们**没做**：需要公开 `vdom` 的大量私有内部，收益 0 字节。上游做才对。）
5. `Props.styles` 加宽成类型化值 —— 这条上游不一定要接受，属设计取向。

## 4. 已知未验证项

- **`diff.mbt`（DOM 后端）只跑过 vendored 的 mock-DOM 单测**（4/4 通过），
  没有在真实浏览器里跑过完整的 rabbita Web 应用。
- `hydrate.mbt` / `ssr.mbt` 我们没碰，也未验证。
