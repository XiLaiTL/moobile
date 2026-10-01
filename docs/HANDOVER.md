# 接手须知（HANDOVER）

> 这份文件是给**刚拿到这个仓库的人**的：现在到哪了、马上该做什么、以及**哪些坑已经有人替你踩过**。
>
> ⚠️ **分数与现状不在这里** —— 一律看 [`STATUS.md`](STATUS.md)（唯一来源）。
> 这里只讲"怎么接手"：环境、命令、坑、以及**哪些话是有证据的、哪些还没有**。

---

## 0. 三分钟认识这个项目

moobile 是给 [rabbita](https://github.com/moonbit-community/rabbita)（MoonBit 的 TEA UI 框架）
**换渲染后端**的库：保留 `Model` / `Msg` / `update` / `view` 与 `@html` DSL，
把最后一跳从"操作 DOM"换成"**产出 React 元素**"。

于是同一份应用代码可以落在 **Web**（react-native-web）与 **Android / iOS**（react-native）——
**换的是宿主，不是应用**（这条机制叫"宿主是可替换件"，`ARCHITECTURE.md` 有分层说明）。

三层结构，改哪层就动哪个目录：

| 层 | 位置 |
|---|---|
| MoonBit 库 | 根包 + `style/` `sqlite/` `canvas/` `gesture/` + `vendor/rabbita/`（fork） |
| 宿主 npm 包 | `npm/moobile-host/`（`MOBILE_HOST` 契约、能力注册表、脚手架命令） |
| 示例应用 | `examples/apps/*`（`todo-app` 是长满了的那份，`template` 是脚手架真源） |

---

## 1. 你接手后的第一件事：把门跑一遍

```bash
bash tools/refresh_host_copies.sh     # ★ 先跑这个，见 §4-2（不跑的话下面那条门可能红）
bash tools/verify_all.sh              # 离线全集 16 项（本地约 20 秒）
```

两者都绿再往下走。**门红了先怀疑探针**，不要先改代码 —— 这个仓库里有好几条"红的是探针、
不是被测物"的实例，都记在 `docs/FINDINGS.md`。

需要本机资源的另外几条（不在上面那条命令里）：

| 要什么 | 命令 |
|---|---|
| 真机（Android 模拟器 + APK） | `python3 tools/verify_android.py` |
| 手势边界真机 | `cd examples/apps/gesture-edges && node device_check.mjs` |
| Web 端到端 | `bash tools/verify_all.sh --with-e2e`（要 Metro 在 8081 + 后端在 8787） |
| 发布前 | `node tools/package_check.mjs` + `bash npm/moobile-host/publish.sh --dry-run` |

---

## 2. 接手时**挂着**的东西（2026-10-01）

| 项 | 状态 |
|---|---|
| **1 个提交没推**：`557b342`（CI 补记 + 文档 + 两个工具提进 `tools/`） | 推送当时网络挡住（`github.com` 000），见 §4-1 |
| **CI 修到一半，仍红 4 条** | 已修好并推上去：workflow 补了 `vendor_sync --apply`（CI 每次都是**新鲜克隆**）、去掉 npm 安装那步的 `continue-on-error`。现在那两步都绿，但 `verify_all.sh` 里**仍有 4 条红 —— 全是"要 moon 编译"的门**。证据指向 **CI 的 moon 比 `DEV.md` 记的新**；**真正的 error 文本还没读到**（公开仓库 job log 走 API 是 403）。详见 §3-1 与 `FINDINGS.md` 的 CI 补记 |
| Metro | **已停**（交接时清掉了：占着 8081 会让接手的人拿到**别的应用**的 bundle，我这一轮就被坑过） |
| Android 模拟器 | `emulator-5554` **还在跑**（无害，真机门要用） |
| **CI 先搁置**（老板拍板"本地跑通就好"） | 它现在会**每次推送都挂个红叉**。想让它别再刷红：把 `.github/workflows/ci.yml` 的 `on: push` 去掉、只留 `workflow_dispatch`（一行的事）；**但请先读 §3-1 与 FINDINGS 的 CI 补记** —— 红的原因已经查清一半，别被它再骗一次 |

---

## 3. 立刻要做的三件事（按顺序）

### 3-1 CI：修到一半，**剩下这 4 条红需要一个能看日志的人**

**已修好并且推上去的两处**（`237f792` / `bc53f2c` / `52784e5`）：

1. workflow 补上 **`bash tools/vendor_sync.sh --apply`** —— `vendor/` 是 gitignore 的生成物，
   而 **CI 每次运行都是一个新鲜克隆**。缺这一步时 `moon check` 连包都解不出来，8 条门连锁红。
2. 去掉 npm 安装那步的 **`continue-on-error: true`** —— 否则"装挂了"与"门红"分不开。
   （顺带修掉一个**对使用者成立**的坑：lockfile 里两条 404 的镜像 URL 会让**任何新鲜克隆的
   `npm install` 挂掉**；修法验过 `integrity` 一致，并立了门 `tools/check_lockfile_urls.mjs`。）

**现在的状态**：`重建 vendor` 与 `Install host deps` **都绿**，`verify_all.sh` 仍红 **4 条**，
而且**全是"要 moon 编译"的门**：`moon check --target js`、`gen_forwarders --check`、
脚手架模板、脚手架承载真应用（其余 11 条全绿）。

**已有的证据链**（详见 `docs/FINDINGS.md` 的 CI 补记）：

- CI 的 `moon check` 日志里出现 `Warning (implicit_impl_as_method)` / `Warning: [0079]`
  （`vendor/rabbita/websocket/types.mbt:89` 的 `impl Show for Snapshot`），**本机不出现**
  ⇒ **CI 的 moon 比本机新**。
- 本机 `moon version` = `0.1.20260827`，而 **`DEV.md` 记录的就是这个版本** ——
  仓库自己声明了期望工具链，CI 却装 `latest`。
- `[0079]`（E0079）按官方文档是**默认开启的警告**，所以**未必**是让 `moon check` 失败的那一行。

**接着怎么做**：**先拿到那份 error 文本**。三条路，按省事排：

1. 打开运行页人肉看（公开仓库，任何人都能看到 job log）：
   `https://github.com/XiLaiTL/moobile/actions`
2. `python3 tools/ci_status.py <sha>` —— 读 annotation（**不需要认证**）。
   ⚠️ 只能拿到"门名 + 12 行尾巴"：**大 payload 会被 GitHub 丢掉**（试过塞 12000 字符，那一条没出现）。
3. 账号持有人用 token 走 REST：`GET /actions/runs/<id>/logs`。

**然后两条候选修法（都还没做）**：

- **钉住工具链**用到 `DEV.md` 那个版本。⚠️ 实测**安装脚本钉不住具体版本**：bucket 只提供
  `latest` 与 `nightly`，带日期的路径一律 403。要钉得另找分发渠道。
- **把代码升到能过新工具链**（E0079 那条要显式 `pub extend … with Show::{…}`）。
  ⚠️ 那处在 `vendor/rabbita/**` 里，而 vendor 是**生成物** —— 改动必须落成
  `tools/patches/*.patch`，再走 `--capture` / `--check`。

### 3-2 发一版（**需要账号持有人在 npm 上按 2FA**）

线上包落后于工作区，这是当前**最硬的阻塞**（`STATUS.md` §4-1）。实测核过的清单：

| 东西 | 线上 | 工作区 | 后果 |
|---|---|---|---|
| 月亮包 `XiLaiTL/moobile` | `0.2.2` —— **能装、能编、README 路径都对**（`tools/check_published.sh` 通过），但**没有 `canvas/` 与 `gesture/`**（拿一个只 import 这两个包的模块去 `moon check`，两个都报 `Cannot find import`） | 含未发布批次 | 发布用户拿不到画布与手势这两个包 |
| 宿主包 `moobile-host`（npm） | `0.2.0` —— tarball 只有 6 个文件，**没有 `init` / `build` / `libgen` / 模板** | 已有 | 用户 `npx moobile-host init` **会扑空**，S1「干净机器三条命令」不成立 |
| 契约版本 | 两边都是 `1`（自洽） | 两边都是 `2` | **必须同代发**：只发一边会让线上错配、启动即抛 |

⇒ 抬到 **`0.3.0`**（契约 `1 → 2` 是破坏性变更，策略见 `CHANGELOG.md` 头部），月亮包与 npm 包**同步抬**。

### 3-3 朝真实应用走：F1 + 拍决策点 3

- **决策点 3**（`PLAN.md` §6）：`interest/yi` 移植要不要做，以及做哪一档
  (a) 全做 / (b) 小步（跳过罗盘）/ (c) 暂停。**从立项起就没拍过板**，这是"最大的空白"。
  ⚠️ 成本判断已更新：原以为最贵的罗盘（Skia）**已经落地且真机验过**，所以 (b) 里"跳过罗盘"的理由少了一半。
- **F1 迁移动检**（`PLAN.md` §5.1）：扫一个既有 rabbita 项目、出一份"迁移还差什么"的报告。
  工具已落地（`tools/mbtools` 的 `migrate-scan`），**报告本身从没对着 yi 跑过**。
  它成本最低、不依赖任何东西，而且它能**用数据回答**决策点 3。
- ✅ 已落地：`tools/check_lockfile_urls.mjs` 已接进 `verify_all.sh`（**第 16 条门**，纯结构判据、
  不联网、已用诱饵证伪）。**理由**：这台机器的 npm 走 npmmirror，那个 bug 会**再次**把 404 的
  `resolved` URL 写进 lockfile，而症状是"新鲜克隆装不上、本机完全看不出来"。
- ✅ 已落地：`tools/ci_status.py`（读 CI 状态与 annotation，**不需要认证**）—— 见 §3-1。

---

## 4. 环境上的坑（都是实测踩出来的，别重新踩）

### 4-1 git：全局代理指向一个**没在跑**的本地代理

`~/.gitconfig`（**全局**）里 `http.proxy = https.proxy = 127.0.0.1:7890`，而那个代理常常没开。
于是 git 把所有远程操作都往死端口送，**报出来却像"连不上远端"**。当时可用的绕法：

```bash
git -c http.proxy= -c https.proxy= push --dry-run origin main   # 先干跑（验认证与快进关系）
git -c http.proxy= -c https.proxy= push origin main
```

另外实测：**`github.com` 的 HTTPS 有些边缘 IP 从这个网络走不通**（`20.205.243.166`、`140.82.121.4` → 000；
`140.82.113.4`、`20.27.177.113` → 200），而 `api.github.com` 一直通；
`github.com:22` 与 `ssh.github.com:443` 的 SSH **握手是通的**，但本机 `~/.ssh/id_rsa` 没在 GitHub 注册
（`Permission denied (publickey)`）。⇒ 长期稳的做法：**注册那把公钥，走 SSH**。

### 4-2 改了宿主包，要刷新 **7 份**副本

应用用 `file:` 依赖把 `npm/moobile-host` **复制**进各自的 `node_modules`。仓库里有 **7 份**副本，
改了源码不刷新的话，门会红；**更糟的是验证脚本会悄悄测旧代码**（真发生过：
一轮探测测的其实是老实现，线索是"两次跑出来一模一样"）。

```bash
bash tools/refresh_host_copies.sh     # 一次刷全部，刷完自动自查
```

### 4-3 新鲜克隆必须先重建 `vendor/`

```bash
bash tools/vendor_sync.sh --apply     # 见 §3-1
```

⚠️ 动了 `vendor/rabbita/**` 的规矩：**先 `--capture` 再 `--check`**（第三方目录是 gitignore 的，
`git status` 不会提醒你漏了回写），然后还要 `python3 tools/gen_forwarders.py`
（根上的转发包是从 vendor 的 `.mbti` 生成的名字清单）。

### 4-4 磁盘：重活要挪到 E:

D: 常年在 90% 以上，原生构建（Skia / reanimated / worklets / CMake）会把盘吃满，
而**报错完全不像磁盘问题**（`No space left on device`、`ninja: manifest 'build.ninja' still dirty after 100 tries`）。

```bash
bash tools/android_env_setup.sh --app examples/apps/<app>
powershell -NoProfile -ExecutionPolicy Bypass -File tools/link_builddirs.ps1 -App examples/apps/<app>
```

⚠️ 只能联**构建产物目录**；**`node_modules` 本身不能联**（`npm install` 会把联接换成真目录，
而且不同工具会看到不同路径，RN codegen 直接报 `this and base files have different roots`）。

### 4-5 别把宿主的 harness 一起杀掉

**不要** `Get-Process node | Stop-Process -Force` —— 这个仓库的宿主 harness（DSH）也是 node
（监听 3081），会被一起杀掉，表现是"会话掉线"。按端口找 PID：

```bash
netstat -ano | findstr :8081                       # 找 PID
MSYS_NO_PATHCONV=1 taskkill /PID <pid> /T /F       # 注意 MSYS 路径改写
```

⚠️ 顺带：**8081 上跑的 Metro 是哪个应用的**一定要确认 —— 我这一轮就撞上"8081 上其实是另一个应用的
Metro"，应用拉到了**别人的 bundle**，差点得出完全错误的结论。

### 4-6 其它几条（都在 `FINDINGS.md` 里有完整记录）

- `uiautomator dump` **失败时不会清掉上一次的 xml** → 读到陈旧界面就会得出错误结论。**每次 dump 前先删旧文件**。
- 真机 debug 包要 Metro + `adb reverse tcp:8081 tcp:8081`；冷启动要**轮询**，别用固定 sleep。
- MSYS 会把 `/PID`、`/sdcard/x`、`/c` 改写成路径 → 相关命令加 `MSYS_NO_PATHCONV=1`。
- `.ps1` 里**别写中文**（Windows PowerShell 5.1 按 GBK 读，会报"指向别处"的语法错）。
- lockfile 里可能被镜像源写入 **404 的 `resolved` URL** → 新鲜克隆 `npm install` 装不上
  （本机因 node_modules 已存在而看不出来）。判据：URL 尾巴必须是 `<registry>/<包名>/-/<末段>-<版本>.tgz`。
- 验证脚本**跑完全绿也要显式 `process.exit`**：不退出的进程会被超时杀掉，而**被杀的进程不执行清理**
  → 下次报 `EADDRINUSE`（看着像端口冲突，其实是上次没收尾）。

---

## 5. 干活的方式（这是这个仓库的规矩，不是建议）

`CONTRIBUTING.md` 有完整版，这里只留最容易违反的五条：

1. **先测再断言**。想不清就问："哪条命令的输出能证明这句话？" 没有就不写。
2. **有数字的地方就有命令**，且要能回答"**哪条命令、什么时候、是不是本轮跑的**"。
   本轮没重跑的一律标"文档记载"，不许混进实测 —— 所以**分数只写在 `STATUS.md` 里**。
3. **结论被推翻要留痕**：旧结论与推翻过程留在原处，不要悄悄改掉。
4. **不要为了让检查过而放宽断言**（那是把 bug 藏起来）。**也不要为了绿灯去改被测物**。
5. **不要在没跑验证的情况下说"已完成"。**

改动与必须跑的门 —— 对照表在 `CONTRIBUTING.md` §1。几条最容易忘的：

| 你改了什么 | 必须跑 |
|---|---|
| `npm/moobile-host/**` | `bash tools/refresh_host_copies.sh` → `verify_all.sh` |
| `gesture/` 或 `gesture-rn.js` | web 试金石 **+ 真机** 两套（有一条不变量在 web 上是对的、在原生上**原本是错的**） |
| `vendor/rabbita/**` | `--capture` → `--check` → `gen_forwarders.py` |
| 模板 / `npm/moobile-host/lib/**` | `template_check.mjs` + `scaffold_probe.mjs` |
| demo / `tools/template/deltas.txt` | `template_compare.mjs`（T1 同源门） |

---

## 6. 仍然**没有**验证的东西（诚实清单，别当成已做）

接手时最容易误解的就是这一类 —— 项目里凡"没验"的地方都写明了，别把它们当已完成：

| 项 | 状态 |
|---|---|
| **iOS** | **一次都没跑过**（仓库里所有真机证据都是 Android 模拟器） |
| **多指手势真机** | 只有 **web 证据**（`pointers=2`、`dx` 锁第一指）—— `adb shell input` 只能发单指 |
| 画布**文字字形** | `makeFont` 那条路**没上过真机**（图形绘制已验：真机 12/12 与 7/7） |
| 画布**坐标换算**（T3.5） | `devicePixelRatio` 换算未验 |
| **性能（D 轨道）** | **整条未开始** ⇒ 没有基线，也就没有"够好了"的判据 |
| 真机**"删除"链条** | `verify_android.py` 里两条**稳定失败**，且**不是新引入的** |
| C0 的 native 半 | 只验了 web 目标（`host-swap-spike` 27/27）；裸 RN **native** 宿主未跑 |
| I7 真浏览器样式实测 | 未做 |
| 元素自身在拖动中移动时的 `x`/`y` 语义 | **契约里还没写**（手势通道的已知边界） |
