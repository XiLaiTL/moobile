# CONTRIBUTING —— 怎么改这个仓库

给三类人看的三件事：**怎么跑起来**（[`DEV.md`](DEV.md)）、**怎么验证**（下面第一节）、
**写东西的规矩**（第二节）。第一类只有一条命令，先记住它。

---

## 1. 改完必须跑什么

```bash
bash tools/verify_all.sh              # 离线 20 项（清单见 AGENTS.md §2；分数见 docs/STATUS.md）
bash tools/verify_all.sh --with-e2e   # 再加 Web 端到端 3 项（需要 Metro + 后端）
python3 tools/verify_android.py       # 真机 27 项（需要模拟器 + APK，不进 CI；当前 25/27）
```

**改了哪一块，至少跑哪几项**：

| 你改了什么 | 必须跑 |
|---|---|
| 库本体（根包 / `style/` / `sqlite/`） | `verify_all.sh`；动了渲染路径再加 `--with-e2e` |
| `vendor/rabbita/**`（fork 代码） | **先 `tools/vendor_sync.sh --capture`，再 `--check`** —— 第三方目录是 gitignore 的，`git status` 不会提醒你漏了回写 |
| 重建第三方（新克隆 / 换版本） | `tools/vendor_sync.sh --apply` → `verify_all.sh` 全跑 |
| demo / 宿主（`examples/**`） | `--with-e2e`；动了原生侧再加 `verify_android.py` |
| **模板（`examples/apps/template/`）或生成器（`npm/moobile-host/lib/**`）** | `node tools/template_check.mjs` + `node tools/scaffold_probe.mjs`（`verify_all.sh` 里那两条门就是它们）。**模板是"用户会拿到什么"的唯一真源**，改它必须让这两条门全绿 —— 生成物编不过、跑不起来、名字没换干净，都在这里红 |
| **demo（`examples/apps/todo-app/`）或 `tools/template/deltas.txt`** | `node tools/template_compare.mjs`（T1：生成物与 demo 的差异逐条对着清单判）。**模板与 demo 是"同源"关系**，改任何一边都可能让两边漂开 —— 漂了就红。⚠️ 加一条清单**不是**"修好"：先问那处差异是不是真该存在（清单越长说明这条路越没走通）。改了比对器本身再加跑 `bash tools/template_compare_falsify.sh` |
| **宿主 npm 包（`npm/moobile-host/**`）** | `bash tools/refresh_host_copies.sh`（**先跑这个**：仓库里有 7 份 `file:` 装出来的副本，不刷新的话门会红，更糟的是**验证脚本会悄悄测旧代码**）+ `bash tools/verify_all.sh`（里面有"副本新鲜度"与"注册表一致性"两条）+ **`node examples/apps/host-swap-spike/verify.mjs`** —— 后者是 C0 那条实测：换掉宿主（零 Expo）之后，同一份产物还能不能渲染 + 交互（要 Chrome 与该目录的 `npm install`） |
| **桌面宿主（`examples/apps/zhouyi-reader-desktop/**`）** | `node examples/apps/zhouyi-reader-desktop/verify.mjs`（**5 项**：`--platform windows` 打包 + 产物里有本应用的真串与宿主接线；**不需要 VS 工具链**）。⚠️ 动了 `App.js` / `metro.config.js` 之后要重跑；原生窗口本身要 VS 2026 + SDK 22621，见 `docs/design/DESKTOP-RNW.md` |
| **桌面（Electron）宿主（`examples/apps/zhouyi-reader-electron/**`）** | `node examples/apps/zhouyi-reader-electron/verify.mjs`（**17 项**：起**真窗口** → 用 `PROBE_CDP_URL` 把应用那 97 条判据**附着打上去** → 再起一个小窗口验响应式）。⚠️ 三个反直觉的点：① **隐藏窗口会被 Chromium 降频**（判据"点击慢一拍"）⇒ `main.js` 里那四个开关不能删；② 判据里"点完等页面变化"（`clickAt` 的 settle）不是保险丝，**换宿主时它是必需的**；③ `Page.captureScreenshot` 在隐藏窗口上**永不返回** ⇒ 截图必须有硬超时，否则汇总行都打不出来 || **静态 Web 宿主（`examples/apps/zhouyi-reader-webview/**`）** | `node examples/apps/zhouyi-reader-webview/verify.mjs`（**15 项**：esbuild 打成静态站点 → 起静态服务 → **把 `../zhouyi-reader/verify.mjs` 那 45 条界面判据原样指向它**；要 Chrome 与本目录的 `npm install`）。⚠️ 它不覆盖 PWA / Tauri / Electron 外壳本身。⚠️ 动它之前先看它的注释：**别用 `spawnSync` 调子进程** —— 静态服务跑在本进程里，同步调用会把事件循环堵死（页面永远加载不出来，而门"只是很慢"） |
| **宿主表 / 宿主文件集（`npm/moobile-host/lib/hosts.js`、`hosts/**`）** | `node tools/host_probe.mjs`（**32 项**，在 `verify_all.sh` 里；原名 `desktop_host_probe.mjs`）—— 它守的是「**换宿主不改应用**」：**三个**宿主（expo / rnw / webview）生成物的 `moon.mod`/`moon.pkg`/`app.mbt` 必须逐字节相同，另外还盯 webview 那三处"定义"（依赖表无 expo/RN、入口不 import expo、`build-web.mjs` 里那行 `alias`）与"模板专属文件要 `drop` 掉"。⚠️ 新判据**必须过 `code()` 助手**（只认代码行）—— 这几份文件的注释里正大光明地写着 `from 'expo'`、`react-native-svg`，grep 全文会假红（本仓库栽过三次）。⚠️ 往宿主文件集里加文件时注意：**`npm pack` 永远不打 `.gitignore`**，所以那份真源叫 `gitignore`（无点），由 `init` 写成 `.gitignore`（加完跑 `bash tools/refresh_host_copies.sh` 与 `node tools/check_npm_fresh.mjs`） |
| **迁移工具（`npm/moobile-host/lib/migrate/**`：扫描 / 样式 / 装配器 / **生成物自查**）** | `node tools/migrate_scan_reconcile.mjs`（JS 版与 MoonBit 版两份扫描器必须**逐 finding 逐 hit 一致**，在 `verify_all.sh` 里）+ **`node tools/migrate_click_scan.mjs`**（13 项：诱饵项目钉住新规则 `click.on-view` 的**期望命中**（含负例 `button`/`a`/`on_clicked`）+ 两侧实现逐 hit 对账；**改这条规则必须给诱饵补一行**，否则"永远返回 0 条"的实现也能过）+ **`node tools/migrate_app_audit.mjs`**（13 项：真实应用必须干净、已记录的例外逐条点名、**5 个故意做坏的样本必须点名** —— 动了 `app-audit.js` 就重跑它，并且**别忘了给新判据加坏样本**："永远返回空数组"的检查器能让所有真实应用都绿）+ `bash tools/verify_all.sh`。⚠️ 动了扫描规则**两边都要改**，只改一边那条门就红（这是刻意的：迁移报告的判据一直挂在 MoonBit 那份上）。⚠️ 预览生成物用 `create … --dry-run`，**别对着已经手工移植过的应用 `--force`**（那会把人工改动盖掉） |
| **迁移过来的真实应用（`examples/apps/zhouyi-reader/**`）** | `npm run build` + Metro（`npx expo start --web --port 8081`）→ `node verify.mjs`（真 Chrome **99/99**：底部三块折叠 21 条 + 详情页五个折叠族与三个状态族 36 条）+ `bash tools/verify_all.sh`。⚠️ 这个应用的数据是**编译期嵌进产物**的（`data_reader.mbt`，由 `assets/reader_data.json` 生成）—— 换了数据要重新生成。**动了宿主的画布/手势接线**（`App.js` / `canvas-native*.js`）还要跑真机：模拟器起来 + Metro 在 8081 → `node examples/apps/zhouyi-reader/device_check.mjs`（**29 项**；它用的**是本应用自己的 APK**，因为 Skia 是原生依赖、借不到别人的壳） |
| **宿主 npm 包要发版** | `bash npm/moobile-host/publish.sh --dry-run`（打包自检：`files` 白名单 + **包内模板齐全** + **打包形态自检**（真装一遍、用装好的 CLI 生成一个项目）；泄漏自检）。⚠️ `.gitignore` 这条踩过两次：`files` 里**必须单独列** `template/.gitignore`（不列，tarball 里一个 ignore 文件都没有），而**列了也不够** —— `npm install` 解包时会把它**改名成 `.npmignore`**，所以最后能不能到用户手里取决于 `init`（它现在负责还原）。详见 [`docs/FINDINGS.md`](docs/FINDINGS.md) 的 2026-09-21 补记 |
| **改了 `npm/moobile-host/**` 之后** | ⚠️ 除了 `refresh_host_copies.sh`，**还要重启 Metro**（`--clear`）：Metro 会缓存模块解析与转换结果，**不重启的话你测的是旧代码** —— 而症状是"改动看起来完全没生效"（本轮实测：宿主修好之后真机仍然全红，重启 Metro 才见真章）。同一个坑的另一半见 `HANDOVER.md` §4-2 |
| **手势通道（`gesture/` 或 `gesture-rn.js`）** | web：`node examples/apps/gesture-spike/host/verify.mjs`（40 项，含边界 20 项）；真机：`node examples/apps/gesture-edges/device_check.mjs`（18 项，要模拟器 + Metro + APK）。⚠️ **两端都要跑**：契约里那几条不变量里有一条（`x/y` 的参照系）在 web 上是对的、在原生上**原本是错的**，只跑一边看不出来 —— 见 `docs/FINDINGS.md` 的手势边界补记 |
| **组件库生成器（`npm/moobile-host/libgen/**`）或某个应用接的组件库** | `node tools/libgen_probe.mjs`（**假包探针 24 项**：假包 + 四条负例，离线、不装任何包 —— 生成器自己的规则就靠它守）；改完再跑对应应用的 `npx moobile-host libgen --check`（`antd-demo` / `chat-app`；**手改生成物与忘了重跑都在这条红**）。⚠️ 改了 `resolve.js` 的解析规则**务必重生一遍 `antd-demo` 并编译它**（`cd examples/apps/antd-demo && moon build --target js`）—— 它是 71 个组件的试金石，洞一那轮就是靠它撞出两处调用要补 `([] : Array[@html.Html])` |
| **markdown / 组件内容通道（`content`、`defaultExports`）** | 无头 `node examples/apps/chat-app/verify.mjs`（22 项）+ **真机** `node examples/apps/chat-app/device_check.mjs`（17 项）。⚠️ **两端都要跑**：内容"以什么形态到达组件"这件事，**web 的 interop 与 Hermes 不一样**（`defaultExports` 那个坑就是只在真机露头） |
| 准备发版 | 下面 §3 |

---

## 2. 写东西的规矩（负面清单为主）

这个仓库的文档问题历来是"读起来像聊天记录"：结论先行、没有证据链、口语与 emoji 混用。
所以规矩尽量写成"**不要做什么**"：

**不要**

- 不要写"已对齐 / 已验证 / 应该没问题"——**除非同一条里给了可复现的命令或输出**。
  反例：`app.mbt` 里曾长期写着一句"签名与 `rabbita.elmish` 对齐"，而实际上 `update`
  既不返回 `Cmd` 也没有 `subscriptions?`。假注释的危害是**迁移者最先读到它**。
- 不要把"没做过"说成"做过"。没有证据就写"未实测 / 未查证"，并说清怎么才能测。
- 不要只写机制不写**为什么**。例如"fork 铺在 `vendor/rabbita/`"要带上原因
  （`internal` 的可见性只认路径段）与**被推翻的旧结论**。
- 不要在文档里贴没有上下文的大段代码。要贴就贴"能直接跑"的，或"被测过的那几行"。
- 不要用 emoji 当标题的装饰；它们只用来标**状态**（✅ 已落地 / 🟡 部分 / ❌ 不可行）。
- **不要把"我们的验收进度"写进 `README.md`**：它是**使用者**的第一屏（也是 mooncakes 与 npm 的落地页），
  只该回答"这是什么 / 给谁用 / 怎么装 / 代码长什么样"。门数、分数、`R2` 这类编号、内部项目名
  一律写在 `PLAN.md`（进度快照）与 `docs/FINDINGS.md`（实测）。
  这条是**踩过才写的**：README 曾有一整段"四道门全绿：27/27、14/14…"，几周后就过期了
  （真机早就是 21/21），既误导使用者又暴露内部节奏。
- 不要把计划写成愿望清单：每条要有**判据**（成功长什么样、怎么验）。

**要**

- 内部文档（`PLAN.md` / `DEV.md` / `FORK.md` / `docs/**`）用中文；对外（`README.md` 首屏、
  npm 包的 README、registry 描述）中英兼顾。
- 踩过的坑写进 [`docs/FINDINGS.md`](docs/FINDINGS.md)，**带上真因与解法**，不要只写现象。
- 断言的粒度要**能抓住设计错误**。例子：同步链路那条"新条目必须是**负 id** 且 `dirty = 1`"
  抓出了一个真 bug（新条目被算成正 id，于是被当成"服务器已有的行"去 PATCH，404）。
  如果只断言"界面上多了一条"，这个 bug 会漏到线上。
- 文档结构见 [`docs/README.md`](docs/README.md)（使用者 / 贡献者 / 维护者三类）。

---

## 3. 发版

```bash
# 0) 先过泄漏闸门：本机绝对路径 / 凭据绝不能进包（README 曾把维护者路径带进已发布的包里）
bash tools/py.sh tools/check_public_leaks.py
#    npm 包那边 publish.sh 会自动跑这一步

# 0.5) 打包，并**拿打出来的那份**验 README 的快速上手（这一步必须重打，不要用旧 zip）
moon package --list                                  # 出 zip：_build/publish/<模块>-<版本>.zip
bash tools/py.sh tools/readme_probe.py --zip _build/publish/XiLaiTL-moobile-<版本>.zip
#    为什么要有这一步：0.2.1 发出去之后才发现，随包发布的 README 让使用者 import
#    `XiLaiTL/moobile/html`，而那份包里根本没有这个包 —— 照 README 写的第一行就编不过。
#    发出去不可撤回，所以**打包后、发布前**必须先自己当一次使用者。

# 1) 月亮包（mooncakes）
moon publish

# 2) npm 宿主包（注意：本机默认 registry 是只读镜像，必须显式指向官方；账号开了 2FA 还要 OTP）
bash npm/moobile-host/publish.sh <6位码>

# 3) 发完从"用户视角"验一遍（默认验 moon.mod 里那一版；**两个包都验**）
bash tools/check_published.sh
```

⚠️ **两个包必须同代发**（契约 `1 → 2` 那次学到的）：只发一边会让线上是**错配的一对**，
用户挂载时同时报出两个契约版本号。第 3 步的**第 6 段**就是这条的探针 ——
它从**两个 registry** 各拉一份，比对 `host_contract_version` 与 `CONTRACT`，不一致直接红
（已用真实的错配组合证伪过：`check_published.sh XiLaiTL/moobile@0.2.2` → `契约 1 vs 2` → exit 1）。

⚠️ **发布不是"敲完就完了"**：npm 那边服务端回 **202 = 异步受理**，实测**约 6 分钟**后才可见，
而且本机默认的 **npmmirror 镜像会更晚**（这段时间 `npm install` 会报 `notarget`）。
所以第 3 步**要么等一会儿再跑，要么轮询** —— 别拿"刚查还是旧版本"当"没发出去"
（这坑 2026-10-01 踩过，全过程见 [`docs/FINDINGS.md`](docs/FINDINGS.md) 的发布日补记）。

**发布前必看**（发布不可逆）：

```bash
moon package --list     # 它会把要发的文件全列出来，也会真的写出 zip
```

⚠️ 这条清单**救过一次**：重写 `.moonignore` 时漏了 `/*.png`，三张 70 KB 的截图当场混进发布包；
发出去就收不回来了。同理 `moon.work` 这类开发用文件也要排除。

版本约定：`moon.mod` 的主版本必须是 `0`（CLI 硬性要求）；破坏性改动抬到下一个次版本
（0.1 → 0.2 就是 `mount` 签名 + 单导出那一次），见 [`CHANGELOG.md`](CHANGELOG.md)。
