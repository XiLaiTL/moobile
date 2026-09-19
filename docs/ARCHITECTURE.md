# ARCHITECTURE.md —— 架构总览与「发布为库」可行性

> **这份文档回答两件事**：
> 1. **整个框架现在长什么样** —— 哪些是我们的、哪些是 vendor 的、边界在哪、契约是什么。
> 2. **能不能发布成 MoonBit 库给别人用** —— 实测体检、必须补的东西、四种发布形态与推荐。
>
> 实测数据来自 2026-09 的 T0.0 之后状态（`moon 0.1.20260827`）。
> 相关文档：`README.md`（结论）· `PLAN.md`（计划）· `DEV.md`（怎么跑）· `FORK.md`（对 rabbita 的 diff）· `docs/DESIGN.md`（设计意图）

---

## 0. 一页结论

| 问题 | 答案 |
|---|---|
| 能不能发布？ | **能。** 代码层面已经验证通了：外部模块能 `check` 能 `build`，还能拿到 `export { start }` |
| 现在就能发吗？ | **不能。** 有 5 个必须先解决的点：**2 个元数据类**（缺 `readme`/`repository` 字段、缺 LICENSE）、**1 个打包配置**（没有 `.moonignore`，会把 `host/`、`_r1/` 一起发出去）、**2 个结构性**（模块根包是 rabbita 而不是库、命名空间要先定名） |
| 最该先做哪个结构改动？ | **把库提到模块根**（形态 B）—— 现在 `import "XiLaiTL/moobile"` 拿到的是 **rabbita 的主包**，不是 moobile |
| 工作量 | 元数据 + LICENSE + `.moonignore`：**半天**；形态 B 重构：**半天~一天**；裁剪 vendor 死重：**另算（可选）** |
| 最大不确定性 | ~~模块名的命名空间规则~~ **已定：`XiLaiTL/moobile`**（账号 `XiLaiTL`，`moon whoami` 实测）。剩下唯一查不出的，是服务端会不会在**上传那一刻**接受它 —— 见 §4.7 |

---

## 1. 分层：谁负责什么

```
┌─ L6 应用 ──────────────────────────────────────────────── demo/
│    模型 / update / view（用 @html DSL + @style 写）
├─ L5 树 / DSL / 样式 ──────────────────────────────────────
│    internal/vdom/   树 + diff + SSR（vendor，被改过：Event 解耦、Props 加宽）
│    html/  cmd/  sub/  dom/  variant/  js/  common/        （vendor）
│    style/            ★ 我们的类型化样式层，已提为公开包
├─ L4 vendor 运行时 ────────────────────────────────────────
│    internal/runtime/react_host.mbt   ★ fork 新增：把最后一跳换成"产出 React 元素"
│    （Cmd / Emit / 订阅 / 异步 effect 全由 rabbita 自己的运行时执行）
├─ L3 TEA 挂载 ───────────────────────────────────────────── 根包 app.mbt
│    mount(model, update, view) -> Mount；start / snapshot / subscribe / element
├─ L2 翻译层 ─────────────────────────────────────────────── 根包 render.mbt
│    VNode → React 元素；标签表 42 条 + 排除表 12 条 + 样式 map → RN style
├─ L1 FFI 边界 ───────────────────────────────────────────── 根包 host.mbt
│    ★ 全套代码里 %identity 不安全性**唯一的集中地**
└─ L0 宿主（JS） ──────────────────────────────────────────── host/
     Expo + React + RN + react-native-web；App.js 提供 MOBILE_HOST
```

**一句话**：moobile 不实现渲染，它只在 L1–L3 做「翻译 + 挂载」；
真正的排版、布局、文本引擎都是 React / RN 的（DESIGN §10 原则 1）。

### 我们写的 vs vendor 的

| 层 | 归属 | 文件 | 行数 |
|---|---|---|---|
| L1–L3 | **我们** | 根包 `host.mbt` `render.mbt` `app.mbt` `store.mbt` `schedule.mbt` | 544 |
| 样式层 | **我们** | `style/style.mbt` | 928 |
| L4 | **我们**（fork 新增） | `internal/runtime/react_host.mbt` | 224 |
| L5 及以下 | **vendor** | `html/ cmd/ sub/ dom/ js/ variant/ common/ internal/*` | ~19,400（不含测试） |

`FORK.md` §2 的语义改动集中在：`internal/vdom`（Event 解耦 + Props 加宽）、`html/`（事件解码表）、
`svg/`（同样的 style 改动）、`internal/runtime/react_host.mbt`（新增）。

---

## 2. 契约：别人要接的三样东西

这一节是"给别人用"的关键 —— 库只占整条链路的中段，两端都得有人接。

### 2.1 宿主侧契约（JS）

`globalThis.MOBILE_HOST` 必须有四个成员（`host/App.js` 是参考实现，约 30 行）：

```js
globalThis.MOBILE_HOST = {
  react: React,                                   // createElement / Fragment / cloneElement
  components: { View, Text, Pressable, TextInput, ScrollView },
  scheduleTask,                                   // 微任务
  scheduleFrame,                                  // rAF（RN 里没有 window）
};
```

⚠️ **必须提供的组件恰好是这 5 个**（`View` `Text` `Pressable` `TextInput` `ScrollView`）——
它是 `render.mbt`（模块根包） 标签表的**值域**：42 条标签全部映射到这 5 个名字上，少一个，
对应标签就会变成 `undefined`。

### 2.2 应用侧契约（MoonBit → JS 的链接导出）

应用**自己的包**在 `moon.pkg` 里声明导出，宿主就能 `import`：

```
options(link: { "js": { "format": "esm",
  "exports": ["demo_start", "demo_snapshot", "demo_subscribe", "demo_element"] } })
```

宿主侧固定四件套：`start()` 挂载并画首帧 → `subscribe/snapshot` 喂给
`useSyncExternalStore` → `element()` 交出当前帧的 React 元素。

> **为什么库不能替应用导出**：导出的函数必须是**单态**的，而 `mount` 对
> `Model`/`Msg` 泛型。所以每个应用自己写一层薄包装（`demo/main.mbt` 就是样板，30 行）。

### 2.3 构建链

```
moon build --target js  →  _build/js/<profile>/build/<pkg>/<pkg>.js  →  (拷/链) 宿主 import
```

`build.sh` 现在把 `demo` 的产物拷成 `host/moobile.js` —— **它是应用侧的脚本，不是库的一部分**，
发布时应排除或改成通用形式（见 §4.1）。

### 2.4 事件载荷的现实（对外必须说清）

`html/` 的公开处理器签名是 DOM 味的：`on_click : (MouseEvent) -> Cmd`、`on_scroll : (UIEvent) -> Cmd`…
而在 React 后端下，`Mouse`/`Keyboard`/`Scroll` 这些载荷**一律是零值**
（`html/event_decoders.mbt` 的透传表，见 `FORK.md` §2.5）。
含义：**能写、不崩、坐标拿不到**。要真实手势数据得走 RN 手势通道（旧计划 `docs/PLAN-2026Q3-yi-port.md` 的 T3.4）。

---

## 3. 包清单与依赖

### 3.1 规模

- **包总数**：**26 个**（模块内，含**模块根包**、`style/`、`demo/`；不含 `host/`、`_tools/`）。
  分类：**我们的 3 个**（**模块根包** + `style/` + `demo/`）、**改过的 vendor 4 个**（`html/` `svg/`
  `internal/vdom/` `internal/runtime/`）、**原样 vendor 19 个**。
- **模块内 main 依赖边 79 条**（另有 2 条只在测试里用的边），**main 边无环**。
  唯一的环是测试边：`html/ -[for "test"]-> <root> -[main]-> html/`
  —— 含义是 `html/` 的白盒测试**只能在本模块内跑**。
- **直接依赖只有 3 个**：`moonbitlang/async@0.21.0`、`hackwaly/moonback@0.8.1`、`moonbitlang/x@0.5.1`。
  ⚠️ `moonback` **只被 `server/` 用**（`server/moon.pkg`），而 `server/` 是 rabbita 的 SSR/HTTP 那套 ——
  RN 库根本用不到。它是"别人装了三个依赖，其中一个白装"。
  ⚠️ 更糟的是 `server/` **从来没被编译过**：它声明 `supported_targets = "native+wasm"`，
  而 `build.sh` / `moon check` 都只跑 js；它还是**唯一**在 main 代码里 import 模块根包 `internal/rabbita/` 的包。
  换句话说，它是"既用不上、又没验证过、还拖着一个依赖"的三重死重。
- **module 级依赖无法按包细分**（`moon.mod` 的 `import` 是模块粒度），所以只要 `server/` 还在模块里，
  `moonback` 就一直在。

### 3.2 使用者真正需要的闭包

外部模块实测验证过的最小依赖闭包 = **16 个包**：

```
moobile/  style/  html/  cmd/            ← 使用者直接 import 的四个
+ common/  dom/  js/  sub/  url/  variant/
+ internal/{vdom, runtime, any, duplix, key, slotmap}/   ← 传递依赖（12 个）
```

`html/` 与 `cmd/` 是**零新增依赖**的（本来就在模块根包的闭包里）；
再加上根包 `internal/rabbita/` 是 17 个包、也是零新增依赖（只在要用 `Val` / `create_state` / `App` / `elmish` 时才需要）。

### 3.3 死重清单（10 个包）

`internal/rabbita/`、`demo/`、`clipboard/`、`dialog/`、`html/canvas/`、`http/`、`nav/`、`server/`、`svg/`、`websocket/`

其中几个有额外含义：

| 包 | 说明 |
|---|---|
| `html/canvas/` | **全模块零入边** —— 连 vendor 内部都没人 import，纯孤儿 |
| `svg/` | 依赖 `html+style+vdom+variant+dom`，是"按需 DSL 层"；但标签表**已把 `svg` 排除**，RN 下用不上 |
| `server/` | 见 3.1：唯一 main 代码用根包的包，从未编译过，顶着 `moonback` 依赖 |
| `internal/rabbita/` | 是 rabbita 的主 API（`App` / `run` / `Elmish` / `Val`），不是我们的库 —— 正是 §4.4-1 那个坑的来源 |

> 裁剪这 10 个包，发布面就从 26 个包降到 16 个、依赖从 3 个降到 2 个。
> 代价是 fork 的 diff 从"改 4 个包"变成"删 10 个包"，跟版脚本要多一份删除清单（旧计划 `docs/PLAN-2026Q3-yi-port.md` 的 T7.5）。

---

## 4. 「发布为库」实测体检

### 4.1 发布产物现在长什么样（`moon package --list`）

| 指标 | 实测 |
|---|---|
| 文件数 | **262 个**（+ 目录），原始 1.80 MB，zip **867 KB** |
| 产物路径 | `_build/publish/XiLaiTL-moobile-0.1.0.zip`（改名前叫 `moobile-moobile-…`） |
| **混进来的非库内容** | `host/` 14 个文件 **741 KB（占 41%！）**、`_r1/` 11 个 49 KB、`_tools/` 14 个 26 KB、`docs/` 3 个 41 KB、`demo/` 5 个 23 KB、`_verify.js` 12 KB、`README.md` 40 KB、`PLAN.md` 25 KB、`DEV.md` 13 KB |
| 死重的 vendor | 8 个死重包（`svg/ http/ websocket/ nav/ dialog/ clipboard/ server/ html/canvas/`）**+ 模块根包的 5 个文件** = 45 个文件 **193 KB** |
| 逃不掉的 vendor | `dom/` 78 个 208 KB（**在 16 包闭包里，删不掉**：`html/`、`cmd/`、`internal/vdom` 都要它）、`html/` 16 个 168 KB、`internal/` 31 个 143 KB、`js/` 15 个 44 KB |

**结论**：现在直接发，等于把**开发环境的截图、安卓构建配置、工作量计划书**一起发给用户。
`.moonignore` 是**必须**的（`moon package --list` 就是验证工具）。

> ✅ **T7.1 之后（2026-09 实测）**：发布包 **262 → 235 个文件、867 KB → 206 KB**，
> `host/` `_r1/` `_tools/` `demo/` `docs/` 全部排除，只剩库 + `LICENSE` / `README.md` /
> `THIRD-PARTY-NOTICE.md` / `FORK.md`。并且**解包后 `moon check` 0 错误**。

三条关于打包机制的**实测**注意事项：

1. ⚠️ **`.moonignore` 会"替换"而不是"叠加"同目录的 `.gitignore`**（官方文档原文 + 实测）。
   所以**不能**只在根写两条规则 —— 必须把 `.gitignore` 的内容整体搬进 `.moonignore` 再追加，
   否则 `host/node_modules/` 会立刻重新入包（实测踩到：只写 `!/.gitignore`、`!/.moonignore` 两条，
   被忽略的文件当场回到清单里）。
   （`host/` 现在这 741 KB 是**已经被 `.gitignore` 挡掉** `node_modules/`、`android/`、`.expo/` 之后的剩余：
   主要是 `package-lock.json` 与 6 张图标。）
2. `moon package --list` **不是只读命令**：它会先跑一遍 `moon check`，并**真的写出**
   `_build/publish/moobile-moobile-0.1.0.zip`。`moon package --dry-run` 明确未实现
   （二进制里就是 `dry-run is not implemented for package`）。
3. **测试文件默认入包**（`*_test.mbt` / `*_wbtest.mbt` 都在清单里，没有默认排除规则）。

### 4.2 元数据：哪些会**拦住发布**、哪些只是告警（都在 scratch 模块里实测过）

| 项 | 现在 | 判定 |
|---|---|---|
| `readme` | 未设 | ⚠️ **仅告警**：`Warning: 'readme' field is not set or empty in module manifest` |
| `repository` | 未设（`git remote -v` 也是空的，只有 1 个 commit） | ⚠️ **仅告警**，但**现在没有可填的 URL** —— 得先决定仓库放哪 |
| `license` 字段 | `"Apache-2.0"` | ✅ 合法 SPDX（实测：非法值如 `BogusLicense-9.9` 会被硬拒） |
| `version` | `"0.1.0"` | ✅ 但注意实测规则：**主版本必须是 `0`**，`1.2.3` 会被硬拒（`the major version must be '0'`） |
| `name` | `XiLaiTL/moobile` | ⚠️ 形状合法（`<author>/<module>`），**但归属要等上传时才判** —— 见 §4.7 |
| LICENSE 文件 | **不存在** | ❌ **CLI 不检查**（实测无任何相关校验），所以这是**法律问题**，不是工具问题 → §4.3 |

### 4.3 许可证（法律上必须先补；工具不会提醒你）

- `moon.mod` 声明 `license = "Apache-2.0"`，但**模块根没有 LICENSE 文件**
  （`git ls-files | grep -i licen` 只找到 `host/LICENSE`，那是 Expo 宿主的）。
- **`moon` 不会因此拦你**：实测 CLI 对 LICENSE 文件**没有任何检查**，对 `license` 字段只校验 SPDX 表达式合法性。
  换句话说，**这个坑只能靠人守**。
- vendor 的 rabbita 也是 **Apache-2.0**（[LICENSE](https://github.com/moonbit-community/rabbita/blob/main/LICENSE)）：
  §4 要求**附许可证全文、保留版权声明、声明修改**。我们改了 4 处（`FORK.md` 有清单，这一步已经做了），
  但仓库里**没有 rabbita 的 LICENSE/NOTICE**。
- 发布前需要：`LICENSE`（我们自己的）+ `THIRD-PARTY-NOTICE`（rabbita 的版权与许可原文）+
  在 README/FORK 里指向 `FORK.md`（正好充当"修改声明"）。

### 4.4 公开 API 的四处瑕疵（实测过，都不阻断，但要决定怎么办）

| # | 现象 | 实测 | 影响 |
|---|---|---|---|
| 1 | ~~模块根包是 rabbita 的主包，不是 moobile~~ ✅ **形态 B 已消除（2026-09）** | 外部模块写 `import { "XiLaiTL/moobile" @moobile }` 再调 `@moobile.mount` → **`Value mount not found in package 'moobile'`**（这次踩坑是真实发生的） | 使用者第一次就会撞上；`import "XiLaiTL/moobile"` 拿到的是 `App`/`run` 这套 rabbita API |
| 2 | 公开签名里露 internal 类型 | `render.mbt`（模块根包） 的 `render_node(v : @vdom.VNode, …)`；`html/html.mbt` 的 `to_virtual_dom/from_vnode`；`svg/svg.mbt` 同；`cmd/commands.mbt` 的 `flatten(key : @key.Key, …)`、`cmd/scheduler.mbt` 的 `runner(_ : @key.Key, …)` | 实测（双模块 scratch）：**签名能编译过**，但消费者**一旦点它的方法或字段就硬失败** —— `4037 Cannot call method of type …VNode: package … is not imported`；直接 import 那个 internal 包则是 `Cannot import internal package … due to internal visibility rules`。结论：这种类型对外**只能当不透明句柄转手**，等于这两个 `pub fn` 对外是废的。属 vendor 既有风格，`FORK.md` §3 的上游化提案 #1/#4 正是治它 |
| 3 | **`supported_targets` 的声明是假的**（不只是含糊） | 模块 `preferred_target = js`，但 14 个包声明 `"js+native+wasm"`、14 个 `"+native"`、7 个 `"-all+native"`。实测 `moon check --target native` **直接失败**：`html/attrs_event.mbt:425/430` 与 `html/html_utils.mbt:400` 报 `The value identifier event_decoders / dom_form_value is unbound` | ① `js/moon.pkg` 是 `options(targets: { "*": ["js"] })`，`dom/` 依赖它 → **传递性 js 锁**；② 我们 fork 的 `html/event_decoders.mbt` 是 js-only 文件，于是 `html/` 的 native 构建**被我们的改动弄坏了**（`docs/DESIGN.md` 里"核心 + html + cmd → native ✅"的结论已经过期）。**对外应明确"只支持 JS target"**；顺手把声明收敛成 `+js` 还能让 native 编译**快速失败并给出清楚的理由**。另据实测：模块级**没有**声明 `supported_targets`，所以包级声明**不会**被"模块 ∩ 包"的交集削弱 —— 意思是 native 消费者只要依赖**模块根包**或 `demo/`，构建会**直接失败**（不是静默降级） |
| 4 | 公开签名里引用**非 pub 类型**（同一类问题的另一面） | 模块根包 `incremental.mbt:12` 是 `struct Val[A](@duplix.Node[A])`（**没有 `pub`**），但 `pub fn Val::map(a : Val[A], …)`、`pub type Cell = () -> Val[Html]` 都在用它；`server/server.mbt:5` 还 `using @rabbita {type Val, …}` | 对使用者而言 `Val` 不可命名 → 与第 2 项同类。因为 `server/` 从没被编译过（§3.1），这个 `using` 到底编不编得过**至今没验证** |

### 4.5 小瑕疵（不阻塞发布，但会误导人）

- `js/js.mbti` 是手写的接口文件（`FORK.md` §1 第 3 步特意保留），顶部还写着
  `// Generated using moon info` 与 `package "rami3l/js-ffi/js"` —— vendor 来的陈旧身份，
  它会**跟着发布出去**。
- `html/canvas/` 全模块零入边（§3.3）。
- 附注（免得后人被 mtime 误导）：`incremental.mbt` 的修改时间属于 T0.0 改名那一批，
  但那是 `sed` 碰到它第 706 行**注释里**的旧模块名（`moobile/moobile_demo/http`）所致，
  **不是**未记录的语义改动；根包其余文件（`top.mbt` / `tea.mbt` / `deprecated.mbt`）仍是 vendor 原始时间戳。

### 4.6 已经验证通的部分（好消息）

| 验证 | 方法 | 结果 |
|---|---|---|
| 外部模块能依赖并使用 | `_tools/check_external.sh`（临时 `moon.work` 工作区 + `probe/app`） | ✅ **0 错误**：`mount` + `style` + `html` + `cmd` 全可用 |
| 外部模块能**构建出 JS 产物** | 同一工作区 `moon build --target js` | ✅ 产出 `_build/js/debug/build/probe/app/app.js`（258 KB），尾部 `export { … as start }` |
| 链接导出契约对第三方生效 | 上面的 `export` 语句 | ✅ 宿主可以直接 `import { start }` |

### 4.7 命名空间（**已定并已实证：`XiLaiTL/moobile`**）

官方规则：**发布到 mooncakes.io 的模块名必须以用户名开头**
（[Module Configuration](https://docs.moonbitlang.com/en/latest/toolchain/moon/module.html)）。

**已落地**：`moon whoami` → `Logged in as XiLaiTL`，所以模块名 = **`XiLaiTL/moobile`**，
并且 **`moon publish --dry-run` 服务端返回 `202 Accepted`**：
`Dry run completed successfully. No changes were made. The dry-run was made for package
XiLaiTL/moobile version 0.1.0.` —— 也就是说「首段必须是账号名」这条**服务端真的接受了**，
这里原本标的"未验证"可以划掉了（2026-09 实测）。
仓库 = `https://github.com/XiLaiTL/moobile.git`（写进 `moon.mod` 的 `repository`）。
改名的机械工作面（`moon.mod` 的 `name` + 全部 `moon.pkg` 的 import 前缀 + 文档示例 +
`FORK.md` §1 的重放脚本 + `_tools/ext_probe/`）已经做完并验证。

三条**实测**补充（将来换名字时仍然适用）：

1. **CLI 只校验形状**（`<author>/<module>`），**归属由服务端在上传时判定**。
   也就是说 `moon package` 会一路绿灯，失败发生在**按下 publish 的那一刻**，
   而服务端的拒绝文案**未文档化**。
2. **组织 / 团队命名空间未文档化**。mooncakes.io 上确实存在 `moonbitlang/*`、`moonbit-community/*`
   这类首段，但官方文档里**没有任何** organization/team 功能说明 —— 按文档只能理解成"首段 = 你的用户名"。
3. `moon publish`（**含 `--dry-run`**）都会**先检查凭据**：没登录直接
   `failed to open credentials file … please login first`。

---

## 5. 四种发布形态（A / B / B′ / C）

### 形态 A —— 现状即发（最小改动）

只做 §4.2/§4.3/§4.1 的卫生工作，模块结构不动。

- **改动**：`moon.mod` 加 `readme`/`repository`；补 `LICENSE` + `THIRD-PARTY-NOTICE`；加 `.moonignore`。
- **用户体验**：`import { "XiLaiTL/moobile/moobile" @moobile }`，且 `import { "XiLaiTL/moobile" }` 会拿到 rabbita 主包（§4.4-1 的坑还在）。
- **适合**：想**先验证发布链路**（注册表、版本、`moon add` 能不能装回来）。

### 形态 B —— 把库提到模块根 ✅ **已实施（2026-09）**

1. vendor 的根包（`top.mbt` / `incremental.mbt` / `deprecated.mbt` / `tea.mbt` / 根 `moon.pkg`）
   挪进 `internal/rabbita/`；
2. `moobile/*.mbt` 提到模块根，写成新的根 `moon.pkg`；
3. 更新 2 处 vendor 对根包的引用（`html/moon.pkg` 的 `for "test"`、`server/moon.pkg`）；
4. 同步 `FORK.md` §1 的重放步骤（根包现在落到 `internal/rabbita/`）。

**实施结果（2026-09，全部实测）**：

- `moon check --target js` → **0 错误 / 19 警告**；`bash build.sh` 正常
- `node _verify.js` → **26 / 26**（Metro 因目录变动崩过一次，重启即恢复 —— 它监视着被移动的目录）
- `bash _tools/check_external.sh` → 外部模块用**裸模块名** `import { "XiLaiTL/moobile" @moobile }` 编译通过
- 附带修复：**`README.mbt.md` 与 `render_test.mbt` 也跟着根包搬走了** —— 它们是 vendor 的
  README 测试与根包单测，若留在模块根就会变成**我们库的**测试文件（引用的 `@rabbita` 会编不过）

- **体验**：`import { "XiLaiTL/moobile" @moobile }` **就是库**；`style/` 依旧是 `XiLaiTL/moobile/style`。
- **代价**：半天~一天；风险低（`moon check` + `node _verify.js` 26/26 就能验证）；生成 JS 里的符号名也会变干净
  （从 `_M0FP37moobile7moobile7moobile5mount…` 变成 `_M0FP37XiLaiTL7moobile5mount…`）。
- **附带收益**：让"模块名 = 库名"这件事名副其实，也让将来的形态 C 更容易走。

### 形态 B′ —— 不搬目录，让根包"再导出"库（备选，比 B 便宜但更脏）

保留 vendor 根包原地，只在它里面加一行再导出：

```
// 根包（= rabbita 主包）里追加
pub using @moobile_lib {mount, type Mount}
```

这样 `import { "XiLaiTL/moobile" @moobile }` 也能拿到 `@moobile.mount`。
**为什么仍推荐 B 而不是 B′**：根包的主身份还是 rabbita（`App`/`run`/`Elmish`），
只是"顺手带了"moobile 的几个符号；而且这些符号要**手工列全**（枚举 API 容易漏），
将来 API 一长就会漂。B′ 适合"只想先止血、不想动目录"的场景。

### 形态 C —— 拆成两个模块（长期）

把 fork 改成**公开可用**（`vdom` 不再是 `internal/`）后单独发布，`moobile` 变成薄依赖。

- **代价**：fork 的 diff 变大（与"跟版"策略冲突）、要维护两个已发布模块、`moonbit-community/rabbita`
  上游若合并（`FORK.md` §3）还得再改一次。
- **收益**：使用者能同时用官方 rabbita；发布体积显著变小。
- **判断**：**现在不做**。等 `FORK.md` §3 的上游提案有结论再说 —— 那是"最小、可独立接受"的提案，成本更低。

---

## 6. 使用者视角：最小接入（20 + 30 行）

**MoonBit 侧**（自己的模块）：

```
// moon.mod
name = "XiLaiTL/myapp"
import { "XiLaiTL/moobile@0.1.0" }

// myapp/moon.pkg
import {
  "XiLaiTL/moobile" @moobile,          ← 形态 B 之后
  "XiLaiTL/moobile/style",
  "XiLaiTL/moobile/html",
  "XiLaiTL/moobile/cmd",
}
options(link: { "js": { "format": "esm", "exports": ["start", "snapshot", "subscribe", "element"] } })
```

```moonbit
pub fn start() -> @moobile.Mount { @moobile.mount(init, update, view) }
pub fn snapshot() -> Int { … }
pub fn subscribe(f : (Int) -> Unit) -> () -> Unit { … }
pub fn element() -> @moobile.JsValue { … }
```

**JS 侧**（照抄 `host/App.js`，换掉 import 路径）：

```js
import * as Bridge from './myapp.js';
globalThis.MOBILE_HOST = { react: React, components: {View, Text, Pressable, TextInput, ScrollView},
                           scheduleTask, scheduleFrame };
Bridge.start();
export default function App() {
  useSyncExternalStore(Bridge.subscribe, Bridge.snapshot);
  return Bridge.element();
}
```

**目前这套是靠文档传递的**（没有 npm 包、没有脚手架）。发布为库时至少要给：
可复制的 `App.js` 模板 + 一句"必须提供哪 5 个组件"。更彻底的做法是发一个
`create-moobile-app` 模板仓或 `@XiLaiTL/moobile-host` npm 包（列入 P7 可选）。

---

## 7. 建议路线（对应 `PLAN.md` §P7）

| # | 任务 | 判据 |
|---|---|---|
| T7.1 | 卫生：`readme`/`repository` 字段、`LICENSE`、`THIRD-PARTY-NOTICE`、`.moonignore`。⚠️ 写 `.moonignore` 时**必须把 `.gitignore` 内容整体抄进去再追加**（它会替换同目录 `.gitignore`，见 §4.1） | `moon package --list` 只剩库文件；不再有 readme/repository 告警；`host/`、`_r1/`、`_tools/`、`demo/` 都不在清单里 |
| T7.2 | 形态 B 重构（库提到模块根 + fork 根包进 `internal/rabbita/`） | `moon check` 0 错误；`_verify.js` 26/26；`check_external.sh` 用**裸模块名**导入并通过 |
| T7.3 | 公开 API 说明：把 §2 的契约写进 `README.md`（宿主 4 件套 + 5 个组件 + 事件的零值语义 + 只支持 js） | 文档里有可复制的两侧样板 |
| T7.4 ✅ | **已完成**：`--dry-run` → `202 Accepted` → 正式 `moon publish` → **`200 OK`**；随后在新建模块里 `moon add XiLaiTL/moobile@0.1.0` → 写真实应用 → `check` 通过、`build` 产出可被 JS import 的产物 | 发布链路闭环 ✅（2026-09） |
| T7.5（可选） | 裁剪死重：把 `demo/ clipboard/ dialog/ html/canvas/ http/ nav/ server/ svg/ websocket/` 从 fork 里去掉（根包在形态 B 之后落到 `internal/rabbita/`，去留另议） | 发布体积降 193 KB 区间的死重，依赖从 3 个降到 2 个（去掉 `moonback`） |
| T7.6（可选） | 宿主脚手架：`App.js` 模板 / npm 包 | 新项目 5 分钟能跑起来 |

**顺序建议**：T7.1 → T7.2 → T7.3 → T7.4（可选 T7.5/T7.6 随后）。
T7.1+T7.2 是"发布"的最小充分集。

---

## 8. 待拍板（先别动手，这些决定会改变做法）

1. **账号名**：mooncakes.io 上你打算用哪个账号/命名空间？模块名大概率要写成 `XiLaiTL/moobile`。
   （发布与 `--dry-run` 都要求**先 `moon login`**；归属检查在服务端，本地工具查不出来。）
2. **形态**：A（先验证链路）还是直接 B（推荐）？
3. **要不要裁 vendor 死重**（T7.5）：裁了发布更干净、少一个白装依赖，但 fork 的 diff 变大、跟版更麻烦。
4. **许可证归属**：库本体沿用 `Apache-2.0`（与 rabbita 一致，最省事），还是换 MIT？vendor 部分无论如何都得保留 Apache-2.0 声明。
5. **发布范围**：只发库（`moobile` + `style` + 必要的 DSL 包），还是要连带 demo/文档一起发（不建议）。
6. **仓库放哪**：`moon.mod` 的 `repository` 字段要有 URL，而现在 `git remote -v` 是空的、只有 1 个 commit。
   要不要先把仓库推到 GitHub（顺便让 `FORK.md` / `docs/EVIDENCE.md` 这些证据可被外部引用）？

---

## 附：怎么复现这份体检

```bash
cd /d/ai_project/interest/moobile
moon package --list                  # 看会发布哪些文件（含告警；注意它也会写出 zip）
moon package                         # 打出 _build/publish/<name>.zip
bash _tools/check_external.sh        # 外部模块可用性（check + 编译）
moon tree                            # 依赖树
moon check --target native           # 看 native 到底能不能编（现在是失败，见 §4.4-3）
```

**不发布也能验证"发出去的包能不能用"**（这就是 `moon publish` 内部做的事）：
解开 `_build/publish/*.zip` → 在解包目录里跑 `moon check`。

**本地双模块实验场**：`_tools/ext_probe/`（`README.md` 里有说明与两个已知坑）。
它靠 `moon.work` 工作区把本模块当本地依赖解析 —— 注意 `moon add` **没有 `--path`**，
本地依赖只能用工作区（`moon work init` / `moon work use`），`moon.work` 成员可以直接写绝对路径。
