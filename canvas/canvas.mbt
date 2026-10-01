///|
/// canvas 通道 —— 把 **canvas 绘制指令**翻译成 React Native 上的 Skia 元素树。
///
/// ## 它解决什么问题
///
/// `render.mbt` 的标签表**明确排除** `canvas`（`excluded_tags()` 的第 5 条：
/// "RN 无 canvas —— 接 `react-native-skia`"）。今天写 `<canvas>` 的后果是
/// **回落成一个空 `View` 并计数** —— 画不出东西，也不报错。
///
/// 设计文档早把它标成"唯一一张标签表搞不定"的地方（`DESIGN.md` §R3），
/// 但方案一直没定。本包就是那份方案：**不新开通道**，而是复用**组件通道**
/// （`库名:组件名` + `prop_json`）—— 与 antd 的 `Table.columns` 走的是同一条路。
///
/// ## 三个角色
///
/// ```text
/// 应用（或从 yi 迁移过来的代码）
///   用 `OpCtx` 记绘制指令           ← 方法名与 DOM 的 CanvasRenderingContext2D **逐字相同**
///   → `canvas(ops, w, h)`            ← 产出一个组件通道的标签节点
///        │  @html.node("moobile:Canvas", …prop_json("ops", …))
///        ▼
/// 宿主（`moobile-host/canvas-skia.js` 或应用自己）
///   registerLibrary({ components: { Canvas: SkiaCanvas }, jsonProps: { Canvas: ["ops"] } })
///        │  ops[] → Skia 元素树
///        ▼
/// @shopify/react-native-skia 的 <Canvas>     ← 真机上真正渲染的东西
/// ```
///
/// ## 为什么方法名要和 DOM 一样（这条是刻意的）
///
/// `interest/yi` 的罗盘（`frontend/colorring.mbt`，439 行）就是**用
/// `@dom.CanvasRenderingContext2D` 画的**。方法名逐字相同意味着迁移是**换一个类型**，
/// 而不是重写绘制逻辑 —— 这正是 `DESIGN.md` 阶段 5 那句"前端视图代码基本不动"的落点。
///
/// ## 词汇表是**有界**的（18 条，量出来的不是拍的）
///
/// yi 全量统计：`begin_path` 16 · `arc` 12 · `stroke` 9 · `line_to` 9 · `fill` 8 ·
/// `close_path` 8 · `set_line_width` 7 · `move_to` 6 · `translate` 3 · `save` 2 ·
/// `rotate` 2 · `restore` 2 · `fill_rect` 2 · `set_stroke_style` / `set_font` /
/// `set_fill_style` / `scale` / `fill_text` 各 1 —— **18 种，一条不多**。
/// 配合 `DESIGN-FEASIBILITY.md` §D1 的另一条实测（无渐变 / 阴影 / 虚线 / 贝塞尔 /
/// `globalAlpha` / `measureText` / 像素读回），映射到 Skia 只需要
/// path + fill + stroke + transform + text。
///
/// ## 载荷形态：JSON 文本数组
///
/// 每条 op 是一个**数组**（`["move_to", 1.0, 2.0]`），整个列表序列化成一段 JSON 文本，
/// 走 `Attrs::prop_json`。六十四卦那一档实测 **5335 条 op / 181 KB**。
/// 用数组而不是对象（`{"op":"move_to","x":1,…}`）省 **31%**。
///
/// ⚠️ **tag 名保留完整拼写**（`move_to` 而不是 `mv`）：实测换成 2 字母只再省几个百分点，
/// 而完整名字让 diff、日志、报错都直接可读。省下的体积不值得换来"看不懂的载荷"。
///
/// ## 谁渲染
///
/// **库不依赖 Skia**（`moon.mod` 一个依赖都不加，这是禁区）。Skia 由**宿主/应用**提供，
/// 与 antd 由应用 `npm install` 是同一个分工。库这一侧只负责
/// "把绘制指令说清楚"，并**不**假装知道对面用什么渲染。

///|
/// 组件通道里的标签名。宿主注册的键就是它。
pub let canvas_tag : String = "moobile:Canvas"

///|
/// 绘制指令那个 prop 的键名。宿主的 `jsonProps` 白名单里必须是这个名字
/// （否则 `JSON.parse` 不会发生，组件拿到一串字符串）。
pub let ops_prop : String = "ops"

///|
/// **绘制指令**：canvas 的 18 个调用，一一对应。
///
/// 变体名与 DOM 的 `CanvasRenderingContext2D` 方法名同义 —— 迁移是换类型，不是重写。
pub enum DrawOp {
  BeginPath
  MoveTo(Double, Double)
  LineTo(Double, Double)
  /// `cx, cy, r, start_angle, end_angle, anticlockwise`（与 DOM 的 `arc` 同参）
  Arc(Double, Double, Double, Double, Double, Bool)
  ClosePath
  FillRect(Double, Double, Double, Double)
  Fill
  Stroke
  SetLineWidth(Double)
  SetFillStyle(String)
  SetStrokeStyle(String)
  SetFont(String)
  FillText(String, Double, Double)
  Save
  Restore
  Translate(Double, Double)
  Rotate(Double)
  Scale(Double, Double)
} derive(Debug, Eq)

///|
/// 数字 → JSON 数字文本。
///
/// ⚠️ 三条都是**契约**（对面是 JS 的 `JSON.stringify`），不是实现细节：
///
/// 1. **整数值不写小数点**：`360.0` → `"360"`（MoonBit 的 `Double::to_string` 本来就这样，
///    与 JS 一致；这里显式写出来，免得以后换格式化方法时静默漂移）。
/// 2. **`-0.0` 归零**：JSON 里 `-0` 合法但没意义，两边写法容易不一致 → 统一成 `0`。
/// 3. **非有限值当场报错**：NaN / Infinity 在 JSON 里没有表示（JS 的 `JSON.stringify`
///    会静默给 `null`）。静默变成 `null` 就是"上线才发现"的那类 bug，所以这里 `abort`。
fn num_to_json(d : Double) -> String {
  if d.is_nan() || d.is_inf() {
    abort("moobile/canvas: 绘制指令里的坐标/角度是 NaN 或 Infinity —— JSON 表达不了它，拒绝静默变成 null")
  }
  if d == 0.0 {
    return "0"
  }
  if d == d.floor() && d.abs() < 1.0e15 {
    return d.to_int().to_string()
  }
  d.to_string()
}

///|
/// 字符串 → JSON 字符串字面量（转义引号、反斜杠与控制字符）。
///
/// 不必做到"支持所有 Unicode 转义"——只要**不产出非法 JSON**：
/// 未转义的 `"` 或换行会让整段载荷解析失败，而失败发生在宿主侧，
/// 那时离出错的地方已经很远了。
fn str_to_json(s : String) -> String {
  let buf = StringBuilder()
  buf.write_char('"')
  for ch in s {
    match ch {
      '"' => buf.write_string("\\\"")
      '\\' => buf.write_string("\\\\")
      '\n' => buf.write_string("\\n")
      '\r' => buf.write_string("\\r")
      '\t' => buf.write_string("\\t")
      _ => {
        if ch.to_int() < 0x20 {
          buf.write_string("\\u00")
          let hex : Array[Char] = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f']
          buf.write_char(hex[ch.to_int() / 16])
          buf.write_char(hex[ch.to_int() % 16])
        } else {
          buf.write_char(ch)
        }
      }
    }
  }
  buf.write_char('"')
  buf.to_string()
}

///|
/// 单条 op → JSON 数组文本（内部用；`ops_to_json` 负责拼成一个数组）。
fn op_to_json(op : DrawOp, buf : StringBuilder) -> Unit {
  match op {
    BeginPath => buf.write_string("[\"begin_path\"]")
    MoveTo(x, y) => {
      buf.write_string("[\"move_to\",")
      buf.write_string(num_to_json(x))
      buf.write_char(',')
      buf.write_string(num_to_json(y))
      buf.write_char(']')
    }
    LineTo(x, y) => {
      buf.write_string("[\"line_to\",")
      buf.write_string(num_to_json(x))
      buf.write_char(',')
      buf.write_string(num_to_json(y))
      buf.write_char(']')
    }
    Arc(cx, cy, r, start, end, anticlockwise) => {
      buf.write_string("[\"arc\",")
      buf.write_string(num_to_json(cx))
      buf.write_char(',')
      buf.write_string(num_to_json(cy))
      buf.write_char(',')
      buf.write_string(num_to_json(r))
      buf.write_char(',')
      buf.write_string(num_to_json(start))
      buf.write_char(',')
      buf.write_string(num_to_json(end))
      buf.write_string(if anticlockwise { ",true]" } else { ",false]" })
    }
    ClosePath => buf.write_string("[\"close_path\"]")
    FillRect(x, y, w, h) => {
      buf.write_string("[\"fill_rect\",")
      buf.write_string(num_to_json(x))
      buf.write_char(',')
      buf.write_string(num_to_json(y))
      buf.write_char(',')
      buf.write_string(num_to_json(w))
      buf.write_char(',')
      buf.write_string(num_to_json(h))
      buf.write_char(']')
    }
    Fill => buf.write_string("[\"fill\"]")
    Stroke => buf.write_string("[\"stroke\"]")
    SetLineWidth(w) => {
      buf.write_string("[\"set_line_width\",")
      buf.write_string(num_to_json(w))
      buf.write_char(']')
    }
    SetFillStyle(color) => {
      buf.write_string("[\"set_fill_style\",")
      buf.write_string(str_to_json(color))
      buf.write_char(']')
    }
    SetStrokeStyle(color) => {
      buf.write_string("[\"set_stroke_style\",")
      buf.write_string(str_to_json(color))
      buf.write_char(']')
    }
    SetFont(font) => {
      buf.write_string("[\"set_font\",")
      buf.write_string(str_to_json(font))
      buf.write_char(']')
    }
    FillText(text, x, y) => {
      buf.write_string("[\"fill_text\",")
      buf.write_string(str_to_json(text))
      buf.write_char(',')
      buf.write_string(num_to_json(x))
      buf.write_char(',')
      buf.write_string(num_to_json(y))
      buf.write_char(']')
    }
    Save => buf.write_string("[\"save\"]")
    Restore => buf.write_string("[\"restore\"]")
    Translate(x, y) => {
      buf.write_string("[\"translate\",")
      buf.write_string(num_to_json(x))
      buf.write_char(',')
      buf.write_string(num_to_json(y))
      buf.write_char(']')
    }
    Rotate(rad) => {
      buf.write_string("[\"rotate\",")
      buf.write_string(num_to_json(rad))
      buf.write_char(']')
    }
    Scale(x, y) => {
      buf.write_string("[\"scale\",")
      buf.write_string(num_to_json(x))
      buf.write_char(',')
      buf.write_string(num_to_json(y))
      buf.write_char(']')
    }
  }
}

///|
/// 一串 op → **载荷 JSON**（紧凑数组）。这就是进组件的那个字符串。
pub fn ops_to_json(ops : Array[DrawOp]) -> String {
  let buf = StringBuilder(size_hint=ops.length() * 24)
  buf.write_char('[')
  let mut first = true
  for op in ops {
    if !first {
      buf.write_char(',')
    }
    first = false
    op_to_json(op, buf)
  }
  buf.write_char(']')
  buf.to_string()
}

///|
/// **绘制收集器**：方法名与 DOM 的 `CanvasRenderingContext2D` 逐字相同。
///
/// 于是把 yi 那样的绘制代码迁移过来，改动是"参数类型从 `@dom.CanvasRenderingContext2D`
/// 换成 `@canvas.OpCtx`"，**函数体一行不用动**（见本文件顶部的迁移说明）。
///
/// ⚠️ 它是**纯记账**，不做任何绘制、也不做任何几何计算：
/// `arc` 就原样记下"圆心/半径/起止角/方向"，把弧转成路径是**宿主适配器**的事
/// （那里才知道对面是 Skia 还是别的东西）。这条分工是有意的 —— 库不该长出一个渲染器。
pub struct OpCtx {
  mut ops : Array[DrawOp]
}

///|
pub fn OpCtx::new() -> OpCtx {
  { ops: [] }
}

///|
/// 取走累积的指令（取走后收集器清空 —— 便于"一帧一次"的用法）。
pub fn OpCtx::take(self : OpCtx) -> Array[DrawOp] {
  let out = self.ops
  self.ops = []
  out
}

///|
/// 已记录多少条（诊断用）。
pub fn OpCtx::len(self : OpCtx) -> Int {
  self.ops.length()
}

///|
pub fn OpCtx::begin_path(self : OpCtx) -> Unit {
  self.ops.push(BeginPath)
}

///|
pub fn OpCtx::move_to(self : OpCtx, x : Double, y : Double) -> Unit {
  self.ops.push(MoveTo(x, y))
}

///|
pub fn OpCtx::line_to(self : OpCtx, x : Double, y : Double) -> Unit {
  self.ops.push(LineTo(x, y))
}

///|
/// `anticlockwise` 默认 `false`，与 DOM 的 `arc` 同默认值。
pub fn OpCtx::arc(
  self : OpCtx,
  cx : Double,
  cy : Double,
  r : Double,
  start : Double,
  end : Double,
  anticlockwise? : Bool = false,
) -> Unit {
  self.ops.push(Arc(cx, cy, r, start, end, anticlockwise))
}

///|
pub fn OpCtx::close_path(self : OpCtx) -> Unit {
  self.ops.push(ClosePath)
}

///|
pub fn OpCtx::fill_rect(self : OpCtx, x : Double, y : Double, w : Double, h : Double) -> Unit {
  self.ops.push(FillRect(x, y, w, h))
}

///|
pub fn OpCtx::fill(self : OpCtx) -> Unit {
  self.ops.push(Fill)
}

///|
pub fn OpCtx::stroke(self : OpCtx) -> Unit {
  self.ops.push(Stroke)
}

///|
pub fn OpCtx::set_line_width(self : OpCtx, w : Double) -> Unit {
  self.ops.push(SetLineWidth(w))
}

///|
pub fn OpCtx::set_fill_style(self : OpCtx, color : String) -> Unit {
  self.ops.push(SetFillStyle(color))
}

///|
pub fn OpCtx::set_stroke_style(self : OpCtx, color : String) -> Unit {
  self.ops.push(SetStrokeStyle(color))
}

///|
pub fn OpCtx::set_font(self : OpCtx, font : String) -> Unit {
  self.ops.push(SetFont(font))
}

///|
pub fn OpCtx::fill_text(self : OpCtx, text : String, x : Double, y : Double) -> Unit {
  self.ops.push(FillText(text, x, y))
}

///|
pub fn OpCtx::save(self : OpCtx) -> Unit {
  self.ops.push(Save)
}

///|
pub fn OpCtx::restore(self : OpCtx) -> Unit {
  self.ops.push(Restore)
}

///|
pub fn OpCtx::translate(self : OpCtx, x : Double, y : Double) -> Unit {
  self.ops.push(Translate(x, y))
}

///|
pub fn OpCtx::rotate(self : OpCtx, rad : Double) -> Unit {
  self.ops.push(Rotate(rad))
}

///|
pub fn OpCtx::scale(self : OpCtx, x : Double, y : Double) -> Unit {
  self.ops.push(Scale(x, y))
}

///|
/// **画布节点** —— 交给宿主的那个组件通道标签。
///
/// 用法与内置标签一致（`@html.div(...)` 那种手感）：
///
/// ```moonbit
/// let ctx = @canvas.OpCtx::new()
/// ctx.fill_rect(0.0, 0.0, 720.0, 720.0)
/// ctx.arc(360.0, 360.0, 300.0, 0.0, 2.0 * @math.pi)
/// ctx.stroke()
/// @canvas.canvas(ctx.take(), 720.0, 720.0)
/// ```
///
/// 三个 prop：`ops`（载荷，走 `prop_json`）、`width` / `height`（CSS 像素；
/// 宿主用它定 Skia `<Canvas style={{width, height}}>` 的尺寸）。
///
/// ⚠️ 宿主**必须**把 `ops` 列进 `jsonProps` 白名单，否则组件拿到的是一段**字符串**
/// 而不是数组 —— 注册表会 fail-fast 点名，但前提是你登记了。见 `PLAN.md` §3.6。
pub fn canvas(ops : Array[DrawOp], width : Double, height : Double) -> @html.Html {
  @html.node(
    canvas_tag,
    @html.Attrs::build()
      .prop_json(ops_prop, ops_to_json(ops))
      .prop_num("width", width)
      .prop_num("height", height),
    ([] : Array[@html.Html]),
  )
}
