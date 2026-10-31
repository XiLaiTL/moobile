// 应用是**独立模块** —— 不是库模块里的一个包。
//
// 为什么必须独立：`moon.mod` 的 import 是**模块粒度**且随包发布 —— 应用若塞进库模块，
// 应用的依赖就变成**所有使用者的下载量**（实测记载见 docs/FINDINGS.md 的 R3）。
//
// ⚠️ 这个目录里有**真名**（`skillpress-site`），不是花括号占位符 ——
//    刻意的：占位符不是合法标识符，模板就编译不过，于是"我们从未验证过用户拿到什么"。
//    生成器按 tools/template/placeholders.txt 替换它们，并断言**替换干净**（T1b）。
//
// ⚠️ 在仓库里它由根上的 `moon.work` 工作区连到库本地的源码（所以 `moon check` 能编）；
//    生成出去之后是**独立项目**，依赖从 registry 解析 —— 见 README 的三条命令。
name = "skillpress-site"

version = "0.1.0"

license = "Apache-2.0"

description = "moobile 最小工程（生成器的唯一真源，见 docs/design/SCAFFOLD.md 3.4 节）"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.6.0",
  // 站点界面就是这里来的（P6）：本工程只接线，界面在包 `shell` 里。
  // ⚠️ 未发布时靠 `moon.work` 指向**本地源码**（两个仓库是兄弟：`interest/skillpress`）；
  //    发布之后这条依赖从 registry 解析，工作区那个文件就可以删掉。
  "XiLaiTL/skillpress@0.1.0",
  // ⚠️ 下面这条是**替上游擦屁股**，本工程并不直接用 parser：
  //    引擎的依赖 `mizchi/markdown@0.8.3` 钉了 `moonbitlang/parser@0.3.18`，而 0.3.1x 的
  //    manifest 要求 `moonbitlang/x@0.4.39` —— **这个版本在 registry 里根本不存在**
  //    （x 的 0.4.x 只到 0.4.38，然后直接跳到 0.4.46）。
  //    · 2026-09 那代 moon（本机 0.1.20260920）解析时放宽到了 0.5.5，所以能过；
  //    · 2026-10-28 那代（GitHub runner 上的 latest）照字面去找 0.4.39 ⇒
  //      `Failed to resolve registry dependency 'moonbitlang/x' …: version '0.4.39' was not found`。
  //    钉到 0.3.19（它要 x@0.5.1，存在）让两代都能解析。上游修好之后这条可以删。
  "moonbitlang/parser@0.3.19",
}
