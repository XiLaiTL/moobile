// ⚠️ 这个 `moon.mod` **不是给探针应用用的**，它是**隔离标记**（与 tools/pub_probe/ 同理）。
//
// MoonBit 会把**没有自己 moon.mod 的子目录**当成父模块（XiLaiTL/moobile）的一个包 ——
// 于是这几个文件会被库的 `moon check` 一起编译（它们引用的 `@moobile` / `@html` 在这个
// 上下文里根本没定义），甚至可能被 `moon package` 打进发布产物。
// `examples/services/todo-server/` 与 `tools/pub_probe/` 都踩过同一个坑（见 FINDINGS 的 R2）。
//
// 有了这个文件，`tools/scaffold_probe/app/` 就是**独立嵌套模块**，与父模块隔离。
// 它**不会**被拷进任何地方 —— `tools/scaffold_probe.mjs` 只拷 `*.mbt`。
name = "probe/scaffold-app"

version = "0.1.0"

preferred_target = "js"

// 版本号必须写（新版 moon.mod 的 import 只接受带版本的 registry 形式）；
// 这些源码真正被编译是在**生成出来的那个项目里**，用的是那个项目的 moon.pkg。
import {
  "XiLaiTL/moobile@0.2.2",
}
