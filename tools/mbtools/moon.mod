// moobile 的工具链 —— **MoonBit 版**（替代 `tools/` 下的 Python 脚本）。
//
// ## 为什么是独立（嵌套）module
//
//   1. 库本体的 `moon.mod` **不能加依赖** —— 它的 `import` 是模块级且**随发布包走**，
//      使用者会被连带下载（见 AGENTS.md「禁区」）。工具要 `moonbitlang/x`，所以必须另起一个模块。
//   2. 嵌套模块有自己的 `moon.mod` 才会被当成独立模块（同 `examples/services/todo-server/`），
//      于是它**不进库的 `moon check`**，也不进发布包（`.moonignore` 排除了 `/tools/`）。
//
// ## 为什么目标是 js
//
//   工具是"跑一次就完"的短命进程，启动成本比吞吐重要：
//     `moon run --target js`（已构建、缓存命中）实测 **~80ms**，
//     与真 Python 解释器同量级，而 Python 经 pyenv shim 要 ~630ms（见 `docs/FINDINGS.md` R6 补记）。
//   走 native 要 MSVC + 构建步骤，跨机器不划算，所以这里钉死 `+js`（由 node 执行）。
name = "XiLaiTL/moobile-tools"

version = "0.1.0"

license = "Apache-2.0"

description = "moobile 的仓库工具链（MoonBit 写的 CLI：cr-scan / check-links / …）"

preferred_target = "js"

import {
  "moonbitlang/x@0.5.1",
}
