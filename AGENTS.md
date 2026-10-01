# AGENTS.md —— 给 AI 协作代理的须知

人看的贡献指南在 [`CONTRIBUTING.md`](CONTRIBUTING.md)；这里是**代理容易踩、而人不太会踩**的那几条。
本仓库有大量工作是代理做的（R1/R2/R3 三轮实测都是），所以把规矩写下来是有回报的。

## 1. 先读哪三份

| 文档 | 为什么 |
|---|---|
| [`docs/README.md`](docs/README.md) | 三类读者三条路线 —— 先弄清你这次是"用库 / 改库 / 查历史" |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 改完必须跑什么、写文档的规矩（负面清单） |
| [`docs/FINDINGS.md`](docs/FINDINGS.md) | 已经踩过的坑与真因 —— **动手前先看，别重复踩** |
| [`docs/HANDOVER.md`](docs/HANDOVER.md) | **接手须知**：第一条该跑什么、挂着什么、环境上的坑、以及"还没验证"的诚实清单 |

**现状与分数只在一处**：[`docs/STATUS.md`](docs/STATUS.md)（已发布版本、各门的最近分数、每条轨道还剩什么）。
下面的项数**会变**，要数字就去那里看，别抄。

## 2. 验证入口（只记这一条）

```bash
bash tools/verify_all.sh              # 离线 15 项（编译 / 行尾 / 链接 / 泄漏 / vendor 一致 / 外部模块 / 转发包一致 / **宿主平台替代物** / **能力包平台矩阵** / antd 试金石 / **脚手架三条门：模板 / 承载真应用 / 同源 T1** / 注册表一致 / 副本新鲜度）
bash tools/verify_all.sh --with-e2e   # 再加 Web 端到端 3 项（需要 Metro + 后端）
python3 tools/verify_android.py       # 真机 27 项（当前 25/27，两条挂在既有问题上，见 docs/STATUS.md §2.2/§4-6；需要模拟器 + APK）
```

**改了什么就至少跑对应的那几项**（对照表在 `CONTRIBUTING.md` §1）。
动了 `vendor/rabbita/**` **必须**先 `tools/vendor_sync.sh --capture` 再 `--check` ——
第三方目录是 gitignore 的，`git status` 不会提醒你漏了回写。
动了 `vendor/rabbita/**` 之后还要 `python3 tools/gen_forwarders.py`（根上的转发包是从
vendor 的 `.mbti` 生成的名字清单；忘了重跑，消费者 import 的 `XiLaiTL/moobile/html` 会缺名字）

### 工具链正在从 Python 迁到 MoonBit

`tools/mbtools/` 是**独立嵌套模块**（不污染库的 `moon.mod`；`.moonignore` 排除了 `/tools/`），
经 `bash tools/mb.sh <子命令>` 调用。已迁：`cr-scan`（行尾）、`migrate-scan`（F1 迁移动检 ——
它扫的是**别的** rabbita 项目，判据与人工清点零遗漏已达成，见 `docs/FINDINGS.md`）。
迁移规矩：**新实现必须与旧实现逐行对账**（两边都有 `--mode list`），并做证伪测试
（塞 CRLF 诱饵 → 必须点名 + 非零退出）。

### 写 MoonBit 代码时：用 `moon ide` 查 API，别 grep 标准库

```bash
moon ide doc "String::*rev*"      # 精确列出方法签名（比 grep ~/.moon/lib/core 快且准）
moon ide outline <file|dir>       # 结构骨架
moon ide peek-def <symbol>        # 定义 + 上下文
```

## 3. 本仓库的硬性事实（代理最容易想当然的地方）

| 别想当然 | 事实 |
|---|---|
| "MoonBit 的 `internal` 按前缀判，所以 fork 必须铺在模块根" | ❌ **旧结论已推翻**：只认**路径段恰好等于 `internal`**；现在 fork 摊平在 `vendor/rabbita/`（见 `docs/FINDINGS.md` R3） |
| "加一层公开再导出包就能绕过 internal" | ⚠️ **分两半，别一句话概括**（旧说法"类型只能被命名、不能被使用"**过宽**，2026-09 实测更正见 `docs/FINDINGS.md` R7）：<br>· **消费者**（import 那个转发包）→ 命名 ✅ 调函数 ✅ 字段访问 ✅ 变体匹配 ✅<br>· **转发包自己**构造转发来的 struct → ❌ `Cannot create values of the read-only type`<br>· `pub using` **没有通配写法**（`{*}`/`{...}`/裸包名都不支持）→ 名字得逐个列，所以 `html/` 这种 400+ 名字的包靠**生成**（`tools/gen_forwarders.py`）；语法是 `pub using @pkg {type T, f, g}`（**不带 `fn` 关键字**，且要写在 `.mbt` 里、不是 `moon.pkg`） |
| "`demo/` 会在发布包里" | ❌ 不在。但**依赖声明是模块级且随包发布**：`moon.mod` 里写了什么，使用者就要下载什么（实测：声明了没人 import 的依赖照样被拉） |
| "`moon add` 会把包下载下来" | ⚠️ 依赖**已写在 `moon.mod`** 时它只说 "already exists, will not update it"，**下载发生在 `moon check`** |
| "本机 git 代理是通的" | ⚠️ `http.proxy=127.0.0.1:7890` 而代理常常没开 → `moon update` 失败，报的却是 `no version satisfies requirement …`（看着像"包没发出去"）。绕过办法见 `tools/check_published.sh` |
| "发布包 = 工作区" | ❌ 发布包是 `.moonignore` **过滤后的产物**。发版前**必须**看 `moon package --list` |
| "`moon build` 的 JS 产物路径可以写死" | ⚠️ **不能**：它取决于**模块在构建根里的身份** —— 工作区成员是 `_build/js/<profile>/build/<作者>/<模块>/<模块>.js`，独立模块（空目录里 `moon new`）是平铺的 `_build/js/<profile>/build/<模块>.js`。所以搬运一律走 `moobile-host build`（**发现**产物），别写死 `cp`（实测见 FINDINGS 的 E 轨道补记） |
| "`files` 白名单里写了就一定会发出去" | ⚠️ **`.gitignore` 是例外**：`npm pack` 永远不打它（即使列了 `template/`）→ 所以 `files` 里必须单独列 `template/.gitignore`。⚠️ **但列了也不够**（2026-09-21 实测）：`npm install` 解包时会把包里的 `.gitignore` **改名成 `.npmignore`**，所以用户 `init` 出来的项目**还是没有 `.gitignore`** —— 这条我们这边复现不出来，只有"真打包 + 真安装 + 用装好的 CLI 生成"才看得见（`tools/package_check.mjs`，发布前必跑）。收口在 `lib/init.js`：它**永远写出 `.gitignore`** |
| "web 上验过 = 真机也能跑" | ❌ **手势通道上三次栽在这条**（详见 `docs/FINDINGS.md` 的手势边界补记）：① Android 的 `onPanResponderGrant` 会被 RN **投机调用**（拿它的布尔返回值当判断，被拒时那个 `grant` 已经跑过了）—— web 宿主只在允许转移时才调，所以浏览器上**看不见**；② 原生的 `locationX/locationY` 是"手指底下**最深**那个 view"的、而且**会中途换**，契约要的"元素内坐标"得自己量原点；③ `onShouldBlockNativeResponder` 默认 `true` 会挡住原生 `ScrollView`。**改这条通道，web 与真机两套判据都要跑** |
| "改了 `npm/moobile-host/**` 就完了" | ⚠️ 仓库里有 **7 份** `file:` 装出来的副本。改完**先** `bash tools/refresh_host_copies.sh`（不刷新的话门会红，更糟的是**验证脚本会悄悄测旧代码** —— 真发生过，表现是"两次跑出来一模一样"） |
| "同步逻辑里 id 随便生成" | ⚠️ 本地新建必须是**负 id**（"服务器还不知道"的标记）。曾经用 `MIN(id)-1` 算成正 id → 被当成"服务器已有的行"去 PATCH → 404 |

## 4. 干活时的习惯

- **先测再断言**。想不清就问自己："哪条命令的输出能证明这句话？" 没有就不写。
- **改前先看 `docs/FINDINGS.md`**，改后把新踩的坑**带真因与解法**补进去（不要只写现象）。
- **报错的第一行不一定是真因**。R3 里我把 match 的**模式**写在主语位置，报的错却像可见性问题。
- **工具的产出要能自证新鲜**：`uiautomator dump` 失败时不会清掉上一次的 xml，读到陈旧 UI 会给出
  完全错误的结论；`pm clear` 会连 Metro 的 bundle 缓存一起清掉，冷启动要**轮询**而不是固定 sleep。
- **验证脚本要能识别"我拿到的是不是这次的"**，而不是无条件相信返回值。
- **断言粒度要能抓住设计错误**：只断言"界面上多了一条"会漏掉负 id 那类 bug。

## 5. 禁区

- 不要为了让检查过而放宽断言（那是把 bug 藏起来，注释里写清为什么放宽才算合格）。
- 不要在没跑验证的情况下说"已完成"。
- 不要往库本体的 `moon.mod` 加依赖（会连带所有使用者；先问"能不能放到独立模块里"）。
- 不要擅自 `git commit` / `git push`，除非用户明确要求。
