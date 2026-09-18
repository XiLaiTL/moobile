# DEV.md —— 开发环境与运行手册

> **给接手的人**：这份文档是自包含的。按 §1 → §4 走一遍就能把环境跑起来。
> 本机环境有几处**刻意的非常规布置**（磁盘几乎写满导致的），§2 解释为什么、
> 以及怎么重建。**动手改环境前先读 §7「禁区」。**
>
> 📌 **代码与文档同在一处**（2026-09 完成 T0.0 合并）：项目根就是本目录
> `interest/moobile/`，模块名 **`moobile/moobile`**。
> `_tools/*.py`、`_tools/*.ps1`、`_r1.js`、`_verify.js` 里的路径已改成
> **从脚本位置推导**，不再写死盘符，换机器照样能跑。
> 目录联接（§2 那张表）不受影响。

---

## 1. 工具链

| 组件 | 版本 / 位置 | 备注 |
|---|---|---|
| MoonBit | `0.1.20260827 (d0aaa07)`，`~/.moon/bin/moon` | |
| Node / npm | `v24.14.1` / `9.2.0` | registry 已指向 `https://registry.npmmirror.com/` |
| **JDK** | `D:/Program Files/Java/jdk-17.0.5` | ⚠️ **不要用 GraalVM**（Kotlin daemon 会卡死在 `compileKotlin`） |
| **Gradle** | **8.14.3**（wrapper，走腾讯镜像） | ⚠️ **不要升到 9.x**，见 §7 |
| Android SDK | `E:\Android\Sdk`（真实位置） | 原路径 `C:\Users\XiLaiTL\AppData\Local\Android\Sdk` 是目录联接 |
| AVD | `moobile64`，位于 `E:\avd` | Android 14 / x86_64 / 1080×2340 @440dpi |
| Expo / RN / React | `57.0.24` / `0.86.3` / `19.2.3` | |
| AGP / Kotlin | `8.12.0` / `2.1.20` | AGP 8.12 **要求 Gradle ≥ 8.13** |

### 每个新 shell 都要设的环境变量

```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_AVD_HOME='E:\avd'
export JAVA_HOME="/d/Program Files/Java/jdk-17.0.5"
# ⚠️ 不要设 GRADLE_USER_HOME —— 让 ~/.gradle 符号链接生效（指向 E:\BACKUP\.gradle）
```

建议把这几行放进一个 `env.sh`，每次 `source` 它。

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
bash _tools/android_env_setup.sh          # 重设 Gradle 版本 + gradle.properties + 联接
bash _tools/android_env_setup.sh --check  # 只检查，不改
```

> ⚠️ **`~/.gradle` 的符号链接是有意的**（把 Gradle 缓存放 E 盘），不是坏掉的环境。
> 早先它的目标 `E:\BACKUP\.gradle` 不存在才导致写失败 —— 建上目录就好，不要去覆盖它。

---

## 3. 日常开发流程

### 3.1 改 MoonBit 代码 → 看到效果

```bash
cd /d/ai_project/interest/moobile

moon check --target js        # 快速语法/类型检查
./build.sh                    # moon build --target js + 拷贝产物到 host/moobile.js
```

`build.sh` 做的事只有一件：`moon build --target js`，再把
`_build/js/debug/build/demo/demo.js` 拷成 `host/moobile.js`。

### 3.2 Web 预览（最快的一环）

```bash
cd host
npx expo start --port 8081
# 浏览器打开 http://localhost:8081
```

改完 MoonBit 后重跑 `./build.sh`，Metro 会增量重建（**不要用 `CI=1` 启动**，
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
cd host/android && ./gradlew assembleDebug
adb install -r /e/moobile-build/android_app_build/outputs/apk/debug/app-debug.apk

# ⑤ 启动 app
adb shell monkey -p com.anonymous.host -c android.intent.category.LAUNCHER 1
```

**只改 MoonBit / JS 时，④⑤ 不用重做** —— app 里已经有 dev 客户端，
重新 `./build.sh` 后它在 Metro 上拉新 bundle 即可（app 内摇一摇 → Reload，
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

| 脚本 | 验什么 | 前置 |
|---|---|---|
| `node _verify.js` | **Web 端到端 26 项断言**（渲染 / 结构化样式 / 点击过滤 / 勾选 / 输入回灌 / 新增 / 删除 / 不可移植节点=0 / 标签表覆盖=0 / 布局审计） | Metro 在 8081 |
| `bash _tools/check_external.sh` | **外部模块可用性**：在一个临时 `moon.work` 工作区里编译一个外部的 `probe/app`，证明别的模块能依赖 moobile + 公开的 `style/` | 无（不需要 Metro） |
| `node _r1.js` | **R1 排版测量（web）** —— 用 `Range.getClientRects()` 数行盒 | Metro 在 8081 |
| `python3 _tools/tap_r1.py` | 在**安卓**上点进 R1 屏并 dump 原生 View 层级（text + bounds） | 模拟器 + app 在跑 |
| `python3 _tools/scroll_r1.py` | 在**安卓**上滚动并逐屏 dump 测量（6 个爻全部） | 同上 |

`_verify.js` / `_r1.js` 用无头 Chrome + CDP，不依赖 UI；安卓那两个用 `uiautomator dump`，
**不依赖 GPU 截图**，所以在无头模拟器上也能量。

### 已产出的测量数据

- `_r1/style_gap.md` —— 样式层对 yi 的 198 条 CSS 的**差集账目**（0 未归类）
- `_r1/dom_survey.txt` —— `html/` + `svg/` 里 **45 处 `@dom.` 的逐条明细**
- `_r1/android_scroll_report.md` —— 安卓上 6 个爻的原生 bounds
- `_r1/yi_yao_css.txt` / `_r1/yi_root_vars.txt` —— 从 yi 抽出的真实 CSS 与配色
- `_r1/qian_yao.txt` —— 乾卦六爻的真实数据

---

## 5. 项目结构速览

```
moobile/                     ← 项目根（模块名 moobile/moobile）
├── moon.mod                 # 模块定义
├── style/                   # ★ 公开包：类型化样式层（StyleValue / Style / 关键字枚举）
├── internal/vdom/           # ★ vendor 自 rabbita，已改：Event 解耦、Props 加宽
├── internal/runtime/        # ★ react_host.mbt = moobile 的 React 后端（新增）
├── html/ cmd/ sub/ dom/ …   # vendor 自 rabbita（跟版方式见 FORK.md）
├── moobile/                 # ★ moobile 后端：render / host / app / store / schedule
├── demo/                    # 演示应用：model / ui(待办) / r1(R1 样本) / main
├── host/                    # Expo 宿主（React + RN + react-native-web）
│   └── App.js               # 一个根组件 + useSyncExternalStore，仅此而已
├── _verify.js _r1.js        # 验证脚本
├── _tools/                  # 环境脚本（见下）
├── _r1/                     # R1 的测量产出与原始数据
├── docs/                    # 设计文档：DESIGN / EVIDENCE / DESIGN-README
├── FORK.md                  # ★ 对 rabbita 的 diff 清单（跟版/上游化用）
├── PLAN.md                  # ★ 剩余工作计划
├── README.md                # 全部实测结论（含 R1 判决）
└── DEV.md                   # 本文件
```

`_tools/`：

| 文件 | 作用 |
|---|---|
| `android_env_setup.sh` | **幂等重建 Android 侧环境**（Gradle 版本 / gradle.properties / 目录联接） |
| `migrate_c_to_e.ps1` | 把 C 盘的 SDK / AVD 数据搬到 E 盘并留联接（已跑过，一般不需要重跑） |
| `link_builddirs.ps1` | 给 Gradle 各项目的 `build/` 建联接指向 E 盘 |
| `probe_cwd.ps1` | **查「谁锁着这个目录」**：读各进程 PEB 的 CurrentDirectory，列出 CWD 扎在指定路径下的进程（`-Filter 关键词`，`-Pids` 只出 PID）。Windows 上 `mv` 一个目录报 `Permission denied` 时用它 |
| `check_external.sh` + `ext_probe/` | **外部模块冒烟测试**：临时工作区里编译 `probe/app`（见 `ext_probe/README.md`） |
| `tap_r1.py` / `scroll_r1.py` | 安卓上的 R1 测量 |

---

## 6. 排错表（这些都是本机实际踩过的）

| 现象 | 真因 | 解法 |
|---|---|---|
| `Unresolved reference 'plugins'` / `Settings_gradle.<init>` | **Expo 模板默认 Gradle 9.3.1 与 RN 0.86 自带的 gradle-plugin 不兼容** | 换 **Gradle 8.14.3**（`_tools/android_env_setup.sh`） |
| `Command 'cmd' finished with non-zero exit value 1`（settings.gradle line 37） | `node_modules/expo-modules-autolinking/build` 被做成了空联接，但它是**包自带的 CLI 代码**不是构建产物 | 从 tarball 恢复：见 §7 |
| Gradle 报"磁盘空间不足" | C/D 盘写满 | 确认 §2 的联接都在（`_tools/android_env_setup.sh --check`） |
| Kotlin 卡死在 `compileKotlin`，CPU 不涨 | GraalVM 当 JDK | `JAVA_HOME` 指向 `jdk-17.0.5` |
| Gradle wrapper 下载失败 | `services.gradle.org` 不通 | wrapper 已指向腾讯镜像（`_tools/android_env_setup.sh` 会重设） |
| Maven 依赖卡住 | `dl.google.com`/`repo1.maven.org` 慢 | `android/build.gradle` + `settings.gradle` 已加阿里云镜像 |
| Web 页整片空白 | Metro 卡死 | 杀掉占用 8081 的进程重启 |
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
   rm -rf host/node_modules/expo-modules-autolinking && mkdir -p host/node_modules/expo-modules-autolinking
   tar -xzf /tmp/ema.tgz -C host/node_modules/expo-modules-autolinking --strip-components=1
   ```
3. **不要设 `GRADLE_USER_HOME`** 去覆盖 `~/.gradle`（那是把缓存放 E 盘的有意布置）。
4. **`npx expo prebuild` 会重写 `host/android/` 下的配置**：
   - `gradle/wrapper/gradle-wrapper.properties` → 又变回 Gradle 9.3.1 ❌
   - `gradle.properties` → 我加的项（ABI、JDK 路径、内存）会丢 ❌
   - `build.gradle` / `settings.gradle` → 阿里云镜像会丢 ❌

   **所以：只要跑过 prebuild，就必须重跑 `bash _tools/android_env_setup.sh` 修回来。**
   （目录联接不受影响；`--clean` 除外。）
5. 写 `.ps1` 脚本时**只用 ASCII**。Windows PowerShell 5.1 按 ANSI/GBK 读脚本，
   中文会破坏字符串字面量、导致语法错误。
6. 不要在 `adb shell` 的参数里用 MSYS 风格路径（`/data/...` 会被 Git Bash 转成
   `C:/Program Files/Git/data/...`）。要么 `export MSYS_NO_PATHCONV=1`，要么用相对路径。
