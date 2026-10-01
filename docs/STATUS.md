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
| 月亮包 `XiLaiTL/moobile` | **`0.2.2`**（mooncakes API 实测；description / keywords 已是新版） | `moon.mod` 里**还是 `0.2.2`**，但内容含**未发布批次** | 契约 `1 → 2`（破坏性）、组件库机制、`libgen`、脚手架——**都还没发** |
| 宿主包 `moobile-host`（npm） | **`0.2.0`**（2026-09-19 发布） | `package.json` 里**还是 `0.2.0`**，但已含 `core.js` 拆分、`lib/`（init/build/regen）、`libgen/`、模板 | ⚠️ **线上包里没有 `init` / `build` / `libgen`** —— 实测 tarball 只有 `LICENSE` / `README.md` / `bin/cli.js` / `capabilities/db.js` / `index.js` / `package.json` |
| **契约版本** | 线上两边都是 **`1`** → **这一对是自洽的**（不会互相拒） | 工作区两边都是 **`2`**（`app.mbt:13` 与 `npm/moobile-host/core.js:24`） | **下次发版必须 lib + host 同代发**，只发一边会让线上错配、启动即抛 |

**由此推出的三件事（发版前必看）**：

1. **版本号要抬**：契约 `1 → 2` 是破坏性变更 → 按 [`CHANGELOG.md`](../CHANGELOG.md) 头部的策略抬**次版本**，
   即 `0.3.0`；月亮包与 npm 包**同步抬**。
2. **`npm publish` 需要一次性密码（2FA）** —— 这一步只能由账号持有人做。
3. **不发布，S1「干净机器三条命令」就不成立**：线上包没有 `init`，用户 `npx moobile-host init` 会扑空；
   现在只能靠本地 `file:` 依赖兜（这也是 E 轨道当前最硬的阻塞）。

---

## 2. 门与分数

### 2.1 最近**实测**过的（每条带日期 —— 数字要能回答"哪条命令、什么时候、是不是本轮"）

| 门 | 命令 | 日期 | 结果 |
|---|---|---|---|
| 离线全集 | `bash tools/verify_all.sh` | 09-21 | **15 / 15 通过、0 失败、0 跳过**（约 20 秒；`--with-e2e` 再追加 Web 端到端 3 项，本轮未跑） |
| ↳ 其中「宿主平台替代物」 | `node tools/native_rn_check.mjs` | 09-21 | **15 项**通过（`visibility` / `geometry` 的形状、取整、不补发初始值） |
| ↳ 其中「能力包平台矩阵」 | `node tools/cap_platform.mjs` | 09-21 | 通过（29 个公开 API × 31 条 DOM 链路，「哪端可用 + 失效形态」齐全，漂了就红） |
| ↳ 其中「组件库接入（antd 试金石）」 | （在离线全集里） | 09-21 | **26 项**通过 |
| ↳ 其中「脚手架模板」 | `node tools/template_check.mjs` | 09-21 | **14 / 14** |
| ↳ 其中「脚手架承载真应用」 | `node tools/scaffold_probe.mjs` | 09-21 | **7 / 7**（探针剧本另 22 项） |
| ↳ 其中「**模板同源 T1**」 | `node tools/template_compare.mjs` | 09-21 | **15 / 15**（清单 26 条，死条目 0）—— 装上当天做过证伪 8/8 |
| ↳ 其中「无头界面验证」 | `node tools/verify_headless.mjs` | 09-21 | **10 通过 / 0 失败 + 1 SKIP**（订阅通道要 `--slow`） |
| **C0 换宿主**（新增） | `node examples/apps/host-swap-spike/verify.mjs`（要 Chrome + `npm install`） | 09-21 | **27 / 27**：同一份 `moobile.js` 在**零 Expo、零 Metro** 的裸 RN(Web) 宿主下渲染 + 四条交互都回到 `update`（`--with-e2e` 那一组里也会跑；缺 Chrome / 没装依赖记 SKIP，**不是** PASS） |
| **打包形态**（新增） | `node tools/package_check.mjs` | 09-21 | **10 / 10**：真打 tarball → 真 `npm install` → 用**装好的 CLI** `init`，断言用户拿到 `.gitignore`（就是这条抓出了 npm 解包改名那个 bug）。**发布前必跑**（`publish.sh` 调它），不进离线全集 |
| **canvas 通道**（新增） | `cd examples/apps/canvas-spike/host && node verify.mjs`（要 `npm install`，只有 `canvaskit-wasm`；含 `moon build`） | 09-21 | **32 / 32**：库包 `canvas/` 的 18 条指令 → JSON 载荷 → 宿主包的解码器/翻译器 → **真 Skia**（CanvasKit）出图。含**跨语言对账**：MoonBit 编出来的载荷与 JS 镜像程序**逐字节相同**、两份载荷各自出图**像素逐点相同（0/40000）**；罗盘 **384 个采样点**颜色逐一等于卦爻数据；另有 3 个证伪诱饵。⚠️ **只到"绘制语义 + 载荷契约"这一层**：真机上的 `<Canvas>` 组件挂载与文字字形**未验**，边界写在它的 `README.md` §5。不进离线全集（要 wasm 运行时），同 `host-swap-spike` |
| **手势试金石**（新增） | `cd examples/apps/gesture-spike/host && node verify.mjs`（要 Chrome + `npm install`） | 09-21 | **15 / 15**：真 Chrome + CDP 在 **RNW(web) 宿主**上真拖三盒对照 —— RNGH（默认 / `minDistance(0)`）与 `PanResponder` **都挂载成功、都给元素内坐标、位置都精确跟手（40px）**；RNGH 默认的 `translationX` **落后 20px**（激活阈值），`minDistance(0)` 后归位。⚠️ **只测 web 宿主**：原生、多指、JS 线程忙时的手感、与滚动容器的冲突**都未测**（见它的 README §6） |
| **canvas-demo · 真机**（新增） | `cd examples/apps/canvas-demo && node device_check.mjs`（要模拟器 + Metro + 已装 APK） | 10-01 | **12 / 12**：`画布 ops=13` · 品红 3798px / 绿 324px / 蓝 424px · **横滑 80px → `dx=80 dy=0 n=9`** · 蓝指针质心移动 **74.5px**（手势→Model→画布整条链）· 点按 0→1 · 证伪屏 token 全不变。⚠️ 过程中发现两个**对使用者都成立**的坑：原生依赖版本必须用 `npx expo install --check` 认的那套、这个组合下**必须**有 `babel.config.js`（Expo 文档说不用）—— 见 FINDINGS |
| **画布通道 · 真机**（新增） | `cd examples/apps/canvas-spike/host && node device_check.mjs`（要模拟器 + Metro + **临时接线的 APK**，见 FINDINGS） | 10-01 | **7 / 7**：`画布 ops=9` token + 截图里**品红 4016 px / 绿 1600 px**（真 Skia 画到 Android 屏上）+ 切到无画布那屏 **0 / 0**（证伪）+ 无 JS 致命错误。**过程中抓到我们自己的两个真 bug**：`installHost` 号称幂等其实会冲掉已注册组件、`registerLibrary` 的 `components` 只认数组（详见 FINDINGS） |
| **F1 迁移动检**（新增） | `bash tools/mb.sh migrate-scan --root ../yi/zhouyi_reader`（要 moon；被扫项目在仓库外） | 09-21 | 候选 **6 文件 / 3139 行**；**15 类命中数与人工清点逐项一致**（见 FINDINGS 的 F1 补记）。顺手照出**我们自己的错**：标签表文档写 42、真源是 **44**（已修 5 处 + 归档 1 处）。⚠️ 边界：判据是"对这 15 类、在这一个项目上零遗漏"，新失效形态要加规则 |
| ↳ 其中库包本身 | `moon test canvas` | 09-21 | **7 / 7**：载荷 JSON 逐字（18 条 op）、数字格式三条契约、字符串转义、`OpCtx` 18 个方法、`arc` 默认方向、节点接线（标签 + `ops`/`width`/`height` prop 落在 VNode 上） |
| ↳ 其中宿主包翻译器 | `moon test canvas` + canvas-spike 的形状组 | 09-21 | 指令→元素树逐条（整圆拆两段、无当前点时补 `M`、有当前点时补 `L`、`fill`/`stroke` 同路径两条、负例不许静默） |
| antd demo（生成物 + 交互 24 条） | `cd examples/apps/antd-demo/host && npm run check` | 09-21 | **24 / 24**；`--check` 一致 |
| **S1 本地代理**（新增） | 见 [`FINDINGS.md`](FINDINGS.md) 的 09-21 补记（`s1-local-run/probe-web.mjs` 是**仓库外**的一次性脚本） | 09-21 | 两段各 **9 / 9**：① 从**仓库布局**生成 → `npm install` → `npm run build` → `npm run web` → 真 Chrome；② 从**打包形态**（`npm pack` → `npm install <tarball>` → 用装好的 CLI `init`）同上。**发版仍是解锁"干净机器"的最后一步** |
| 组件库生成器读数 | `npx moobile-host libgen` | 09-20 | **71 个组件 / 65 个复合子组件 / 注册 136 个键 / 9317 个 prop（其中 4965 个进 DSL）**，抽取 ~0.6s；生成的 `components.generated.mbt` **12062 行**（`moon check` 0 错误） |
| 已发布包内容（npm） | `npm view moobile-host version` + 拉 tarball 列清单 | 09-20 | `0.2.0`，**无 `lib/`、无 `core.js`**（见 §1） |
| 已发布包内容（mooncakes） | mooncakes API 查 `XiLaiTL/moobile` | 09-20 | `0.2.2` |

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
| 真机 Android 14 | `python3 tools/verify_android.py` | 27 项，**25/27**（删除链路 2 条挂 —— **既有的**，见 §4 第 6 条）；可见性 3 条 + 尺寸 3 条（**精确数值**）全过 | 模拟器（AVD `moobile64`，**x86_64**）+ APK |
| 一键（含 e2e） | `bash tools/verify_all.sh --with-e2e` | 追加 Web 那三项 | Metro + 后端 |
| 发布后核对 | `bash tools/check_published.sh` | —— | 网络 + 已发布版本 |

---

## 3. 轨道进度

| 轨道 | 已落地 | 还剩什么 | 正文 |
|---|---|---|---|
| **A 治理** | 目录重排、文档分层、风格规则、CHANGELOG、CI | —— | [`PLAN.md`](../PLAN.md) §3.2 |
| **B 叙事** | description / keywords / README 首屏（registry 实测已是新版） | 要不要英文版 README（决策点 1） | §3.3 |
| **C 回归** | 安卓断言脚本、离线入口（15 项）、CI、**C0 宿主可替换性验证（09-21 ✅ 实测）** | **C2 那条"干净机器"的完整判据要等发版**（见 §1/§4） | §3.4 |
| **H 接入收敛** | 宿主收成 npm 包、单导出、注册表生成、fail-fast、契约校验 | H3（可选，已降级） | §3.7 |
| **N 原生能力** | `Cmd`/`Sub` 接线、真能力样板（expo-sqlite）、`@sub.every` 两端验过、**N2 能力通道两层都验过（`MOBILE_HOST.native` + `visibility`）**、**N5a 平台矩阵（29 API × 平台 × 失效形态，已进门禁）**、**N5b 3/4 有结论，其中 `on_visibility_change` 与 `on_resize` 真机验过（后者断言精确数值）** | N4 后半（`custom_sub` + 退订）、N6 文档、`clipboard`/`nav`/`dialog` 的处置（卡决策点 17） | §3.6 |
| **I 生态接入** | 机制 + I1 事件载荷 + I2/I3/I5 生成器（三份产物同源、`--check` 可 diff） | **I7 真浏览器样式**、I6 样式交集量化、I4 平台矩阵 | §3.8 |
| **E 脚手架** | 模板唯一真源、`init`、`build`（发现产物）、**三条离线门（模板 / 承载真应用 / 同源 T1）**、**打包形态门**（`package_check`，发布前跑；09-21 抓起 npm 解包改名那个 bug） | **发一版带 `init` 的宿主包**、`doctor`、E5/E6/E7、E8 接线 | §3.9 |
| **CAN 画布通道** | 设计定案（**不新开通道**：组件通道 + `prop_json`）、库包 `canvas/`（18 条指令 + `OpCtx` + `canvas()`）、宿主包两个入口（`canvas-ops` 纯翻译器 / `canvas-skia` React 桥）、本机真 Skia 验证 32 项、跨语言对账：载荷**逐字节相同** | **真机**（`<Canvas>` 挂载 + 文字字形，要 prebuild + 重建 APK）、**手势**（P3 T3.4）、**坐标换算/devicePixelRatio**（T3.5）、性能基线（D 轨道） | §3.6 补记 + [`design/DESIGN.md`](design/DESIGN.md) 阶段 4 |
| **GES 手势通道** | 库包 `gesture/`（`Gesture` + `Phase` + `attrs`/`pan`/`tap`，走既有事件载荷通道）、宿主包 `gesture-rn.js`（**默认装载**，PanResponder、零新依赖）、示例 `canvas-demo`（真机 12/12） | **多指 / pinch / rotate**（契约留了 `pointers`）、iOS、以及"JS 线程忙时的手感" | §3.6 / §7-19 |
| **F 迁移** | **F1 迁移动检**（`tools/mb.sh migrate-scan`；判据"与人工清点零遗漏"✅ 已达成） | F2 样式半自动、F3 指南、F4 `moon add` 提示；**E9 从此有了前置** | §5.1 |
| **D 性能** | D4 空样式短路（顺手做的） | D1/D2 基线、D3（表分成三档但查表仍是线性扫描）、D5、D6 | §4 |
| **G 真实应用** | —— | 全部（`interest/yi` 移植仍未拍板，见决策点 3） | §6 |

---

## 4. 现在最大的几处空白（按"卡不卡别人"排序）

1. **线上包没有 `init`/`build`** → S1 判据不成立、E 轨道卡住。**解它只需要一次发版**（+2FA）。
   ✅ 2026-09-21 补：**"干净机器三条命令"这条链路的本地代理已经两段全通**（仓库布局与打包形态各 9/9，
   见 §2.1），发版前又新抓了一个 bug（打包后 `init` 生成的项目的 `.gitignore` 被 npm 改名吃掉，
   已修 + 已有发布前门）。所以这条现在**只剩"上传"这一步**，不再是未知量。
2. **I7 没做** → M9 差的这半条正是"能不能在真浏览器里看样式"。
3. **D 整条未开始** → 没有基线，也就没有"够好了"的判据。
4. **没有任何真实应用的完整移植**（F1 未做、G 未拍板）—— 这是从立项起就没变过的最大空白。

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
7. **canvas 通道：真机"画得出"已验（10-01），仍差手势与文字字形**：`<Canvas>` 的**组件挂载 + 真绘制**
   已在 Android 模拟器上验过（`device_check.mjs` 7/7：token + 截图取色 + 证伪），Skia 原生库也确实链上了
   （`RNSkia: JniSkiaManager` 出现在 logcat）。**未验**：**文字字形**（`makeFont` 那条路没上过真机）、
   手势（T3.4）与 `devicePixelRatio` 换算（T3.5）—— 所以罗盘现在"**画得出**"，还"**拖不动**"。
   ⚠️ 另：这次验证用的是**临时接线**（把画布塞进 todo-app 做实验，验完回滚）——
   画布是**可选特性**（要原生依赖），按"库优先"它该有自己的示例应用，不该进模板。
   见 [`FINDINGS.md`](FINDINGS.md) 的真机补记与 `examples/apps/canvas-spike/host/device_check.mjs`。

> 2026-09-21 划掉两条：
> · **T1 比对器已装**（原第 2 条）—— 门 + 证伪都做了，见 §2.1 与 [`SCAFFOLD.md`](design/SCAFFOLD.md) §6；
>   清单本身也被机器核过一遍（手量首版**漏登 3 处、多登 1 处**，见 [`FINDINGS.md`](FINDINGS.md) 的 T1 补记）。
> · **C0 已实测**（原第 2 条）—— 同一份产物挂到零 Expo 的裸 RN(Web) 宿主，27 项断言全过，
>   见 `examples/apps/host-swap-spike/`。**但结论有边界**：web 目标 + 零能力应用，
>   这两条边界写进了新的第 5 条。

---

## 5. 维护这份文件的三条纪律

1. **只有跑过的命令才能写进 §2.1**，并写明日期；没跑的一律进 §2.2 并标"文档记载"。
2. **项数/分数变了的当天就改这里**，别去改别的文档 —— 别的文档只该有链接。
3. **别写"已完成"除非同条给了命令**（[`CONTRIBUTING.md`](../CONTRIBUTING.md) 的负面清单第一条）。
