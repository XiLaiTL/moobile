# DEV.md —— 开发环境与运行手册

> **给接手的人**：这份文档是自包含的。按 §1 → §4 走一遍就能把环境跑起来。
> 本机环境有几处**刻意的非常规布置**（磁盘几乎写满导致的），§2 解释为什么、
> 以及怎么重建。**动手改环境前先读 §7「禁区」。**
>
> 📌 **代码与文档同在一处**（2026-09 完成 T0.0 合并）：项目根就是本目录
> `interest/moobile/`，模块名 **`XiLaiTL/moobile`**。
> `tools/*.py`、`tools/*.ps1`、`tools/measure_r1.js`、`tools/verify_web.js` 里的路径已改成
> **从脚本位置推导**，不再写死盘符，换机器照样能跑。
> 目录联接（§2 那张表）不受影响。

---

## 1. 工具链

| 组件 | 版本 / 位置 | 备注 |
|---|---|---|
| MoonBit | `0.1.20260827 (d0aaa07)`，`~/.moon/bin/moon` | ⚠️ **工作区钉的是这一版，而 CI 装的是 `latest`** —— 两代都该绿，见下 |
| Node / npm | `v24.14.1` / `9.2.0` | registry 已指向 `https://registry.npmmirror.com/` |
| **JDK** | `D:/Program Files/Java/jdk-17.0.5` | ⚠️ **不要用 GraalVM**（Kotlin daemon 会卡死在 `compileKotlin`） |
| **Gradle** | **8.14.3**（wrapper，走腾讯镜像） | ⚠️ **不要升到 9.x**，见 §7 |
| Android SDK | `E:\Android\Sdk`（真实位置） | 原路径 `C:\Users\XiLaiTL\AppData\Local\Android\Sdk` 是目录联接 |
| AVD | `moobile64`，位于 `E:\avd` | Android 14 / x86_64 / 1080×2340 @440dpi |
| Expo / RN / React | `57.0.24` / `0.86.3` / `19.2.3` | |
| AGP / Kotlin | `8.12.0` / `2.1.20` | AGP 8.12 **要求 Gradle ≥ 8.13** |

> ⚠️ **工具链有两代，而且必须两代都绿**（2026-10-01 被 CI 咬过之后加的这一段）：
> CI（`.github/workflows/ci.yml`）用安装脚本的默认值 **`latest`**，而本机钉的是上表那一版。
> 差异会表现成**"CI 红、本机绿"**，而且读不到 CI 日志。当时的真因是新工具链把
> **旧式泛型写法 `fn f[T]`** 判成了语法错误（新写法 `fn[T] f`）。
> **办法：把 `latest` 装到 `.scratch/` 里，拿它把离线全集再跑一遍** ——
> 配方（含 Windows 上的三条坑）在 [`HANDOVER.md`](docs/HANDOVER.md) §3-1。
> **带日期的版本钉不住**：`cli.moonbitlang.com` 上只有 `latest` 与 `nightly`，
> `binaries/0.1.20260827/…` 一律 403（实测）。所以"让 CI 跟本机一致"这条路是**堵死的**，
> 只能让代码在两代上都能编。

### 每个新 shell 都要设的环境变量

```bash
source tools/env.sh     # 就这么简单 —— 下面几行已收进这个脚本
```

脚本里就是这几行，**别手敲**（漏 `ANDROID_HOME` 的表现是 Gradle 报
`SDK location not found`；漏 `JAVA_HOME` 的表现是 Kotlin daemon 卡死在 `compileKotlin`）：

```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_AVD_HOME='E:\avd'          # ← 不设它，`emulator -list-avds` 看不到 moobile64
export JAVA_HOME="/d/Program Files/Java/jdk-17.0.5"
# ⚠️ 不要设 GRADLE_USER_HOME —— 让 ~/.gradle 符号链接生效（指向 E:\BACKUP\.gradle）
```

---

## 1.5 全新 clone 后的第一步（第三方代码不在仓里！）

**第三方代码（rabbita fork）不进仓** —— 16 个目录在 `.gitignore` 里，
真相是 `tools/vendor.lock` 的版本 + `tools/patches/` 的 15 个 patch。
所以 clone 下来**直接 `moon check` 会报一堆"找不到包"**，那是正常的，不是环境坏了。

```bash
git clone <repo> && cd moobile
bash tools/vendor_sync.sh --apply     # 拉 rabbita@0.15.4 → 铺开 → 打 patch → 统一行尾
moon check --target js                 # 现在应当是 0 错误
```

之后跑验证（按需）：

```bash
bash tools/vendor_sync.sh --check     # 断言「工作区 == pristine + patch」（提交前/CI）
bash tools/lf_normalize.sh --check    # 行尾检查（CRLF 会把 patch 的上下文打乱）
bash tools/check_external.sh          # 外部模块可用性（不需要 Metro）
node tools/verify_web.js                        # Web 端到端 26 项（需要 Metro 在 8081）
```

**改第三方代码之后必须回写 patch**，否则改动会**静默消失**（那目录是 gitignore 的）：

```bash
vim internal/vdom/vdom.mbt             # 直接改
bash tools/vendor_sync.sh --capture   # 回写成 patch
bash tools/vendor_sync.sh --check     # 确认一致
git add tools/patches && git commit
```

细节与理由见 `FORK.md` §0–1。

---

## 2. 磁盘布局（为什么有这么多目录联接）

本机剩余空间：**C: ≈12G，D: ≈1.5G，E: 852G**。D 盘几乎写满，而 RN 的
Android 构建中间产物要好几 G。所以**能搬的都搬到 E 盘，并在原路径留目录联接**，
这样 adb / emulator / Gradle / Expo 全都不需要改配置。

| 原路径（照旧可用） | 真实位置 |
|---|---|
| `C:\Users\XiLaiTL\AppData\Local\Android\Sdk` | `E:\Android\Sdk` |
| `C:\Users\XiLaiTL\.android` | `E:\Android\dot-android` |
| `C:\Users\XiLaiTL\.expo` | `E:\Android\dot-expo` |
| `C:\Users\XiLaiTL\.gradle`（符号链接） | `E:\BACKUP\.gradle` |
| `host\android\build` | `E:\moobile-build\android_build` |
| `host\android\app\build` | `E:\moobile-build\android_app_build` |
| `host\node_modules\@react-native\gradle-plugin\build` | `E:\moobile-build\node_modules_@react-native_gradle-plugin_build` |
| `host\node_modules\@react-native\gradle-plugin\*\build`（4 个） | `E:\moobile-build\node_modules_@react-native_gradle-plugin_*_build` |
| `host\node_modules\expo-modules-autolinking\android\expo-gradle-plugin\build` | `E:\moobile-build\...` |
| `host\node_modules\expo-modules-core\android\build` | `E:\moobile-build\node_modules_expo-modules-core_android_build` |

**重建方式**（幂等，随时可重跑）：

```bash
bash tools/android_env_setup.sh          # 重设 Gradle 版本 + gradle.properties + 联接
bash tools/android_env_setup.sh --check  # 只检查，不改
```

> ⚠️ **`~/.gradle` 的符号链接是有意的**（把 Gradle 缓存放 E 盘），不是坏掉的环境。
> 早先它的目标 `E:\BACKUP\.gradle` 不存在才导致写失败 —— 建上目录就好，不要去覆盖它。

---

## 3. 日常开发流程

### 3.1 改 MoonBit 代码 → 看到效果

```bash
cd /d/ai_project/interest/moobile

moon check --target js        # 快速语法/类型检查
./tools/build.sh                    # moon build --target js + 拷贝产物到 examples/apps/todo-app/host/moobile.js
```

`tools/build.sh` 做的事只有一件：`moon build --target js`，再把
`_build/js/debug/build/examples/apps/todo-app/demo.js` 拷成 `examples/apps/todo-app/host/moobile.js`。

### 3.2 Web 预览（最快的一环）

```bash
cd host
npx expo start --port 8081
# 浏览器打开 http://localhost:8081
```

改完 MoonBit 后重跑 `./tools/build.sh`，Metro 会增量重建（**不要用 `CI=1` 启动**，
那会关掉 watch 模式）。

### 3.3 Android 真机（模拟器，带窗口）

```bash
# ① 起模拟器（带窗口，你能看见；去掉 -gpu auto 前的参数就是无头）
"$LOCALAPPDATA/Android/Sdk/emulator/emulator.exe" \
  -avd moobile64 -gpu auto -no-boot-anim -no-snapshot -no-audio &

# ② 等启动完成
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done

# ③ 让 app 能连到宿主的 Metro（关键！否则 app 里白屏）
adb reverse tcp:8081 tcp:8081

# ④ 构建并安装（只有原生侧变了才需要重来）
cd examples/apps/todo-app/host/android && ./gradlew assembleDebug
adb install -r /e/moobile-build/android_app_build/outputs/apk/debug/app-debug.apk

# ⑤ 启动 app
adb shell monkey -p com.anonymous.host -c android.intent.category.LAUNCHER 1
```

**只改 MoonBit / JS 时，④⑤ 不用重做** —— app 里已经有 dev 客户端，
重新 `./tools/build.sh` 后它在 Metro 上拉新 bundle 即可（app 内摇一摇 → Reload，
或 `adb shell input keyevent 82` 打开 dev 菜单）。

### 3.4 屏幕尺寸

AVD 的 `config.ini` 里已经设好真机尺寸（`hw.lcd.width=1080 / height=2340 / density=440`
= **392.7 × 850.9 dp**）。**不要用 `wm size` 覆盖** —— 一个真实的坑：

> `wm size 390x844` + `wm density 440` 得到的是 **142dp 宽**的逻辑屏（不是 390dp），
> 排版会全部挤在一起。390dp 宽的真机尺寸应该是 **1073×2321 @440dpi**。
>
> 如果已经设过覆盖：`adb shell wm size reset && adb shell wm density reset`

---

## 4. 验证脚本

**先记这一条**（其余脚本按需单跑）：

```bash
bash tools/verify_all.sh              # 离线全套（不需要 Metro/模拟器/后端）
bash tools/verify_all.sh --with-e2e   # 再加 Web 端到端三门
```

⚠️ 项数**别抄**（这里曾长期写着"6 项"，而实际早就不是了）—— 跑一遍看汇总行，
最近的分数见 [`docs/STATUS.md`](docs/STATUS.md) §2（唯一来源）。

真机与"已发布版本"两套**不进**这个入口（前者要模拟器，后者要发版之后）：

```bash
python3 tools/verify_android.py       # 真机 21 项（新增/完成/删除/离线落库/同步）
bash tools/check_published.sh         # registry 上那一版对外可用吗
```

| 脚本 | 验什么 | 前置 |
|---|---|---|
| `node tools/verify_web.js` | **Web 端到端 27 项断言**（渲染 / 结构化样式 / 点击过滤 / 勾选 / 输入回灌 / 新增 / 删除 / 不可移植节点=0 / 标签表覆盖=0 / 布局审计 / 订阅在跑） | Metro 在 8081 |
| `bash tools/check_published.sh [模块@版本]` | **已发布版本可用性**：在临时模块里 `moon add` + `moon check --target js`，证明 registry 上那一版对外真的能用（含能力包是否进了发布产物）。发版后跑 |
| `bash tools/check_external.sh` | **外部模块可用性**：在一个临时 `moon.work` 工作区里编译一个外部的 `probe/app`，证明别的模块能依赖 moobile + 公开的 `style/` | 无（不需要 Metro） |
| `node tools/measure_r1.js` | **R1 排版测量（web）** —— 用 `Range.getClientRects()` 数行盒 | Metro 在 8081 |
| `python3 tools/tap_r1.py` | 在**安卓**上点进 R1 屏并 dump 原生 View 层级（text + bounds） | 模拟器 + app 在跑 |
| `python3 tools/scroll_r1.py` | 在**安卓**上滚动并逐屏 dump 测量（6 个爻全部） | 同上 |
| `node tools/db_probe.js` | **本地库（expo-sqlite）8 项**：能力注册、契约形状（snake_case / JSON 字符串 / 布尔→0/1）、界面条数==库里行数、**刷新后仍在**（OPFS） | Metro 在 8081 |
| `node tools/sync_probe.js` | **同步链路 14 项**：拉取合并（服务器为准）、本地新增是**负 id + dirty**、推送后换成服务器 id、界面与服务器一致 | Metro + 后端在 8787 |
| `python3 tools/verify_android.py` | **真机 21 项**：原生 SQLite / 播种 / 订阅心跳 / 同步拉取合并 / **新增·完成·删除**各自「先只落本地 → 同步后服务器跟上」/ 界面与服务器一致。脚本**自己把状态清成确定的**（`pm clear` + 重置服务器），可反复跑 | 模拟器 `moobile64` + 后端 + APK 已装 |
| `node tools/console_dump.js` | **白屏排查**：把 console / exception / network-loadingFailed 三类事件原样打出来 | Metro 在 8081 |
| `node tools/template_check.mjs` | **脚手架模板门**：生成 / 替换干净 / 生成物能编能构建 / 无头跑起最小 Todo（T1b·T1c·T3·T3b） | 无 |
| `node tools/scaffold_probe.mjs` | **生成物撑得住真应用**：把"多文件 + 多页面 + 过滤"的应用覆盖进刚生成的项目里再跑 | 无 |
| `node tools/template_compare.mjs` | **模板同源 T1**：生成物与 `examples/apps/todo-app/` 的差异逐条对着 `tools/template/deltas.txt` 判，清单外即红 | 无 |
| `bash tools/template_compare_falsify.sh` | 证伪上面那条门（**会临时改工作区、跑完还原**，手动跑；不进 `verify_all`） | 无 |
| `node examples/apps/host-swap-spike/verify.mjs` | **C0 换宿主**：同一份 MoonBit 产物挂到**零 Expo、零 Metro** 的裸 RN(Web) 宿主上，真 Chrome 里断言渲染 + 交互 + 产物 sha256（27 项）。`--with-e2e` 那一组会跑它；缺 Chrome/依赖记 SKIP | Chrome + 该目录 `npm install` |
| `node tools/package_check.mjs` | **打包形态**：真打 tarball → 真 `npm install` → 用**装好的 CLI** `init` 一个项目，断言它拿到的是 `.gitignore`（npm 解包会把模板里的 `.gitignore` 改名成 `.npmignore` —— 详见 FINDINGS）。**发布前必跑**（`publish.sh` 会调它） | npm（要 registry）+ 网络 |

`tools/verify_web.js` / `tools/measure_r1.js` / `db_probe.js` / `sync_probe.js` 用无头 Chrome + CDP，不依赖 UI；
安卓那两个用 `uiautomator dump`，**不依赖 GPU 截图**，所以在无头模拟器上也能量。

### 后端（Todo 示例）

```bash
cd server && moon build --target native && ./_build/native/debug/build/moobile-todo-server.exe
# 监听 127.0.0.1:8787；状态落在 examples/services/todo-server/todos.json（写临时文件再 rename，原子替换）
```

Windows 上原生构建**需要 MSVC**：moon 自己用 `vswhere.exe` 找到 VS 2022 BuildTools，不用手动 vcvars。
`moon run --target native` **必须带包路径**（`moon run --target native .`）。
模拟器通过 `10.0.2.2` 访问宿主机（也可以 `adb reverse tcp:8787 tcp:8787`）。

⚠️ 服务端日志要用 `@stdio.stdout.write`，**`println` 是块缓冲的** —— 输出被重定向时日志会"消失"。

### 发布

```bash
moon publish                                  # 月亮包（mooncakes）
bash npm/moobile-host/publish.sh 123456   # npm 包（2FA 的一次性密码）
bash tools/check_published.sh                 # 发完再验一遍"外部视角能用"
```

⚠️ **本机的 git 代理陷阱**：`git config --global http.proxy` 指向 `127.0.0.1:7890`，
代理没开时 `moon update` / `moon add` 会失败，而报错是
`no version satisfies requirement …`（看着像"包没发出去"，其实是索引没刷新）。
绕过办法写在 `tools/check_published.sh` 里（`GIT_CONFIG_*` 清空 `http.proxy`）。

### 宿主 npm 包（`npm/moobile-examples/apps/todo-app/host/`）

```bash
cd host && npm install file:../npm/moobile-host   # 装本地副本
npx moobile-host regen                                  # 生成 registry.generated.js
```

**发布前建议先按 tarball 验一遍**（`npm publish` 上传的是 `files` 白名单过滤后的那份，
不是源码目录）：`npm pack` → 在 `examples/apps/todo-app/host/` 里 `npm install <tgz>` → 重启 Metro → 跑四道门。
`publish.sh` 里已经有"缺文件就拒绝发布"的自检。

⚠️ **两个必踩的坑**（都记在 `FINDINGS.md` 的 R2）：

1. `npm install file:...` 在 Windows 上是**拷贝**而非符号链接 —— 改了包里的代码要**重装一次**，
   否则浏览器里跑的还是旧副本；
2. **加了 npm 依赖之后必须重启 Metro**，否则页面整片空白、控制台一条错都没有（不是你的代码错）。

### 已产出的测量数据

- `docs/evidence/r1/style_gap.md` —— 样式层对 yi 的 198 条 CSS 的**差集账目**（0 未归类）
- `docs/evidence/r1/dom_survey.txt` —— `html/` + `svg/` 里 **45 处 `@dom.` 的逐条明细**
- `docs/evidence/r1/android_scroll_report.md` —— 安卓上 6 个爻的原生 bounds
- `docs/evidence/r1/yi_yao_css.txt` / `docs/evidence/r1/yi_root_vars.txt` —— 从 yi 抽出的真实 CSS 与配色
- `docs/evidence/r1/qian_yao.txt` —— 乾卦六爻的真实数据

---

## 5. 项目结构速览

```
moobile/                     ← 项目根（模块名 XiLaiTL/moobile）
├── moon.mod                 # 模块定义
├── moon.pkg                 # ★ 模块根包 = moobile 库本体
├── host.mbt render.mbt app.mbt store.mbt schedule.mbt
├── style/                   # ★ 公开包：类型化样式层（StyleValue / Style / 关键字枚举）
├── internal/rabbita/        # vendor 的 rabbita **主包**（App / run / Val / elmish）
├── internal/vdom/           # ★ vendor 自 rabbita，已改：Event 解耦、Props 加宽
├── internal/runtime/        # ★ react_host.mbt = moobile 的 React 后端（新增）
├── html/ cmd/ sub/ dom/ …   # vendor 自 rabbita（跟版方式见 FORK.md）
├── examples/apps/todo-app/                    # 演示应用：model / ui(待办) / r1(R1 样本) / main
├── examples/apps/todo-app/host/                    # Expo 宿主（React + RN + react-native-web）
│   └── App.js               # 一个根组件 + useSyncExternalStore，仅此而已
├── tools/verify_web.js tools/measure_r1.js        # 验证脚本
├── tools/                  # 环境脚本（见下）
├── docs/evidence/r1/                     # R1 的测量产出与原始数据
├── docs/                    # 设计文档：DESIGN / EVIDENCE / DESIGN-README / ARCHITECTURE
├── FORK.md                  # ★ 对 rabbita 的 diff 清单（跟版/上游化用）
├── PLAN.md                  # ★ 剩余工作计划
├── README.md                # 全部实测结论（含 R1 判决）
└── DEV.md                   # 本文件
```

> **`internal/rabbita/` 是什么**：vendor 的 rabbita **主包**（原来在模块根），
> 2026-09 的「形态 B」把它挪进去，为的是让**模块根包 = moobile 库本体** ——
> 使用者写 `import { "XiLaiTL/moobile" @moobile }` 拿到的是库，而不是 rabbita 的 `App`/`run`。
> 见 `docs/ARCHITECTURE.md` §5。

`tools/`：

| 文件 | 作用 |
|---|---|
| `android_env_setup.sh` | **幂等重建 Android 侧环境**（Gradle 版本 / gradle.properties / 目录联接） |
| `migrate_c_to_e.ps1` | 把 C 盘的 SDK / AVD 数据搬到 E 盘并留联接（已跑过，一般不需要重跑） |
| `link_builddirs.ps1` | 给 Gradle 各项目的 `build/` 建联接指向 E 盘 |
| `probe_cwd.ps1` | **查「谁锁着这个目录」**：读各进程 PEB 的 CurrentDirectory，列出 CWD 扎在指定路径下的进程（`-Filter 关键词`，`-Pids` 只出 PID）。Windows 上 `mv` 一个目录报 `Permission denied` 时用它 |
| `check_external.sh` + `ext_probe/` | **外部模块冒烟测试**：临时工作区里编译 `probe/app`（见 `ext_probe/README.md`） |
| `vendor_sync.sh` + `vendor.lock` + `patches/` | **生成式 vendor**：第三方代码不进仓，靠「版本 + 15 个 patch」重建。`--check` / `--apply` / `--capture` / `--from <版本>`（见 `FORK.md` §1） |
| `lf_normalize.sh` | **行尾预处理**：把文本文件统一成 LF（白名单式，不碰二进制）。CRLF 会让 patch 贴不上 |
| `tap_r1.py` / `scroll_r1.py` | 安卓上的 R1 测量 |

---

## 6. 排错表（这些都是本机实际踩过的）

| 现象 | 真因 | 解法 |
|---|---|---|
| `Unresolved reference 'plugins'` / `Settings_gradle.<init>` | **Expo 模板默认 Gradle 9.3.1 与 RN 0.86 自带的 gradle-plugin 不兼容** | 换 **Gradle 8.14.3**（`tools/android_env_setup.sh`） |
| `Command 'cmd' finished with non-zero exit value 1`（settings.gradle line 37） | `node_modules/expo-modules-autolinking/build` 被做成了空联接，但它是**包自带的 CLI 代码**不是构建产物 | 从 tarball 恢复：见 §7 |
| Gradle 报"磁盘空间不足" | C/D 盘写满 | 确认 §2 的联接都在（`tools/android_env_setup.sh --check`） |
| Kotlin 卡死在 `compileKotlin`，CPU 不涨 | GraalVM 当 JDK | `JAVA_HOME` 指向 `jdk-17.0.5` |
| Gradle wrapper 下载失败 | `services.gradle.org` 不通 | wrapper 已指向腾讯镜像（`tools/android_env_setup.sh` 会重设） |
| Maven 依赖卡住 | `dl.google.com`/`repo1.maven.org` 慢 | `android/build.gradle` + `settings.gradle` 已加阿里云镜像 |
| Web 页整片空白 | Metro 卡死 | 杀掉占用 8081 的进程重启 |
| **clone 后 `moon check` 报一堆"找不到包"** | 第三方代码（rabbita fork）**不在仓里**，是 `tools/vendor_sync.sh` 生成的 | 跑 `bash tools/vendor_sync.sh --apply`（见 §1.5） |
| **`vendor_sync.sh --check` 说"内容不同"** | ① 你真改了 fork 代码却没回写 patch；② 只是行尾被写成了 CRLF | ① `--capture` 回写；② 先 `bash tools/lf_normalize.sh` 再 `--check` |
| **改了 `html/`、`internal/vdom/` 却 `git status` 一片干净** | 那些目录是 gitignore 的生成物，git **不会**提醒你 | 提交前必须 `--capture` 再 `--check`（否则改动静默丢失） |
| `patch` 报 `malformed patch` / `hunk FAILED` | patch 文件或工作区的行尾是 CRLF | `bash tools/lf_normalize.sh`；并确认 `.gitattributes` 没被改 |
| Metro 在目录大挪动后自己死掉 | 它的文件监视器盯着被移动的目录 | 重启 Metro（`cd host && npx expo start --port 8081`） |
| 模拟器截屏全黑 | 无头 + swiftshader | 带窗口跑（`-gpu auto`）；或用 `uiautomator dump` 代替截图 |
| app 白屏、日志有 `loadJSBundleFromMetro` | 没做 `adb reverse tcp:8081 tcp:8081` | 见 §3.3 ③ |

---

## 7. 禁区（改之前先问）

1. **不要把 Gradle 升到 9.x。** RN 0.86 的 `settings.gradle.kts` 在 Gradle 9 下
   必然失败（`pluginManagement` 之后的 `plugins {}` 报 `Unresolved reference`）。
   也不要为此去改 `node_modules` —— **当前 `node_modules` 里没有任何补丁**，
   保持原样即可。
2. **不要在 `node_modules` 里给"包自带的 `build/` 目录"建联接。**
   `node_modules/expo-modules-autolinking/build` 是**该包的 CLI 代码**（npm tarball 里有 135 个文件），
   不是构建产物。把它替换成空目录会让 autolinking 全线失败。
   只给 **Gradle 生成**的目录建联接。
   万一弄坏了：
   ```bash
   curl -sSL "https://registry.npmmirror.com/expo-modules-autolinking/-/expo-modules-autolinking-57.0.13.tgz" -o /tmp/ema.tgz
   rm -rf examples/apps/todo-app/host/node_modules/expo-modules-autolinking && mkdir -p examples/apps/todo-app/host/node_modules/expo-modules-autolinking
   tar -xzf /tmp/ema.tgz -C examples/apps/todo-app/host/node_modules/expo-modules-autolinking --strip-components=1
   ```
3. **不要设 `GRADLE_USER_HOME`** 去覆盖 `~/.gradle`（那是把缓存放 E 盘的有意布置）。
4. **`npx expo prebuild` 会重写 `examples/apps/todo-app/host/android/` 下的配置**：
   - `gradle/wrapper/gradle-wrapper.properties` → 又变回 Gradle 9.3.1 ❌
   - `gradle.properties` → 我加的项（ABI、JDK 路径、内存）会丢 ❌
   - `build.gradle` / `settings.gradle` → 阿里云镜像会丢 ❌

   **所以：只要跑过 prebuild，就必须重跑 `bash tools/android_env_setup.sh` 修回来。**
   （目录联接不受影响；`--clean` 除外。）
5. 写 `.ps1` 脚本时**只用 ASCII**。Windows PowerShell 5.1 按 ANSI/GBK 读脚本，
   中文会破坏字符串字面量、导致语法错误。
6. 不要在 `adb shell` 的参数里用 MSYS 风格路径（`/data/...` 会被 Git Bash 转成
   `C:/Program Files/Git/data/...`）。要么 `export MSYS_NO_PATHCONV=1`，要么用相对路径。
