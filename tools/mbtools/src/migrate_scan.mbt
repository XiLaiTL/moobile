///|
/// `migrate-scan` —— **F1 迁移动检报告**（PLAN §5.1 / `docs/design/SCAFFOLD.md` §3.7）。
///
///   bash tools/mb.sh migrate-scan --root ../yi/zhouyi_reader [--json] [--top 10]
///
/// ## 它是什么、不是什么
///
/// 扫一个**既有的 rabbita 项目**，把它在 moobile 上**会静默失效**的东西逐条点名。
/// 它**不改任何代码** —— 产出只有两样：一份报告，和每一类的"下一步指向"。
/// 这是 `SCAFFOLD.md` §3.7.4 定的形态：E9（`--from-rabbita`）的三件产出里，
/// 第一件就是它，而**判据是"报告零遗漏"，不是"自动改对了多少"**。
///
/// ## 为什么它必须先于 E9
///
/// `SCAFFOLD.md` §3.7.5 原话："先做 E9 而 F1 不存在时，'哪些会静默失效'这个问题
/// 没有答案，迁移器只能瞎猜。" 所以顺序是 **F1 → E9**，而 F1 不依赖任何东西。
///
/// ## 为什么是 MoonBit（而不是 `.mjs`）
///
/// `SCAFFOLD.md` §4.2 的判据是**进程边界**：纯文件扫描 → MoonBit（`.mbtx` 的甜区）；
/// 要 spawn 进程 / 跨生态 → `.mjs`。这个工具只读文件、只做子串统计，不 spawn 任何东西。
/// （对照：`readme_probe` 被判给 `.mjs`，因为它要驱动 `moon check` 并解析输出 —— 判据是活的性质，
/// 不是"在不在仓库里"。）
///
/// ## 两张表的来源：**解析库源码，不抄一份**
///
/// "标签表 42 条"与"排除表 12 条"的真源是 `<lib>/render.mbt`。这里**在运行时解析它**，
/// 而不是把清单抄进这个文件 —— 抄一份就会漂一份（本仓库为这类事栽过好几次，
/// 见 `tools/check_npm_fresh.mjs` 记的那次事故）。所以报告里会写明"表来源：<路径>"。
///
/// ## 判据（F1 自己的）
///
/// 拿一个真实项目跑，**与人工清点零遗漏**。`--json` 是为了让这件事可机器对账：
/// 人工那边数出来的每个数字，都能在这个 JSON 里找到对应的项。

///|
/// 一处命中：文件（相对根）、行号（1 起）、那行原文（截断）。
struct Hit {
  file : String
  line : Int
  text : String
}

///|
/// 一类发现。
struct Finding {
  id : String
  auto : String
  why : String
  next : String
  count : Int
  hits : Array[Hit]
}

///|
/// 一条**按行子串匹配**的规则。
struct Rule {
  id : String
  auto : String
  why : String
  next : String
  needle : String
  exts : Array[String]
}

///|
/// 自动化程度四档（与 `SCAFFOLD.md` §3.7.3 的迁移矩阵同一套口径）。
/// 顺序即报告顺序：**越早越该先处理**。
let auto_order : Array[String] = ["必须改", "自动", "半自动", "不自动", "人决定"]

///|
/// 目录剪枝（**本工具自己一张表**，刻意不与 `cr-scan` 共用）。
///
/// 为什么不共用：两者的活不同 —— `cr-scan` 管的是**我们自己仓库**的行尾，
/// 而这里扫的是**别人的项目**，会撞见我们仓库里不存在的东西。
///
/// ★ `.repos` 是**实测加上的**：`interest/yi` 里有一份 MoonBit 标准库的源码检出，
/// 第一版报告数出 **881 个候选文件 / 219886 行**，其中 **700+ 个来自
/// `.repos/moonbitlang/core/…`** —— 不剪掉的话，报告会被标准库淹没，
/// 而那不是"要迁移的项目代码"。这条正是"拿真项目跑一次"才能发现的。
let migrate_prune : Array[String] = [
  ".git", "_build", "target", ".mooncakes", "node_modules", ".repos", "dist", ".expo", ".cache",
]

///|
fn migrate_prune_hit(rel : String) -> Bool {
  for seg in rel.split("/") {
    if migrate_prune.contains(seg.to_owned()) {
      return true
    }
  }
  false
}

///|
/// 扫描的扩展名。**`.html` 必须在** —— 真实项目常常把 CSS 内联在 HTML 的 `<style>` 里
/// （`interest/yi` 就是这样：476 行 CSS 全在 `backend/index.html`）。
/// 只扫 `.css` 会得出"这个项目没有样式问题"的错误结论。
let scan_exts : Array[String] = ["mbt", "mod", "css", "html", "htm"]

///|
/// 按行子串匹配的规则表。
///
/// ⚠️ 每条规则**必须**有 `next`（下一步指向）—— 判据 S9-5 要求"报告里没有'未知'这一类"。
fn rules() -> Array[Rule] {
  [
    // ── 样式（分母最大的一块）────────────────────────────────────────────────
    {
      id: "style.class", auto: "半自动",
      why: "CSS 类名在 moobile 里没有对应物：样式是**类型化**的 `Attrs::styles(Style)`，属性集封闭。",
      next: "F2 样式层半自动（CSS → Style 调用）；`:hover`/媒体查询那部分见各自那条。",
      needle: "class=", exts: ["mbt"],
    },
    {
      id: "style.inline", auto: "半自动",
      why: "`Attrs::style(String)` 这个字符串通道**已被删除**（实测零调用点），结构化样式只能走 `Style`。",
      next: "F2：把字符串样式改写成 `@style.Style::new()…`；数值/颜色可直接搬。",
      needle: "style=", exts: ["mbt"],
    },
    {
      id: "css.hover", auto: "人决定",
      why: "RN 没有伪类。`:hover` 在触屏上本来也不存在（没有 hover 状态）。",
      next: "F3 指南：改成「由状态驱动的条件样式」（把 hover 的那组属性在 Model 里表达）。",
      needle: ":hover", exts: ["css", "html"],
    },
    {
      id: "css.media", auto: "半自动",
      why: "RN 没有媒体查询；响应式靠 `Dimensions` / `useWindowDimensions` 在 JS 里算。",
      next: "F2/F3：断点转成「按尺寸选样式」的函数（宿主侧已能拿到窗口尺寸，见 N5b 的 `geometry`）。",
      needle: "@media", exts: ["css", "html"],
    },
    {
      id: "css.grid", auto: "半自动",
      why: "RN 没有 grid 布局，只有 flex。",
      next: "F3 指南：`display:grid` → flex 容器 + 显式换行（`flexWrap`）。",
      needle: "display: grid", exts: ["css", "html"],
    },
    {
      id: "css.sticky", auto: "人决定",
      why: "RN 没有 `position: sticky`。",
      next: "三方补齐（`nandorojo/sticky` 一类的库）或改成固定头 + 滚动容器。",
      needle: "sticky", exts: ["css", "html"],
    },
    {
      id: "css.var", auto: "自动",
      why: "CSS 自定义属性（`var(--x)`）在类型化样式里没有对应物。",
      next: "F2：在迁移时**展开成字面量**（值从 `:root` 块里读）。",
      needle: "var(--", exts: ["css", "html"],
    },
    // ── 浏览器能力直连 ───────────────────────────────────────────────────────
    {
      id: "dom.direct", auto: "半自动",
      why: "`@dom.*` 是浏览器 API 直连；RN 上 `document` 根本不存在（`window` 存在但里面是空的）。",
      next: "N 轨道能力包（`MOBILE_HOST` 注册表）；canvas 那部分已有一条现成通道，见 `canvas.api`。",
      needle: "@dom.", exts: ["mbt"],
    },
    // ── 手势与坐标（yi 的罗盘就在这一档）────────────────────────────────────
    {
      id: "gesture.mouse", auto: "不自动",
      why:
        "**读坐标的处理器在 RN 上拿到的是零值** —— 全库普查后整表换成 `passthrough_decoders()`，它的 `Mouse`/`Keyboard`/`Scroll` 三个载荷**无条件返回 0**（`vendor/rabbita/html/event_decoders.mbt` 明写「已知降级，不是等价替换」）。",
      // ⚠️ 这条原本写的是「手势通道**尚未实现**（T3.4）」—— 2026-10-01 手势通道落地后**过时了**。
      //    报告的说辞也是产物：说错了会把人引到"先去做一条已有的通道"上（F1 的价值全在"下一步"准不准）。
      next: "**手势通道已落地**（`@gesture.attrs(on_pan=…)` / `@gesture.pan(attrs, msg)`，宿主默认装载、零新依赖）：`on_mousedown/move/up` 换成**一个** `pan` 处理器，坐标从 `Gesture` 的 `x/y`（**元素内**）取。判据：web 40/40 + 真机 18/18。⚠️ 多指（pinch/rotate）真机未验。",
      needle: "on_mouse", exts: ["mbt"],
    },
    {
      id: "gesture.coord", auto: "不自动",
      why: "坐标换算依赖 DOM 的布局信息（`getBoundingClientRect` / `devicePixelRatio`），RN 上没有这些。",
      next: "量原点这件事**已经收进手势通道**了（`Gesture` 的 `x/y` 就是元素内坐标，真机验过 `深 起=130,50`）；剩下的是**画布侧**的 `devicePixelRatio` 换算（T3.5，未验）。",
      needle: "getBoundingClientRect", exts: ["mbt"],
    },
    {
      id: "gesture.dpr", auto: "半自动",
      why: "`devicePixelRatio` 是浏览器概念；RN 用 `PixelRatio.get()`。",
      next: "T3.5：换算收进画布/手势通道内部，应用侧不用自己算。",
      needle: "devicePixelRatio", exts: ["mbt"],
    },
    // ── 输入 / 网络 / 画布 ───────────────────────────────────────────────────
    {
      id: "input.controlled", auto: "半自动",
      why: "受控输入的**事件载荷通道已落地**（I1：`Attrs::on_raw` + `Payload::text/json/num/bool/field`）。",
      next: "把 `on_input=emit.map(f)` 换成 `on_raw(\"change\", e => …)`，值从 `e.text()` 取。",
      needle: "on_input", exts: ["mbt"],
    },
    {
      id: "net.http", auto: "半自动",
      why: "rabita 的 `@rhttp` 依赖 DOM/浏览器的 fetch 语义；moobile 有 `XiLaiTL/moobile/http` 转发包。",
      next: "换成 `XiLaiTL/moobile/http`；⚠️ 它在 RN 上的传输层**未验过**（见 STATUS §4）。",
      needle: "@rhttp.", exts: ["mbt"],
    },
    {
      id: "canvas.api", auto: "半自动",
      why: "canvas 在标签表里是**明确排除**的（RN 无 canvas）。",
      next: "**画布通道已落地**（`@canvas.OpCtx`，32 项判据）：方法名与 `CanvasRenderingContext2D` 逐字相同，迁移是换类型；真机也验过（`canvas-spike` 7/7、`canvas-demo` 12/12）。⚠️ 仍差**文字字形**（`makeFont`）与 **`devicePixelRatio` 换算**（T3.5）。",
      needle: "CanvasRenderingContext2D", exts: ["mbt"],
    },
  ]
}

///|
/// 判断一个标签名是否会被**标签表**接住（用于分类）。
fn classify_tag(
  name : String,
  mapped : Array[String],
  excluded : Array[String],
) -> String {
  if mapped.contains(name) {
    return "mapped"
  }
  if excluded.contains(name) {
    return "excluded"
  }
  "outside"
}

///|
/// 从 `render.mbt` 里解析两张表。
///
/// 解析方式刻意**朴素**（按行的 `("tag", …)` 形状）而不是写一个 MoonBit 语法树 ——
/// 目的是"读真源"，不是"做一个解析器"。真源换了写法，这里会**数出 0 条**，
/// 而报告里会写"表来源 + 条数"，于是 0 条一眼可见（不许静默）。
fn parse_render_tables(lib : String) -> (Array[String], Array[String]) raise @fs.IOError {
  let text = @fs.read_file_to_string(lib + "/render.mbt", encoding="utf8")
  let mapped : Array[String] = []
  let excluded : Array[String] = []
  // ── 分段：先找到两段的位置 ──
  let lines = text.split("\n").to_array()
  let mut section = ""
  for raw in lines {
    let line = raw.to_string()
    if line.contains("fn tag_table(") {
      section = "mapped"
    } else if line.contains("fn excluded_tags(") {
      section = "excluded"
    } else if line.has_prefix("pub fn ") && section != "" {
      section = ""
    }
    if section == "" {
      continue
    }
    // 形状： ("div", "View"),
    match parse_tag_entry(line) {
      Some(name) =>
        if section == "mapped" {
          mapped.push(name)
        } else {
          excluded.push(name)
        }
      None => ()
    }
  }
  (mapped, excluded)
}

///|
/// 从一行里取出 `("tag", …)` 的第一个字符串。取不到返回 `None`。
fn parse_tag_entry(line : String) -> String? {
  let t = line.trim()
  // 形状： ("div", "View"),  —— 只看开头两个字符：`(` 和 `"`
  if t.length() < 3 || t[0] != '(' || t[1] != '"' {
    return None
  }
  let body = t[2:].to_string()
  match body.find("\"") {
    Some(i) => Some(body[:i].to_string())
    None => None
  }
}

///|
fn is_scanned(rel : String) -> Bool {
  scan_exts.contains(extname(basename(rel)))
}

///|
fn collect_scanned(root : String, rel : String, out : Array[String]) -> Unit raise @fs.IOError {
  let dir = if rel == "" { root } else { root + "/" + rel }
  for name in @fs.read_dir(dir) {
    let child = if rel == "" { name } else { rel + "/" + name }
    if migrate_prune_hit(child) {
      continue
    }
    if @fs.is_dir(root + "/" + child) {
      collect_scanned(root, child, out)
    } else if is_scanned(child) {
      out.push(child)
    }
  }
}

///|
/// 行摘录：压掉多余空白并截断，免得报告被一行超长代码撑爆。
fn excerpt(line : String) -> String {
  let t = line.trim().to_string()
  if t.length() <= 120 {
    t
  } else {
    t[:120].to_string() + "…"
  }
}

///|
/// 「`on_click` 挂在**不会响的标签**上」这条**结构规则**的命中：`(行号, 标签名)`。
///
/// 这是 `tools/mbtools` 侧的实现；JS 侧那一份在
/// `npm/moobile-host/lib/migrate/click-on-view.js` —— **算法逐字同构**，
/// 判据是 `node tools/migrate_scan_reconcile.mjs` 与 `node tools/migrate_click_scan.mjs`
/// 两侧逐 finding / 逐 hit（含 `text`）一致。改这里必须同时改那里。
///
/// 事实（`render.mbt:243`）：`on_click` 映射成 RN 的 `onPress`，而标签表里**只有
/// `button` / `a` 落到 `Pressable`**；`div` / `span` / `p` 落到 `View` / `Text`，
/// 那两个组件没有 `onPress` —— 点击被**丢掉**，不报错、不警告。
///
/// 为什么不在"按行子串匹配"的那 14 条规则里：它要的是"标签 + 事件"两个 token 的
/// **结构关系**（同一次调用里），单行子串判不出来（`div(… on_click=…)` 与
/// `button(… on_click=…)` 逐字看没有区别）。
///
/// ⚠️ 口径与那 14 条规则一致：**扫原始文本，注释里的代码同样算命中**（兄弟规则也是这么做的）。
///    这是有意的 —— 假阳性（注释）比假阴性（漏一个真的点不动）代价小得多，见 FINDINGS。
///
/// 算法（**与 JS 侧逐字同构**，别在这里顺手优化）：
///   ① 找每一处 `on_click`，要求它后面（跳过空白）是 `=`（否则是 `on_clicked` 这类名字）；
///   ② 从它往回扫，用括号配对找到包着它的那次调用的左括号；
///   ③ 读左括号紧前面的标识符当标签名（`div(` / `@html.div(` 都读成 `div`）；
///   ④ 标签名不是 `button` / `a` 就记一条（行号取 `on_click` 那一行）。
fn scan_click_on_view(text : String) -> Array[(Int, String)] {
  let chars = text.to_array()
  let n = chars.length()
  let out : Array[(Int, String)] = []
  let needle = "on_click".to_array()
  let mut from = 0
  while from < n {
    let at = match find_chars(chars, needle, from) {
      Some(i) => i
      None => break
    }
    from = at + needle.length()
    // ① 后面必须是 `=`（跳过空白）
    let mut j = at + needle.length()
    while j < n && is_space_char(chars[j]) {
      j = j + 1
    }
    if j >= n || chars[j] != '=' {
      continue
    }
    // ② 往回找包着它的那次调用的左括号
    let mut depth = 0
    let mut tag : String? = None
    let mut k = at - 1
    while k >= 0 {
      let c = chars[k]
      if c == ')' {
        depth = depth + 1
      } else if c == '(' {
        if depth == 0 {
          // ③ 左括号紧前面那个标识符就是标签名（跳过空白，如 `div (`）
          let mut p = k - 1
          while p >= 0 && is_space_char(chars[p]) {
            p = p - 1
          }
          let e = p
          while p >= 0 && is_ident_char(chars[p]) {
            p = p - 1
          }
          if e > p {
            let mut acc = ""
            let mut q = p + 1
            while q <= e {
              acc = acc + chars[q].to_string()
              q = q + 1
            }
            tag = Some(acc)
          }
          break
        } else {
          depth = depth - 1
        }
      }
      k = k - 1
    }
    match tag {
      None => continue
      Some(t) =>
        if t == "button" || t == "a" {
          continue
        }
    }
    // ④ 行号 = `on_click` 之前有几个换行
    let mut line = 1
    let mut q = 0
    while q < at {
      if chars[q] == '\n' {
        line = line + 1
      }
      q = q + 1
    }
    out.push((line, match tag { Some(t) => t; None => "" }))
  }
  out
}

///|
/// 命中行的**标注**（hit 的 `text` 尾巴）。两侧必须逐字相同。
fn click_hit_note(tag : String) -> String {
  "   ← `" + tag + "(…) on_click=`"
}

///|
/// 在字符数组里从 `from` 起找 `pat`，返回下标（找不到给 `None`）。
/// 自己写而不用 `String::find`：这里要的是**字符下标**（往回走、括号配对、数换行都在同一套下标上），
/// 而字符串 API 的下标口径（字节 / 码元）随版本漂 —— 函数里混两套下标是 bug 的温床。
fn find_chars(chars : Array[Char], pat : Array[Char], from : Int) -> Int? {
  let n = chars.length()
  let m = pat.length()
  if m == 0 || n < m {
    return None
  }
  let mut i = from
  while i + m <= n {
    let mut ok = true
    let mut j = 0
    while j < m {
      if chars[i + j] != pat[j] {
        ok = false
        break
      }
      j = j + 1
    }
    if ok {
      return Some(i)
    }
    i = i + 1
  }
  None
}

///|
/// 标识符字符（与 JS 侧一致：ASCII 字母、数字、下划线）。
fn is_ident_char(c : Char) -> Bool {
  let v = c.to_int()
  (v >= 97 && v <= 122) || (v >= 65 && v <= 90) || (v >= 48 && v <= 57) || v == 95
}

///|
/// 空白（含换行）—— 往回找标签名时要跳过 `div (` 里的那个空格。
fn is_space_char(c : Char) -> Bool {
  c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

///|
/// 解析 `--root`：`moon run` 在模块目录里跑，所以用 `MBTOOLS_CWD` 拼调用者的相对路径。
fn resolve_from_cwd(p : String) -> String {
  let abs = p.has_prefix("/") || (p.length() > 1 && p[1] == ':')
  if abs {
    p
  } else {
    match @env.get_env_var("MBTOOLS_CWD") {
      Some(base) => base + "/" + p
      None => p
    }
  }
}

///|
fn parse_flag(args : Array[String], name : String) -> Bool {
  args.contains(name)
}

///|
fn json_escape(s : String) -> String {
  let buf = StringBuilder()
  for ch in s {
    match ch {
      '"' => buf.write_string("\\\"")
      '\\' => buf.write_string("\\\\")
      '\n' => buf.write_string("\\n")
      '\r' => buf.write_string("\\r")
      '\t' => buf.write_string("\\t")
      _ => buf.write_char(ch)
    }
  }
  buf.to_string()
}

///|
fn jstr(s : String) -> String {
  "\"" + json_escape(s) + "\""
}

///|
fn migrate_scan_run(args : Array[String]) -> Int raise @fs.IOError {
  let root = match parse_arg(args, "--root") {
    Some(r) => resolve_from_cwd(r)
    None => {
      println("ERROR: migrate-scan 需要 --root <既有 rabbita 项目目录>")
      return 2
    }
  }
  let lib = match parse_arg(args, "--lib") {
    Some(l) => resolve_from_cwd(l)
    None =>
      match @env.get_env_var("MBTOOLS_CWD") {
        Some(base) => base
        None => "."
      }
  }
  let top = match parse_arg(args, "--top") {
    Some(n) => parse_top(n)
    None => 8
  }
  let as_json = parse_flag(args, "--json")

  let (mapped, excluded) = parse_render_tables(lib)

  let files : Array[String] = []
  collect_scanned(root, "", files)

  // ── 按行扫规则 ──
  let findings : Array[Finding] = []
  for rule in rules() {
    let hits : Array[Hit] = []
    for rel in files {
      let ext = extname(basename(rel))
      if not(rule.exts.contains(ext)) {
        continue
      }
      let text = @fs.read_file_to_string(root + "/" + rel, encoding="utf8")
      let lines = text.split("\n").to_array()
      let mut i = 0
      for raw in lines {
        i = i + 1
        let line = raw.to_string()
        if line.find(rule.needle) is Some(_) {
          hits.push({ file: rel, line: i, text: excerpt(line) })
        }
      }
    }
    findings.push({
      id: rule.id,
      auto: rule.auto,
      why: rule.why,
      next: rule.next,
      count: hits.length(),
      hits,
    })
  }

  // ── 结构规则：`on_click` 挂在**不会响的标签**上（`div` / `span` / `p` …）────────
  //
  // 放在这里（而不是当成第 15 条 `Rule`）：`Rule` 的契约是**按行子串匹配**，
  // 这一条要的是"标签 + 事件"的结构关系 —— 塞进去会让那条契约名不副实。
  // ⚠️ 位置参与对账（finding 顺序即报告顺序），JS 侧必须插在同一处。
  let click_hits : Array[Hit] = []
  for rel in files {
    if extname(basename(rel)) != "mbt" {
      continue
    }
    let text = @fs.read_file_to_string(root + "/" + rel, encoding="utf8")
    let lines = text.split("\n").to_array()
    for pair in scan_click_on_view(text) {
      let (line_no, tag) = pair
      let raw = if line_no - 1 < lines.length() && line_no >= 1 {
        lines[line_no - 1].to_string()
      } else {
        ""
      }
      click_hits.push({
        file: rel,
        line: line_no,
        text: excerpt(raw) + click_hit_note(tag),
      })
    }
  }
  findings.push({
    id: "click.on-view",
    auto: "人决定",
    why:
      "`on_click` 在 moobile 里映射成 RN 的 `onPress`，而标签表里**只有 `button` / `a` 落到 `Pressable`**；`div` / `span` / `p` 落到 `View` / `Text`，那两个组件没有 `onPress` —— 点击被**丢掉**，不报错、不警告。",
    next: "把标签换成 `button`（要语义就用 `a`）—— **换标签，不是加样式**；换完这个块才有真的点击。",
    count: click_hits.length(),
    hits: click_hits,
  })

  // ── 标签分类（要"真源两张表"，不是模式匹配）──
  //
  // 计数口径：**命中行数**（一行里同一个标签出现两次算一次）。
  // 为什么不按"去重后的标签名"计数：迁移时人要改的是**位置**，不是"有哪些标签"。
  // 标签名的去重清单在报告末尾单独给（`tag_names`），两个口径都有用，别混。
  let tag_ids : Array[String] = ["tag.excluded", "tag.outside"]
  let tag_hits : Array[Array[Hit]] = [[], []]
  let tag_names : Array[Array[String]] = [[], []]
  for rel in files {
    if extname(basename(rel)) != "mbt" {
      continue
    }
    let text = @fs.read_file_to_string(root + "/" + rel, encoding="utf8")
    let lines = text.split("\n").to_array()
    let mut i = 0
    for raw in lines {
      i = i + 1
      let line = raw.to_string()
      for name in tag_candidates(line) {
        match classify_tag(name, mapped, excluded) {
          "excluded" => {
            if not(tag_names[0].contains(name)) {
              tag_names[0].push(name)
            }
            tag_hits[0].push({
              file: rel,
              line: i,
              text: "\{excerpt(line)}   ← 标签 `\{name}`",
            })
          }
          "outside" => {
            if not(tag_names[1].contains(name)) {
              tag_names[1].push(name)
            }
            tag_hits[1].push({
              file: rel,
              line: i,
              text: "\{excerpt(line)}   ← 标签 `\{name}`",
            })
          }
          _ => ()
        }
      }
    }
  }
  let tag_auto = ["人决定", "人决定"]
  let tag_why = [
    "这 12 个标签是**明确排除**的（`render.mbt` 的 `excluded_tags()`）：RN 没有对应物，所以不映射 —— 用它们等于「看起来能跑」。",
    "标签表之外的标签一律**回落 `View`** 并计进 `unmapped_tag_count`（迁移诊断的支点，但**运行时不会提醒你**）。",
  ]
  let tag_next = [
    "接第三方组件库（I 轨道）或改写成真实组件。**已有的替代物**：`canvas`（画布通道）。",
    "人决定：改写成表内标签，或走组件通道（`库名:组件名`）。",
  ]
  let mut t = 0
  while t < tag_ids.length() {
    // 命中标签的**去重清单**附在 `why` 后面：计数口径是"行"，而"涉及哪些标签"
    // 是另一个问题（两个都要，别让读者自己去明细里数）。
    let names_note = if tag_names[t].length() > 0 {
      "\n\n**命中的标签**（去重）：" + tag_names[t].join("、")
    } else {
      ""
    }
    findings.push({
      id: tag_ids[t],
      auto: tag_auto[t],
      why: tag_why[t] + names_note,
      next: tag_next[t],
      count: tag_hits[t].length(),
      hits: tag_hits[t],
    })
    t = t + 1
  }

  // ── 依赖与构建目标（读 moon.mod，不是子串扫源码）──
  let dep_hits : Array[Hit] = []
  let target_hits : Array[Hit] = []
  for rel in files {
    if basename(rel) != "moon.mod" {
      continue
    }
    let text = @fs.read_file_to_string(root + "/" + rel, encoding="utf8")
    let lines = text.split("\n").to_array()
    let mut i = 0
    for raw in lines {
      i = i + 1
      let line = raw.to_string()
      if line.contains("moonbit-community/rabbita") || line.contains("tiye/rabbita") {
        dep_hits.push({ file: rel, line: i, text: excerpt(line) })
      }
      if line.contains("preferred_target") || line.contains("supported_targets") {
        if line.contains("wasm") || line.contains("native") || line.contains("js") {
          target_hits.push({ file: rel, line: i, text: excerpt(line) })
        }
      }
    }
  }
  findings.push({
    id: "dep.rabbita",
    auto: "必须改",
    why:
      "两个 rabbita 的 `Html` / `VNode` / `Attrs` 是**不同包的不同类型**，混用编不过；也不能同时 import 两个 `@html`（SCAFFOLD §3.7.2）。",
    next: "换成 `XiLaiTL/moobile`；判据：`moon.mod` 里只剩一条 rabbita 来源、`moon tree` 不出现 `moonbit-community/rabbita`。",
    count: dep_hits.length(),
    hits: dep_hits,
  })
  findings.push({
    id: "target.build",
    auto: "自动",
    why: "moobile 的库**只支持 js 目标**（传递性 js 锁）；既有项目常见 `wasm-gc` / `native`。",
    next: "改 `preferred_target` / `supported_targets`（机械改动，无风险）。",
    count: target_hits.length(),
    hits: target_hits,
  })

  // ── 输出 ──
  let mut scanned_lines = 0
  for rel in files {
    let text = @fs.read_file_to_string(root + "/" + rel, encoding="utf8")
    scanned_lines = scanned_lines + text.split("\n").to_array().length()
  }

  if as_json {
    print_json(root, files.length(), scanned_lines, mapped, excluded, findings)
  } else {
    print_report(root, lib, files.length(), scanned_lines, mapped, excluded, findings, top)
  }
  0
}

///|
/// 一行里有没有一次**像 DSL 调用**的 `name(`。
///
/// 为什么要看**前一个字符**（第一版只看 `name(` 子串，结果假阳性一堆）：
/// `arr.map(…)` / `x.time(…)` / `data.slot(…)` 里的 `map` / `time` / `slot`
/// 也都是 `name(` 形状，而它们**都是 HTML 标签名**（`<map>` `<time>` `<slot>`）——
/// 于是 `Array::map(` 被数成了"用了 `<map>` 标签"。
/// 判据：调用点前面必须是**分隔符位置**（行首 / 空白 / `(` / `,` / `[` / `=` / `>`），
/// 或者它是 `@html.name(` 这种显式前缀。`x.map(` 前面是 `.` → 排除。
fn has_dsl_call(line : String, name : String) -> Bool {
  let needle = name + "("
  let n = line.length()
  let mut from = 0
  while from <= n {
    let rest = line[from:].to_string()
    match rest.find(needle) {
      None => return false
      Some(i) => {
        let at = from + i
        let prev_ok = if at == 0 {
          true
        } else if at >= 6 && line[at - 6:at].to_string() == "@html." {
          true
        } else {
          let prev = line[at - 1:at].to_string()
          prev == " " ||
          prev == "\t" ||
          prev == "(" ||
          prev == "," ||
          prev == "[" ||
          prev == "=" ||
          prev == ">"
        }
        if prev_ok {
          return true
        }
        from = at + 1
      }
    }
  }
  false
}

///|
/// 从一行里挑出可能的**标签名**：像 DSL 调用的 `name(`，且 name 在 HTML 标签候选名单里。
///
/// 为什么要有"候选"这一层：`ring_draw(` / `push(` / `println(` 也都是 `name(` 形状，
/// 没有候选名单就会把函数调用当成标签 —— 报告里全是噪声，人就不看了。
/// 候选名单是下面 `html_tags()`，它**只包含 HTML 标签**。
fn tag_candidates(line : String) -> Array[String] {
  let out : Array[String] = []
  for name in html_tags() {
    if has_dsl_call(line, name) {
      out.push(name)
    }
  }
  out
}

///|
/// HTML 标签候选名单（用于"这个 token 是不是标签"的判定）。
///
/// ⚠️ 它是**候选**，不是"moobile 支持的标签"—— 支持与否由 `render.mbt` 的两张表决定，
/// 这里只负责把"看起来像标签的 token"挑出来，再交给那两张表分类。
fn html_tags() -> Array[String] {
  [
    "a", "abbr", "address", "area", "article", "aside", "audio", "b", "base", "bdi", "bdo",
    "blockquote", "body", "br", "button", "canvas", "caption", "cite", "code", "col",
    "colgroup", "data", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt",
    "em", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
    "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "iframe", "img", "input", "ins",
    "kbd", "label", "legend", "li", "link", "main", "map", "mark", "menu", "meta", "meter",
    "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p", "picture", "pre",
    "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "slot",
    "small", "source", "span", "strong", "style", "sub", "summary", "sup", "svg", "table",
    "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr",
    "track", "u", "ul", "var", "video", "wbr",
  ]
}

///|
fn print_report(
  root : String,
  lib : String,
  nfiles : Int,
  nlines : Int,
  mapped : Array[String],
  excluded : Array[String],
  findings : Array[Finding],
  top : Int
) -> Unit {
  println("# 迁移动检报告（F1）")
  println("")
  println("- 扫描根：`\{root}`")
  println("- 候选文件：**\{nfiles}** 个 · 共 **\{nlines}** 行")
  println(
    "- 标签表来源：`\{lib}/render.mbt` —— 映射 **\{mapped.length()}** 条 · 排除 **\{excluded.length()}** 条",
  )
  if mapped.length() == 0 || excluded.length() == 0 {
    println("")
    println("⚠️ **两张表解析出 0 条** —— 说明 `render.mbt` 的写法变了，本报告的标签分类不可信。")
  }
  println("")
  println("## 汇总")
  println("")
  println("| 自动化程度 | 类别 | 命中 |")
  println("|---|---|---|")
  let mut total = 0
  for a in auto_order {
    for f in findings {
      if f.auto == a && f.count > 0 {
        println("| \{f.auto} | `\{f.id}` | **\{f.count}** |")
        total = total + f.count
      }
    }
  }
  println("")
  println("合计 **\{total}** 处（其中 `dep.rabbita` 那一类是**硬约束**：不改就编不过）。")
  println("")
  println("## 明细")
  for a in auto_order {
    let mut printed_header = false
    for f in findings {
      if f.auto != a || f.count == 0 {
        continue
      }
      if not(printed_header) {
        println("")
        println("### \{a}")
        printed_header = true
      }
      println("")
      println("#### `\{f.id}` —— \{f.count} 处")
      println("")
      println("**为什么**：\{f.why}")
      println("")
      println("**下一步**：\{f.next}")
      println("")
      let mut shown = 0
      for h in f.hits {
        if shown >= top {
          println("- …还有 \{f.count - shown} 处（`--top` 调上限，`--json` 拿全量）")
          break
        }
        println("- `\{h.file}:\{h.line}`  \{h.text}")
        shown = shown + 1
      }
    }
  }
  println("")
  println("---")
  println("")
  println("**这份报告不自动改任何代码**（`SCAFFOLD.md` §3.7.4 的负面清单）：")
  println("不重写业务逻辑、不猜 CSS 的意图、不「顺手删掉」迁移不过去的代码。")
  println("判据是**报告零遗漏**，不是「自动改对了多少」。")
}

///|
fn print_json(
  root : String,
  nfiles : Int,
  nlines : Int,
  mapped : Array[String],
  excluded : Array[String],
  findings : Array[Finding]
) -> Unit {
  let buf = StringBuilder()
  buf.write_string("{\n")
  buf.write_string("  \"root\": " + jstr(root) + ",\n")
  buf.write_string("  \"files\": \{nfiles},\n")
  buf.write_string("  \"lines\": \{nlines},\n")
  buf.write_string("  \"table\": {\"mapped\": \{mapped.length()}, \"excluded\": \{excluded.length()}},\n")
  buf.write_string("  \"findings\": [\n")
  let mut first = true
  for f in findings {
    if not(first) {
      buf.write_string(",\n")
    }
    first = false
    buf.write_string("    {\"id\": " + jstr(f.id) + ", \"auto\": " + jstr(f.auto))
    buf.write_string(", \"count\": \{f.count}, \"why\": " + jstr(f.why) + ", \"next\": " + jstr(f.next))
    buf.write_string(", \"hits\": [")
    let mut fh = true
    for h in f.hits {
      if not(fh) {
        buf.write_string(", ")
      }
      fh = false
      buf.write_string(
        "{\"file\": " + jstr(h.file) + ", \"line\": \{h.line}, \"text\": " + jstr(h.text) + "}",
      )
    }
    buf.write_string("]}")
  }
  buf.write_string("\n  ]\n}\n")
  println(buf.to_string())
}

///|
/// `--top` 的整数解析：只认十进制数字，非法就回默认。
/// （刻意不引 `moonbitlang/core/string` —— 一个参数解析不值得多一个 import；
/// 而且这里"解析失败就回默认"是**明确行为**，不是静默吞错。）
fn parse_top(s : String) -> Int {
  let mut v = 0
  let mut any = false
  for ch in s {
    let d = ch.to_int() - '0'.to_int()
    if d < 0 || d > 9 {
      return 8
    }
    v = v * 10 + d
    any = true
  }
  if any && v > 0 {
    v
  } else {
    8
  }
}
