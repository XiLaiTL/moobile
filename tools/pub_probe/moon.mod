// ⚠️ 这个 moon.mod **不是给模板用的**，它是"隔离标记"。
//
// `tools/pub_probe/` 只是 `check_published.sh` 的**模板源码**（两个文件被拷进临时目录）。
// 但 MoonBit 会把**没有自己 moon.mod 的子目录**当成父模块（XiLaiTL/moobile）的一个包 ——
// 于是模板会被库的 `moon check` 一起编译（多出没必要的警告），甚至可能被 `moon package`
// 打进发布产物。`examples/services/todo-server/` 踩过同一个坑（见 FINDINGS 的 R2）。
//
// 加了这个文件，这个目录就是**独立嵌套模块**，与父模块隔离。
name = "probe/pubapp-template"

version = "0.1.0"

preferred_target = "js"
