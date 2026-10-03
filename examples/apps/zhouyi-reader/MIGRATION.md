# 迁移报告 —— `../yi/zhouyi_reader` → `examples/apps/zhouyi-reader`

> 由 `moobile-host create --from-rabbita` 生成。**这份报告是产物的一部分**：
> 它的价值在于把"会静默失效的东西"变成一张显式清单（判据：零遗漏）。

> ⚠️ **本地补记（人手写的，不是生成器写的，2026-10-02）**：这份报告是 `create` 在**迁移当天**
> 生成的，之后这个应用被**手改**过（`main.mbt` 等），所以它不再逐字对应现在的代码。两条要紧的：
>
> 1. **生成器后来学会自查了** —— `create` 现在**落盘后**会跑 `lib/migrate/app-audit.js`，
>    把"机械迁移**移不过来**的两块"写进报告的 **§5**（判据在库侧，离线门是
>    `tools/migrate_app_audit.mjs`）。这个应用当时**没有那一节**，而那两块**真的都缺**：
>    `page()`（源 CSS 的 `body`/`html`）生成了却没人挂、根上**没有滚动容器**。
>    它们两个都**只在原生上现形** —— 真机上滚 30 次界面纹丝不动，而**同一个页面**
>    web 判据 45/45。修法与实测数字见 [`README.md`](README.md) 的架构表与
>    [`../../../docs/FINDINGS.md`](../../../docs/FINDINGS.md) 的 10-02 七续补记。
> 2. **`more_view`（文言 / 传文关联 / 义例归类）已从"保底桩"改成受控折叠** ——
>    `<details>/<summary>` 在标签表里是**明确排除**的，开合状态进了 Model
>    （`open_more : Array[Bool]` + `ToggleMore(Int)`）；web 21 条断言、真机 9 条，且做过证伪。
>
>
>
> 5. ⚠️ **§4 那份 TODO 清单已经过期**（第十二轮核过）：26 项里绝大多数**早就做完了** ——
>    动态类名（爻线）、`more_view`、`draw_bagua_cmd`/`bagua_view` 三处保底桩、13 处 `@dom`
>    整块注释（`grep @dom` 现在 **0 命中**），另有 4 处"上下文键对不上"经查是**状态标记**
>    （源码 CSS 里本来就查无此规则）。**这份报告记的是"迁移那天工具搬不动什么"**，
>    而应用在这之后被人改了很多 ⇒ **要问"还差什么"，看判据**：
>    `node verify.mjs`（99 项）、`node device_check.mjs`（29 项）、`node tools/migrate_app_audit.mjs`，
>    以及本文件上方这几条补记。
> 4. **第十轮把详情页那几族交互补上了判据，顺手修掉三个真缺陷**（都写进 FINDINGS 十续）：
>    ① 爻线（`class=line_cls` 那条 `dynamic-class` TODO）**根本没渲染出来** ⇒ 变爻点不到；
>    ② 侧栏 `.m-side` 的 `position: sticky` 退化成 `relative; top: 70px` ⇒ **压住下一栏 70px**，
>    大象点不开；③ 两栏 grid 丢失 ⇒ 断点改成"`flex_wrap` + 最小宽度"**结构性**表达
>    （不再依赖 `vp_w`：`@sub.on_resize` 刻意不补发初始值，拿它做布局判断等于永不生效）。
>    判据从 45 条涨到 **81 条**。
> 3. **当年手工数出来的那 5 处 `div(… on_click=…)` 现在是 F1 报告里的一条**（`click.on-view`，
>    10-02 落地）：这份报告的 §0 写的是 **18 类 / 357 处**（当时的读数），现在是
>    **19 类 / 362 处** —— 多出来的第 15 类正是那 5 处
>    （`frontend/main.mbt:484 / 1269 / 1372 / 1400 / 1463`，即卦卡 / 变爻 / 爻辞 / 小象 / 折叠）。
>    判据：`node tools/migrate_click_scan.mjs`（诱饵项目 + 两侧实现逐 hit 对账 + 真项目 5 处）。

## 0. 一句话

动检命中 **18 类 / 357 处**；样式层生成 **104** 个样式函数（声明 510 条 = 已映射 435 + 有损 75）；**34 项需要人工处理**（逐条见 §4）。

宿主档：RN **0.83**（`--rn` 决定）；库依赖 `XiLaiTL/moobile@0.4.0`。

## 1. 动检（F1）：会**静默失效**的东西

| 类别 | 条数 | 自动化 | 下一步 |
|---|---|---|---|
| `style.class` | 122 | 半自动 | F2 样式层半自动（CSS → Style 调用）；`:hover`/媒体查询那部分见各自那条。 |
| `style.inline` | 0 | 半自动 | F2：把字符串样式改写成 `@style.Style::new()…`；数值/颜色可直接搬。 |
| `css.hover` | 16 | 人决定 | F3 指南：改成「由状态驱动的条件样式」（把 hover 的那组属性在 Model 里表达）。 |
| `css.media` | 2 | 半自动 | F2/F3：断点转成「按尺寸选样式」的函数（宿主侧已能拿到窗口尺寸，见 N5b 的 `geometry`）。 |
| `css.grid` | 5 | 半自动 | F3 指南：`display:grid` → flex 容器 + 显式换行（`flexWrap`）。 |
| `css.sticky` | 2 | 人决定 | 三方补齐（`nandorojo/sticky` 一类的库）或改成固定头 + 滚动容器。 |
| `css.var` | 166 | 自动 | F2：在迁移时**展开成字面量**（值从 `:root` 块里读）。 |
| `dom.direct` | 15 | 半自动 | N 轨道能力包（`MOBILE_HOST` 注册表）；canvas 那部分已有一条现成通道，见 `canvas.api`。 |
| `gesture.mouse` | 4 | 不自动 | **手势通道已落地**（`@gesture.attrs(on_pan=…)` / `@gesture.pan(attrs, msg)`，宿主默认装载、零新依赖）：`on_mousedown/move/up` 换成**一个** `pan` 处理器，坐标从 `Gesture` 的 `x/y`（**元素内**）取。判据：we |
| `gesture.coord` | 0 | 不自动 | 量原点这件事**已经收进手势通道**了（`Gesture` 的 `x/y` 就是元素内坐标，真机验过 `深 起=130,50`）；剩下的是**画布侧**的 `devicePixelRatio` 换算（T3.5，未验）。 |
| `gesture.dpr` | 2 | 半自动 | T3.5：换算收进画布/手势通道内部，应用侧不用自己算。 |
| `input.controlled` | 1 | 半自动 | 把 `on_input=emit.map(f)` 换成 `on_raw("change", e => …)`，值从 `e.text()` 取。 |
| `net.http` | 1 | 半自动 | 换成 `XiLaiTL/moobile/http`；⚠️ 它在 RN 上的传输层**未验过**（见 STATUS §4）。 |
| `canvas.api` | 11 | 半自动 | **画布通道已落地**（`@canvas.OpCtx`，32 项判据）：方法名与 `CanvasRenderingContext2D` 逐字相同，迁移是换类型；真机也验过（`canvas-spike` 7/7、`canvas-demo` 12/12）。⚠️ 仍差**文字字形**（`makeFont`）与 **`devi |
| `tag.excluded` | 7 | 人决定 | 接第三方组件库（I 轨道）或改写成真实组件。**已有的替代物**：`canvas`（画布通道）。 |
| `tag.outside` | 0 | 人决定 | 人决定：改写成表内标签，或走组件通道（`库名:组件名`）。 |
| `dep.rabbita` | 1 | 必须改 | 换成 `XiLaiTL/moobile`；判据：`moon.mod` 里只剩一条 rabbita 来源、`moon tree` 不出现 `moonbit-community/rabbita`。 |
| `target.build` | 2 | 自动 | 改 `preferred_target` / `supported_targets`（机械改动，无风险）。 |

扫描范围：6 个文件 / 3139 行；标签表：映射 44 / 排除 12。

## 2. 样式层（F2）：CSS → `@style`

源：`backend/index.html:7`（476 行 / 198 条规则）

产物：`styles/styles.mbt` —— **每个"源码里真实用到的类组合"一个函数**（共 104 个）。

**对账**（这份报告能被信任的前提）：

```
声明总数 510 = 已映射 435 + 有损 75
```

### 2.1 祖先链对不上、样式**没有落到任何元素**的规则（真损失）

- `.topnav input`（backend/index.html:37，8 条声明）—— 源码里用了 `input`，但**祖先链与该选择器要求的上下文不一致**（`.topnav input`）——这一组样式没有落到任何元素上
- `.detail-head .crumb a`（backend/index.html:89，3 条声明）—— 源码里用了 `a`，但**祖先链与该选择器要求的上下文不一致**（`.detail-head .crumb a`）——这一组样式没有落到任何元素上
- `.detail-title h1`（backend/index.html:91，4 条声明）—— 源码里用了 `h1`，但**祖先链与该选择器要求的上下文不一致**（`.detail-title h1`）——这一组样式没有落到任何元素上
- `.detail-title .idx`（backend/index.html:93，3 条声明）—— 源码里用了 `idx`，但**祖先链与该选择器要求的上下文不一致**（`.detail-title .idx`）——这一组样式没有落到任何元素上
- `.rel-link.sel .rl-label`（backend/index.html:145，1 条声明）—— 源码里用了 `rl-label`，但**祖先链与该选择器要求的上下文不一致**（`.rel-link.sel .rl-label`）——这一组样式没有落到任何元素上
- `.bagua-canvas-box canvas`（backend/index.html:210，5 条声明）—— 源码里用了 `canvas`，但**祖先链与该选择器要求的上下文不一致**（`.bagua-canvas-box canvas`）——这一组样式没有落到任何元素上
- `.gua-zhu b`（backend/index.html:225，1 条声明）—— 源码里用了 `b`，但**祖先链与该选择器要求的上下文不一致**（`.gua-zhu b`）——这一组样式没有落到任何元素上
- `.card h3`（backend/index.html:232，5 条声明）—— 源码里用了 `h3`，但**祖先链与该选择器要求的上下文不一致**（`.card h3`）——这一组样式没有落到任何元素上
- `.yao-body .xiang`（backend/index.html:257，3 条声明）—— 源码里用了 `xiang`，但**祖先链与该选择器要求的上下文不一致**（`.yao-body .xiang`）——这一组样式没有落到任何元素上
- `.cite-box .c-src`（backend/index.html:264，3 条声明）—— 源码里用了 `c-src`，但**祖先链与该选择器要求的上下文不一致**（`.cite-box .c-src`）——这一组样式没有落到任何元素上
- `.nav-adj button`（backend/index.html:275，7 条声明）—— 源码里用了 `button`，但**祖先链与该选择器要求的上下文不一致**（`.nav-adj button`）——这一组样式没有落到任何元素上
- `.m-sec h2`（backend/index.html:326，5 条声明）—— 源码里用了 `h2`，但**祖先链与该选择器要求的上下文不一致**（`.m-sec h2`）——这一组样式没有落到任何元素上
- `.m-ann > summary`（backend/index.html:337，8 条声明）—— 源码里用了 `summary`，但**祖先链与该选择器要求的上下文不一致**（`.m-ann > summary`）——这一组样式没有落到任何元素上
- `.m-rels .hex-rels`（backend/index.html:348，1 条声明）—— 源码里用了 `hex-rels`，但**祖先链与该选择器要求的上下文不一致**（`.m-rels .hex-rels`）——这一组样式没有落到任何元素上
- `.m-bottom .m-sec`（backend/index.html:440，1 条声明）—— 源码里用了 `m-sec`，但**祖先链与该选择器要求的上下文不一致**（`.m-bottom .m-sec`）——这一组样式没有落到任何元素上
- `.m-bottom .m-ann-body`（backend/index.html:441，2 条声明）—— 源码里用了 `m-ann-body`，但**祖先链与该选择器要求的上下文不一致**（`.m-bottom .m-ann-body`）——这一组样式没有落到任何元素上
- `.m-more details`（backend/index.html:444，4 条声明）—— 源码里用了 `details`，但**祖先链与该选择器要求的上下文不一致**（`.m-more details`）——这一组样式没有落到任何元素上
- `.m-more details > summary`（backend/index.html:448，7 条声明）—— 源码里用了 `summary`，但**祖先链与该选择器要求的上下文不一致**（`.m-more details > summary`）——这一组样式没有落到任何元素上

### 2.2 有损的声明（**逐条**给出了理由）

- ×16 cursor:pointer —— 触屏没有光标概念（Web/桌面才有意义）
- ×8 display:inline-block —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）
- ×6 transition:border-color .15s, color .15s, background .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated
- ×6 display:inline-flex —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）
- ×5 font-family:inherit —— RN 的字体不继承
- ×4 transition:border-color .15s, color .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated
- ×4 border-radius:50% —— RN 的圆角只收点数，"圆形"要用一个大点数（如 999）来表达
- ×4 min-width:3.2em —— 只支持 px / % / auto（`calc` `min` `max` `vw` `vh` 与 em 在 RN 上没有对应物）
- ×3 letter-spacing:0
- ×3 display:grid —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）
- ×2 position:sticky —— `@style` 只有 Relative / Absolute；sticky / fixed 在 RN 上没有对应物
- ×2 display:inline —— `@style` 只有 Flex / Hidden 两个取值（行内排版在 RN 上是怎么显示的问题，见 R1 判决）
- ×1 font-feature-settings:"palt" —— 原生字体渲染由平台决定
- ×1 -webkit-font-smoothing:antialiased —— 原生字体渲染由平台决定
- ×1 cursor:default —— 触屏没有光标概念（Web/桌面才有意义）
- ×1 width:min(94vw, 720px) —— 只支持 px / % / auto（`calc` `min` `max` `vw` `vh` 与 em 在 RN 上没有对应物）
- ×1 box-shadow:0 2px 10px rgba(26,20,16,.10) —— RN 要拆成 shadowColor/shadowOffset/shadowOpacity/shadowRadius（Android 还要 elevation），需要复合助手
- ×1 transition:border-color .15s, transform .15s —— RN 没有 CSS 过渡；动效走 Animated / Reanimated
- ×1 grid-template-columns:repeat(auto-fill, minmax(116px, 1fr)) —— RN 没有 grid 布局（`@style` 只有 flex）。降级成 flex 需要**人来决定**列宽策略
- ×1 grid-template-columns:250px 1fr —— RN 没有 grid 布局（`@style` 只有 flex）。降级成 flex 需要**人来决定**列宽策略
- ×1 grid-template-columns:160px 1fr —— RN 没有 grid 布局（`@style` 只有 flex）。降级成 flex 需要**人来决定**列宽策略
- ×1 background:transparent —— 只支持纯色（渐变 / 图片 / 多重背景在 RN 上没有对应物）
- ×1 box-shadow:inset 0 0 0 2px #8a2518, inset 0 0 0 4px #f6efe0 —— RN 要拆成 shadowColor/shadowOffset/shadowOpacity/shadowRadius（Android 还要 elevation），需要复合助手
- ×1 transform:translateY(-50%) —— RN 要结构化数组，而 `Style` 的条目是扁平 (key, StyleValue)，装不下

> 这些不是"生成器漏了"，而是 `@style` **明确不表达**它们（可移植子集优先于表达力）。
> 逐条的位置写在 `styles/styles.mbt` 的函数头注释里（`TODO(migrate)`）。

### 2.3 整条规则没映射（38 条）

- **pseudo** ×25：伪类/伪元素 :focus —— RN 没有伪类，:hover 在触屏上本来也不存在（`.topnav input:focus`）
- **media** ×13：@media @media (max-width: 760px) 里的 `.m-layout` —— RN 没有媒体查询，断点要在 Model 里按窗口宽度表达

## 3. 改写统计

- `class=` 改写处数：**131**（含条件类；带祖先链上下文）
- 入口/依赖/import 改写：6 条（见 §4 表里 `auto` 那几行）

## 4. 必须人工处理（TODO 清单）

**每一项都指了下一步**（判据 S9-5：不许出现"未知"这一类）。

| # | 位置 | 什么 | 为什么 | 下一步 |
|---|---|---|---|---|
| 1 | `frontend/main.mbt:1370` | `class=line_cls` | 类名不是字面量（`class=line_cls`）—— 机械映射只能靠猜变量的赋值，不猜 | 人工：把类名收敛成字面量（或在 Model 里表达状态），再决定样式 |
| 2 | `frontend/main.mbt:1864` | `class="m-yaos"` | 上下文键 `div.m-detail>div.m-layout>div.m-lines>div.m-yaos` 在 CSS 里没有匹配的规则（多半是状态标记），未改写 | 人工：确认这是状态标记还是有遗漏的规则 |
| 3 | `frontend/main.mbt:1844` | `class="m-detail"` | 上下文键 `div.m-detail` 在 CSS 里没有匹配的规则（多半是状态标记），未改写 | 人工：确认这是状态标记还是有遗漏的规则 |
| 4 | `frontend/main.mbt:1574` | `class="rl-name"` | 上下文键 `div.rel-wrap>button>span.rl-name` 在 CSS 里没有匹配的规则（多半是状态标记），未改写 | 人工：确认这是状态标记还是有遗漏的规则 |
| 5 | `frontend/main.mbt:1572` | `class="rl-label"` | 上下文键 `div.rel-wrap>button>span.rl-label` 在 CSS 里没有匹配的规则（多半是状态标记），未改写 | 人工：确认这是状态标记还是有遗漏的规则 |
| 6 | `frontend/main.mbt:1119` | `draw_bagua_cmd` | `draw_bagua_cmd` 的实现迁不过去（`@dom` 是浏览器 API 直连；RN 上没有 `document`） | 人工：用 moobile 的对应通道重写实现 —— canvas 走 `@canvas.OpCtx`、读坐标的手势走 `@gesture.pan`、`details/summary` 改成受控组件（见 SCAFFOLD §3.7.3） |
| 7 | `frontend/main.mbt:1152` | `bagua_view` | `bagua_view` 的实现迁不过去（`@dom` 是浏览器 API 直连；RN 上没有 `document`） | 人工：用 moobile 的对应通道重写实现 —— canvas 走 `@canvas.OpCtx`、读坐标的手势走 `@gesture.pan`、`details/summary` 改成受控组件（见 SCAFFOLD §3.7.3） |
| 8 | `frontend/main.mbt:1669` | `more_view` | `more_view` 的实现迁不过去（标签表外的标签（RN 无对应物）） | 人工：用 moobile 的对应通道重写实现 —— canvas 走 `@canvas.OpCtx`、读坐标的手势走 `@gesture.pan`、`details/summary` 改成受控组件（见 SCAFFOLD §3.7.3） |
| 9 | `frontend/colorring.mbt:189` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 10 | `frontend/colorring.mbt:224` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 11 | `frontend/colorring.mbt:268` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 12 | `frontend/main.mbt:638` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 13 | `frontend/main.mbt:644` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 14 | `frontend/main.mbt:650` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 15 | `frontend/main.mbt:672` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 16 | `frontend/main.mbt:801` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 17 | `frontend/main.mbt:837` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 18 | `frontend/main.mbt:859` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 19 | `frontend/main.mbt:881` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 20 | `frontend/main.mbt:1077` | blocked | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：整块重写（签名也迁不过去）—— 同上 |
| 21 | `frontend/main.mbt:1081` | blocked | 内联 JS FFI 是按浏览器语义写的（`window` / `devicePixelRatio`） | 人工：整块重写（签名也迁不过去）—— 同上 |
| 22 | `frontend/colorring.mbt:189` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 23 | `frontend/colorring.mbt:224` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 24 | `frontend/colorring.mbt:268` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 25 | `frontend/main.mbt:638` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 26 | `frontend/main.mbt:644` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 27 | `frontend/main.mbt:650` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 28 | `frontend/main.mbt:672` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 29 | `frontend/main.mbt:801` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 30 | `frontend/main.mbt:837` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 31 | `frontend/main.mbt:859` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 32 | `frontend/main.mbt:881` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 33 | `frontend/main.mbt:1077` | 整块已注释 | `@dom` 是浏览器 API 直连；RN 上没有 `document` | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 34 | `frontend/main.mbt:1081` | 整块已注释 | 内联 JS FFI 是按浏览器语义写的（`window` / `devicePixelRatio`） | 人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |
| 35 | `—` | entry-manual | 没有找到 `fn app() -> Val[Html]` 这个形状的入口 —— 入口要手工改 | 自动完成，无需动作 |
| 36 | `—` | using | `using @rabbita {…}` 改成 `using @html {…}`（Html 由 html 包提供；`Val` 是 rabbita 根包的东西，随入口一起没了） | 自动完成，无需动作 |
| 37 | `—` | entry | 入口改写成单导出：`fn main { @rabbita.new(app).mount("app") }` → `pub fn app() -> @moobile.JsValue`（handlers_with_init） | 自动完成，无需动作 |
| 38 | `—` | entry | 去掉 `fn main`（挂载由宿主负责，库侧不再自己 mount） | 自动完成，无需动作 |
| 39 | `—` | import-dropped | import `moonbit-community/rabbita` 在 moobile 里没有对应物（它是 rabbita 的根包：`App`/`run` 那一套由宿主接管），已去掉 | 自动完成，无需动作 |
| 40 | `—` | entry-manual | 没有找到 `fn app() -> Val[Html]` 这个形状的入口 —— 入口要手工改 | 自动完成，无需动作 |

## 5. 生成物清单

```
.gitignore
App.js
MIGRATION.md
README.md
app.json
colorring.mbt
index.js
main.mbt
metro.config.js
migration.generated.json
moon.mod
moon.pkg
package.json
registry.generated.js
shared/hexagram.mbt
shared/moon.pkg
styles/moon.pkg
styles/styles.mbt
```

## 6. 这份报告**没有**做的事（诚实清单）

- **不重写业务逻辑**：`update` / `view` 的结构、数据模型、文案一个字都没动；
- **不承诺效果一致**：RN 的排版与浏览器不同（行内流那条已被实测推翻过），效果要重新验；
- **不改宿主之外的工程配置**：`app.json` 的图标/包名等仍是模板默认值；
- 被注释掉的块**没有**给出等价改写 —— 那是人的决定。
