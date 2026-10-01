///|
/// `cr-scan` —— 行尾（CR）检查 / 修复。
///
/// 语义与 `tools/cr_scan.py`（以及更早的 bash 版）逐条对齐：白名单、排除目录、判据、输出、退出码。
///
///   · 判据是**字节级**（数 0x0D），不经过任何文本模式 —— 这条是踩过坑的：
///     `grep -lU $'\r'` 在本机 Git Bash（MSYS）上会把 argv 里的裸 CR 弄坏，
///     对一个 0 个 CR 的仓库报出 2537 个假阳性，而且"很快"（因为它几乎匹配了所有文件）。
///   · 输出里带**候选文件数**：一个"什么都没查"的检查同样会报通过，这个数字是它真在查东西的证据。
///
/// 为什么需要这个检查：patch 的上下文行一旦是 CRLF，`patch -p1` 就贴不上（vendor 靠 patch 维护）。

///|
const CR : Int = 13

///|
const LF : Int = 10

///|
/// 文本扩展名白名单（含无扩展名的点文件特例）。
let exts : Array[String] = [
  "mbt", "mbti", "md", "json", "js", "jsx", "ts", "sh", "ps1", "py", "txt", "pkg", "mod", "patch",
  "yml", "yaml", "toml", "css", "html", "xml", "gradle", "properties", "lock", "gitignore",
  "moonignore", "gitattributes",
]

///|
/// 不进的目录 —— 两种规则，各有理由：
///
/// 1. **按路径段**（任意深度）：`.git` / `_build` / `target` / `.mooncakes` / `node_modules`
///    —— 这些是版本控制、构建产物与第三方缓存。**规则只该管我们自己的文件**：
///    它们要么不该被改写（`--mode fix` 去改构建产物毫无意义），要么根本不该被报警
///    （第三方源码带 CRLF 不是我们的问题）。
///    ⚠️ 这条是按**路径段**判的，不是精确路径 —— 曾经只排 `<root>/_build`，
///    于是新建的 `tools/mbtools/_build/` 里 192 个构建产物被当成候选（实测：候选数 2338 → 2531）。
/// 2. **按精确相对路径**：fork 的 `vendor/`（由 `vendor_sync.sh` 自己规范行尾），
///    以及 Expo 宿主下那几个生成目录。
let prune_segments : Array[String] = [".git", "_build", "target", ".mooncakes", "node_modules"]

///|
let prune_paths : Array[String] = [
  "vendor",
  "examples/apps/todo-app/host/android",
  "examples/apps/todo-app/host/dist",
  "examples/apps/todo-app/host/.expo",
]

///|
fn should_prune(rel : String) -> Bool {
  for seg in rel.split("/") {
    if prune_segments.contains(seg.to_owned()) {
      return true
    }
  }
  for p in prune_paths {
    if rel == p {
      return true
    }
    if rel.length() > p.length() + 1 && rel.has_prefix(p + "/") {
      return true
    }
  }
  false
}

///|
fn basename(rel : String) -> String {
  match rel.rev_find("/") {
    Some(i) => rel[i + 1:].to_string()
    None => rel
  }
}

///|
fn extname(base : String) -> String {
  match base.rev_find(".") {
    // 与 Python 版一致：有点号就取最后一段（`.gitignore` → `gitignore`）
    Some(i) => base[i + 1:].to_string()
    None => ""
  }
}

///|
fn is_candidate(rel : String) -> Bool {
  exts.contains(extname(basename(rel)))
}

///|
/// 递归收集候选文件的**相对路径**（正斜杠，便于跨平台比对与输出）。
fn collect(root : String, rel : String, out : Array[String]) -> Unit raise @fs.IOError {
  let dir = if rel == "" { root } else { root + "/" + rel }
  let entries = @fs.read_dir(dir)
  for name in entries {
    let child = if rel == "" { name } else { rel + "/" + name }
    if should_prune(child) {
      continue
    }
    let full = root + "/" + child
    if @fs.is_dir(full) {
      collect(root, child, out)
    } else if is_candidate(child) {
      out.push(child)
    }
  }
}

///|
fn has_cr(path : String) -> Bool raise @fs.IOError {
  let data = @fs.read_file_to_bytes(path)
  let n = data.length()
  for i = 0; i < n; i = i + 1 {
    if data[i].to_int() == CR {
      return true
    }
  }
  false
}

///|
/// 去掉紧邻 LF 的 CR，以及文末孤立的 CR（等价于 Python 版的 `strip_cr`）。
fn strip_cr(data : Bytes) -> Bytes {
  let out : Array[Byte] = []
  let n = data.length()
  for i = 0; i < n; i = i + 1 {
    let b = data[i]
    if b.to_int() == CR {
      if i + 1 >= n || data[i + 1].to_int() == LF {
        continue
      }
    }
    out.push(b)
  }
  Bytes::from_array(out)
}

///|
fn parse_arg(args : Array[String], name : String) -> String? {
  let mut i = 0
  while i < args.length() {
    if args[i] == name && i + 1 < args.length() {
      return Some(args[i + 1])
    }
    i = i + 1
  }
  None
}

///|
/// 相对 `--root` 的解析：`moon run` 必须在本模块目录里跑，所以进程 cwd 不是调用者的 cwd。
/// 包装脚本 `tools/mb.sh` 把调用者的 cwd 放进 `MBTOOLS_CWD`，这里用它拼绝对路径。
fn resolve_root(root : String) -> String {
  let abs = root.has_prefix("/") || (root.length() > 1 && root[1] == ':')
  if abs {
    root
  } else {
    match @env.get_env_var("MBTOOLS_CWD") {
      Some(base) => base + "/" + root
      None => root
    }
  }
}

///|
fn cr_scan_run(args : Array[String]) -> Int raise @fs.IOError {
  let root = match parse_arg(args, "--root") {
    Some(r) => resolve_root(r)
    None => {
      println("ERROR: cr-scan 需要 --root <目录>")
      return 2
    }
  }
  let mode = match parse_arg(args, "--mode") {
    Some(m) => m
    None => "check"
  }
  if mode != "check" && mode != "fix" && mode != "list" {
    println("ERROR: --mode 只能是 check / fix / list（收到 \{mode}）")
    return 2
  }
  let files : Array[String] = []
  collect(root, "", files)
  // `list`：把候选文件原样列出来。存在的意义是**对账** ——
  // 两个实现（Python 版 / MoonBit 版）必须数出同一批文件，否则就是有一边在漏查或越查。
  if mode == "list" {
    for rel in files {
      println(rel)
    }
    return 0
  }
  let crfiles : Array[String] = []
  for rel in files {
    if has_cr(root + "/" + rel) {
      crfiles.push(rel)
    }
  }
  for rel in crfiles {
    if mode == "check" {
      println("  [CR] \{rel}")
    } else {
      let full = root + "/" + rel
      let fixed = strip_cr(@fs.read_file_to_bytes(full))
      @fs.write_bytes_to_file(full, fixed)
      println("  已转 LF: \{rel}")
    }
  }
  println("候选 \{files.length()} 个文本文件，带 CR 的 \{crfiles.length()} 个")
  // 退出码语义**按模式分**（⚠️ 这里踩过一次）：
  //   · check —— 有 CR 就是"检查失败" → 1
  //   · fix   —— 已经把它们改好了，是**成功** → 0
  // 曾经两种模式都用"有没有找到 CR"当退出码，于是 `lf_normalize.sh` 的 apply 路径
  // （`… || exit 1`）在**成功修复之后反而报失败**；当时命令走了管道（`| tail`），
  // 退出码被 tail 吃掉，所以一直没暴露。
  match mode {
    "check" => if crfiles.length() > 0 { 1 } else { 0 }
    _ => 0
  }
}
