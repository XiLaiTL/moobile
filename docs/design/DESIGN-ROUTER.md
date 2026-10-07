# DESIGN-ROUTER —— 路由模块（设计稿 v0.1）

> **状态**：**设计已定形，地基已验**（2026-10-07）。读数在 `docs/FINDINGS.md` 的
> 「路由地基的三条真读数」；试金石与驱动：`examples/apps/route-spike/`（`node drive.mjs`）。
> **没有实现**：本文件只定形状与判据，第一刀见 §7。

---

## 0. 为什么要有它

站点/应用的"我在哪、怎么来的、怎么回去"今天散在各应用里手写（skillpress 是
`Msg::Go(kind, i, k)` 这样一个"页面下标选择器"）。它有三个必须一起满足的诉求：

1. **可分享**（一个位置一个地址，深链能直达）；
2. **可返回**（栈、后退键、以及**被系统回收后恢复**）；
3. **可呈现**（sheet / modal 这类"位置之上的一层"）。

三者混在一起写，就会长出"返回键行为视入口而定"的一堆特例。**所以第一刀是把它们分开。**

---

## 1. 三层不许混

| 层 | 是什么 | 判据 |
|---|---|---|
| **定位** | 可寻址的状态（"在哪一页"） | 一个**能序列化的值**；与 URL **1:1 且规范化**（同一位置只有一个地址） |
| **栈** | 返回与冷启恢复的唯一依据 | 一串**条目**（条目 = 一个定位 + 产生它的参数）；`push` / `pop` / `replace` 三种动作有明确语义 |
| **呈现** | sheet / modal / drawer | **不是位置，是位置之上的一次呈现**；**可以被寻址**，但默认不占栈（见 §4） |

---

## 2. 参数三种，分开对待

| 类 | 例子 | 进地址吗 | 认不出时 |
|---|---|---|---|
| **身份参数**（路径） | `/s/:slug/:kid` | **必须进**；缺了就不是那一页 | **404**（不许降级到首页——那会把死链接伪装成活的） |
| **装饰参数**（查询） | `?s=sec-2`、`?v=raw`、`?sheet=shelf` | 可省略 | **忽略，并从地址里抹掉**（不许把不生效的值留在地址栏） |
| **状态参数**（history state） | 滚动位置、来源 | **不进** | 忽略 |

**两条附加规矩**：
- **默认值不入地址**（`?v=render` 是默认 ⇒ 不写），**顺序固定**（同一位置只有一个地址）；
- 装饰参数**不许改变"你在哪一页"**（改它们不产生新的一页）。

---

## 3. 单向环 + 唯一写者

```text
Msg::Navigate(intent)  →  reducer 算出 Route（**值**）
                            ├─ ① Model 更新
                            └─ ② 一个 Cmd 把 Route 推给宿主（**唯一写者**）

宿主来的变化（深链 / 后退 / 前进）→ Sub → Msg::RouteChanged(url) → parse → 与 Model 比对 → 不同才更新
```

- **必须留一格"我最后写出去的 Route"**，否则"自己推的地址又回来"会触发第二轮导航（抖）。
  这条在 Web 上**不是可选项**：本次实测里 `pushState` 不产生 popstate，而 hash 变化会（见 §5）。
- **`parse` 与 `render` 必须往返一致**：`render(parse(url)) === 规范化后的 url`。
  ⚠️ 今天**不成立**：`@url.parse` 对 `#/s/baz?s=sec-2` 会拆错（真因与修法见 `docs/FINDINGS.md`）。

---

## 4. sheet 的定论（"它算不算子页"）

**不算子页，但可寻址。** 三条规则：

1. 地址里给 sheet 一个**从属段**（`?sheet=shelf` 或路径末段）⇒ 深链进 sheet、分享带 sheet 的链接、
   返回关 sheet 这三件事才有定义；
2. **栈里默认不给它独立条目**——**除非是用户主动打开的**：那时压一条，
   于是**返回键 = 关 sheet**（符合直觉）；路由带进来的（深链已开着）**不**因返回而只关它；
3. **硬判据：同一时刻只有一个可分享的地址**。页面与 sheet 各持一份可分享状态 =
   "分享出去的链接打开的是哪一屏"说不清。

---

## 5. Web 侧地基的真读数（**已验**，2026-10-07）

| 事实 | 读数 |
|---|---|
| `on_url_changed` | **只有 popstate 那一档会推**：改 hash / 后退 / 前进 / 点同文档 `<a href>` ✅；`pushState` / `replaceState` ❌；**首屏** ❌ |
| 载荷形状 | 完整 URL；**hash 模式下路由在 `fragment` 里、`path` 为空**，`query` 是 fragment 之外的查询串 |
| `on_url_request` | **Web 上一个调用点都没有**（13 组动作计数恒 0）⇒ 深链入口要自己接桥 |
| `on_visibility_change` | DOM 回退接上了、方向对（`hidden=true` → 隐藏）。**"真切后台"未验**（无头浏览器给不了读数） |
| 应用侧 push | `@nav.push_url` / `replace_url` / `back` / `forward` 在 fork 里（`vendor/rabbita/nav`），**根上没有转发包**；本次**没点通**（细节见 FINDINGS） |

**⇒ 结论**：地基"部分通"。要按 §3 的形状做路由，**必须先补两条**：
① 一个**能被应用调用**的 push/replace 通道（今天 `nav` 不可达、且它自身在 RN 上会抛）；
② 一条**深链入口**（`on_url_request` 的调用方，或宿主模板里的桥）。
两条都属于"宿主能力"那一类，做法见 §6。

---

## 6. 模块切法（四块，都在本仓；别塞进应用）

| 模块 | 装什么 | 能怎么测 |
|---|---|---|
| `router/core` | 类型（`Location` / `Route` / `Stack`）+ **纯函数**（`parse` / `render` / `canonical`）+ `push`/`pop`/`replace` 语义 + overlay 策略 | ✅ `moon test` 全覆盖（纯函数，不需要浏览器） |
| `router/host-web` | 接 `history` / `popstate` / `location`；把 §5 的两条缺口补上（push 通道 + 深链桥） | 真浏览器（`route-spike` 那套 CDP 形状） |
| `router/host-native` | universal link / 自定义 scheme 收口 + 持久化栈 | 真机 |
| `router/persist` | 栈快照与恢复策略（存什么、版本号、认不出的条目怎么办） | ✅ 纯逻辑 + 存储桩 |

**与 TEA 的接法（硬规矩）**：**路由不许接管应用的 Model**。它只给
`subs(emit)` + `cmd_push(route)` + 一个**纯函数** `apply(model, route) -> model`（应用自己写投影）。
理由：不同应用里"一条 route 意味着什么"差别太大；框架一旦接管 Model，就会逼所有人按它的形状存状态。

---

## 6.5 第三类能力：**动作（`invoke`）** —— 形状与落地清单（**未实现**，2026-10-07 定形）

今天能力通道只有两类：**读**（`read_json`，`current_viewport()` / `current_url()` 走这条）与
**订阅**（`subscribe_bool` / `subscribe_json`）。而"推一下地址栏"**既不是读也不是订阅** ⇒ 补第三类。

### 纪律（这条比实现重要）

**动作不许是一个能塞任何东西的洞**：每个动作要**具名 + 声明载荷形状 + 声明哪端实现**，
并**进 `tools/cap_platform.mjs` 那张机检表** ⇒ **未声明的动作 = 判据能看见的缺口**，
而不是运行时才发现。这条纪律已在 `current_url()` 上实证过一次
（当时门直接报 `FAIL sub::current_url 是公开 API，但 PUBLIC_API 里没有它`）。

### 落地清单（下一刀按这个做，每步都有读数）

| # | 改哪里 | 做什么 |
|---|---|---|
| 1 | `vendor/rabbita/cmd/host_native.mbt` | `HostCapability` 加 `invoke(action : String, payload : String) -> String?`（js FFI：`MOBILE_HOST.native.<cap>.invoke`）；**未实现该动作 ⇒ `None`**（由调用方决定退化还是 abort） |
| 2 | `vendor/rabbita/cmd/url_action.mbt`（新） | `pub fn push_url(url : String) -> Cmd` / `pub fn replace_url(url : String) -> Cmd`。实现：**① 先问宿主动作**（`host_capability("url").invoke("push", url)`）→ **② 有 DOM 就自己来**（`@dom.window().push_url(url)`）+ **自己补一次本地回声**（`scheduler.inject_url_changed(@dom.window().current_url())`，用 `@cmd.custom_cmd` 拿 scheduler）→ **③ 两头都没有 ⇒ `abort`**（与 `on_scroll` 同一条取舍：宁可在开发期炸一次，也不要"点了没反应"） |
| 3 | `tools/cap_platform.mjs` | 新增 `ACTIONS` 表（名字 / 载荷 / web / RN / note）；把 `nav.window.push_url` 那条"RN 上会抛"改挂到**"由宿主实现"**栏（**它就是这套的理由**）；加一条检查：源码里出现的 `capability_action("…")` 必须都在 `ACTIONS` 里 |
| 4 | 判据 | `route-spike` 加两个动作读数：点"push（走动作通道）"→ **地址栏变 + `url_changed` 计数 +1**（本地回声生效）；再补一条证伪：把回声那行去掉，计数**必须不涨** |
| 5 | 文档 | `docs/ARCHITECTURE.md` 的能力表里补第三类形状；`docs/FINDINGS.md` 记"为什么本地回声是必需的"（实测：`pushState` 不产生 popstate） |

⚠️ **为什么"本地回声"必须写进实现而不是留给应用**：这是实测出来的 ——
`pushState` / `replaceState` **不产生 popstate**（`on_url_changed` 因此不会推），
而"推完之后我自己的 Model 怎么知道"是**每个调用方都会踩**的同一个坑。
库里补一次回声 ⇒ 应用侧只需处理"路由变了"这一件事（单向环里那格"我最后写出去的 Route"仍然要有）。

## 7. 深链与后台（两条容易想当然的地方）

**深链**：universal link（https）与自定义 scheme 进来**都是 URL**，差别只在谁给、给得多早。
⇒ `parse(url) -> Route?` 必须是**纯函数**、**能在首屏之前被调用**、**认不出走降级（404）永不抛**。
⚠️ `@url.Url::to_string` 今天对非 http(s) 协议**会 panic**（`_ => panic() // TODO`），
而自定义 scheme 正好落在那条分支上 —— 用之前先修或绕开。

**后台状态**分两种，别混：

| 情况 | 要什么 |
|---|---|
| 进程活着（只是切后台） | **什么都不做**（TEA 的 Model 在，从 Model 重渲）。**不许**在热路径读存储——那会引入"冷启/热启两条路径" |
| 进程被回收（Android 杀后台 / iOS jetsam） | **持久化栈 + 每层最小状态 + 版本号**，冷启恢复；**派生状态不许持久化**（滚动偏移可以按条目存，但要能容忍内容变了） |

通道：`on_visibility_change`（**已验**，Web + Android）触发写快照；存储用 `store.mbt` / `sqlite`
（能不能直接存"栈快照"见 §8 未查实）。

---

## 8. 未查实（**不许当已成立**）

| # | 问题 | 现状 |
|---|---|---|
| 1 | `@url.parse` 对 `#path?query` 的拆分 | ❌ **实测是错的**（见 §3 与 FINDINGS），修法已写，未做 |
| 2 | `url` / `nav` 两个包**要不要加根转发包** | 未定。今天消费者命名不了 `Url` / `UrlRequest`（只能调方法），也不能用 `nav` 的 Cmd |
| 3 | `store.mbt` / `sqlite` 能不能直接存"栈快照" | **未查实**（要读 `store.mbt` 的容量与事务面，或新开一条持久化通道） |
| 4 | 原生侧 universal link / scheme 的入口在哪 | **未查实**（`Linking`？宿主能力？先查再定，别猜） |
| 5 | 应用侧 push 通道为什么在本 spike 里没点通 | **未查实**（`@nav.push_url` 按钮 `n_push` 恒 0；该元素无 `tabindex="0"`） |
| 6 | 真"切后台"的 visibility 事件 | **未验**（无头浏览器给不了；要真机，`verify_android.py` 那种形状） |

---

## 9. 第一刀（建议）

1. **`router/core` 的纯函数 + `moon test`**：`parse` / `render` / `canonical` 与三类参数的处理规则。
   它不依赖浏览器、不依赖宿主，**今天就能做**，而且 §2 的每条规矩都能写成断言。
   ⚠️ 顺手把 §8-1 那个解析 bug 一起修掉（或先在 core 里自己解析，把 `@url.parse` 的坑挡在边界外）。
2. 然后**补 §5 那两条缺口**（push 通道 + 深链桥）——它们是"能不能真做路由"的前置，
   而不是"实现细节"。
3. `router/persist` 与 `router/host-native` 排在其后（都依赖 §8 里那几条未查实）。
