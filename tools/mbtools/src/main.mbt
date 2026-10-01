///|
/// moobile 工具链 CLI（MoonBit 版）。
///
///   moon run --target js tools/mbtools/src -- <子命令> [参数…]
///
/// 子命令：
///   cr-scan --root <目录> --mode check|fix     行尾（CR）检查/修复
///   migrate-scan --root <项目> [--json]        F1 迁移动检报告
///
/// 常用入口是 `bash tools/mb.sh <子命令> [参数…]`（省得记 `moon run` 的路径）。
///
/// **为什么 `exit` 要 extern 到 node**：core 的 `@env` 只给了 `args` / `cwd` / `now`，
/// 没有退出码；而工具必须用退出码跟 shell 脚本（`verify_all.sh` 那些）对话。
/// js 目标下由 node 执行，所以直接调 `process.exit`。

///|
extern "js" fn js_exit(code : Int) -> Unit = "(code) => { process.exit(code) }"

///|
fn usage() -> Unit {
  println("mbtools —— moobile 工具链（MoonBit）")
  println("")
  println("用法：moon run --target js tools/mbtools/src -- <子命令> [参数…]")
  println("      （或 bash tools/mb.sh <子命令> [参数…]）")
  println("")
  println("子命令：")
  println("  cr-scan --root <目录> --mode check|fix   行尾（CR）检查 / 就地转 LF")
}

///|
fn main {
  // js 目标下 @env.args() 就是 process.argv：[node, 脚本, 用户参数…]
  let argv = @env.args()
  let user : Array[String] = if argv.length() > 2 { argv[2:].to_array() } else { [] }
  if user.length() == 0 {
    usage()
    js_exit(2)
  }
  let sub = user[0]
  let rest : Array[String] = if user.length() > 1 { user[1:].to_array() } else { [] }
  let code = try {
    match sub {
      "cr-scan" => cr_scan_run(rest)
      "migrate-scan" => migrate_scan_run(rest)
      "-h" | "--help" | "help" => {
        usage()
        0
      }
      _ => {
        println("ERROR: 未知子命令 \{sub}")
        usage()
        2
      }
    }
  } catch {
    err => {
      println("ERROR: \{err.to_repr()}")
      2
    }
  }
  js_exit(code)
}
