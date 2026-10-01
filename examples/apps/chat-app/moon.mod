// 应用是**独立模块** —— 不是库模块里的一个包。
//
// 为什么必须独立：`moon.mod` 的 import 是**模块粒度**且随包发布 —— 应用若塞进库模块，
// 应用的依赖就变成**所有使用者的下载量**（实测记载见 docs/FINDINGS.md 的 R3）。
//
// ⚠️ 这个目录里有**真名**（`chat-app`），不是花括号占位符 ——
//    刻意的：占位符不是合法标识符，模板就编译不过，于是"我们从未验证过用户拿到什么"。
//    生成器按 tools/template/placeholders.txt 替换它们，并断言**替换干净**（T1b）。
//
// ⚠️ 在仓库里它由根上的 `moon.work` 工作区连到库本地的源码（所以 `moon check` 能编）；
//    生成出去之后是**独立项目**，依赖从 registry 解析 —— 见 README 的三条命令。
name = "chat-app"

version = "0.1.0"

license = "Apache-2.0"

description = "LLM 聊天应用（流式回复 + 本地历史 + 设置页）—— 也是「真实应用」这条轨道的样本"

preferred_target = "js"

import {
  "XiLaiTL/moobile@0.3.0",
}
