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
| **CI 那一代的工具链**（"本机绿 ≠ CI 绿"的另一半） | 见 §3-1 的配方：装 `latest` 到 `.scratch/`，再拿它跑 `verify_all.sh` |
| 发布前 | `node tools/package_check.mjs` + `bash npm/moobile-host/publish.sh --dry-run` |

---

## 2. 接手时**挂着**的东西（2026-10-01）

| 项 | 状态 |
|---|---|
| **发版** | ✅ **2026-10-01 已发布并验证**（两个包都 `0.3.0`，契约两边都是 `2`；从 registry 从零走的用户路径真 Chrome **9 / 9**）。见 §1 与 §3-2 |
| **提交与推送：全部干净了** | ✅ **2026-10-01 已全部推送**：`origin/main` = `b8323c2`，工作区干净，`main...origin/main` 已同步（本轮 6 条提交 + 之前挂着的 2 条都上去了）。⚠️ 推送时**没用任何绕法** —— 直连当晚恢复了（见 §4-1），但那条"边缘 IP"的记录留着，因为它是**不稳定**的 |
| **CI 已绿**（2026-10-01 第一次通过） | 两次红的真因都不在"逻辑"上：① 一条**语法错误**（新工具链判 E3002）；② `file:` 依赖在 **Linux 是软链 / Windows 是拷贝**，导致 `core.js` 的 `import 'react'` 在 CI 上解析不到。两个都修了，run `36888896799` @ `3e4a3fc` → `success`。详见 §3-1 |
| Metro | **已停**（交接时清掉了：占着 8081 会让接手的人拿到**别的应用**的 bundle，我这一轮就被坑过）。10-01 那轮为验 S1 又起过一次，**验完已按 PID 关掉**（注意：**不能** `Stop-Process node` 一把梭 —— 宿主 DSH 也是 node） |
| Android 模拟器 | `emulator-5554` **还在跑**（无害，真机门要用） |
| ~~**CI 先搁置**（老板拍板"本地跑通就好"）~~ **→ 已经不用搁置了** | 它以前会**每次推送都挂个红叉**，所以当时考虑过把 `on: push` 去掉。**现在它绿了** —— 留着 `on: push` 就是白拿的回归门（每次推送自动跑一遍离线全集）。真要是哪天它又红，**先看 annotation 里的"错误行"**（那是 10-01 加上的出口，两次红的第二次就是靠它一步定位的）。 |

---

## 3. 立刻要做的三件事（按顺序）

### 3-1 CI：**真因已找到，修复已在本地做完（未推）** —— 剩下的是"推一次"

**一句话**：那 4 条红门不是 4 个问题，是**一条语法错误**。另外三条只是"需要能编译"。

**真因**（`examples/apps/antd-demo/gallery.mbt:10`）：

```
Error: [3002]
 10 │ fn cell[C : @html.IsChildren](name : String, children : C) -> @html.Html {
    │        ╰── Parse error, unexpected `fn f[T]`, you may expect `fn[T] f`.
```

CI 那代 moon 把**旧式泛型写法**判成解析错误；新写法是 `fn[T] f`。改法就这一行：
`fn[C : @html.IsChildren] cell(name : String, children : C) -> @html.Html {`。
连带红的 `gen_forwarders --check`（要跑 `moon info`）与脚手架两条门**随之全绿**。

**⚠️ 上一轮把 `[0079]` 当嫌疑犯 —— 那是猜错了方向**：那次 `moon check` 的收尾是
`Failed with 322 warnings, 1 errors`，**error 只有 1 个**。日志尾巴全是警告，是因为真因在更早的位置。

**怎么拿到的（这一条比结论更值钱）**：不要在 CI 日志上耗 —— 公开仓库的 job log 走 API 是 403、
运行页是 JS 渲染的。**改为在本地把 CI 那代工具链装出来**（Windows 也发 `latest` 的 zip）：

```bash
curl -fsSL -o moon.zip https://cli.moonbitlang.com/binaries/latest/moonbit-windows-x86_64.zip
curl -fsSL -o core.tar.gz https://cli.moonbitlang.com/cores/core-latest.tar.gz
unzip -q moon.zip -d <scratch> && tar xzf core.tar.gz -C <scratch> && mv <scratch>/core <scratch>/lib/core
MOON_HOME=<scratch> <scratch>/bin/moon.exe -C <scratch>/lib/core bundle --warn-list -a --all
# 再把 ~/.moon 的 registry/ cache/ 拷过去（否则依赖图解不出来），然后：
MOON_HOME=<scratch> PATH=<scratch>/bin:$PATH bash tools/verify_all.sh
```

装出来是 `0.1.20260920 (914d7da)`，`moon check` **一行不差**复现了 CI 的报错形状
（连日志尾巴那条 `impl Show for Snapshot` 警告都在同一位置）。

**判据（跑过的）**：`0.1.20260827`（工作区钉的）**16 / 16**；`0.1.20260920`（≈CI 的 latest）**16 / 16**。
⚠️ 删过 `_build` 再跑时，"antd 试金石"那条会红 —— 它要 `_build` 里已构建的产物，
**与本次改动无关**（新鲜克隆里它是 SKIP）。先 `moon build --target js` 即绿。

**为什么是"改代码"而不是"钉工具链"**：实测带日期的路径**一律 403**（`binaries/0.1.20260827/…`、
`cores/core-0.1.20260827.tar.gz` 都试过），bucket 只有 `latest` 与 `nightly`；
何况**用户从官网拿到的就是 `latest`**，库必须在新工具链上能编。详见 `FINDINGS.md` 的 CI 收口补记。

**还没做的**：推上去让 CI 真绿（本轮按用户指示"先别推，只在本地验完"）。推之前建议顺手把
CI 的失败 annotation 补一句 `moon version` —— 现在"CI 红了"能读到的只有门名 + 12 行尾巴，
而这次的教训正是**尾巴不指向真因**。

**仍未解决（别当已做）**：新工具链下 `moon check` 有 **322 warnings**，其中 **238 条
`implicit_impl_as_method`** 官方说将来会**变成错误**，243 条落在 `vendor/rabbita/**`
（我们的 fork，改动得走 `--capture`/`--check` → patch）。分布见 FINDINGS 的 CI 收口补记。

### 3-2 发一版 —— ✅ **2026-10-01 已发布并验证（这条不再是阻塞）**

接手时线上落后于工作区，那是当时**最硬的阻塞**；现在两个包都在线上是 **`0.3.0`**：

| 东西 | 发布前（接手时） | 现在（10-01 发布后，实测） |
|---|---|---|
| 月亮包 `XiLaiTL/moobile` | `0.2.2` —— 能装能编，但 **9 个公开包里缺 `canvas` `gesture`** | **`0.3.0`** —— `check_published.sh` 通过：9 个公开包**齐全**，README 的 import 路径对着线上这一版能编过 |
| 宿主包 `moobile-host` | `0.2.0` —— tarball 只有 6 个文件，**没有 `init` / `build` / `libgen` / 模板** | **`0.3.0`** —— 线上 tarball **35 个文件**，`lib/init.js` / `lib/build.js` / `bin/libgen.js` / 整套 `template/`（含 `template/.gitignore`）都在 |
| 契约版本 | 两边都是 `1`（自洽） | **两边都是 `2`**（线上 `core.js` 是 `export const CONTRACT = 2`）—— 已自洽 |

✅ **判据这次是真的成立了**：发布后**从 registry 上那两个包从零走了一遍用户的三条命令** ——
`npx moobile-host@0.3.0 init hello` → `npm install`（488 个包）→ `npm run build`
（`moon build` 用的是**线上**的 `XiLaiTL/moobile@0.3.0`，产物 `moobile.js` 629 KB）→ `npm run web`
→ **真 Chrome 9 / 9**（首屏「待办」、计数、输入回灌、点添加 → 「还有 1 件」、无 console 错误）。
明细在 `STATUS.md` §2.1（最后几条）。

**复现这套验证**（换一版发布后照做）：

```bash
bash tools/check_published.sh                    # 月亮包：默认跟 moon.mod 的版本走，缺公开包会红
bash npm/moobile-host/publish.sh --dry-run       # 宿主包：发布前的门（打包形态 10 项 + 泄漏）
# 发布（需要账号持有人）：
moon publish                                     # 先 moon login；可先 moon publish --dry-run 空跑
bash npm/moobile-host/publish.sh                 # 交互式；或 publish.sh 123456
# 发布后从零走一遍用户路径（本轮就是这么验的）：
npx moobile-host@<新版本> init hello --name hello && cd hello && npm install && npm run build && npm run web
# 再把浏览器断言跑上：node <repo外的> s1-local-run/probe-web.mjs http://localhost:8081/
```

⚠️ **发布日踩到的三个坑，都写进 `FINDINGS.md` 了，下次别再花时间**：
① npm 对**未认证**的 `PUT` 回的是 **404**（`Not found`），看着像包名写错 —— 其实是 `~/.npmrc`
   里那个 `npm_…` token 过期了（拿它问 `/-/whoami` 会得到 **401**）；
② 发布**成功**时服务端回 **202 = 异步受理**，npm 自己会说"may take a few minutes" ——
   实测 **约 6 分钟**后 `0.3.0` 才在 registry 上可见。**一分钟就去查会得出"没发出去"的错误结论**；
③ 本机默认的 **npmmirror 镜像没同步**（`npm install` 报 `notarget … ^0.3.0`）——
   官方源上已经有；按需同步：`curl -X PUT https://registry.npmmirror.com/-/package/<包名>/syncs`。

### 3-3 朝真实应用走：F1 + 拍决策点 3

- **决策点 3**（`PLAN.md` §6）：`interest/yi` 移植要不要做，以及做哪一档
  (a) 全做 / (b) 小步（跳过罗盘）/ (c) 暂停。**从立项起就没拍过板**，这是"最大的空白"。
  ⚠️ 成本判断已更新：原以为最贵的罗盘（Skia）**已经落地且真机验过**，所以 (b) 里"跳过罗盘"的理由少了一半。
- **F1 迁移动检**（`PLAN.md` §5.1）：扫一个既有 rabbita 项目、出一份"迁移还差什么"的报告。
  ⚠️ **这里原来写着"报告本身从没对着 yi 跑过" —— 2026-10-01 复核：那句话是错的。**
  报告**跑过**（`docs/STATUS.md` §2.1 与 `FINDINGS.md` 的 F1 补记都记着 09-21 那次：
  6 文件 / 3139 行、15 类命中数与人工清点逐项一致），刚才又重跑了一遍，逐项不变。
  本轮真正修掉的是**另一件事**：报告里那三句"下一步"**已经过期、在指错路**
  （说"手势通道尚未实现"、"画布真机未验、手势未做" —— 而这两条 10-01 都已落地并真机验过），
  已改成事实。见 `FINDINGS.md` 的 F1 坑四。
  ⇒ **F1 剩下的不是"跑报告"，是"用报告回答决策点 3"** —— 那需要人拍板。
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

> **2026-10-01 复核（推之前先看这段）**：
> - **直连仍然是 000**（`curl https://github.com/…` 12 秒超时）；`api.github.com` 照常通 ——
>   所以**读** GitHub（CI 状态、annotation）没有障碍，卡住的只有 **push**。
> - `140.82.113.4` 是好的：`curl --resolve github.com:443:140.82.113.4 https://github.com/XiLaiTL/moobile`
>   → **200、372 KB、4.3 秒**。`20.27.177.113` 也 200 但**很慢**（12 秒收不到字节）。
>   ⚠️ 12 秒的超时**不够**，会被误判成"这个 IP 也不通" —— 加长到 60–90 秒再判。
> - **系统的 hosts 文件可写、不需要提权**（本轮实测追加成功并已还原；路径就是 Windows 那个
>   `<SystemRoot>\System32\drivers\etc\hosts`），所以"临时加一条 `140.82.113.4 github.com`
>   → push → 撤掉"是可行的。**动手前先用上面那条 `--resolve` 确认 IP 当下是通的**（边缘 IP 会变）。
> - 换个更干净的绕法（不动系统文件）：写个本地 CONNECT 代理，把 `github.com` 转到那个 IP，
>   再 `git -c http.proxy=http://127.0.0.1:<port> push`。本轮没做，留作备选。
> - ✅ **当晚直连恢复了**（`curl https://github.com/` → **200**），于是那两次推送**没用任何绕法**，
>   就是 `git -c http.proxy= -c https.proxy= push`。但**别据此认为它一直通** ——
>   这条网络是**时好时坏**的，所以"边缘 IP + hosts"的操作留在上面当备选。

### 4-2 改了宿主包，要刷新 **7 份**副本

应用用 `file:` 依赖把 `npm/moobile-host` 装进各自的 `node_modules`。仓库里有 **7 份**副本，
改了源码不刷新的话，门会红；**更糟的是验证脚本会悄悄测旧代码**（真发生过：
一轮探测测的其实是老实现，线索是"两次跑出来一模一样"）。

```bash
bash tools/refresh_host_copies.sh     # 一次刷全部，刷完自动自查
```

⚠️ **但"复制"只是 Windows 的行为**：Linux/macOS 上 npm 把 `file:` 依赖装成**软链**，
副本永远"新鲜"（也就不可能漂）。这不是好事 —— 它让 `check_npm_fresh` 在那些平台**恒真**，
还让 `core.js` 的 `import 'react'` 按**仓库源码**那一层解析（CI 第二次红就是这个，
见 `FINDINGS.md` 的 CI 第二次红补记）。

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
