# ext_probe —— 「外部模块能不能用 moobile」的冒烟测试

**它证明什么**：`T0.0` 把 `internal/style` 提为公开包 `style/`，图的就是
「别的模块能依赖 moobile 写自己的应用」。但 `demo/` 在模块**内部**，
它编译得过**不能**证明外部可用 —— 所以这里放一个真正的外部模块。

**怎么跑**：`bash _tools/check_external.sh`（在临时工作区里跑，不动本仓库）

它做的事：把本目录的 `app/` 拷进一个临时目录，生成一份 `moon.work`
（成员 = 本模块 + `app`，用绝对路径引用本模块），然后 `moon check --target js`。

**为什么用 `moon.work`**：新版 `moon.mod` 的 `import` 只接受**带版本号的 registry 依赖**，
本地模块依赖的官方推荐做法就是工作区（`moon.work` 的成员按本地源码解析，
`@版本号` 部分被忽略）。实测 `members` 里可以直接写本模块的**绝对路径**。

## 实测结论（2026-09）

| 项 | 结果 |
|---|---|
| `probe/app` 依赖 `XiLaiTL/moobile` + `style` + `html` + `cmd` | ✅ **0 错误**编译通过 |
| 能写出完整的 模型/更新/视图 + `@moobile.mount(...) -> @moobile.Mount` | ✅ |
| 公开样式包可用（`@style.Style::new().font_size(16.0)` 等） | ✅ |

### 两个容易踩的点

1. ~~**库本体是 `XiLaiTL/moobile/moobile`，模块根包是 rabbita**~~
   ✅ **形态 B（2026-09）之后这个坑没了**：模块根包**就是库本体**，所以外部使用者写
   `import { "XiLaiTL/moobile" @moobile }` 直接拿到 `mount`/`Mount`。
   改之前它会拿到 vendor 的 rabbita 主包，报 `Value mount not found in package 'moobile'`
   —— 本探针当初就是**真踩过这个坑**才发现的（历史记录，留在这里当回归说明）。
2. **`render_node` 的公开签名里有 `@vdom.VNode`（internal 包）。**
   实测**不阻断**外部使用者：引用这个函数能编译（`main.mbt` 末尾的 `probe_internal_type_leak`
   就是这个回归探针），只是外部没法**命名**那个参数类型。
   真正要用它得等 `internal/vdom` 拆包（`FORK.md` §3 第 4 条）。
