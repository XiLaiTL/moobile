# STATUS —— 现状与分数（**唯一来源**）

> **规矩**：这个项目"现在到哪了"**只写在这一份文件里**。其他文档（[`PLAN.md`](../PLAN.md)、
> `docs/design/**`、`README.md`、CI 注释）只留一句"见 `docs/STATUS.md`"。
>
> 为什么立这条规矩：2026-09-20 整理文档时，光 `PLAN.md` 一份文件里就同时存在
> Web **26/26** 与 **27/27**、真机 **21/21** 与 **14/14**、"已发布"停在 `0.1.0`
> （而月亮包已经到 `0.2.2`）三处互相矛盾的数字。**数字抄一份就会漂一份。**
>
> **每个数字都要能回答三件事**：哪条命令跑的、什么时候跑的、是不是本轮跑的。
> 本轮（2026-09-20）没重跑的，一律标"文档记载"，不许混进实测那一栏。

---

## 1. 已发布 vs 工作区

| 东西 | registry 上的 | 工作区里的 | 差异 |
|---|---|---|---|
| 月亮包 `XiLaiTL/moobile` | ✅ **`0.5.0`**（**2026-10-04 发布**；`moon publish` 回 `Server status: 200 OK`；外部视角复核见下） | `0.5.0` | **已对齐** ✅ |
| 宿主包 `moobile-host`（npm） | `0.4.0`（2026-10-03 发布，核过） | **`0.5.0`（已抬版、已过发布前自检，⏳ 待发）** | ⏳ **待发** |
| **契约版本** | 月亮包 `2` / 宿主包 `2`（宿主包还是 0.4.0 那一份） | 两边都是 `2` | 待宿主包发完再终判 |

> ✅ **2026-10-04：月亮包 `0.5.0` 已发布，并**从外部视角**复核过**（`bash tools/check_published.sh`）：
> · 从 registry **装得下来**（`XiLaiTL/moobile@0.5.0`，当外部模块用、`moon check --target js` **0 错误**）；
> · **9 个公开包齐全**（`canvas` `cmd` `gesture` `html` `http` `sqlite` `style` `sub` `vendor/rabbita`）；
> · README 里那 5 条 import 路径对着**线上这一版**编得过。
> ⏳ **宿主包 `0.5.0` 等发布**：`bash npm/moobile-host/publish.sh <6位OTP>`（⚠️ 先 `npm login`，
> 本机 `npm whoami` 是 `E401`）。发完再跑一次 `check_published.sh` —— 第 6 段验"两个包同代 + 契约一致"，
> 且**别拿"刚发完查不到"当"没发出去"**（npm 回 202 异步受理，约 6 分钟才可见）。

> ⏳ **2026-10-04：`0.5.0` 正在发**（**月亮包先、宿主包后**）。抬版动的 20 个文件与发布前读数：
>
> - **抬版范围**（`0.4.0` → `0.5.0`）：`moon.mod` · `npm/moobile-host/package.json` ·
>   `hosts/rnw` 与 `hosts/webview` 的 `"moobile-host"` · `lib/migrate/create.js`（两处）·
>   `README.md`（两条）· **11 个** `examples/apps/*/moon.mod` · `examples/apps/template/package.json` ·
>   `tools/scaffold_probe/app/moon.mod` · `tools/template/deltas.txt`；另加**重新生成**的生成物
>   （`libgen` 两侧 + `check_npm_fresh` 的 **13 份宿主副本**先刷过）。
> - **发布前自检（2026-10-04 实跑）**：离线全集 **34 / 34**；白盒测试 `moon test --target js`
>   **110 / 110**；`node tools/package_check.mjs` **10 / 10**；
>   `readme_probe --zip _build/publish/XiLaiTL-moobile-0.5.0.zip` ✓；泄漏自检 ✓
>   （`tools/check_public_leaks.py`）；`moon publish --dry-run` → `Server status: 202 Accepted`
>   （**月亮包的 token 是好的**）；`publish.sh --dry-run` ✓（读出 `moobile-host@0.5.0`）。
> - ⚠️ **宿主包这边有个已知阻塞**：`npm whoami --registry=https://registry.npmjs.org/` → **`E401`**
>   （与 `0.4.0` 那次同一个坑的**前置信号**：未认证的 `PUT` 会回 404，看着像包名不对）。
>   ⇒ 发 npm 之前必须先 `npm login --registry=https://registry.npmjs.org/`（**别用默认镜像**），
>   发布时还要 6 位 OTP。
> - ⚠️ **GitHub 推不上去**（与发版无关，但记一笔）：`git push` 走 `http.proxy=127.0.0.1:7890`
>   而**代理没开**（直连则 `Connection was reset`）⇒ 工作树已提交、**推送待代理恢复**。
>   提交：`e54cead`（折叠箭头那一处排版修复 + `FINDINGS` 第三十一轮）。
>
> ✅ **2026-10-03：`0.4.0` 两个包都已发布**（**月亮包先、宿主包后**，顺序不能反的理由见 `CHANGELOG.md`）。
> 下面三条是这一版发布时**踩到的**，都留下 —— 因为它们都是"会再犯"的那一类。
>
> 1. ★ **宿主包第一次发失败：`npm ERR! code E404 … PUT https://registry.npmjs.org/moobile-host - Not found`**。
>    这是 [`FINDINGS.md`](FINDINGS.md) **记过的那条坑的原样复现** ——
>    **npm 对"未认证"的 `PUT` 回 404**（看着像"包名不对"，其实是 **token 过期**）；
>    佐证：`npm whoami` → **`E401`**。刷新凭据
>    （`npm login --registry=https://registry.npmjs.org/`）后重发成功。
>    ⚠️ **别用默认 registry 登录** —— 本机默认是淘宝镜像（只读，发不上去）。
>    （失败的 PUT **什么都没发出去**：当时复核线上仍是 `0.3.0`，工作树也干净、没留 tarball 或模板副本。）
> 2. ⚠️ **"发完了"要以 registry 为准，而且要给它传播时间**：重发之后**头几分钟**查
>    `npm view moobile-host version` **仍然是 `0.3.0`**，过一会儿再查才是 `0.4.0` ——
>    与 `FINDINGS.md` 记的"**成功时回 202 异步受理、约 6 分钟才可见**"一致。
>    ⇒ **一分钟就去查会得出"没发出去"的错误结论**（这条坑本仓库已经踩过至少两次）。
> 3. ⚠️ **发布前必须先修 CHANGELOG**：原文写着"这一版是纯增量、**没有破坏性改动** ——
>    老代码不用改"，而 vendor 换底（rabbita `0.15.4 → 0.16.3`）带进来**三处源码级破坏**
>    （`@js.Promise` → `Promise[T]`、`@common.Viewport` 的 `width`/`height` `Int` → `Double`）。
>    **发出去的文档把事实说反了** —— 那比漏写一条严重。详见 [`CHANGELOG.md`](../CHANGELOG.md) 的 `0.4.0` 第一节。
>
> 发布前的自检（都是实跑）：`publish.sh --dry-run` 打包自检 ✓ · **打包形态门 10/10** ✓ ·
> 泄漏自检 ✓；`moon package --list` 产物齐全（`_build/publish/XiLaiTL-moobile-0.4.0.zip`）；
> 离线全集 **25 / 25**、白盒测试 **104 / 104**。宿主包线上 tarball **64 个文件 / 199.3 kB**
> （`template/` 与新增的 `hosts/` 都在）。
>
> 发布前的自检（都是本会话实跑）：`publish.sh --dry-run` 打包自检 ✓ ·
> **打包形态门 10/10** ✓ · 泄漏自检 ✓；`moon package --list` 产物齐全
> （`_build/publish/XiLaiTL-moobile-0.4.0.zip`）。⚠️ 离线全集在本会话是 **25 / 25**、
> 白盒测试 **104 / 104**。

> ✅ **2026-10-01：0.3.0 已发布，两个包都核过 —— §4-1 那条"最硬的阻塞"结了。**
> 实测证据（本轮跑的，见 §2.1）：`check_published.sh` 对 **线上** `0.3.0` 通过（9 个公开包齐全）；
> 线上 npm tarball 拉下来逐个查过；**从 registry 上两个包从零走了一遍用户的三条命令**，
> 真 Chrome 断言 **9 / 9**（见 §2.1 的「干净机器（registry 版）」）。
>
> ⚠️ 两个**只在发布日成立**的坑，都记进了 [`FINDINGS.md`](FINDINGS.md)：
> ① npm 对**未认证**的 `PUT` 回 **404**（看着像"包名不对"，其实是 token 过期）；
> ② 发布成功时服务端回 **202 = 异步受理**，`0.3.0` **约 6 分钟后**才在 registry 上可见 ——
> 一分钟就去查会得出"没发出去"的错误结论（我这一轮就判错了一次）。
> ③ 本机默认的 **npmmirror 镜像还没同步**（`npm install` 报 `notarget … ^0.3.0`），
> 官方源上已经有 —— 按需同步已触发。

---

## 2. 门与分数

### 2.1 最近**实测**过的（每条带日期 —— 数字要能回答"哪条命令、什么时候、是不是本轮"）

| 门 | 命令 | 日期 | 结果 |
|---|---|---|---|
| **★ 节点寻址（站点右栏目录那两件事的**前置**）** | `node examples/apps/node-spike/drive.mjs`（真 Chrome + CDP **真鼠标**）· `node tools/cap_platform.mjs` · `moon test --target js` | **2026-10-07** | **五组读数全成立**（产物 sha256 `e9ff4a4c5209405d…`）：① `Attrs::id("…")` **落到 DOM**（`#pane` / `#sec-1..3` / 四个按钮全在）· ② `@sub.scroll_to_node("sec-3", block="start")` 把那一节**顶到容器上沿**（`sec-3.top − pane.top = **0.0px**`，`scrollTop` 0→1000）· ③ `@sub.node_rect("sec-3")` 与浏览器自己量的**最大差 0.000px**（x=12 y=274 w=854 h=500）· ④ 读数是**活的**（滚回顶再量 y 274→1274）· ⑤ `node_scroll_top` **137 vs 137**。**证伪**：把 `section()` 上的 `.id(name)` 去掉 ⇒ **12 条红**、`#sec-1..3` 报「不在 DOM 里」、堆栈点名 `abort_missing_node`；还原后 sha256 **逐字节相同**、复跑全绿。平台矩阵 **36 公开 API / 34 条 DOM 链路**一致；白盒 **111 / 111**；页面 0 条 JS 错误。⚠️ **两条边界别读大**：**RN 未验**（`node` 能力今天没有任何宿主登记 ⇒ RN 上 `abort`）、**容器级滚动订阅未做**（跟读高亮还差这一刀）。另：**我原先判「`@nav.scroll_to` 是死通道」是错的** —— 实测它真滚了（库侧 `AfterLayout`+DOM 自己实现；`push`/`load` 那几个才没实现），详见 `FINDINGS.md` 本轮补记第五节 |
| **★ `MIGRATION.md` 分两区（拍板 ⑥ 落地：生成区可覆盖 / 手写区逐字节保留）** | `node tools/report_region_check.mjs`（**新门，15 项**）· 临时目录里真跑两次 `create --force` | 10-23 夜 | **15 / 15**（含证伪）。起因：这份报告是"**迁移当天的生成物 + 人手补记**"两种东西，混在一起**两头都疼** —— 重生成**冲掉人的补记**（不可逆）、不重生成数字**一直漂**（实测漂过 4 处：§0 的 `18 类/357 处` → `19/362`、`510=435+75` → `439+71`、`34 项` → `39 项`、类别表少一行）。做法：`create.js` 写报告时带两组标记（`GENERATED_*` / `HAND_*`），落盘前**读旧文件取出手写区**再拼回去（`reportWithHandRegion`）。⚠️★ **老格式（没有标记）不许丢东西**：那种文件里"人的补记"与"生成物"**分不开**，所以不猜 —— **整份旧文件**保留进手写区 + 一句"这是上一版报告、请人工搬走要紧的补记、然后把这段删掉"。判据：两个区各恰好一个标记 / 顺序对 / 不嵌套 / 手写区非空 / **重生成之后补记逐字节还在**（这条是目的，其余是守卫）/ 老格式整份不丢 / **真报告必须已经是分区格式**（免得规则只在夹具里成立）。证伪 `MOBILE_REPORT_DROP_HAND=1` ⇒ 那条判据变红。★ **还做了真·端到端**：`.scratch/` 里真跑 `create --from-rabbita … --force` → 往手写区注入带标记串的补记 → **再重生成 ⇒ 补记还在（命中 1）**；证伪开关再重生成 ⇒ **命中 0**（证明这条链真的接上了，不是"文件根本没被重写"）。真报告已转换（`examples/apps/zhouyi-reader/MIGRATION.md`：生成区 + 五条编号补记 + 一条把 99/29 更新成 **107/39** 的补记），转换用脚本做并自查过"旧文件 **191 条非空行**里只有**我明确改的那 2 行**不在新文件里"。详见 [`FINDINGS.md`](FINDINGS.md) 第三十轮 |
| **★ `numberOfLines` 键（拍板 ⑤ 落地：加，但**只作显式键**，生成器不自动折）** | `moon test -p XiLaiTL/moobile --target js` · `node tools/style_platform_check.mjs` | 10-23 夜 | 白盒 **110 / 110**（108 → 110）· 平台门 **14 / 14**（8 → 14）。为什么"加一个键"比看起来麻烦：**它不是样式键、是 `Text` 的组件属性**（`<Text numberOfLines>`）—— 留在 `style` 里**两端都错**（原生 RN 静默忽略、RNW 当非法 CSS）⇒ 三处都要动：① `style.mbt` 构造器 + ⚠️ 说明（**语义是"截断 + 省略号"，不是"不折行"** ⇒ 所以**不自动折**，这是拍板结论）；② `render.mbt` 新增 `is_prop_key` / `split_prop_keys` / `set_style_value`，把属性键从 `style` 里**摘出来挂成元素 props**（`render_props` 与 `make_text` **共用同一个拆分函数**），`is_text_key` 也算上它（只在 `Text` 上有效 ⇒ 跟着最近的文字层往下走）；③ 判据：白盒 2 条（**构造器的键名必须与"属性键那张表"对得上** —— typo 会让它**退化成一个普通样式键**，那正是失效的样子；`split_prop_keys` 之后属性键**不在样式那一半、在属性那一半**、且普通键**一个没被顺手摘走**）+ 平台门新增第三类表 `PROP_KEYS`（与"RN 不认的样式键"分开 —— 混在一起会把一个**正确**的设计判成"没登记"）：它**不在** RN 样式登记表里、**在** RN 与 RNW 的 `Text` 实现里（读真源码，0.83.10 / 0.86.3 都命中），4 条证伪（含**词边界**：`fooNumberOfLinesBar` 不算命中）。⚠️ 写证伪时自己踩了一下：假源码**注释里**写了那个键 ⇒ 谓词命中 ⇒ **证伪自己假红**（"证伪的夹具也要干净"）。⚠️ **端到端还没验**（没有应用在用这个键 —— 拍板就是"显式键、不自动折"，不能为了验它去改外观）：现在能说的是"库把它摘出来挂成 prop"+"两端真的认这个属性"，**"真机上真的截断了"要等有应用用它**。⚠️ 另记：本轮改了 `render.mbt` ⇒ **应用产物的 sha 从 `9e55868191f167dd` 变成 `8fcf2411dfa5c212`** —— 之后的三条读数（web **107 / 0**、静态宿主 **15 / 15**（内含那 107 条）、真机 **39 / 0**）**都是在这个新产物上跑的**。详见 [`FINDINGS.md`](FINDINGS.md) 第三十轮 |
| **★ 分边边框样式自动折叠（第二十一轮列的欠账 ④，本轮做掉；真机读数"实线 16 条 → 虚线 22 条"）** | `node tools/border_fold_check.mjs`（**新门，22 项**）· `node examples/apps/zhouyi-reader/device_check.mjs` · `regen --styles` | 10-23 夜 | **22 / 22**（含**两组**证伪）· 真机 **39 / 0**（35 → 39）· web **107 / 0**（未变）· 离线全集 **33 门**（⚠️ 第三十轮重跑已是 **34 门**，多的那条是 `report_region_check` —— 见 `FINDINGS.md` 第三十轮·三）。**这件事的真实代价不是"注释不准确"而是画错了**：源 CSS `.m-yao { border-bottom: 1px dashed }` 迁成 `borderBottomStyle` —— 原生 RN **不认这个键**（登记表里没有）⇒ 按默认 `solid` 画 ⇒ **web 虚线、真机实线**，而 web 那 107 条**看不出**。折法（`style-map.js` 的 `planBorderStyleFold`）：按**整格**算每边的"有效宽度"（分边 > 四边 > 0）与"有效 style"（分边 > 四边 > 默认 solid），**有宽度的边 style 全一样** ⇒ 发一次四边共用的 `borderStyle`、去掉各条分边 style 调用（简写里的宽度/颜色照旧发）；四边共用那个键已是同值 ⇒ **纯冗余**，只删不补；⚠️ **有几条带宽度的边 style 不同 ⇒ 一条都不许折**（`div_m_weny_box`：左 2px 实线 + 上 1px 虚线）。**等价性**：没宽度的边**画不出线**（RN 的 `borderWidth` 默认 0），它的 style 是什么都不影响外观。**门里"能折"与"不许折"是同一件事的两半**（夹具 6 格 + **反例控制**），两组证伪：`MOBILE_NO_BORDER_FOLD=1`（关掉折叠）⇒ 四条"该折"的判据 **4/4 全红**；`MOBILE_BORDER_FOLD_ALL=1`（无脑全折）⇒ **同一条反例控制判据变红**（证明它挡得住假修）。另两条"账本不破"：折叠让一条声明**少掉一个调用** ⇒ 必须说明自己去哪了（否则 `silentEmpty` 点名 = 新的静默丢键）；折成功的格子里那句过期的"原生不生效"说明**必须去掉**（不然产物自相矛盾）。⚠️ 写这条门时又栽在"判据自己的读数不可信"上：`fnDoc` 从 `src.slice(0, i)` 取函数头注释，而切片**正好切在 `pub fn` 处** ⇒ 最后一个元素是空串 ⇒ 5 条"说明写清了没有"的判据**全假红**。**真机标定**（同一屏、按颜色找 `--paper-3` 横线）：**折叠前 虚线 1 / 实线 16（爻行四条都是 585px 连续）；折叠后 虚线 22 / 实线 1（爻行变 33 段；剩下那条实线正是折不动的 `div_m_weny_box`）**。产物：105 个函数里 **7 个**有差异（折 6 + 折不动的 1），`--sync` 后 0 差异；`MOBILE_NO_BORDER_FOLD` 两个开关**只为这条门存在**。⚠️ 另记一条**操作读数**（第三十轮顺手撞到）：`render.mbt` 改完之后重跑两端 —— web **107 / 0**（未变）、真机 **39 / 0**（连跑两次）；但**刚 `--clear` 重启 Metro 之后的第一跑是 30 / 2**，红的不是判据而是两条**夹具级**的（`切回「后天文王」→ 画面复原` 与 `（夹具）进入了某一卦的详情页`），而**夹具一红、后面 7 条被 `if` 静默跳过** ⇒ 总数从 39 掉到 32。⇒ **"清缓存重启后的第一跑"不是可信读数，再跑一次才算**；另注意**总数也是读数**（"少验了"不该看起来像"验过了"）。详见 [`FINDINGS.md`](FINDINGS.md) 第三十轮第五节 与第二十九轮 |
| **★ web 侧也补上文字样式判据（廿七轮留的缺口："103 条里一条都没量文字样式"）** | `node examples/apps/zhouyi-reader/verify.mjs`（真 Chrome）· `node examples/apps/zhouyi-reader-webview/verify.mjs` | 10-23 夜 | **通过 107 / 失败 0**（103 → 107）+ **静态宿主 15 / 15**（其中那 107 条原样打在零 Expo / 零 Metro 的宿主上也是 **107 / 0**）。新增 4 条：**爻题叶子够多（≥3，前提自查）** · **★爻题都是粗体**（6 个文本叶子的**计算** `font-weight` 全 700）· **爻题的字号与颜色也按元素生效**（16.5px / `rgb(138, 37, 24)` / `letter-spacing: 1.65px` = `.1em`）· **★爻辞不是粗体**（同屏另一组 400 ⇒ 防"都粗/都没粗"两种假绿）。**为什么两端都要有**（不是验两遍）：web 的 `font-weight` **会继承** ⇒ "web 绿"代替不了"真机绿"；反过来"迁移侧真丢了键"web 也看得见 ⇒ 两面互补。**证伪**：删掉生成物 `span_m_yao_title()` 的 `font_weight` → 重建 + **`--clear` 重启 Metro** ⇒ **通过 106 / 失败 1**，红的正是「爻题都是粗体」（6 个叶子的 `w` 全从 700 掉到 400、另三条照旧绿 ⇒ 它量的确是**那一个键**）；还原后 `107 / 0`。⚠️ 口径抄了自己两条老账：**量看得见的那一层**（文本叶子，不是祖先 —— 第十轮"衬线体"那条就栽在只看祖先）、**要分组对照**（只断"页面上有 700"是恒真的，页头 brand 就是 700）。⚠️ **这一侧的弱点如实记下**：`getComputedStyle` 拿到的是**继承之后**的值 ⇒ 祖先写了粗、叶子丢了键时它**照样绿**；真机那条（量像素笔画粗细）没有这个漏洞 ⇒ **两条不等价**。详见 [`FINDINGS.md`](FINDINGS.md) 第二十八轮 |
| **★ 真机上量"文字样式到底生效没有"（廿一轮欠账，本轮补上；新判据**能红**是量出来的）** | 模拟器 AVD `moobile64` → `node examples/apps/zhouyi-reader/device_check.mjs` | 10-23 夜 | **通过 35 / 失败 0**（32 → 35：+**进详情页** +**两组样本够**（前提自查，防"零样本地判过"）+ **★ `fontWeight` 真的生效**）。怎么量（**不靠应用自述、不装图像库**）：详情页每一爻都是「爻题（`span.m-yao-title`：16.5px **W700** 红字）+ 爻辞（16px 常规深字）」⇒ **同屏两组对照**：A 组 = 2~3 字爻题、B 组 = 同字号的整句正文；统计量 = 墨色**水平游程**（竖笔粗细）里 **≥4px 的段数占比**，比两组比值。**两个被否掉的统计量**（都是量出来才知道）：① **墨点密度**被**字形复杂度**带偏（A 0.122 / B 0.136 —— 加粗那组反而更"稀"，因为「六三」的「三」只有三横）；② 游程 **p25** 是**整数分位数**，真信号只有"3 还是 4" ⇒ 原始 1.56 / 证伪 1.11、阈值只能卡 1.35、两侧余量各 ~0.2。换连续量后：**粗笔段数占比比值 原始 2.15 / 证伪 1.22**（探针取样），跑判据本体 **2.33 / 1.32** ⇒ 阈值 **1.6**。**证伪怎么做**：把生成物 `styles/styles.mbt` 里 `span_m_yao_title()` 的 `font_weight` 删掉 → 重建（sha `1f530204c12de42b`）→ **`--clear` 重启 Metro** → **通过 34 / 失败 1、红的正是新判据（1.32）**；还原后 sha 回 `9e55868191f167dd`、复跑 **35 / 0**。★ **顺手否掉一个我自己的错假设**（差点照它去"修"）：从 `render.mbt` 读起来像"祖先的 `textAlign` 会丢"（`make_element` 整份替换 `near`），真机上标题确实**左对齐**；但**再去量 web 侧**（CDP 读计算样式链）发现**web 也是左对齐**（RNW 的 `Text` 自带一层 `text-align: start` 把祖先的 `center` 挡住了）⇒ **两边一致、没有 bug** —— 若照假设去改继承合并，改的是不存在的差异、还会**改产物**并要重跑 103 条 web 判据。⚠️ **仍未量**：`fontStyle` / `textAlign` / `textTransform` 三个键（⚠️ **原先这里还写"web 侧一条文字样式判据都没有（可测而未测，下一件）"—— 第二十八轮当晚就补上了 4 条**，web 从 103 → **107 / 0**，见本表上一行）。详见 [`FINDINGS.md`](FINDINGS.md) 第二十七轮 |
| **★ 真机判据集（本轮新增 3 条"量"的判据 + 把两处固定 `sleep` 换成轮询）** | 模拟器 AVD `moobile64` → `node examples/apps/zhouyi-reader/device_check.mjs` | 10-23 夜 | **通过 32 / 失败 0 / 跳过 0**（30 → 32）。新增三条都是**量出来**的（自带约 50 行 PNG 解码器，**不装图像库**）：① **画布上真的有字** —— 数画布区域"独立墨色**连通块**"，标定 **无字 790 / 有字 2191 ⇒ 阈值 1500**；② **罗盘是正圆** —— 逐行取最外沿半宽 `h(y)`、最小二乘拟合 `h² = A + B·y + C·y²` 解横竖半轴，标定 **修前 a/b = 0.512（≈ k）/ 修后 1.000**（残差 RMS **0.3px**、779 行），**容差 3%**；③ **圆心居中** —— 拟合圆心与画布中心差 **14px**（容差 4% 边长），标定 修前**低 482px**。后两条是**第二次回头看那个椭圆**：那次是**用户用眼睛报的**，而当时 29 条真机判据**全绿** ⇒ 现在它变成了一条"**会自己抓住那个 bug**"的判据。另：折叠展开/收起与模式切换那两处**固定 `sleep(1500)`** 换成盯**目标状态**的轮询（`waitFor` / 新增 `waitForShot`）—— 旧写法在这台机器上读到的是**点击前的那一帧**（表现"慢一拍"：点展开读到"没变"、下一次检查却已是展开态），这正是那条"切回默认 ⇒ 画面复原"判据**时红时绿**的真因。⚠️ **仍未量**：真机字形与 web/桌面**不一致**（回退用 NotoSansCJK 黑体，源 CSS 想要楷体）—— ⚠️ **原先这里还写"叶子文字样式（`fontWeight` / `textAlign`）在真机上长什么样"，那一半已被第二十七轮补上**：`fontWeight` 真机量了笔画粗细（32 → **35 / 0**，两条都做过证伪）；**仍是零的是 `fontStyle` / `textAlign` / `textTransform` 三个键**（见本表上面那一行）。详见 [`FINDINGS.md`](FINDINGS.md) 第二十六轮 |
| **★ 两个"离线门看不见、跑起来才现形"的真 bug（本轮逮到并修掉；症状都是首屏白屏）** | 真机 `device_check.mjs` + `adb logcat`；`node tools/check_npm_fresh.mjs` | 10-23 夜 | ① **宿主包 `files` 白名单漏了 `canvas-font.js`** ⇒ `npm install`（`file:` 依赖）装出来的副本里**没有这个文件** ⇒ 应用 bundling 失败 ⇒ **首屏一片空白**（真机套件当场 5 / 7 全红）。★ **最要命的是那条门当时是绿的**：`check_npm_fresh` 用**同一张白名单**筛"源码侧"与"副本侧" ⇒ 漏掉的文件**在两边都被筛掉**了、"missing"自然是空的。**判据与被测物共用一张表 ⇒ 这张表自己的漏永远看不见**（与"计数闭合不是对账"同源）。修法：白名单补上 `canvas-font.js` + 给这条门加一条**白名单自洽**判据（**源码顶层的每个 `.js` 都必须出现在 `files` 里**）。⚠️ **我在新判据上又踩了一次**：第一版从 `srcFiles`（**已按白名单筛过**）里取顶层 `.js` ⇒ 漏的文件在 `srcFiles` 里也不存在 ⇒ **判据恒真、永远不会红**（证伪时当场抓到；注释里刚写过同一个坑、我立刻又踩了）；改用**未过滤**的 `listFiles(SRC)` 后证伪成立 —— 临时抽掉一条 ⇒ **exit 1** 并点名 `canvas-font.js`，还原后 exit 0。② **`export { … } from './x.js'` 不产生本地绑定** —— 把字体逻辑抽到 `canvas-font.js` 时我只写了转发导出，组件里却直接调 `subscribeFallback(...)` ⇒ 真机 `Render Error | Property 'subscribeFallback' doesn't exist` + 白屏；补一行 `import` 即好。⚠️ 这类错**离线门抓不到**（该文件要 `import React`，而判据跑在 node 里、没有 react）—— **只有真机 / 浏览器跑一遍才看得见**，是"判据要放在它能跑的那一层"的反面教材。★ 附带的更值钱教训：bug ② 是**重构引入**的，但重构后那次真机跑**是绿的** —— 因为那一次 bundle 是**重构之前**建的（**Metro 缓存**）⇒ **"改完跑一遍"没清缓存，验的是旧代码**（与 AGENTS.md 那条"改了宿主包要刷新副本、否则验证脚本悄悄测旧代码"是同一个坑的**第二形态**：那次副本旧、这次 bundle 旧）。本轮所有真机读数都是 `--clear` 重启 Metro **之后**的（bug ① 正是在清缓存后的第一次运行里暴露的），`DEV.md` 那条已补上实测代价 |
| 离线全集（**本轮重跑**） | `bash tools/verify_all.sh` | 10-23 晚 | **32 通过 / 0 失败 / 0 跳过**（27 → 32：新增四条门「按下态组装顺序（`press`，含证伪）」「样式源侧账本（每声明一个桶 + 零调用兜底，含证伪）」「样式键的平台矩阵（库 vs 原生 RN 登记表，含证伪）」「机器可读迁移事实（facts 与重算一致，含证伪）」「画布通道（canvas 试金石，35 项 —— 它一直都在，本轮才接进入口）」。第十八轮那唯一一条红——**故意留红**的 4 条证据判据——已全部转绿。⚠️ 同日**早先**那次是 **26 通过 / 1 失败**（那 1 条红就是故意留的；再早先第一次跑还是 **24 / 27** —— 多出的 2 条红是**我自己的错**：新文件写成了 CRLF ⇒ `行尾规范` 与 `vendor 一致性` 一起红，跑 `bash tools/lf_normalize.sh` 之后回绿） |
| **★ 第十八轮那三个洞：本轮已修** | `node tools/press_order_check.mjs` · `moon test --target js` · `node tools/regen_styles_check.mjs` | 10-23 晚 | ① `entries_to_styles` / ② `apply_key` 的 5 键白名单**整张删掉**，收口到 `@style.Style::from_entries`（不认识名字 ⇒ 结构上不会再漏）；③ `emitModule` 的组装顺序改成 **hover → `.press()` → 常态**。读数：白盒 **108 / 108**；新门 **10 / 10**（把旧形状灌回去做证伪 ⇒ **5 红**，读数正是"常态 `undefined` / 按下态拿到 `min_width`+`flex_grow`"）；应用产物**逐字未变**（105/105 一致 —— 因为 press 那条通道**默认关着**）。真应用上 `button_bagua_mode` 的常态从 2 条回到 **10 条**、`div_hex_card` 的 `min_width`/`flex_grow` **回到常态侧**。详见 [`FINDINGS.md`](FINDINGS.md) 第十九轮 |
| **★ 新逮到两条"本机绿、CI 红 / 本机自己就不跑"**（都在本轮修掉） | 模拟新鲜克隆跑 `regen_styles_check` · `netsh int ipv4 show excludedportrange protocol=tcp` | 10-23 晚 | ① `regen_styles_check`（未提交的新门）在**新鲜克隆上必红**——它要的源项目 `../yi/zhouyi_reader` 在**仓库外面**；改成"源不在本机 ⇒ **SKIP**（退出码 2 ⇒ `verify_all` 记 SKIP）"。② 这台机器上 **Windows 把 8664-9697 整段端口保留了**，而三个验界面的脚本把 CDP 端口钉在 9231 / 9244 / 9246 ⇒ **Chrome 一个都起不来**（症状像"界面坏了"）；改成"**绑一下**试试"（`tools/cdp_port.js`），webview 那条门随后 **15 / 15**（自动选到 9698）。另修掉一个陈旧常量（webview 那条门要求"99 条"而应用已 103 ⇒ 该门长期假红） |
| **★ 源侧账本 + "零调用兜底"（本轮新增一条门）** | `node tools/migrate_ledger_check.mjs` | 10-23 晚 | **21 / 21**（含两组真证伪）。真实应用：**规则 198 · 源声明 660 = 命中 360 + 根样式 8 + @media 19 + 后代 hover 5 + 同元素 hover（未接线）20 + 认不出 12 + 上下文损失 0 + 用不上 236**，Σ桶 = 660（差 0，且与门**自己数的那一遍**一致）；"算成已映射却零调用零说明" = **0**。★ 与第十八轮那次人工清点的交叉验证：**规则级理由 292 完全一致**（那次源声明数是 656，本轮 660 —— 口径不同，**没有逐条核对那 4 条**）。修掉三处"标志与事实打架"：① `letter-spacing: normal`（全库唯一的 `mapped([])`：零调用、零说明、却算"已映射"）→ 改成 `.letter_spacing(0.0)` + 一句说明；② 单段带标签选择器的 `lost` **不认标签**（`button.primary` + 源码 `div.primary` ⇒ 理由写着"没有落到任何元素上"而标志是 `lost:false` ⇒ 报告里**哪都不出现**）→ 修；③ 同元素 `:hover` 被写成"打在后代上"的理由（实测 20 条落到那条理由上）→ 两种 hover 分开写。**真证伪**：只把 `letter-spacing` 改回 `mapped([])` ⇒ **3 红**；只把 `lost` 公式改回旧的 ⇒ **2 红**。应用产物**逐字未变**（regen 105/105）。详见 [`FINDINGS.md`](FINDINGS.md) 第二十轮 |
| **★ 样式键 vs 原生 RN（"有没有对应物"；本轮新增一条门）** | `node tools/style_platform_check.mjs` | 10-23 晚 | **8 / 8**（含真证伪）。自己从 `style/style.mbt` 推出库的键集 = **77 个**（与第十八轮审计一致；⚠️ 只取一条来源会数出 52），与**装在本仓库里的三份真 RN**（0.83.10 / 0.86.3 / 0.87.1，各 146 键）相减 ⇒ **6 个键原生不认**：`whiteSpace` / `order` / 四个 `border*Style`（三版**全缺** ⇒ 不是"版本没跟上"）。**不是潜伏的**：`zhouyi-reader` 产物里**实际 11 处**（`border_*_style` 8 + `white_space` 3），而该应用 web 判据 **103/0 全过**。⚠️ **这条读数当天晚上就变小了**（第二十九轮：分边 style 自动折叠 ⇒ 现在剩 **1 处**分边 style —— 都在 `div_m_weny_box` 那一格、属于折不动的反例 —— 加 `white_space` 3 处；见本表最上面那行），**旧读数按规矩留着不删**。**"有没有对应物"逐个查过**：`border*Style` **半有**（原生有四边共用的 `borderStyle`；"有宽度的那些边 style 相同"时合成**等价** —— 本应用那几条都只有一边有宽度）、`whiteSpace` **部分有**（`nowrap` → `Text` 的 `numberOfLines(1)`（截断，语义不同）；`pre-line`/`pre-wrap` ≈ RN Text 的默认行为）、`order` **真没有**（Yoga 不支持 ⇒ 只能在 Model 里结构性表达）。另 2 个（`textDecorationStyle`/`textDecorationColor`）**只有 iOS** —— 单独一张表，不许与上面混。处置：修掉 `style/style.mbt` 那句假注释（"可移植且 RN 支持"）+ 给那 **8 个构造器**各加一句 ⚠️ + 生成器给这 8 个键**带 note**（**产物里 11 条说明**）。⚠️ 差点只做一半：note 挂在 `mapDeclaration`，而那 8 处走的是 `mapBorderShorthand`（**数产物条数**才发现）。**行为零变化**：重建后 `moobile.js` 的 sha256 仍是 `9e55868191f167dd`（新增的全是注释）。详见 [`FINDINGS.md`](FINDINGS.md) 第二十一轮 |
| **★ 机器可读迁移事实（`facts` 块 + 时间戳；本轮新增一条门）** | `node tools/migrate_facts_check.mjs` | 10-23 晚 | **5 / 5**（含真证伪）。起因：`migration.generated.json`（`create` 写的"机器可读形态"）**从来没人读**（只有 `regen_styles_check` 拿它的**存在**当标记），于是它漂得比 `MIGRATION.md` 还狠 —— `accounting 510=435+75`（实际 **439+71**）、`unmatchedLost 18`（实际 **0**）、`scan 18 类/357 处`（实际 **19/362**）。修法：加 `facts` 块（**当前事实** + `generatedAt`）并把**顶层那两组**明确标成"迁移当天的记录"；事实块的**形状**只有一份（`lib/migrate/facts.js` 的 `factBlock`，**写它的与验它的共用**），重算**配方**也共用 `create.js` 导出的 `walkSource`/`pickPackages`（不复制）。门：① 每份都要有事实块与时间戳（**CI 上也能跑**）② 逐字段与重算一致（要仓库外的源，没有就 SKIP）③④ 两组证伪 ⑤ 前提自查；`--sync` 重写并刷新时间戳。**真证伪**：往 JSON 注入两处漂移（`emitted −4` / `scan.hits +5`）⇒ 门报 `记的 435 / 实际 439`、`记的 367 / 实际 362` 并非零退出；`--sync` 修回后复跑转绿。同步后 JSON 的读数：**510 = 439 + 71 · unmatchedLost 0 · 19 类 / 362 处** |
| **★ 真机上的"八卦阵变椭圆"（用户报的；本轮定位并修掉）** | 截图 → 字符画/逐行最外沿 → 椭圆拟合（`.scratch/`）→ 真机复核 | 10-23 晚 | **修前：椭圆 a=489.5px b=955.2px，a/b = 0.512（= k = 369/720），圆心比盒子中心低 482px ⇒ 被下边缘裁掉**；**修后：正圆 R=489.5px，a/b = 1.000，圆心 = 盒子中心（956）**。真因：`canvas-ops.js` 把变换写成"两项合一"（`{translateX, translateY}` / `{scaleX, scaleY}`），而 **RN Skia 的 `processTransform3d` 只读每项的第一个键**（`Object.keys(val)[0]`）⇒ `scale(k,k)` 只缩 x（正圆→椭圆）、旋转那段的 `translate(cx,cy)` 只移 x（⇒ **内外圈对不上**，用户两个症状同一根因）。为什么三个门都没拦住：web 后端重放**原始 op** ✅、SVG 后端**两个键都读** ✅、CanvasKit 回放**两个键都读** ✅ —— **只有 Skia 那条经过 RN Skia 的变换处理**；而判据的期望值把**错形状**钉住了，且这条门**不在 `verify_all.sh` 里**。修法：拆成每项一个键 + 改期望值 + **新增两条判据**（"每项只许一个键"、"按 RN Skia 的规则重放 == 按 canvas 的规则重放"，带证伪）+ **把 canvas 试金石接进入口**。证据图：`docs/evidence/zhouyi-compass-before-fix.png` / `-after-fix.png`。详见 [`FINDINGS.md`](FINDINGS.md) 第二十三轮 |
| **★ 新鲜克隆预演（本轮实跑；"本机绿 ≠ CI 会绿"那条纪律）** | 临时目录 `git clone`（**只有 tracked 文件**）→ `vendor_sync --apply` → `examples/apps/todo-app/host npm install` → `bash tools/verify_all.sh` | 10-23 夜 | **通过 25 / 失败 0 / 跳过 6**。6 条 SKIP **全是资源缺失且如实 SKIP**（仓库外源项目 ×2：F1 对账、`regen --styles`；`node_modules` 未装 ×4：antd / SSE / chat-app / 画布试金石）。★ **本轮新加的四条门在新鲜克隆上全部 PASS**（按下态顺序是纯夹具；账本门跑夹具、真应用那半 SKIP；平台矩阵用到了 CI 也会装的 `todo-app/host` 里那份 RN；事实门跑"时间戳判据 + 证伪"）。⇒ **"本机 32/0/0"现在有新鲜克隆的读数撑着**（这正是上一个 commit 信息里那条纪律：推之前先预演，上一次它逮到过"本机绿、CI 红"）。⚠️ 本机有 vendor 缓存，所以 `vendor_sync --apply` 走的是缓存（没拉网络）——这一步与 CI 的网络路径不完全等价 |
| **★ 真机画布上的中文（第二十五轮已修 + 已量）** | 真机：`device_check.mjs`（30 项）；离线：画布试金石（41 项） | 10-23 夜 | **画出来了。** 破局读数：**族名要不到、文件读得到** —— `await SkiaApi.Data.fromURI('file:///system/fonts/NotoSansCJK-Regular.ttc')`（⚠️ 它返回 **Promise**；廿四轮那次"Expected Data but got different type"就是没 await）→ typeface 里「乾」= **字形 9647**。**零新依赖、APK 不增大**。修法：宿主新增 `canvas-font.js`（`fontCoversText` / `setFallbackTypeface` / `subscribeFallback` / `pickTextFont`）+ `canvas-skia.js` 转发并新增可选 `spec.skiaApi`；应用启动时异步读系统 CJK 字体并注册（**注册时通知画布重渲染** —— 少了这一句**首屏永远没有字**）。三条独立读数：① 应用日志 `画布回退字体已就绪…（「乾」= 字形 9647）`；② 宿主"画不出"警告 **0** 条（修前每屏都在报）；③ **像素**：画布区域"独立墨色连通块" **790 → 2191**（墨点 153005 → 158346），两张截图差异 16716 像素里 **86% 落在中带+标签带、圈外 0 个**（⇒ 无布局位移），放大字符画**能直接看到汉字笔画**。判据：离线 6 条（含"注册要通知重渲染"与证伪）+ **真机 1 条**（`★ 画布上真的有字`：连通块 ≥ **1500**，标定 无字 790 / 有字 2191）。证据图 `docs/evidence/zhouyi-compass-cjk-{before,after}.png`。⚠️ 仍未量：**真机字形与 web/桌面的差异**（回退用的是 NotoSansCJK，源 CSS 想要的是楷体）—— ⚠️ **这条与"字形画出来了"不矛盾**：那个第二十五轮已量（见本行前半），"两端字形**差多少**"至今**没有判据**（第二十五 / 二十七 / 二十八 / 三十轮都记着它，`examples/apps/canvas-spike/README.md` §5 也是这么写的）。详见 [`FINDINGS.md`](FINDINGS.md) 第二十五轮 |
| **★ 真机画布上的中文（用户报的第二个现象；本轮定位，⚠️ 当轮未修 —— 第二十五轮已修 + 已量，见本表上面那条）** | 三轮真机探针（读 `adb logcat`） | 10-23 晚 | **结论：不是"也没了"，是从来没画出来过。** 读数：宿主 `makeFont` 出来的字体（`Kaiti TC`）对「乾」的 `getGlyphIDs` → **0**（Skia 的 `.notdef`）；设备 **33 个字体族里能画中文的 = 0**（`serif`/`sans-serif`/`Noto Sans CJK SC`/`System` 全 0），而**对照拉丁 `A` = 38** ⇒ 探针本身没问题；`FontMgr.matchFamilyStyle('Noto Sans CJK SC' …)` 也是 0（该族名没注册）。真因：**Android 的中文字形只走系统字体回退链**（`fonts.xml` 里 `lang="zh-Hans"` 那一族，文件确实在：`NotoSansCJK-Regular.ttc`），而 **RN Skia 的 `<Text font=>` 用单个 `SkFont`、不做回退**（`FontMgr` 只暴露 `matchFamilyStyle`，没有按字符找字体的 API）⇒ 真机上画布里的中文**一条都画不出来**，而 web（DOM `fillText`，浏览器自己回退）与桌面（SVG）都正常 —— **又一个"web 绿、真机红"**。本轮**只做了"让它响"**：宿主加 `fontCoversText` + 每个字体族一次 `console.warn` + 计数 `unrenderableTextCount()`；并把应用里那句假注释（"中文通常落到 Noto Sans CJK"）改成实测读数。**正解没做**（① 改用 `Skia.ParagraphBuilder`（SkParagraph 走回退，包里确有 `<Paragraph>` 组件）；② 由应用加载真含中文字形的 typeface）。**也还没有任何判据**在量"画布上真的画出了字"。—— ⚠️ **上面这两句（"正解没做"与"没有任何判据"）原先都是当轮的读数**：**第二十五轮走的就是路②**（应用把系统 CJK typeface 读进来注册）并补了真机判据「画布上真的有字」（像素：独立墨色连通块 **790 → 2191**、阈值 1500），证据图 `docs/evidence/zhouyi-compass-cjk-{before,after}.png`。详见 [`FINDINGS.md`](FINDINGS.md) 第二十四轮与第二十五轮 |
| **★ 真机复核（第一次；本轮实跑）** | 模拟器 AVD `moobile64` → `node examples/apps/zhouyi-reader/device_check.mjs` | 10-23 晚 | ⚠️ **本条已被上面那条取代：修完画布 + 清 Metro 缓存重启之后是 29 / 29**。当时（修画布之前）读数是 **真机 24 / 29**（⚠️ 文档记的上一次是 **29/29**，10-02 —— 见下面那条"已过期"说明）。红 5 条：`切回「后天文王 · 卦气」→ 画面复原`（切回后指纹 == 京房八宫那张）、折叠族 4 条（`箭头变 ▾` / `展开后正文在视口里` / `收起后箭头合上` / `再点收起正文消失`）。★ **先做了 A/B 排除"是不是本轮改坏的"**：第十九轮把 4 个文字键送进叶子文字、**会改原生排版**，所以完全可能是我弄出来的 —— 于是临时把 `is_text_key` 缩回改动前的 5 个键重建（产物 sha `0de1649b00054400`）再跑一遍：**同样 24 / 5、逐条同名**（带改动的产物 sha 是 `9e55868191f167dd`）⇒ **与本次改动无关**（验完已改回来并重建，sha 回到 `9e55868191f167dd`）。那 5 条的形状是"**慢一拍**"：`点标题展开=▾ 节点 0`，而紧接着 `收起后箭头合上` 读到 `▾ 节点 1`（已经是展开态）—— 夹具在那两处用的是固定 `sleep(1500)`（本仓库早就记过"固定 sleep 读到的是点击前的内容"）。**本轮只读出形状，没修** |
| **真应用（web，换宿主静态宿主）** | `node examples/apps/zhouyi-reader-webview/verify.mjs` | 10-23 夜 | **15 / 15**，其中"应用自己那 **107** 条判据" **107 / 0**（本轮重跑；那个 `EXPECT_APP_ASSERTIONS` 常量已跟着 103 → **107**）。产物 sha256 `9e55868191f167dd…` 与磁盘逐字节一致；`moon.work` 把该应用连到**本地库源码** ⇒ 这 107 条吃到了本轮 `render.mbt` 的改动。⚠️ **"文字样式"这一格现在两端都有判据了**（本条 row 的旧说法"真机上那 4 个键的效果仍未量"已被廿七/廿八轮取代）：web 侧 4 条（读**计算样式**：爻题 700 / 16.5px / `rgb(138,37,24)`，爻辞 400）+ 真机侧 3 条（量**像素里的笔画粗细**）。⚠️ 但两侧**不等价**：`getComputedStyle` 给的是**继承之后**的值（祖先写了粗，叶子丢了键也照样绿）⇒ 只守得住"产物里这个键在、值对"，守不住"画出来粗不粗" —— 那由真机那条守 |
| **★ "静默丢键"审计（新增 4 条判据；洞当日已修 —— 见上面那条「第十八轮那三个洞：本轮已修」）** | `moon test -p XiLaiTL/moobile` | 10-23 | **11 条：7 通过 / 4 失败**（4 条红是**故意的**，它们就是证据）。三个已证明的洞：① `entries_to_styles`（`render.mbt:382`）按名字只还原 5 个键，而 `is_text_key`（`:339`）认 **9** 个 ⇒ `fontWeight` / `fontStyle` / `textAlign` / `textTransform` 被静默丢掉（真实应用里 **20 处**）；② `apply_key`（`:366`）是**同一张白名单的副本** ⇒ 只修 ① 会"看起来修好了、其实没生效"；③ press 链组装顺序反了（`style-emit.js:532-548`）⇒ **常态与按下态整体互换**（真实应用 10 个函数中招；`div_hex_card` 的 `min_width` 再次变成"只在按住时生效"）。另：`press:` / `pressStyle` 在**全仓库零判据**。**三处当日修掉，本条读数已过期**（修后：白盒 108/108、新门 10/10）—— 复现命令、查法与另两条只读审计的读数见 [`FINDINGS.md`](FINDINGS.md) 第十八轮，修法与验证面见第十九轮 |
| 离线全集 | `bash tools/verify_all.sh` | 10-02 | **24 / 24 通过、0 失败、0 跳过**（门数长过三次：第 21 条 = **F1 迁移动检两份实现逐 finding 逐 hit 对账**；第 23 条 = **生成物自查：根样式 `page()` 与根上的滚动容器**；第 24 条 = **F1 新规则 `click.on-view`（诱饵 + 两侧对账）**。⚠️ 门**内容**也会长：原来的"桌面宿主生成器"这一轮变成**宿主矩阵生成器**（20 → 32 项，见下）。这一格**只记最近一次**；同一天早些时候的 20/20、21/21、23/23 都是真的，别当成矛盾 |
| ↳ 其中「F1 迁移动检对账」（**新增**） | `node tools/migrate_scan_reconcile.mjs` | 10-02 | 通过：**19 类 / 362 条命中**（10-02 晚新增第 15 类 `click.on-view` 5 条 —— 见下一行），JS 版与 MoonBit 版**逐 finding 逐 hit** 一致（`interest/yi/zhouyi_reader`，6 文件 / 3139 行）。**已证伪**：改一个 needle、只改 `excerpt` 截断长度、删掉整条规则 —— 三种都能让它非零退出 |
| ↳ **F1 新规则 `click.on-view`**（`on_click` 挂在不会响的标签上，**新增**） | `node tools/migrate_click_scan.mjs` | 10-02 | **13 / 13**（进 `verify_all.sh` → **24 项**）：★ **诱饵项目**把期望值写死 —— `div` / 跨行的 `@html.div(` / `div (` / `span` / **注释里那行**都命中，`button` / `a` / `on_clicked` **一条都不报**（负例），`.mbt.bak` 不算；★ 两侧实现（JS 的 `click-on-view.js` 与 MoonBit 真源）逐 hit（`file:line` + `text`）一致；★ 真项目读数 **5 处**（`frontend/main.mbt:484/1269/1372/1400/1463`）—— 与**当年手工数出的 5 处**一致。**已证伪两个方向**：只改 JS（把 `span` 当会响的）→ 9/13；只改 MoonBit → 11/13 |
| **迁移过来的真实应用（`examples/apps/zhouyi-reader/`）** | Metro（`npx expo start --web --port 8081`）→ `node examples/apps/zhouyi-reader/verify.mjs` | 10-02 晚（十轮） | ⚠️ **本条读数已过期**（同一套判据后来长到 **103** 条，最近的读数见本表上面那条「真应用（web，换宿主静态宿主）」）。当时 **真 Chrome 99 / 99**（45 → 81 → 83：十轮补**详情页五个折叠族 + 三个状态族**；**十一轮补响应式** 2 条、**十二轮补罗盘面板控件 16 条**（四模式 / 立竿测影 / 两两不同 / 可逆） —— 首屏画布边长 = min(94vw,720)（修前一直是回落值 **360**）、窗口收窄到 400px 时跟着变 376）。★ 补判据的过程**逮到三个真缺陷**并修掉：① **爻线根本不存在**（动态 `class=` 静默失效 + RN 默认 column）⇒ 变爻点不到；② **侧栏 sticky 退化成 `relative; top:70`** ⇒ 压住下一栏 70px，**大象点不开**；③ **两栏布局的 grid 丢失** ⇒ 改成"row + wrap + min-width"**结构性表达那个 760px 断点**。判据同时抓到**四处判据自己的错**（○/× 本来就在提示文案里、RNW 不落 `title`、按祖先找元素找错了、变卦期望值算错）。原始读数（同一轮的早期版本）：**真 Chrome 45 / 45**：首屏（页头/副题/页脚印章）、数据装载（应用日志 `658049 字符`）、**罗盘画出像素（非透明 518400）+ 拖拽后画面变化 + 轻点外环进卦（落到「萃」）**、搜索「乾」→ 过滤网格、点卦卡 → 详情页（真爻辞「乾，元，亨，利，贞。」）、样式落地（纸色底 / 边框 / 字距 / 衬线体）、**底部三块折叠（21 条：常显 + 默认折叠 + 点开出现正文的具体句子 + 箭头 ▸→▾ + 再点收起）**、无 console 错误。**已证伪**：把 `more_section` 的 `if open` 改成 `if true`（永远展开）→ **39 / 45**，红的正好是那 6 条折叠断言。⚠️ 罗盘**只在 web 上验过**（原生走 Skia、桌面走 `react-native-svg`，两条另有判据） |
| ↳ 同一条链上的编译与生成量 | `moon check --target js`（工作区含生成物）；`create --from-rabbita` 的产物 | 10-02 | 生成物 **0 错误**；样式层 **104 个函数**、声明对账 **510 = 已映射 435 + 有损 75**；报告 **21 项 TODO**（3 保底桩 + 13 整块注释 + 5 `on_click`-on-view） |
| **画布通道的 Web 后端（新增 `npm/moobile-host/canvas-web.js`）** | `node examples/apps/zhouyi-reader/verify.mjs`（真 Chrome，罗盘那三条断言） | 10-02 | 通过：18 条 draw-op → DOM 2D 重放，零依赖；应用侧不再需要自己写 `prepare_canvas`（高分屏收进后端）。**起因**：组件通道在 Web 上原本**没有后端**，`moobile:Canvas` 会 fail-fast，而 React 会把整页卸掉（现场是 root 空 + 控制台无 error） |
| **Android（模拟器）· 迁移过来的应用** | 起模拟器 → Metro 在 8081（同一条命令服务原生与 web）→ `node examples/apps/zhouyi-reader/device_check.mjs` | 10-02 晚（十轮） | ⚠️ **本条读数已过期**（2026-10-23 复跑是 **24 / 29**，红的 5 条与 A/B 证据见本表上面那条「真机复核」）。当时的 **真机 29 / 29**（⚠️ 条数 27 → 26：删掉一条**阈值型**判据（"折叠时标题下的长文本 ≤2 条"，真机实测是 3 条——另外两个折叠标题 + 页脚也算），换成"**展开后才出现的那句正文**在展开时在、收起时不在"，判据少一条、硬一档）；十二轮 +3 条**模式切换**（点「京房八宫」→ 截屏指纹变、切回默认 → **指纹复原**）。上一轮读数 **真机 27 / 27**（含「同一点、转过之后命中另一卦」—— 它逼出了并修掉了库侧 `gesture-rn.js` 的一处真 bug：`start` 与 `move` 用了两个参照系；以及本轮新增的 **9 条折叠断言** —— 判据是"边滚边收长文本集合、再做差集"：展开比折叠态多 **14** 条、收起后多 **0** 条）。★ **这一轮它逮到两个 web 判据永远看不见的洞**（根上没滚动容器 → 滚 30 次界面纹丝不动；`page()` 没人挂），已修为两层根容器并把判据写进库（见下一行）。⚠️ 验不到：输入中文 → 点卦卡（adb 打不出中文），那条由 web 判据覆盖 |
| ↳ **生成物自查**（新增，库侧判据 + 离线门） | `node tools/migrate_app_audit.mjs`；`moobile-host create --from-rabbita …` 落盘后自动跑 | 10-02 | **13 / 13**（进 `verify_all.sh` → **23 项**）：4 个真实应用**必须干净**、2 个**已记录**的例外逐条点名（`perf-bench` 压测 harness / `antd-demo` web 画廊）、**5 个故意做坏的样本必须逐条点名**（含两个诱饵：注释里的假代码、组件属性名也叫 `scroll`）。拿仓库外的真源跑 `create`：当场报 **2 条必须处理**（`page-style-unused` + `no-native-scroll`），并写进生成物的 `MIGRATION.md §5` |
| ↳ 它的 APK（含 **Skia 的 C++**） | `cd examples/apps/zhouyi-reader/android && ./gradlew assembleDebug` | 10-02 | `BUILD SUCCESSFUL in 7m 23s`（240 tasks）；76 MB debug 包；装到 emulator-5554 并启动成功。**画布文字走 `makeFont` 那条路第一次上真机**（库里原来记着未验），截图逐点取色见 `docs/evidence/zhouyi-android-compass.png` |
| **画布通道第三条后端（新增 `npm/moobile-host/canvas-svg.js`）** | 真 Chrome + `EXPO_PUBLIC_CANVAS=svg` → `node examples/apps/zhouyi-reader/verify.mjs` | 10-02 | **24 / 24**（罗盘 758 个矢量元素 / 拖拽重绘 / 轻点外环进卦）。**它的意义是桌面**：`react-native-svg` 的 tarball 里有 153 个 windows 文件，是 RNW 上唯一现成的矢量通道 —— 而它同时支持 web，所以**桌面那条画布路径在本机就验掉了**（不必等 VS 工具链）。默认 web 后端仍是 DOM 2D，同一份判据也 **24 / 24** |
| **桌面宿主生成器（`--host rnw`）**（⚠️ 10-02 晚这个文件**改名成 `tools/host_probe.mjs`** 并扩成三宿主矩阵 —— 见下面第 55 行那一格；这一格是当时那一版的读数，留着不改成"历史被重写"的样子） | `node tools/desktop_host_probe.mjs` | 10-02 | **20 / 20**（离线，进 `verify_all.sh`）：★ 两个宿主生成物的 `moon.mod`/`moon.pkg`/`app.mbt` **逐字节相同**（「换宿主不改应用」的硬判据）＋ 宿主文件确实换了（expo ↔ rnw 的依赖 / 入口 / metro 配置）＋ 错参数当场红 |
| **桌面宿主（新增 `examples/apps/zhouyi-reader-desktop/`）** | `node examples/apps/zhouyi-reader-desktop/verify.mjs` | 10-02 | **5 / 5**：`react-native bundle --platform windows` 退出码 0（34.6 s）→ 产物 **8.80 MB**，里面既有**这个应用的真串**（比对串是**从应用源码与产物里同时取**的，不是写死的），也有宿主接线（`mountApp` + `registerSvgCanvas`）。⇒ “同一份 MoonBit 产物进第三个宿主”**从论断变成了判据**。⚠️ 这**不是**“桌面窗口能起来”：那要 VS 2026 + SDK 22621（本机没有）|
| **宿主矩阵生成器**（原「桌面宿主生成器」，**改名+扩容**） | `node tools/host_probe.mjs` | 10-02 | **32 / 32**（离线，进 `verify_all.sh`）：★ **三个**宿主（expo / rnw / **webview**）生成物的 `moon.mod`/`moon.pkg`/`app.mbt` **逐字节相同**（「换宿主不改应用」的硬判据，三个宿主 = 三份证据）＋ 各宿主的定义面确实换了（expo↔rnw 的依赖/入口/metro；webview 的依赖表无 expo/RN、入口不 import expo、`build-web.mjs` 那行 `alias`、模板专属文件被 `drop` 掉）＋ 错参数当场红。**已证伪**：删掉 `drop` → **31 / 32** |
| **静态 Web 宿主（新增 `examples/apps/zhouyi-reader-webview/`）** | `node examples/apps/zhouyi-reader-webview/verify.mjs` | 10-02 | **15 / 15**：esbuild 输入清单里 **0 个 expo / Metro 包**、产物是静态站点、服务端指纹 = 磁盘 `moobile.js` 的 sha256；★ 第 3 层是**把应用自己那 45 条界面判据原样指向这个静态宿主的 URL** → **45 / 0**。⇒ “同一份 MoonBit 产物 + 同一套界面判据，换宿主管用”**从论断变成判据**。⚠️ 不覆盖 PWA/Tauri/Electron 外壳本身。★ 另外拿**模板生成**的工程端到端再撞了一次（`init --host webview` → `build-web.mjs` → `serve-web.mjs` → 同那 45 条判据）：**45 / 0** ⇒ "模板生成物能承载真应用"也是判据（细节见 FINDINGS 九续第七节） |
| **桌面端（Electron）· 新增 `examples/apps/zhouyi-reader-electron/`** | `node examples/apps/zhouyi-reader-electron/verify.mjs`（要 `npm install` 装 Electron） | 10-02 晚（十三轮） | **17 / 17** —— ★ 起**真窗口**、把**应用自己那 97 条界面判据原样打在这个窗口上**（`PROBE_CDP_URL` 附着模式，应用那份脚本不自己起浏览器、也不导航）、再加两个**真窗口**（1280 / 420）比画布边长（跟随窗口宽度、**不是回落值 360**）。⇒ 目标里"桌面端**实测**"这一格**第一次真的有判据**（`--host rnw` 那条仍要 VS 2026 + SDK 22621）。⚠️ 打包安装包 / 自动更新 / 原生菜单**没做**；这条路线**还没进脚手架**（下一步做成 `--host electron`）。踩到的五个宿主坑见 FINDINGS 十三续 |
| **桌面端（RNW）可行性** | `.scratch/rnw-probe/` 的 17 份日志；`npx react-native bundle --platform windows` | 10-02 | **JS 侧通过**（退出码 0，裸 RN + 仓库源码版 `moobile-host` + **同一份** `moobile.js`）；**原生侧卡在 VS 版本闸门**：`NoMSBuild: … Visual Studio 18.6.0 or later`（RNW 0.83.2 要 **VS 2026**，不是文档写的 2022），绕过闸门后是 `MSB8036: 找不到 Windows SDK 版本 10.0.22621.0`。另：**Skia 无 Windows 后端**（`npm pack` 后 `package/windows/` 0 文件）⇒ 桌面罗盘要改 `react-native-svg` |（`--with-e2e` 再追加 Web 端到端 3 项，本轮未跑）。10-02 新增两条门：**组件库生成器（`libgen` 假包探针，24 项）** 与 **chat-app 的生成物一致性（`libgen --check`）** |
| ↳ 同一条命令，换成 **CI 那一代的工具链**（`0.1.20260920 (914d7da)`） | 先 `moon build --target js`，再 `MOON_HOME=.scratch/moonlatest` + 该工具链的 `bin` 进 PATH，跑 `bash tools/verify_all.sh` | 10-01 | **16 / 16 通过、0 失败、0 跳过** —— 「本机绿 ≠ CI 会绿」里**工具链漂移**那一半，第一次在本机被验掉（做法见 §4-8 与 FINDINGS 的 CI 收口补记） |
| ↳ 换回工作区钉的 `0.1.20260827 (d0aaa07)` | 同上 | 10-01 | **16 / 16 通过、0 失败、0 跳过** —— 新旧**两代都绿**，这是「改法是安全的」的判据 |
| ↳ 其中「lockfile 的 resolved URL 与包名一致」（**新增**） | `node tools/check_lockfile_urls.mjs` | 10-01 | 通过（8 份 lockfile、2088 个 `resolved` URL）。**立它的原因**：镜像源把两条 URL 写成了 404 的畸形路径（`expo-server` / `@expo/router-server`），而**任何新鲜克隆的 `npm install` 都会挂在它们上面**（本机因 node_modules 已存在而看不出来）。**已用诱饵证伪**：塞回一条坏 URL → 点名 + exit 1 |
| ↳ 其中「宿主平台替代物」 | `node tools/native_rn_check.mjs` | 10-02 晚（十一轮） | **19 项**通过（原 15 项；新增 4 条盯 `geometry.read()`：存在 / 取整 / **读的是当前值** / 两个形状都在）。起因：`@sub.on_resize` **只推变化、不补发初始值**，而应用需要"**现在多大**"（罗盘边长按窗口宽度算）⇒ 库侧补了 `HostCapability::read_json` + `@sub.current_viewport()` |
| ↳ 其中「能力包平台矩阵」 | `node tools/cap_platform.mjs` | 10-02 晚（十一轮） | 通过（**30 个公开 API** × 31 条 DOM 链路，「哪端可用 + 失效形态」齐全，漂了就红） |
| ↳ 其中「组件库接入（antd 试金石）」 | （在离线全集里） | 10-01 | **26 项**通过 —— ⚠️ 这一条**原来是个假通过**：负例 (b)「不给事件覆盖时点 antd 按钮应当无效」之所以绿，是因为 `installHostCore` 把事件表**合并**进全局 `MOBILE_HOST`（为修"重复 install 会冲掉注册"），前面用例装的 `"*": {click:"onClick"}` 一直留着；而它被**一份陈旧的 `moobile-host` 副本**（整体替换语义，天然干净）掩盖了很久。补了 `installHostCore({reset:true})` 之后它才名副其实（并终于能看到 React 那句 `Unknown event handler property onPress`）。见 FINDINGS「陈旧副本掩盖了一条门的假通过」 |
| ↳ 其中「脚手架模板」 | `node tools/template_check.mjs` | 09-21 | **14 / 14** |
| ↳ 其中「脚手架承载真应用」 | `node tools/scaffold_probe.mjs` | 09-21 | **7 / 7**（探针剧本另 22 项） |
| ↳ 其中「**模板同源 T1**」 | `node tools/template_compare.mjs` | 09-21 | **15 / 15**（清单 26 条，死条目 0）—— 装上当天做过证伪 8/8 |
| ↳ 其中「无头界面验证」 | `node tools/verify_headless.mjs` | 09-21 | **10 通过 / 0 失败 + 1 SKIP**（订阅通道要 `--slow`） |
| **C0 换宿主**（新增） | `node examples/apps/host-swap-spike/verify.mjs`（要 Chrome + `npm install`） | 09-21 | **27 / 27**：同一份 `moobile.js` 在**零 Expo、零 Metro** 的裸 RN(Web) 宿主下渲染 + 四条交互都回到 `update`（`--with-e2e` 那一组里也会跑；缺 Chrome / 没装依赖记 SKIP，**不是** PASS） |
| **打包形态**（新增） | `node tools/package_check.mjs` | 09-21 | **10 / 10**：真打 tarball → 真 `npm install` → 用**装好的 CLI** `init`，断言用户拿到 `.gitignore`（就是这条抓出了 npm 解包改名那个 bug）。**发布前必跑**（`publish.sh` 调它），不进离线全集 |
| **canvas 通道**（新增） | `cd examples/apps/canvas-spike/host && node verify.mjs`（要 `npm install`，只有 `canvaskit-wasm`；含 `moon build`） | 09-21 | **32 / 32**：库包 `canvas/` 的 18 条指令 → JSON 载荷 → 宿主包的解码器/翻译器 → **真 Skia**（CanvasKit）出图。含**跨语言对账**：MoonBit 编出来的载荷与 JS 镜像程序**逐字节相同**、两份载荷各自出图**像素逐点相同（0/40000）**；罗盘 **384 个采样点**颜色逐一等于卦爻数据；另有 3 个证伪诱饵。⚠️ **只到"绘制语义 + 载荷契约"这一层**：~~真机上的 `<Canvas>` 组件挂载与文字字形**未验**~~ ⇒ **都已验**（**原先这半句写"未验"**）：组件挂载 10-01 真机验过（`canvas-spike/host/device_check.mjs` 7/7，见本表）、文字字形 10-23 第二十五轮真机量到（`docs/evidence/zhouyi-compass-cjk-after.png`）；边界写在它的 `README.md` §5。⚠️ **原先那句"不进离线全集（要 wasm 运行时），同 `host-swap-spike`"也过期了**：第二十三轮起它**已接进 `verify_all.sh`**（见本表「分边边框样式自动折叠」那一行与本表末尾汇总）。 |
| **手势试金石** | `cd examples/apps/gesture-spike/host && node verify.mjs`（要 Chrome + `npm install`） | 10-01 | **40 / 40**：§1-4 是三盒对照（RNGH 默认 / `minDistance(0)` / `PanResponder` —— 都挂载成功、都给元素内坐标、位置都精确跟手 40px；RNGH 默认 `translationX` **落后 20px**，`minDistance(0)` 后归位）；**§5 是边界 20 项**：嵌套归属（子赢父 0）、深层子元素的参照系、多指 `pointers=2` 且 `dx` 锁第一指、滚动容器、同挂、无处理器（带正对照）、相位状态机。⚠️ **只测 web 宿主**；多指的真机行为、JS 线程忙时的手感仍未测（README §6/§7） |
| **gesture-edges · 真机**（新增） | `cd examples/apps/gesture-edges && node device_check.mjs`（要模拟器 + Metro + 已装 APK） | 10-01 | **18 / 18**：验 web 上**压根问不出来**的四条 —— ① 嵌套归属（`外 n=0`，`序外` 为空）② **`x/y` 相对挂手势的元素**（`深 起=130,50`、`末=170,50`，`深xs=[130,131,…,169]` 单一参照系；修前是 `[6,7,79,…]`）③ `on_pan` 的块吞掉外层滚动（`拖A c=0`、哨兵不出现）④ 只挂 `on_tap` 的块**让**滚动（`底B 见` 出现、`点B n=0`，带"无手势块滑得动"的正对照）。⚠️ 这条**逼出三处实现错误**（投机 grant / 原生 `locationX` 参照系 / `onShouldBlockNativeResponder`），见 FINDINGS 与它的 README §4 |
| **canvas-demo · 真机** | `cd examples/apps/canvas-demo && node device_check.mjs`（要模拟器 + Metro + 已装 APK） | 10-01 | **12 / 12**：`画布 ops=13` · 品红 3798px / 绿 324px / 蓝 424px · **横滑 80px → `dx=80 dy=0 n=9`** · 蓝指针质心移动 **74.5px**（手势→Model→画布整条链）· 点按 0→1 · 证伪屏 token 全不变。⚠️ 过程中发现两个**对使用者都成立**的坑：原生依赖版本必须用 `npx expo install --check` 认的那套、这个组合下**必须**有 `babel.config.js`（Expo 文档说不用）—— 见 FINDINGS |
| **画布通道 · 真机**（新增） | `cd examples/apps/canvas-spike/host && node device_check.mjs`（要模拟器 + Metro + **临时接线的 APK**，见 FINDINGS） | 10-01 | **7 / 7**：`画布 ops=9` token + 截图里**品红 4016 px / 绿 1600 px**（真 Skia 画到 Android 屏上）+ 切到无画布那屏 **0 / 0**（证伪）+ 无 JS 致命错误。**过程中抓到我们自己的两个真 bug**：`installHost` 号称幂等其实会冲掉已注册组件、`registerLibrary` 的 `components` 只认数组（详见 FINDINGS） |
| **SSE 流式通道（试金石，web/node）**（新增） | `node examples/apps/sse-spike/verify.mjs`（无头，自己起本地 SSE 服务；已接成 `verify_all.sh` 第 17 条门） | 10-01 | **12 / 12**：边收边长（第 1 帧到、第 3 帧还没到）· 顺序 · **一帧被切成两半要拼回一条** · **两帧挤在一次读取里要拆成两条** · `[DONE]`→完成 · HTTP 500→失败 · 非 SSE 响应一行不出（负例）· **abort 后一条都不再出现** |
| **SSE 流式通道（真机）**（新增） | `node examples/apps/sse-spike/device_check.mjs`（要模拟器 + Metro 服务本工程；自己起 SSE 服务并 `adb reverse`） | 10-01 | **14 / 14** —— ⚠️ **这条验的是另一份代码**：RN 的 `fetch` 没有 `response.body`，走的是 **XHR 渐进读**。边收边长 ✅ · 顺序 ✅ · `[DONE]` ✅ · 中途「停止」后**服务端继续推、界面一条不涨** ✅ |
| **F1 迁移动检**（新增） | `bash tools/mb.sh migrate-scan --root ../yi/zhouyi_reader`（要 moon；被扫项目在仓库外） | 09-21 | 候选 **6 文件 / 3139 行**；**15 类命中数与人工清点逐项一致**（见 FINDINGS 的 F1 补记）。顺手照出**我们自己的错**：标签表文档写 42、真源是 **44**（已修 5 处 + 归档 1 处）。⚠️ 边界：判据是"对这 15 类、在这一个项目上零遗漏"，新失效形态要加规则 |
| ↳ **同一项目重跑**（10-01） | 同上 | 10-01 | 候选 **6 文件 / 3139 行**、**44 映射 / 12 排除** —— 与 09-21 **逐项不变**（只改了报告里的话，没动判据）。**顺手修掉报告里三处过期的"下一步"**：`gesture.mouse` 说"手势通道尚未实现"、`canvas.api` 说"真机未验、手势未做"、`gesture.coord` 把量原点算在未做里 —— 都已被 10-01 的落地推翻，见 FINDINGS 的 F1 坑四 |
| ↳ 其中库包本身 | `moon test canvas` | 09-21 | **7 / 7**：载荷 JSON 逐字（18 条 op）、数字格式三条契约、字符串转义、`OpCtx` 18 个方法、`arc` 默认方向、节点接线（标签 + `ops`/`width`/`height` prop 落在 VNode 上） |
| ↳ 其中宿主包翻译器 | `moon test canvas` + canvas-spike 的形状组 | 09-21 | 指令→元素树逐条（整圆拆两段、无当前点时补 `M`、有当前点时补 `L`、`fill`/`stroke` 同路径两条、负例不许静默） |
| antd demo（生成物 + 交互 24 条） | `cd examples/apps/antd-demo/host && npm run check` | 09-21 | **24 / 24**；`--check` 一致 |
| **S1 本地代理**（新增） | 见 [`FINDINGS.md`](FINDINGS.md) 的 09-21 补记（`s1-local-run/probe-web.mjs` 是**仓库外**的一次性脚本） | 09-21 | 两段各 **9 / 9**：① 从**仓库布局**生成 → `npm install` → `npm run build` → `npm run web` → 真 Chrome；② 从**打包形态**（`npm pack` → `npm install <tarball>` → 用装好的 CLI `init`）同上。**发版仍是解锁"干净机器"的最后一步** |
| 组件库生成器读数 | `npx moobile-host libgen` | 09-20 | **71 个组件 / 65 个复合子组件 / 注册 136 个键 / 9317 个 prop（其中 4965 个进 DSL）**，抽取 ~0.6s；生成的 `components.generated.mbt` **12062 行**（`moon check` 0 错误） |
| 已发布包内容（npm） | `npm view moobile-host version` + 拉 tarball 列清单 | 09-20 | `0.2.0`，**无 `lib/`、无 `core.js`**（见 §1） |
| 已发布包内容（mooncakes） | mooncakes API 查 `XiLaiTL/moobile` | 09-20 | `0.2.2` |
| **已发布包到底缺什么**（10-01 复核） | `bash tools/check_published.sh XiLaiTL/moobile@0.2.2`（改成了**逐个查公开包**） | 10-01 | 9 个公开包里 **`✗ canvas`、`✗ gesture`**，其余 7 个（`cmd html http sqlite style sub vendor/rabbita`）都在 —— **独立复现了"发布用户拿不到画布与手势"这句话** |
| 打包形态门（发布前） | `node tools/package_check.mjs`（由 `publish.sh --dry-run` 调起） | 10-01 | **10 / 10**：装成功 / 模板随包在 / 用**装好的 CLI** `init` 跑通 / 生成物**有** `.gitignore` / 没有漏出来的 `.npmignore` / 11 个文件逐一对得上 |
| npm 发布前空跑 | `bash npm/moobile-host/publish.sh --dry-run` | 10-01 | **通过 10 / 失败 0**，版本读出来是 `moobile-host@0.3.0`；泄漏自检 ✓ —— **没有发布** |
| 月亮包发布前空跑 | `moon publish --dry-run` | 10-01 | `Check passed`；服务端 **202 Accepted**：`Dry run completed successfully. No changes were made. The dry-run was made for package XiLaiTL/moobile version 0.3.0.` ⚠️ 命令**最后仍打 `Error: moon publish failed`** —— 那是 dry-run 的正常收尾，别当成失败 |
| 发布包里有哪些包 | `moon package --list` | 10-01 | 303 个文件；**`canvas/` 与 `gesture/` 各 3 个文件都在**，9 个公开包齐全（所以抬版本之后一发布就补上了 0.2.2 缺的那两块） |
| **已发布 · 月亮包 0.3.0** | `bash tools/check_published.sh`（默认就跟 `moon.mod` 的版本走） | 10-01 | **通过**：9 个公开包 `✓ canvas ✓ cmd ✓ gesture ✓ html ✓ http ✓ sqlite ✓ style ✓ sub ✓ vendor/rabbita`；README 的 5 条 import 路径对着**线上这一版**编过；外部模块装得下来也编得过 |
| **已发布 · 宿主包 0.3.0** | `npm pack moobile-host@0.3.0 --registry=https://registry.npmjs.org/` + 解包查 | 10-01 | 线上 tarball **35 个文件**；`lib/init.js` `lib/build.js` `bin/libgen.js` `template/moon.mod` `template/.gitignore` 全在；`core.js` 里 **`export const CONTRACT = 2`**（与月亮包 `host_contract_version` 同代） |
| **真实应用（chat-app，无头）**（新增） | `node examples/apps/chat-app/verify.mjs`（自带假 OpenAI 服务 + 假 `MOBILE_HOST.db`；已接成 `verify_all.sh` 的门） | 10-02 | **22 / 22**：没有 key→设置页 · 保存→回聊 · 发送→**逐字长**（此刻 4 字而非一次 8 字）· 请求对（`Authorization` / `stream:true` / **不发空的助手占位**）· **重启历史还在** · 停止后服务端还在推而界面不涨 · 401 显示在界面上 · **200 的流里的错误帧**也算错 · 非 SSE 的 200（负例）· 清空（界面+库）。10-02 新增第 22 条：**★ markdown 组件收到的是原始字符串**（读 `md:Markdown` 元素的 `props.children` **类型**；"渲染成什么样"只有真机/浏览器验得到） |
| **组件库生成器（`libgen` 假包探针）**（新增） | `node tools/libgen_probe.mjs`（临时目录手写假包 + 四条负例；已接成 `verify_all.sh` 的门，**离线、不装任何包**） | 10-02 | **24 / 24** —— 生成器的规则第一次有离线门看得见：洞一（`PropsWithChildren` 认得出 / `PropsWithoutRef` 透明）· 洞二（`children: string` 自动 raw、`content` 声明 raw、没声明**不会**自己 raw）· `defaultExports` 两侧都通（宿主编用 stub react 真 import 真注册）· 负例 A/B/D（拼错的组件名 / prop 名 → 退出码 2 且点名）· 负例 C（挡住"规则放宽成全都当原始字符串"）。**落地当天抓到两个真 bug**（详见 FINDINGS） |
| **真实应用（chat-app，真机）**（新增） | `node examples/apps/chat-app/device_check.mjs`（要模拟器 + Metro 服务本工程；借已装的 debug 壳） | 10-02 | **17 / 17** —— 验的是**无头验不到的两件事**：① **RN 那条传输**（XHR 渐进；与 web 的 fetch 流是**两份代码**）；② **markdown 真的渲染出来了**：界面上读到 `AI | 标题一 | 这是粗体和行内代码。 | const a = 1; | • | 列表甲 | • | 列表乙` —— `#` / `**` / 反引号 / 围栏**全被吃掉**；流到一半时读到的正是 `AI | 标题一 | 这是** | ▍ | 生成中…`。⚠️ 这一轮它**先红了一次**（`registerLibrary("md") 里列了 Markdown，但模块里没有这个导出`）—— 真因是**类型定义谎报了导出**，只有真机看得见，见 FINDINGS |
| **干净机器（**registry 版**）** —— 本轮最重要的一条 | `npx moobile-host@0.3.0 init hello --name hello` → `npm install` → `npm run build` → `npx expo start --web` → 真 Chrome 断言（`s1-local-run/probe-web.mjs`） | 10-01 | **9 / 9**：生成 11 个文件（**含 `.gitignore`**）→ 装到 **488 个包**（`moobile-host@0.3.0` 就是本项目自己那份）→ `moon build --target js` 用的是**线上** `XiLaiTL/moobile@0.3.0` → `moobile-host build` 出 `moobile.js` **629 KB** → Metro 服务的就是这个工程（`<title>hello</title>`）→ 浏览器：标题「待办」/ 计数「还有 0 件」/ 输入回灌 / 点「添加」→「还有 1 件」/ 列表出现 / 输入框清空 / **全程无 console 错误** |
| ↳ 同一轮里的**镜像延迟**（不是包的问题） | `npm install`（默认源 = npmmirror） | 10-01 | **失败**：`notarget No matching version found for moobile-host@^0.3.0` —— 官方源上已有、镜像未同步。已触发按需同步（`PUT https://registry.npmmirror.com/-/package/moobile-host/syncs` → `state: waiting`）；改走官方源后安装成功（488 包 / 4 分钟） |
| **发布后核对（扩成两个包）** | `bash tools/check_published.sh`（第 6 段是 10-01 新加的） | 10-01 | **通过**：月亮包 9 个公开包齐 + README 路径成立；宿主包线上 `latest = 0.3.0` 与工作区一致、12 个用户路径文件全在（tarball 35 个）；**契约对账 `月亮包 2 = 宿主包 2`**。⚠️ 这一条补上的是 `docs/design/SCAFFOLD.md` §6.1 早就点名的缺口（"npm 那一半从来没有发布后验"） |
| ↳ 同一段门的**证伪**（用真实的错配组合） | `bash tools/check_published.sh XiLaiTL/moobile@0.2.2` | 10-01 | **`exit 1`** 且点名：`线上两个包的契约版本不一致（月亮包 1 / 宿主包 2）` —— 即"只发了一边"的场景，门能抓住 |
| ↳ 同一段门的**宽松分支** | `bash tools/check_published.sh XiLaiTL/moobile@0.2.2`（历史核对） | 10-01 | 缺包/版本不一致只**提示**，不判红（`PUBLISHED_REQUIRE_ALL=0/1` 可强制） |
| **性能基线 · 离线每帧成本（D1/D2 的离线那一半）**（新增） | `node tools/perf_bench.mjs --n 1000,5000 --mode translate --frames 100 --warmup 30 --trials 9`（负载 `examples/apps/perf-bench/`，先 `moon build --target js`） | 10-02 | **基线（重测，机器空闲；各 9 次 `min` 统计量）**：N=1000 **12.64 ms**（7007 元素）· N=5000 **84.90 ms**（35007 元素）· 每元素 **1.8–2.4 µs**。⚠️ translate 档 = **只算翻译层**，不含 React / 布局 / 原生渲染。⚠️ **首测是在并发负载下量的，两批不可混用**（`PERF.md` §3.1）。全部数字与边界见 `PERF.md` |
| **D3 标签表索引化**（新增） | 同上，用 `--artifact` 量两份**留档的构建**（改前 `3d8b00bf0ca5419a` / 改后 `90bdcb5fbaac274e`，各 9 次、交错跑） | 10-02 | **−10.5%（N=5000，两组 9 次 `min` 区间完全不重叠）/ −7.6%（N=1000，区间轻微重叠）**。⚠️ 首测报的 −10.7%@N=1000 是**并发负载放大**的；**单次读数能差 1.4–2.2×** ⇒ 判据是多次的 `min`，不是单次中位（`PERF.md` §5）。两份产物**都能从源码重建出同一哈希**（即 A/B 只差 D3 一处）。F1 复验仍 **44 映射 / 12 排除** |
| **★ 每帧成本归因（消融探针）**（新增） | 把 `Props::copy` 临时改成共享（**测完字节级还原**，不入 patch 系列），构建留档产物与对照同会话交错跑 | 10-02 | **−36.1%（N=1000）/ −27.8%（N=5000）**，即 **0.64 µs/元素**（两个规模几乎完全相同 ⇒ 归因成立）。**这改判了首测的归因**：大头是 `resolve_attrs` → `Attrs::copy` → `Props::copy` 那**四张表**的 `copy_map`，**不是**上一版写的 `styles_map()`（那里根本没有 `copy_map`） |
| **★ P1 的正确性回归（已修）**（新增） | `moon test --target js`（**本轮才补进 `verify_all.sh`**） | 10-03 | 上游自带的 `attrs_copy_test.mbt`（`Attrs::copy isolates later mutations`）**原来是红的**：`Props::copy` 把四张**可变**表连句柄一起共享 ⇒ 往副本里写会**漏回原件**（同一个 Attrs 传给两个元素就串味）——**已发出的语义回归**。修法：新增 `PropsTable::share()`（共享不可变数据、句柄各自新建）。**代价实测**：`translate` 中位 **+6.3%** / 均值 +7.6%（区间重叠）· `dom` +1.5~4.3% ⇒ **P1 净收益 −32% → 约 −25%**。门已补 `moon test`（**96/96**）——`moon check` 查不到行为，这一格原来没人守 |
| **★ 插入成本探针（给 P1b 定大小）**（新增） | 把 `Attrs::styles` 的插入**做 3 遍**（输出逐项不变：7007/1001/4005，`shape_ok` 仍 true），8 轮交错 | 10-03 | `min` **+61.4%（区间不重叠）**/ 中位 +37.8% / 均值 +29.1% ⇒ 反推每帧 **4005 次样式插入 ≈ 1.8 ms ≈ 翻译层的 30%**。⚠️ **profile 只报 3.2%** —— 低估一个数量级（内联/归属漂移）⇒ **给一刀定大小要用消融探针，别用 profile 份额**（`PERF.md` §12.3） |
| **★ memo 成为新应用的默认写法：脚手架模板**（新增） | `node tools/template_compare.mjs`（T1）· `node tools/verify_headless.mjs` · `node tools/template_check.mjs` | 10-03 | 模板的最小 Todo 列表改用 `@moobile.memo_list`（键 = `text` + `done` + `id` 三样；**`id` 那一条防的是「被复用的 handler 闭包在重排后切换错行」**）。判据：T1 **15/0**（`app.mbt` 属「生成物独有」，**不需要改 `deltas.txt`**）、无头 **10/0**（添加/勾选/删除都真的驱动了这个列表 ⇒ 键的三条被端到端走到）、模板门 **15/0**。**`id` 位的失败模式已有测试守着**：`verify_headless.mjs` 新增「同名两条 → 删第一条 → 勾剩下那条」剧本，无头判据 **10 → 13 项**；**并做了证伪** —— 把 `id` 从键里临时拿掉后那条**准确变红**（报 `点过之后 text=""`，与预测一致）（`PERF.md` §14.8） |
| **★ memo 落到真应用：chat-app 消息列表**（新增） | `node examples/apps/chat-app/verify.mjs`（无头，含新增的一条 memo 判据） | 10-03 | 消息列表改用 `@moobile.memo_list_i`（新增**带序号**的 helper；键 = `role` + `text` + `streaming_tail` 三样齐全）。**端到端判据**：流式期间读库自报的计数 ⇒ `命中 +4 · 未命中 +4`（4 帧 × 两行 ⇒ 每帧 1 命中 1 未命中）——**两个数都涨才算过**（只涨命中=界面冻住；只涨未命中=memo 没接上）。chat-app 无头判据 **22 → 23 项**，本次 **23/23** |
| **★ memo 落地（应用侧）：`@moobile.memo_list` + 诊断计数 + 配方**（新增） | 基准负载**改走这个公开入口**后重跑；`--memo` 8 轮交错；另加 `moon test` 3 条 | 10-03 | `translate` 中位 **4.9 → 0.13 ms（−97.5%）** · `dom` **12.00 → 0.37 ms（−96.9%）**、`min` 9.58 → **0.30 ms**（区间不重叠 ✅）。新增 `memo_hits()`/`memo_misses()` 诊断计数 ⇒ **读数自报命中率**（`--memo` 档零命中时仪器**直接报错**、并声明该批数字不可引用）。配方 [`PERF-RECIPES.md`](PERF-RECIPES.md)（长列表/虚拟化/update/样式，各带自查判据）。`PERF.md` §14.1 |
| **★ P3 收尾：记账快路（不用 memo 的应用不再付那笔税）**（新增） | 12 轮交错两档；另加 memo 档形状/命中与真应用无头判据 | 10-03 | `MCtx` 的路径记账**只有 thunk 用得上**却是每帧每元素都要付的（含时归因：`render_memo`+`render_children_memo` 自身 ≈ 14.6% vs 改造前 ≈ 6.3%）。改法：**先走零记账快路；真遇到 thunk 就把这一帧作废、武装记账并重画**（只发生一次）——**不做猜**，所以不存在「换屏后 memo 静默失效」。实测 `translate` **min −29.7% / 中位 −22.1% / 均值 −33.3% / p95 −41.1%（四列全不重叠 ✅）**；`dom` −15.8% / −15.9% / −15.0% / −12.3%（**同向但区间重叠**）。正确性四条都实跑：`--memo` 档形状 7 + 命中 1000/帧、chat-app **23/23**（命中 +4/未命中 +4）、模板无头 **13/13**、全量门 **25/25**。顺带重测 memo：**`translate` −97.0% · `dom` −96.1%**（`PERF.md` §14.9/§14.10） |
| **★ P3 续：没有 handler 就别建迭代器**（新增） | 20 轮（translate）/ 10 轮（dom）交错；同一份产物的 profile 对照 | 10-03 | 加 `Props::has_handlers()`（O(1)）挡住 `each_handler` 的循环（本负载 7007 个元素里只有 1001 个有 handler）。墙钟：`translate` 中位 **−10.5%** / 均值 −5.4% / min −2.0%，**区间全部重叠 ⇒ 只算方向一致**；`dom` 测不出。**直接证据**：profile 里 **`each_handler` 从榜单消失**（原 5.1%）⇒ 工作确实被拿掉了。⚠️ 这一档**堆增量 +295% 且区间不重叠** —— 因为**分配变少 ⇒ GC 更少 ⇒ 净堆更高**（堆增量 ≠ 分配量，`PERF.md` §14.6） |
| **★ 试过又退掉：Text 元素的 props 传 `null`**（新增） | 12 轮交错，两档 | 10-03 | 账本上说得通（每帧少 3000 个 JS 对象），实测 **四列符号自相矛盾、区间全重叠 ⇒ 测不出** ⇒ **回退**（回退后产物逐字节相同）。`PERF.md` §14.6 |
| **★ P3 落地：空表不建迭代器 + 样式走索引**（新增） | 含时归因定位 → 两刀 → 10 轮交错 | 10-03 | `translate` **min −20.7% / 中位 −16.7% / 均值 −28.4% / p95 −40.8%（四列区间全不重叠 ✅）**；`dom` −9.6% / −9.4% / −8.6% / −8.2%（**四列同向但区间重叠**，只算方向一致）。改法：① `render_props` 里空表不建迭代器（本负载 7007 个元素的 attrs/props **全空**）；② `styles_to_js` 用新增的 `Styles::at(i)` 按序号遍历，不再走闭包迭代器（省每元素一次间接调用 + 一个 `Option`）。定位手段：**含时归因**（`.cpuprofile` + 自己写的树分析），因为它**不新增分配 ⇒ 不扰动 GC**。`PERF.md` §14.5 |
| **★ P3 的探针（属性 → JS 对象值多少）**（新增） | 把 `render_props` 的构造**做两遍、丢掉结果**（输出逐项不变），8 轮交错 ×2 种 GC 条件 | 10-03 | **`min` +23.2% / 中位 +14.1%**（默认）· **`min` +25.3%（区间不重叠）/ 中位 +20.9%**（半空间 64 MB）⇒ 这笔成本 ≈ **翻译层的 20~25%**，与 profile 的 `render_props` 7.5~12% + `styles_to_js` 6~9% 吻合。⚠️ **均值/p95 反向**（探针更快）⇒ **这个探针会扰动 GC**（多造一倍垃圾改变了「GC 落在哪一帧」）；结论**只用 `min`/中位**，并把反向那两列如实写明。下一轮的具体改法：把「每键一次 FFI」改成**批量接口**（`PERF.md` §14.4） |
| **★ 试过又退掉：`Styles` 用 `ArrayView`（类型保证只读）**（新增） | 10 轮交错，两档 | 10-03 | **更优雅但更慢**：`translate` min **+15.2%** / 中位 +10.1% · `dom` min **+9.5%** / 中位 +8.4% / 堆增量 **+86.5%**（区间重叠，但两档六个统计量方向完全一致）⇒ **回退**。安全收益改走便宜那条路：**删掉会漏出可变数组的 `Styles::entries()` 访问器**。⚠️ 回退时顺手丢了一条快路径（+5.5%），靠 A/B 抓回 ⇒ 纪律：**回退要用「产物哈希回到原值」验收**（`PERF.md` §14.2/§14.3） |
| **★ P1b：样式表改扁平数组（本轮最大的一刀）**（新增） | 同一负载、同会话交错 12 轮（`--artifact` 两份留档产物） | 10-03 | **`translate` `min` 6.58 → 3.45 ms（−47.6%）· 中位 −38.7% · 均值 −34.9%**；**`dom` `min` 12.53 → 8.93 ms（−28.8%）· 中位 −22.7% · p95 −15.6%** —— **两档区间全部不重叠 ✅**。形状逐项不变（7007/1001/4005）⇒ 纯成本移除。改法：`Props.styles` 从不可变 HAMT 换成 `Styles`（扁平数组 + **可变句柄 + 数组永不原地改**，三条不变式写进注释）；写入点三处（`html`/`svg` 的 `Attrs::styles`、`Props::styles`）。⚠️ 上一轮那条探针估 30%，实测更大（连 `styles_to_js` 的 HAMT 迭代开销一起去掉了）。`PERF.md` §13 |
| **★ `memo` 在新树上重测**（新增） | 同一份产物切 `--memo`，8 轮交错 | 10-03 | `translate` 3.548 → **0.090 ms（−97.5%）** · `dom` 10.29 → **0.32 ms（−96.9%）**，区间不重叠。⇒ §11.1 的 −98.5%/−97.0% 是**旧树**读数，结论不变、幅度略小；**引用用新数**（`PERF.md` §13.4） |
| **★ P3a：`is_empty()` 去 O(N)**（新增） | `translate` / `dom` 各 12 轮交错 | 10-03 | `PropsTable::is_empty` 原来是 `length() == 0`，而 core 的 `immut/hashmap` 把 `length()` 标成 **O(N)**。改成保守非空位 ⇒ O(1)（语义精确）。⚠️ **墙钟在噪声内**（中位 −0.9%，区间全重叠）——真因：小表走 `Flat` 节点时 `length()` 本来就不遍历。**保留的理由**：去掉一个有文档背书的 O(N)；**没换到可测收益**（`PERF.md` §12.2） |
| **★ P1：属性表改不可变（每元素那次复制的开销）**（新增） | 四张表换成 `PropsTable[V]`（包 core 的 `immut/hashmap`）⇒ `Props::copy()` 变 **O(1) 指针拷贝**；留档产物同会话交错跑，`--artifact` 各 9 次 | 10-02 | **−32.4%（N=1000）/ −29.3%（N=5000）**，两组各 9 次 `min` 区间**完全不重叠**；三种统计量同向；**形状断言逐项不变**；**全量门 24/24**（含 chat-app 22 项等行为判据）。⚠️ **契约没破** —— 复制还在，只是变便宜了（对比消融上界 0.64 µs/元素，实测省 0.52/0.60）。已在 `tools/patches/{08,10,11,01,06,34}`，`vendor_sync --check` 通过 |
| **★ `dom` 档口径（真 React + jsdom）**（新增） | `node tools/perf_bench.mjs --n 1000 --mode dom --frames 100 --warmup 30 --trials 9`（⚠️ **量纲取决于 `NODE_ENV`**：production 构建没有 `act`，见 `PERF.md` §6.1） | 10-03 | **N=1000 `min` 统计量 14.29 ms**（9 轮交错 [13.05..16.45]）；同会话 `translate` 8.70 ms ⇒ **React 的 diff/commit + DOM ≈ 5.6 ms（39%）**。⚠️ jsdom **不做布局**、DOM 比真浏览器慢 ⇒ 绝对值偏悲观、只有差值方向可信。**新增「每帧自证落地」**（`frames_landed/missed/dropped`）——它第一次跑就抓到一次「帧压根没发生」的假读数（0.03 ms/帧，`PERF.md` §6.4） |
| **★ D6：`memo` 接通（0.16 那把刀原本在我们这条通道上是空转的）**（新增） | 同一份产物、宿主注入的开关切两格（`--memo`），`--mode translate` 与 `--mode dom`，各 9 轮交错 | 10-03 | **`translate` 8.70 → 0.133 ms（−98.5%）· `dom` 14.29 → 0.43 ms（−97.0%）**，两档区间均**不重叠**；每帧新建元素 **7007 → 7**、handler 1001 → 1。⚠️ **这是「只有表头在变」这个访问模式的上界**，别搬到真实应用。**「空转」有三层证据**（源码 / 编译产物里 `_Thunk._0` 从未被引用 / 实跑 `row_html` 调用计数 1000 vs 0），见 `PERF.md` §11.2。⚠️ **那条「未解释的 −27%」已查明**：不是记忆化，是 **GC 的复制量** —— `view()` 建的整棵树被 duplix 图持有到下一帧（活对象 11.73 → 8.74 MB、单次 Scavenge **2.0 → 6.5 ms**）。顺着它做的「惰性根」把 GC 时间砍到 **216 → 63 ms**、活对象 −29%，但**三种条件下 `min`/中位都不动** ⇒ **已回退**（否定结果与被我推翻的解释都留在 `PERF.md` §11.6） |
| **★ vendor 换底：rabbita 0.15.4 → 0.16.0**（新增） | 分支 `drill/rabbita-0.16.0`：`tools/vendor.lock` 改 0.16.0 → 4 个冲突 patch 用**三方合并**重做 → `vendor_sync.sh --apply` → 重生成转发包 | 10-03 | **`moon check` 0 错误 · `verify_all.sh` 24 / 24** · 基准**不回归**（N=1000 7.40→**7.36** ms；N=5000 46.62→**47.52** ms，区间重叠）· **P1 的 `PropsTable` 保住**（0.16.0 的 `vdom.mbt` 里 24 处）。当轮那 **33 条**里**只有 4 条**要手工重做（`04`/`08`/`09`/`28`），其余 29 条直接重放；干净基树上 **33/33** 可打。⚠️ **2026-10-23 实测：patch 系列现在 34 个**（数 `ls tools/patches/*.patch` 的输出行）—— **原先这里写 33**，那是当轮的读数；此后新增了 `35-new-html-attrs_copy_test.mbt.patch`（`git log -- tools/patches`，3cc586d）。⚠️ **对库使用者是 breaking**：`@common.Viewport` 的 `width/height` 变 `Double`、`@js.Promise` 变 `Promise[T]` ⇒ 下次发版必须进 CHANGELOG（`vendor/rabbita` 也在发布包里）。⚠️ 注册表最新是 **0.16.3**，它当时还需要**更新的工具链**（`moon upgrade`；见 `FORK.md` §4.3）—— **当日稍后就升上去了**：`tools/vendor.lock` 现在就是 `RABBITA_VERSION=0.16.3`（2026-10-23 实测；见 §1 那条 `0.15.4 → 0.16.3` 的破坏性改动记录）。坑与手法见 `FINDINGS.md`（第十四轮·七） |
| **CI（C3）· GitHub Actions**（**第一次绿**） | push 后自动跑 `.github/workflows/ci.yml`（读结果：`python3 tools/ci_status.py <sha>`） | 10-01 | run **`36888896799`** @ `3e4a3fc` → **`conclusion = success`**，8 个步骤全 success，annotation 只剩两条与本仓库无关的弃用提示。**它落地以来第一次通过**（此前两次都是 failure，见 §4-8） |
| ↳ **再次绿：门长到 25 项、且换过 vendor 之后**（新增） | 同上 | **2026-10-03** | run **`37119065187`** @ **`fdd0e5e`** → **`conclusion = success`**，**13 个步骤全 success**（含 `重建 vendor`、`Install host deps`、`一条命令跑完离线检查`），annotation **仍是那两条与本仓库无关的弃用提示**。★ 这一次是**推之前先在本机预演了新鲜克隆**的：预演 `通过 20 · 失败 0 · 跳过 4` → 真 CI 绿。**预演当场逮到一条"本机绿、CI 红"的断链**（`docs/design/DESKTOP-RNW.md` 链到 gitignore 的 `.scratch/`）—— 不修的话这一跑就会红在 `check_links`。手法与坑见 [`FINDINGS.md`](FINDINGS.md) 十五续 |

⚠️ **口径**：09-20 那三行是**那天**跑的，这一轮没重跑（数字本身没错，但别当成今天的）。
`tools/verify_headless.mjs` 裸跑是 **10 通过 + 1 SKIP**，SKIP 数**取决于调用方式**
（订阅通道要 `--slow`；"计数文案"那条断言只在模板门带 `--count-pattern` 的调用里存在）——
所以设计文档里**不再自报项数**，一律指向本表。

### 2.2 需要本机资源、本轮**没有**重跑的（文档记载，别当成本轮实测）

| 门 | 命令 | 最近已知 | 前置 |
|---|---|---|---|
| Web 端到端 | `node tools/verify_web.js` | 27 / 27（含订阅心跳） | Metro 在 8081 + 后端在 8787 |
| 本地数据库 | `node tools/db_probe.js` | 8 / 8 | 同上 |
| 同步链路 | `node tools/sync_probe.js` | 14 / 14 | 同上 |
| 真机 Android 14 | `python3 tools/verify_android.py` | 27 项，**25/27**（删除链路 2 条挂 —— **既有的**，见 §4 第 6 条）；可见性 3 条 + 尺寸 3 条（**精确数值**）全过 | 模拟器（AVD `moobile64`，**x86_64**）+ APK + **后端在 8787** |
| ↳ ⚠️ **2026-10-23 实测：这条套件在本机跑不起来**（两个环境问题，都记进了 FINDINGS 第二十二轮） | 同上 | —— | ① 后端 8787 **落在 Windows 的保留段 8764-8863 里**（`An attempt was made to access a socket in a way forbidden…`；无管理员权限清不掉）—— 已加 `MOBILE_TODO_PORT` 开关 + `adb reverse tcp:8787 tcp:<实际端口>`（**设备侧不改**）；② 但**原生服务端在当前工具链下链接失败**（`moon 0.1.20260920`：`MOONBIT_MALLOC_RAW` 等 **6 个未解析符号**，`moon clean` 后照样）⇒ 拿不到后端，这条套件本轮**没跑成**。这是**既有问题**，不是本轮引入 |
| 一键（含 e2e） | `bash tools/verify_all.sh --with-e2e` | 追加 Web 那三项 | Metro + 后端 |
| 发布后核对 | `bash tools/check_published.sh` | —— | 网络 + 已发布版本 |

---

## 3. 轨道进度

| 轨道 | 已落地 | 还剩什么 | 正文 |
|---|---|---|---|
| **A 治理** | 目录重排、文档分层、风格规则、CHANGELOG、CI | —— | [`PLAN.md`](../PLAN.md) §3.2 |
| **B 叙事** | description / keywords / README 首屏（registry 实测已是新版） | 要不要英文版 README（决策点 1） | §3.3 |
| **C 回归** | 安卓断言脚本、离线入口（`bash tools/verify_all.sh`：**原先写"15 项"**，2026-10-23 第三十轮的读数是 **34 门** —— 项数一律以它自己打的汇总行为准）、CI、**C0 宿主可替换性验证（09-21 ✅ 实测）** | ✅ **C2 那条"干净机器"的判据 10-01 已成立**（从 registry 上两个包从零走完用户的三条命令、真 Chrome **9 / 9**，见 §2.1；**原先这里写"要等发版"**）；本机剩下的是**镜像延迟**（属时间问题） | §3.4 |
| **H 接入收敛** | 宿主收成 npm 包、单导出、注册表生成、fail-fast、契约校验 | H3（可选，已降级） | §3.7 |
| **N 原生能力** | `Cmd`/`Sub` 接线、真能力样板（expo-sqlite）、`@sub.every` 两端验过、**能力通道第三种形状 `read_json`（"读一次当前视口"，十一轮）**、**N2 能力通道两层都验过（`MOBILE_HOST.native` + `visibility`）**、**N5a 平台矩阵（30 个公开 API × 31 条 DOM 链路 × 平台 × 失效形态，已进门禁）**（⚠️ **原先写"29 API"** —— 2026-10-23 跑 `node tools/cap_platform.mjs` 读到的合计就是 30 / 31）、**N5b 3/4 有结论，其中 `on_visibility_change` 与 `on_resize` 真机验过（后者断言精确数值）** | N4 后半（`custom_sub` + 退订）、N6 文档、`clipboard`/`nav`/`dialog` 的处置（卡决策点 17） | §3.6 |
| **I 生态接入** | 机制 + I1 事件载荷 + I2/I3/I5 生成器（三份产物同源、`--check` 可 diff）、**生成器自己的规则有了离线门（假包探针 24 项）**、**两处「类型定义撒谎」由声明兜住**（`content`：children 是原始字符串；`defaultExports`：名字只在 default 上）、**一个真实 RN 组件库接进来了**（`react-native-markdown-display`，无头 22/22 + 真机 17/17，宿主侧零手写） | **I7 真浏览器样式**、I6 样式交集量化、I4 平台矩阵 | §3.8 |
| **E 脚手架** | 模板唯一真源、`init`、`build`（发现产物）、**三条离线门（模板 / 承载真应用 / 同源 T1）**、**宿主矩阵三个宿主（expo / rnw / webview：第三个是零 Expo/零 Metro 的静态站点）**、**打包形态门**（`package_check`，发布前跑；09-21 抓起 npm 解包改名那个 bug） | ✅ ~~**发一版带 `init` 的宿主包**~~（**10-01 已成立**：`npx moobile-host@0.3.0 init hello` 从 registry 走通、真 Chrome 9/9，见 §2.1；**原先列在"还剩什么"**）、`doctor`、E5/E6/E7、E8 接线 | §3.9 |
| **CAN 画布通道** | 设计定案（**不新开通道**：组件通道 + `prop_json`）、库包 `canvas/`（18 条指令 + `OpCtx` + `canvas()`）、宿主包两个入口（`canvas-ops` 纯翻译器 / `canvas-skia` React 桥）、本机真 Skia 验证 32 项、跨语言对账：载荷**逐字节相同** | ✅ ~~**真机**（`<Canvas>` 挂载 + 文字字形，要 prebuild + 重建 APK）~~（**原先列在"还剩什么"，现在都已验**：挂载 10-01 真机验过、文字字形 10-23 第二十五轮量到 —— 见 §2.1/§4-7）、✅ ~~**手势**（P3 T3.4）~~（**10-01 已收口**，见 §4-7）、**坐标换算/`devicePixelRatio`**（T3.5，**仍未验**）、性能基线（D 轨道：**离线那一半已建**，但**画布 + 真机这一格仍没有判据** —— 见 `examples/apps/canvas-spike/README.md` §5） | §3.6 补记 + [`design/DESIGN.md`](design/DESIGN.md) 阶段 4 |
| **GES 手势通道** | 库包 `gesture/`（`Gesture` + `Phase` + `attrs`/`pan`/`tap`）、宿主包 `gesture-rn.js`（**默认装载**，PanResponder、零新依赖）、**契约的不变量 4 条**（`start` 恰一次且在最先 / 起点 `dx=0` / 全程同一参照系 / `cancel` = 这次不算）、web 试金石 **40/40**（含边界 20 项）、真机 `gesture-edges` **18/18**（⚠️ **本机 2026-10-02 实测是 14/18**，4 条红与当轮改动**无关** —— 已用「stash 掉改动再跑」对照证明前后逐条一致；两条是夹具前提（哨兵初始不该在屏内）、一条是 dp/px 单位假设，见 FINDINGS 的 Android 补记）| **多指 / pinch / rotate**（`pointers` 已**诚实报数**、`dx` 锁第一指，但真机多指没验 —— `adb shell input` 只能发单指）、iOS、**元素自身在拖动中移动时 `x/y` 怎么解释**（契约未写）、"JS 线程忙时的手感" | §3.6 / §7-19 |
| **SSE 流式通道**（新增） | **`@http` 的流式那一半**（`http/stream.mbt`：`StreamEvent` + `stream` + `abort`；web 用 `fetch` 流、RN 用 XHR 渐进）、试金石 `examples/apps/sse-spike/`（无头 **12/12**、真机 **14/14**）、已接成第 17 条门 | 契约里**没有**取消之外的流控（背压）；多路并发流（一次开多条）未验 | 见 `FINDINGS.md` 的 SSE 补记 |
| **F 迁移** | **F1 动检**（MoonBit 版 + 新增的 JS 版，两者逐项对账已进门；**19 类**，含新增的结构规则 `click.on-view`）· **F2 样式层**（✅ 已落地：CSS → `styles.mbt`，对本仓库真实应用量到 **510 = 439 + 71** —— 机器可读事实块 `migration.generated.json` 的 `facts`，`generatedAt 2026-10-04`；**原先这里写 510 = 435 + 75**，那是迁移当天的记录，见 §4-10）· **E9 装配器**（✅ 已落地：`create --from-rabbita`，判据 S9-1…S9-6 全达成）+ **生成后自查**（✅ 10-02 新增：`lib/migrate/app-audit.js`，`create` 落盘后自动跑、结果进报告 §5；离线门 `tools/migrate_app_audit.mjs` 13 项） | F3 指南、F4 `moon add` 提示 | §5.1、[`plan/PLAN-yi-port-2026-10.md`](plan/PLAN-yi-port-2026-10.md) |
| **D 性能** | D4 空样式短路；**D3 标签表索引化（−10.5%@N=5000 / −7.6%@N=1000，重测）**；**P1 属性表改不可变（−32.4%@N=1000 / −29.3%@N=5000，实测；契约未破）**；**D1 离线基线（重测）**（`docs/PERF.md` + `tools/perf_bench.mjs` + `examples/apps/perf-bench/`）；**归因（消融探针：每元素每帧那四张表的复制 = 0.64 µs/元素 ≈ −28~−36%）**；**`dom` 档统计口径 ✅（14.29 ms，React 占 39%）**；**D6 `memo` 接通 ✅（`dom` −97%，区间不重叠）** | **D1 的真机/真浏览器那两套**（D2 的掉帧率/内存峰值/首屏、连续滚动那一路）、**P2/D5（handler 闭包与元素身份/闭包池 —— `PERF.md` §8 仍记"未测"）**、虚拟化列表下的 memo 收益（`PERF.md` §9）。⚠️ **原先这里还列着 P1b / P2-P3 的 JS 对象构造 / P0 / P0b —— 这几条现在都有结论了**：**P1b ✅ 已落地**（`PERF.md` §13）、**P3 ✅ 已落地**（含 P3a；`PERF.md` §14.5/§14.9，见 §2.1 那三行）、**P0b ✅ 已做**（= P3 收尾的"记账快路"）、**P0 ✅ 已查明**（不是记忆化，是 GC 的复制量 —— `PERF.md` §11.5，见 §2.1）；P0c（惰性根）**试过又回退**（`PERF.md` §11.6） | §4 |
| **G 真实应用** | **决策点 3 已拍板（2026-10，走 (a) 全做）且主体已落地**：`interest/yi` → [`examples/apps/zhouyi-reader/`](../examples/apps/zhouyi-reader/)，**四个宿主形态**（Expo / RNW / 静态 webview / Electron）都跑过判据（⚠️ **10-23 更新**：应用那套判据长到 web **107 / 0**、真机 **39 / 0**（静态宿主上那 107 条也是 107/0）—— **原先这里写 web 99/99 · 真机 29/29**，静态宿主 **15/15** · Electron **17/17**（后两者是 10-02 的读数、**未重跑**），见 §2.1） | **"完整"**：迁移报告的 §4 清单**现在 39 项**（**原先写"剩 21 项 TODO（3 保底桩 + 13 整块注释 + 5 处 `on_click`）"** —— 那是迁移当天的读数，见 §4-10；逐条在生成物的 `MIGRATION.md §4`）。⚠️ **但那份清单已经过期**：报告手写区的补记 5（第十二轮核过）写着其中**绝大多数早就做完了**（`grep @dom` 现在 **0 命中**）⇒ 要问"还差什么"**看判据**（`node examples/apps/zhouyi-reader/verify.mjs` 107 条 / `device_check.mjs` 39 条 / `node tools/migrate_app_audit.mjs`）。⚠️ RNW 的**真窗口**仍未起（要 VS 2026 + SDK 22621） | §6、[`plan/PLAN-yi-port-2026-10.md`](plan/PLAN-yi-port-2026-10.md) |

---

## 4. 现在最大的几处空白（按"卡不卡别人"排序）

1. ~~**线上包没有 `init`/`build`** → S1 判据不成立、E 轨道卡住。~~ ✅ **2026-10-01 解决**：
   `moon publish` + `npm publish` 都做完了，两个包都在线上是 **`0.3.0`**（见 §1）。
   ⚠️ **10-23 补记：这句里的 `0.3.0` 是 10-01 当天的读数** —— 版本后来往前走了两版：
   月亮包线上 **`0.5.0`**（10-04 发布）、宿主包线上 **`0.4.0`**、工作区 `0.5.0` 待发（当前版本一律看 §1）。
   ✅ 2026-09-21 补：**"干净机器三条命令"这条链路的本地代理已经两段全通**（仓库布局与打包形态各 9/9，
   见 §2.1），发版前又新抓了一个 bug（打包后 `init` 生成的项目的 `.gitignore` 被 npm 改名吃掉，
   已修 + 已有发布前门）。
   ✅ **10-01 收口**：发布后**从 registry 上两个包从零走了一遍用户的三条命令**
   （`npx moobile-host@0.3.0 init` → `npm install` → `npm run build` → `npm run web`），
   真 Chrome **9 / 9**（§2.1）。这条判据**这次是真的成立了**，不再是"本地代理"。
   剩下的是**镜像延迟**（npmmirror 还没同步 0.3.0，属时间问题，见 §1 与 FINDINGS）。
2. **I7 没做** → M9 差的这半条正是"能不能在真浏览器里看样式"。
   ⚠️ **别把这条读宽**（10-23 补记）：**应用自己**那套判据里已经有 **4 条量的就是真浏览器的计算样式**
   （第二十八轮：爻题 700 / 16.5px / `rgb(138,37,24)`，爻辞 400，见 §2.1）；**I7 指的是第三方组件库**
   （antd 的 CSS-in-JS）在真浏览器里**生效没有** —— 那一条仍然没做（`examples/apps/antd-demo` 的
   24 条判据要装 antd、手动跑，不在离线门里）。
3. ✅ **有了**（10-02 划掉一半）：**离线基线已建**（`PERF.md`：每元素 **1.8–2.4 µs**、成本随元素数线性）—— ⚠️ **原先这里写"每元素 ~2–2.6 µs"**：权威数字是 `PERF.md` §3.2 的 **1.80 / 2.43 µs**，而 P1b 之后 `translate` 那一层已经是 **≈0.49 µs/元素**（`PERF.md` §13.6）。
   但**"够好了"的判据仍然没有** —— 真机与真浏览器那两套（D2 的掉帧率/内存/首屏）一条都没采，
   而"手感"只在那里看得见。归因已经把下一刀指出来（**每帧重建 Map ≈ 四成**，`PERF.md` §7/§8）。
   ⚠️ **10-23 补记**：上面那句"下一刀"其实是**首测归错了** —— 消融探针把它改判成
   「`resolve_attrs` → `Attrs::copy` → `Props::copy` 那**四张表**」（每元素 **0.64 µs** ≈ −28~−36%），
   而且**那一刀当天就落地了**（P1 / P1b / P3，见 §2.1 那三行与 `PERF.md` §7.2/§7.3/§13）。
4. ✅ **主体已落地**（10-02 划掉大半）：决策点 3 已拍板（走 (a) 全做），
   `interest/yi` → [`examples/apps/zhouyi-reader/`](../examples/apps/zhouyi-reader/)，
   **四个宿主形态**都跑过判据（见 §2.1）。
   **剩下的不是"有没有真实应用"，而是"完整性"**：迁移报告 §4 的清单**现在 39 项**
   （**原先写 21 项**，那是迁移当天的读数 —— 见 §4-10）；⚠️ 而且**"还没有人处理"这句已经不成立**：
   报告手写区的补记 5（第十二轮核过）记着那批里**绝大多数早就做完了** —— 动态类名（爻线）、
   `more_view`、`draw_bagua_cmd`/`bagua_view` 三处保底桩、13 处 `@dom` 整块注释
   （`grep @dom` 现在 **0 命中**），另有 4 处"上下文键对不上"经查是**状态标记**（源 CSS 里本就查无此规则）。
   ⇒ 要问"还差什么"**看判据**（`verify.mjs` 107 条 / `device_check.mjs` 39 条 / `node tools/migrate_app_audit.mjs`），
   证据在 `examples/apps/zhouyi-reader/MIGRATION.md` 的手写区 ——
   这条**从立项起就在**，只是形状从"完全没有"变成了"逐条点名、且多数已有结论"。

5. **C0 只验到 web 目标那半**（09-21 新增的边界）：裸 RN **native** 宿主（gradle + 真机、不经 Expo）
   还没跑过；带能力的宿主（换一个 db 实现去挂 `todo-app`）也还没写 —— 实测下来卡点很明确：
   **把平台拉进来的是注册表那一环**（`registry.generated.js` → `moobile-host/capabilities/db` →
   `expo-sqlite`，连打包都过不去），换成空注册表则启动那条 db 命令直接 abort（页面全空）。
   见 [`FINDINGS.md`](FINDINGS.md) 的 C0 补记。
6. **真机上"删除"这条链路是挂的，而且一直都在挂**（2026-09-21 实测）：`verify_android.py` 里
   `删除在真机上生效` 与 `同步后服务器上那条也没了` 两条**稳定失败**（新增 / 勾选 / 同步都过）。
   §2.1 里过去记的"真机 21/21"**已经不准**。判定过程与"不是新引入的"这条结论的依据见
   [`FINDINGS.md`](FINDINGS.md) 的 N2 补记（关键：先核验 Metro **实际服务**的产物内容，
   再跑基线对照 —— 前两次对照因为 Metro 的缓存行为跑的都是新代码，白跑）。
   另：真机断言**本身**的证伪（把可见性映射写反）试了两次都**没有得到有效结果**，
   原因记在同一处 —— 所以「它能抓映射写反」这句**没有被证明**，别当已验。
7. **canvas 通道：真机"画得出 + 拖得动"都已验（10-01）；文字字形 10-23 也量到了（第二十五轮），现在仍差坐标换算**：`<Canvas>` 的
   **组件挂载 + 真绘制**已在 Android 模拟器上验过（`canvas-spike/device_check.mjs` 7/7：token + 截图取色 + 证伪），
   **整条链（手势 → Msg → Model → 绘制指令 → Skia）**在 `canvas-demo` 里验过（真机 12/12），
   Skia 原生库也确实链上了（`RNSkia: JniSkiaManager` 出现在 logcat）。
   ✅ **10-01 划掉一条**：原写的"手势（T3.4）未验"**已经收口** —— 手势通道独立成包（`gesture/`）、
   宿主默认实现（`gesture-rn.js`，零新依赖），web 试金石 **40/40**（含边界 20 项）、
   真机 `gesture-edges` **18/18**，过程中逼出三处**只在真机露头**的实现错误（见 FINDINGS 的手势边界补记）。
   **未验**：`devicePixelRatio` 换算（T3.5）—— ⚠️ **原先这里还写"文字字形（`makeFont` 那条路没上过真机）"，那半条已经不成立**：2026-10-23 第二十五轮在真机上量到了（画布区域独立墨色连通块 **790 → 2191**、阈值 1500，判据在 `examples/apps/zhouyi-reader/device_check.mjs`；证据图 `docs/evidence/zhouyi-compass-cjk-{before,after}.png`）—— ⚠️ 但"真机字形与 web/桌面的**差异**"**仍未量**（见 §2.1 那两行）。
   ⚠️ 另：这次验证用的是**临时接线**（把画布塞进 todo-app 做实验，验完回滚）——
   画布是**可选特性**（要原生依赖），按"库优先"它该有自己的示例应用，不该进模板。
   见 [`FINDINGS.md`](FINDINGS.md) 的真机补记与 `examples/apps/canvas-spike/host/device_check.mjs`。

> 2026-10-02 新增（M3 手机 LLM 聊天应用 + 组件库生成器补洞）：
> · **一个真实的 RN 组件库接进来了，宿主侧零手写**：`react-native-markdown-display`
>   （LLM 的回复基本都是 markdown）。以前 `App.js` 里有一段手写 `registerLibrary` +
>   `({markdown, ...rest}) => createElement(Markdown, rest, …)` 适配层，现在**整段没有了** ——
>   接一个组件库 = 写 `libgen.config.json` + 跑一条命令。判据：无头 **22/22**、真机 **17/17**。
> · **两处「类型定义在撒谎」由声明兜住**（这是这一轮最有复用价值的东西）：
>   `content`（children 是**原始字符串**而非子树）与 `defaultExports`（名字**只在 default 上**）。
>   两处都**不猜**：类型说不准就由人声明，声明错了就报错并指出怎么改。机制与真因见
>   [`FINDINGS.md`](FINDINGS.md) 的 10-02 补记。
> · **生成器自己的规则第一次有离线门**：`tools/libgen_probe.mjs`（假包 + 四条负例，**不装任何包**）
>   已进 `verify_all.sh`。它落地当天就抓到两个真 bug（一个"清单字段被静默丢掉"、
>   一个 `defaultExports` 的语义写错）。⚠️ 它也是**唯一一条在 CI 上真的会跑**的组件库门
>   （antd / chat-app / sse 那几条在 CI 上是 SKIP，理由与下面的空白一致）。
> · ⚠️ **仍未验（别读大）**：markdown 只在 **Android 模拟器**上验过（**iOS 从未跑过**、
>   web/RNW 上的渲染没验）；chat-app 用的是**借来的 debug 壳**（`com.anonymous.host`），
>   **它自己的 APK 没编过**；`antd-demo` 的 `libgen:check` 与 24 项宿主判据**不在离线门里**
>   （要装 antd，靠人手动跑 `cd examples/apps/antd-demo/host && npm run check`）。
>
> 2026-10-01 新增两条：
> · **CI（C3）此前从未运行过，且按原写法永远不可能绿**：提交一直没推出去，GitHub 不会跑远端没有的工作流；
>   一推上去两次都是 `failure`，而本机同一个命令全绿。真因是它**漏了"新克隆"的第一步** ——
>   `vendor/` 是 gitignore 的生成物（`tools/vendor_sync.sh` 生成），而 **CI 每次运行都是一个新克隆**；
>   外加 npm 安装那步 `continue-on-error: true` 把失败线索抹掉。实测：新鲜克隆 4 通过 / 8 失败，
>   补上 `vendor_sync --apply` 后 **14 / 0 / 1、exit 0**。修法在 `.github/workflows/ci.yml`（**待推**，见 §4-8）。
>   ✅ **10-01 收口**：剩下那 4 条红门的真因是**一条语法错误**（`gallery.mbt` 的旧式泛型 `fn f[T]`），
>   已在本地修掉；**新旧两代工具链各 16 / 16**，当时**修复本身还没推**（§4-8）—— ✅ **当天就推上去了**：CI 第一次绿是 run `36888896799` @ `3e4a3fc`（§2.1 与 §4-8）。
> · **宿主包副本新鲜度门原来只守 1 份，而仓库里有 7 份**：另有两份早就漂了。已经吃到代价 ——
>   陈旧副本让一轮边界探测**测的是老实现**，还掩盖过一条门的假通过（antd 负例 (b)）。
>   门已改成发现式，配 `tools/refresh_host_copies.sh` 一键全刷。
>
> 2026-09-21 划掉两条：
> · **T1 比对器已装**（原第 2 条）—— 门 + 证伪都做了，见 §2.1 与 [`SCAFFOLD.md`](design/SCAFFOLD.md) §6；
>   清单本身也被机器核过一遍（手量首版**漏登 3 处、多登 1 处**，见 [`FINDINGS.md`](FINDINGS.md) 的 T1 补记）。
> · **C0 已实测**（原第 2 条）—— 同一份产物挂到零 Expo 的裸 RN(Web) 宿主，27 项断言全过，
>   见 `examples/apps/host-swap-spike/`。**但结论有边界**：web 目标 + 零能力应用，
>   这两条边界写进了新的第 5 条。

---

8. **CI（C3）：✅ 2026-10-01 第一次绿了**（run `36888896799`，提交 `3e4a3fc`，全部步骤 success）。
   它此前**从未运行过**（提交一直没推），第一次跑就红，一共红了两次、两个真因：

   - **第一次跑的 4 条红门 → 真因是一条语法错误，不是警告。**
     `examples/apps/antd-demo/gallery.mbt:10` 用了旧式泛型写法 `fn cell[C : …](…)`，
     CI 那代 moon 判 **E3002 解析错误**（新写法 `fn[T] f`）；另外三条红门
     （`gen_forwarders` / 脚手架两条）只是**需要能编译**。
     上一轮把 `[0079]` 当嫌疑犯是**猜错了方向** —— 那次是"322 warnings, **1 errors**"。
   - **怎么拿到的**：不再求 CI 日志（job log 走 API 403），而是**在本地把 CI 那代工具链装出来**
     （Windows 也有 `latest` 的 zip）：`0.1.20260920 (914d7da)`，用它**一行不差**复现了 CI 的报错形状。
     复现配方写在 [`FINDINGS.md`](FINDINGS.md) 的 CI 收口补记里。
   - **修法**：改那一行语法（**不钉工具链** —— 实测带日期的路径全 403，bucket 只有 `latest`/`nightly`；
     何况用户拿到的就是 `latest`，库必须在新工具链上能编）。**新旧两代各跑一遍离线全集，都是 16 / 16**（§2.1）。
   - **第二次跑的 2 条脚手架门 → 真因在"依赖的形态"，不在代码。**
     `file:` 依赖在 **Linux 上是软链**（真身 = 仓库源码）→ `core.js` 里的 `import 'react'` 从仓库那层
     往上找、必然找不到；在 **Windows 上是拷贝** → 就在装着 react 的 `node_modules` 里。
     ⇒ 同一份代码本机 16/16、CI 红。修法是 `tools/verify_headless.mjs` re-exec 加 `--preserve-symlinks`。
   - **两处出口也修了**（真因都不难，难的是"出口给的信息不指向它"）：`verify_all.sh` 失败时
     **先打错误行**（带 3 行上下文）再打尾巴；CI 的 annotation 顺序改成 **门名 → 错误行 → 尾巴 → 工具链版本**。
     **第二次红就是靠它一步定位的** —— 第一次红只能看到一串警告尾巴。
   - ⚠️ 顺带修掉一个**对使用者成立**的坑：`todo-app/host/package-lock.json` 里两条 404 的
     `resolved` URL 会让**任何新鲜克隆的 `npm install` 挂掉**（修法验过 integrity 一致）。
   - ⚠️ **仍未解决（记在这里，别当已做）**：① 新工具链下 `moon check` 有 **322 warnings**，
     其中 **238 条是 `implicit_impl_as_method`**（官方说将来会从警告**变成错误**），
     243 条落在 `vendor/rabbita/**`（我们的 fork，得走 patch 流程）；
     ② **`check_npm_fresh` 在 CI 上是空的** —— 副本是软链时它比的是"源码 vs 源码"，恒等，
     只有本机（真目录）才有意义（见 FINDINGS 的 CI 第二次红补记）。

---

> **2026-10-23 晚：9–12 是新一轮清点补记的**（起因：问"现在到底还差什么"）。
> 排序**只在它们内部成立** —— 上面 1–8 保持原样，不动旧结论。

9. ★ **"行为"那一层没有自动判据**（唯一一条"结构性"的空白，其余都是欠账）。
   量化（2026-10-23 实测）：`press:` / `pressStyle` 在**全仓库零判据**（⚠️ 这条当晚已补：
   `tools/press_order_check.mjs` 10 项）；应用的样式判据形状是 `>= 1`（"有没有元素拿到这个属性"）；
   而**真正看得见的证据**（真机 **39/39**、web **107/107** —— **原先写真机 35/35**，那是第二十七轮的读数，
   当晚长到 39）**全是手跑的，不进 CI**。
   ★ **当晚的进展**：`fontWeight` 这一档从"一条都没有"变成**两端都有**（web 读计算样式 4 条、
   真机量笔画粗细 3 条，两侧都做过证伪）—— 但 `fontStyle` / `textAlign` / `textTransform`
   **仍然是零**。⇒ 这个仓库反复栽的恰好全是这一类
   （手势通道三次、`page()` 没人挂、根上没滚动容器、文字键这次）——**唯一反复栽的东西，也是唯一没有门的东西**。
   **卡点**：要模拟器 + APK（`verify_android.py`），所以它排在"等拍板 / 等设备"那一档，不是技术上做不了。

10. ⚠️ **迁移报告（`MIGRATION.md`）的性质要重新定性**（2026-10-23 实测，**这条纠正了我当晚早些时候的判断**）。
    我先前把它归成"产物没同步"，实测下来它不是那一类：它 = **迁移当天的生成物 + 一段人手补记**
    （文件顶部那段 `⚠️ 本地补记（人手写的，不是生成器写的）`）；而 `styles/styles.mbt` 是
    "必须与生成器逐字同步"的产物 —— **两者不是一类东西**。
    实测漂移（`create --from-rabbita` 重跑进临时目录后逐行 diff，**223 行**）：
    §0 写 `18 类 / 357 处` 而现在是 `19 类 / 362 处`；`510 = 435 + 75` 而现在是 `510 = 439 + 71`；
    `34 项需要人工处理` 而现在是 `39 项`；类别表少一行 `click.on-view`。
    ⇒ **"让报告进对账"不是显然的解**：重新生成会**冲掉那段人手补记**，不重新生成数字就一直漂。
    要拍的是形态（生成区与手写区分开？加机器可读事实块？还是明确标成历史读数？）——见 PLAN §8.2 的 ④。
    ✅ **2026-10-23 夜拍板并做完**（第三十轮）：**分两区** —— 生成区每次重写、**手写区逐字节保留**；
    老格式（没有标记）**整份**保留进手写区并让人工搬走要紧的补记（不丢东西）。门是
    `tools/report_region_check.mjs`（15 项含证伪），而且**真跑过一次端到端**：
    在临时目录里 `create` → 往手写区注入一条补记 → `--force` 重生成 ⇒ 补记还在；
    证伪开关打开 ⇒ 补记没了。真报告 `examples/apps/zhouyi-reader/MIGRATION.md` 已转换，
    转换时自查过"旧文件 191 条非空行里只有我明确改的那 2 行不在新文件里"。见 §2.1 与 FINDINGS 第三十轮。

11. ✅ **2026-10-23 晚做掉**：**"源侧账本"有闭合判据了** —— 新门
    `tools/migrate_ledger_check.mjs`（**21 项**，含两组真证伪），把第十八轮那次**只读**人工清点
    （656 条声明逐条对账、无痕消失 0）变成每次生成都算一遍的东西：每条源声明落进一个**有名字的桶**、
    桶里的条目带 `file:line`，外加"算成已映射 ⇒ 至少给一条调用或一句说明"。
    顺带修掉三处实测到的"标志与事实打架"（`letter-spacing: normal` 算成"已映射"却零调用；
    单段带标签选择器的 `lost` 不认标签；同元素 `:hover` 被写成"打在后代上"的理由）。
    读数见 §2.1 那一行。⚠️ **剩下没做的**：报告（`MIGRATION.md`）仍然没有门（见 §4-10）。

12. ✅ **2026-10-23 晚做掉**：**有门了** —— `tools/style_platform_check.mjs`（**8 项**，含真证伪）。
    判据的形状是"**新键必须登记**"：库有、RN 没有 ⇒ 必须在表里写清 `why`（原生的事实）与
    `instead`（**对应物/替代路径**）；RN 哪天支持了它也会红（**表过期**）；iOS-only 那类单独一张表。
    RN 那一侧是**从装在本仓库里的真 RN 读的**（三份：0.83.10 / 0.86.3 / 0.87.1），**不是手抄的表**。
    "有没有对应物"逐个查过（**半有 / 部分有 / 真没有**三种都出现了），读数见 §2.1 那一行与
    [`FINDINGS.md`](FINDINGS.md) 第二十一轮。
    ⚠️ **仍未做的两条**：① ~~**没有自动合成 `borderStyle`**~~ ⇒ **2026-10-23 晚已做**（第二十九轮：
    `planBorderStyleFold` + 门 `tools/border_fold_check.mjs`；真机上读数从"实线 16 条"变成
    "虚线 22 条"，见 §2.1 那一行）；**折不动的那种情形仍然修不了**（几条边 style 不同 ⇒ 原生表达不了）；
    ② ~~**没有给 `numberOfLines` 加键**（`whiteSpace: nowrap` 的替代路径 —— 那是**加公开 API**，要单独拍）~~ ⇒ **2026-10-23 晚已做**（第三十轮拍板⑤：**只作显式键、生成器不自动折**；白盒 **110/110** + 平台门 **14/14**，见 §2.1 那一行）。⚠️ **端到端仍未验** —— 要等有应用真的用它。
    另：**真机已跑**（第二十七/二十九轮各补了真机判据）；§2.1 里"观感"那两列当初是读代码 + 读 RN
    登记表推的，现在其中"虚线→实线"那一条**有真机读数**了。

## 5. 维护这份文件的三条纪律

1. **只有跑过的命令才能写进 §2.1**，并写明日期；没跑的一律进 §2.2 并标"文档记载"。
2. **项数/分数变了的当天就改这里**，别去改别的文档 —— 别的文档只该有链接。
3. **别写"已完成"除非同条给了命令**（[`CONTRIBUTING.md`](../CONTRIBUTING.md) 的负面清单第一条）。
