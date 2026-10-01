// Todo 演示应用 —— **独立模块**。
//
// 为什么必须独立（而不是库模块里的一个包）：`moon.mod` 的 `import` 是**模块粒度**的，
// 只要 demo 用到的包 import 了某个第三方模块，那个模块就得写进**库的** `moon.mod`，
// 而 `moon.mod` 是**随发布包一起发出去的** —— 于是"我们 demo 用的东西"会变成
// "每个使用者都要下载的东西"（实测：声明了但没人 import 的依赖照样被拉下来，
// `moonorm`+`moondb` 就是 11 MB，而库自己的发布包才 ~200 KB）。
//
// 开发时由仓库根的 `moon.work` 工作区连起来（版本号在工作区解析时被忽略），
// 所以改库代码立刻生效；想验"用户视角"用 `tools/check_published.sh`。
name = "XiLaiTL/moobile-todo-app"

version = "0.1.0"

license = "Apache-2.0"

description = "moobile 的 Todo 演示应用（本地库 + 网络同步 + 多页面）"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.2.0",
}
