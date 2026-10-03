# DESKTOP-RNW —— 桌面端（Windows 原生 / react-native-windows）可行性实证

> **2026-10 补记（第十三轮）**：桌面这一格现在有**第二条路线**了 ——
> `examples/apps/zhouyi-reader-electron/`（Electron 真窗口，**本机不需要 VS 工具链**，
> 应用那 97 条界面判据附着在窗口上跑）。本文档继续管 **RNW** 那条（"同一份产物进 RN 原生宿主"，
> 窗口要 VS 2026 + SDK 22621）。两者的取舍见 [`../FINDINGS.md`](../FINDINGS.md) 十三续。

> **这份文件回答一个问题**：把 moobile 挂到 **裸 RN + react-native-windows（RNW）** 这个宿主上做
> Windows 桌面原生，**现在能不能做、差什么、要付多少**。
>
> 本文的全部数字都来自 **2026-10-02 本机一次连续实测**（`<探针目录>\RnwProbe`，日志原件在
> `.scratch/rnw-probe/logs/`）。
> ⚠️ **这里是路径而不是链接，是有意的**：`.scratch/` 是 **gitignore 的一次性探针目录** ——
> 本机有、**新鲜克隆里没有**，写成链接会让 `check_links` 在 CI 上红（本机却看不出来，
> 实测踩过，见 [`../FINDINGS.md`](../FINDINGS.md) 的 CI 收口补记）。凡是没跑过的，一律进 §6 的诚实清单。
>
> 关联：`PLAN.md` §1.2（宿主是可替换件）、`PLAN.md` §7 **决策点 4**（桌面端档位，本文给它补上 ② 的实测）、
> `docs/HANDOVER.md` §4-4（重活挪 E:）、`docs/design/SCAFFOLD.md`（宿主 = npm 包）。

---

## 0. 一句话结论

> **JS 侧已经通了，原生侧被工具链卡住 —— 而卡住的原因不是"缺个 SDK"，是 RNW 0.83 要
> Visual Studio **2026**（≥ 18.6），本机的 VS 2022 BuildTools 连门都进不去。**

三条各自有原始报错支撑的结论：

| # | 结论 | 证据 |
|---|---|---|
| **A** | **RNW 0.83.2 官方 CLI 在本机连"找 MSBuild"这一步都过不去**，报 `NoMSBuild: Could not find MSBuild with VCTools for Visual Studio 18.6.0 or later` | `logs/09-run-windows.log` |
| **B** | 绕过 CLI 版本闸门直连 MSBuild，下一层缺的是 **Windows SDK 10.0.22621.0**，报 `MSB8036`（本机只装了 10.0.19041.0） | `logs/14-msbuild-solutiondir.log` |
| **C** | **JS 侧（宿主接线 + Metro 打 windows bundle）已经跑通**：裸 RN（零 Expo）拿着**同一份** `moobile.js`，`--platform windows` 打包成功、退出码 0 | `logs/17-bundle-windows-with-pwsh.log` |

⇒ 也就是说：**"宿主是可替换件"这条在 Windows 上没有被证伪**，被证伪的只是"这台机器能编原生 Windows"。

---

## 1. 探针工程：位置、状态、谁写的

### 1.1 位置（为什么不在 `.scratch/` 里）

| | |
|---|---|
| 工程 | `<探针目录>\RnwProbe\` |
| 日志 | `<探针目录>\_logs\`（→ 已复制到 `.scratch/rnw-probe/logs/`） |
| 指针与手写文件副本 | `.scratch/rnw-probe/` |

搬去 E: 是**被磁盘逼的**，不是偏好：建工程前实测 `df -h` = `C: 22G / D: 16G / E: 805G` 可用，
而 HANDOVER §4-4 写明 **`node_modules` 不能做目录联接**（`npm install` 会把联接换成真目录），
所以只能整工程就地建在 E:。npm cache 本来就在 `<E盘>\BACKUP\npm`（`npm config get cache`）。

### 1.2 实际用的命令（版本全部 pin 死）

```bash
# ① 官方文档给的初始化命令（RNW 0.83 getting-started 原文是 --version 0.83.0，这里 pin 到 0.83.10）
npx --yes @react-native-community/cli@latest init RnwProbe --version 0.83.10 --pm npm --skip-git-init
# ② 加 RNW（官方文档：yarn add react-native-windows@^0.83.0；这里 pin 到 0.83.2）
npm install --save-exact react-native-windows@0.83.2
# ③ 生成原生工程（官方文档：npx react-native init-windows --overwrite）
npx react-native init-windows --overwrite --logging
# ④ 构建（--no-launch = 只编不启动）
npx react-native run-windows --no-launch --logging
```

**实际写进 `package.json` 的版本**（`npx ... init` 之后逐字抄的，`.scratch/rnw-probe/package.json` 有原件）：

| 包 | 写进去的版本 | 谁钉的 |
|---|---|---|
| `react-native` | `0.83.10` | 我们（`--version`） |
| `react` | `19.2.0` | RN 0.83.10 模板 |
| `react-native-windows` | `0.83.2` | 我们（`--save-exact`） |
| `@react-native-community/cli` | `20.0.0` | RN 0.83.10 模板（devDependency） |
| `@react-native/metro-config` / `babel-preset` / `typescript-config` / `eslint-config` | `0.83.10` | RN 0.83.10 模板 |
| `react-native-safe-area-context` | `^5.5.2` | RN 0.83.10 模板 |
| `@react-native-windows/find-dotnet-tools` | `0.0.0` | **我们手工补的**（见 §1.4，RNW 0.83.2 漏声明） |

版本存在性（`npm view`，本机 walk npmmirror 镜像）：

- `react-native@0.83.x` 共 11 个版本（0.83.0 … **0.83.10**）—— 0.83.10 在。
- `react-native-windows@0.83.x` 只有 **0.83.0 / 0.83.2**；dist-tag `v0.83-stable = 0.83.2`、`latest = 0.84.0`。
- `react-native-windows@0.83.2` 的 peer：`react-native: ^0.83.0`、`react: ^19.2.0`、`@types/react: ^19.1.1`
  —— 与 RN 0.83.10 的 `react 19.2.0` **相容**，没有 peer 冲突（`npm install` 无 ERESOLVE）。

### 1.3 哪些是工具生成的、哪些是我手写的

| 东西 | 来源 |
|---|---|
| `package.json` / `index.js` / `App.tsx` / `metro.config.js` / `babel.config.js` / `app.json` / `android/` / `ios/` | `@react-native-community/cli init` 生成 |
| `windows/**`（**28 个文件**，清单在 `.scratch/rnw-probe/windows-filelist.txt`） | `npx react-native init-windows` 生成，**一个字节都不是我手写的** |
| `NuGet.config`（工程根）、`jest.config.windows.js`、被**覆盖**的 `metro.config.js` | `init-windows` 生成/覆盖 |
| `moobile.js` | **直接复用仓库里现成的产物**：`examples/apps/host-swap-spike/moobile.js`（sha256 `1b6d07e1…`，649,389 B）—— 本轮没跑 `moon build` |
| `host/App.js`、`host/index.js` | **我手写**（各 10 行左右，见 §4.1） |
| `host/registry.generated.js` | `npx moobile-host regen` 生成 |

> 说明：`init-windows` 会**覆盖**工程根的 `metro.config.js`（官方文档专门提醒过这件事），
> 覆盖后的版本里加了 `windows/` 目录 blockList 与 RNW 包的 `build/ target/` 排除。

### 1.4 ⚠️ 踩到的第一个坑：RNW 0.83.2 的 CLI **漏声明了一个依赖**（上游打包 bug）

`npx react-native init-windows --overwrite` 第一次跑直接报：

```
error: unknown command 'init-windows'
```

（`logs/03-init-windows.log`）—— 注意 CLI **不给任何警告**，只是"没有这条命令"。

**真因**（一步步查出来的，不是猜的）：

1. `node -e "require('@react-native-windows/cli')"` →
   `Cannot find module '@react-native-windows/find-dotnet-tools'`；
2. 官方 registry 上 `@react-native-windows/cli@0.83.2` 的 `dependencies` 里**确实没有**这个包，
   而它的编译产物 `lib-commonjs/utils/commandWithProgress.js:45` 在**模块加载时**就
   `findPowerShell()`；`@react-native-windows/cli@0.84.0` 才把它加进 `dependencies`。
   ⇒ **0.83.0 / 0.83.2 是坏的，0.84.0 修了。**
3. RN CLI 加载依赖的 `react-native.config.js` 时把 `require` 失败**静默吞掉** →
   `npx react-native config` 里只剩 `ios` / `android` 两个平台 → `init-windows` / `run-windows` 都不存在。

**修法**（照抄即可）：

```bash
npm install --include=dev --save-prod --save-exact @react-native-windows/find-dotnet-tools@0.0.0
```

三个必须注意的点：

- 这个包**只有 `0.0.0` 一个版本属于 0.83 线**（dist-tag `v0.83-stable = 0.0.0`；另有 `0.84.0` / `0.85.0-preview.1`）。
- 它会被 `@react-native-windows/cli` 解析到，所以必须落在 `dependencies` ——
  **装成 `devDependencies` 会在下一次 `npm install` 时被删掉**（实测：`init-windows` 的 `postInstall`
  自己跑了一次 `npm install`，那份 devDependency 就被剪了，`run-windows` 于是又变成"未知命令"）。
- 本机 shell 里有 **`NODE_ENV=production`**（`env | grep NODE_ENV` 实测；注册表 HKCU/HKLM 里都没有，
  是会话级的），npm 9 因此默认 `omit=dev`（`npm config get omit` → `dev`），
  所以补装时要显式 `--include=dev`，否则连 `jest`、`@react-native/typescript-config` 这类模板
  devDependency 都不会落地。

### 1.5 ⚠️ 第二个坑：RNW CLI **硬依赖 PowerShell 7（`pwsh.exe`）**

补完依赖后，`require('@react-native-windows/cli')` 换成另一个错：

```
ERR: Unable to find pwsh.exe. It should have been made available by `yarn install`.
```

出处：`@react-native-windows/find-dotnet-tools@0.0.0` 的 `lib-commonjs/findDotnetTools.js`
`findPowerShell()`（46–63 行）先找 NuGet 里的 `/PowerShell/7.6.1/tools/net10.0/any/win/pwsh.exe`，
再 `execSync('where pwsh.exe')`，都找不到就抛。RNW 的 CLI 在 `commandWithProgress.js:45`
（顶层常量）与 `healthCheck/healthChecks.js:40` 调用它 ⇒ **只要 pwsh 不在 PATH 上，整个 RNW CLI 都加载不了**。

本机现状（实测）：**PowerShell 7.6.6 已装**（winget `Microsoft.PowerShell`），
但装在 `<用户目录>\AppData\Local\Microsoft\WindowsApps\pwsh.exe`，
而**用户 PATH 里没有 WindowsApps 目录**（`reg query HKCU\Environment /v Path` 实测），
所以 `where pwsh.exe` 从 Node 进程里查不到。

修法（两种，任选）：

```bash
# ① 临时：跑 RNW 命令的那个 shell 里加一行
export PATH="$LOCALAPPDATA/Microsoft/WindowsApps:$PATH"
# ② 永久：把 %LOCALAPPDATA%\Microsoft\WindowsApps 加进用户 PATH（图形界面改环境变量，或 setx）
```

> 这一条的**连带后果比看上去大**：因为 `react-native.config.js` 加载失败是静默的，
> 所以 **Metro 也认不出 `windows` 这个平台** —— 实测不带那行 PATH 时 `--platform windows`
> 报 `error: Invalid platform "windows" selected. Available platforms are: "ios", "android", "native"`
> （`logs/15-bundle-windows.log`）。**一个"找不到 pwsh"竟然表现成"平台不存在"。**

### 1.6 状态总表

| 步骤 | 结果 | 日志 |
|---|---|---|
| `npm install`（`init` 内嵌的那次；之后 lockfile 里共 **996** 个包条目） | ✅ 成功，无 peer 冲突（无 ERESOLVE） | `01-init.log` |
| `npm install react-native-windows@0.83.2` | ✅ 成功（125 包） | `02-install-rnw.log` |
| `npx react-native init-windows --overwrite` | ⚠️ 第一次 ❌（未知命令）→ 补依赖后 ✅（7.2 s） | `03-init-windows.log` / `03b-init-windows.log` |
| `npx react-native run-windows --no-launch --logging` | ❌ **卡在这里**（VS 版本闸门） | `09-run-windows.log` |
| 绕过闸门直连 MSBuild | ❌ 下一层：缺 SDK 10.0.22621.0 | `14-msbuild-solutiondir.log` |
| `npx react-native bundle --platform windows`（JS 侧） | ✅ 成功 | `17-bundle-windows-with-pwsh.log` |

**最终失败的原始报错（原文，`logs/09-run-windows.log`）**：

```
- Running x64 node on a x64 machine
i Running x64 node on a x64 machine
- Verbose: ON
i Verbose: ON
Looking for VS installs with version range: [18.6.0,19.0)
Looking for vswhere at: <ProgramFiles(x86)>\Microsoft Visual Studio\Installer\vswhere.exe
- No public VS release found
‼ No public VS release found
- Trying pre-release VS
i Trying pre-release VS
Looking for VS installs with version range: [18.6.0,19.0]
Looking for vswhere at: <ProgramFiles(x86)>\Microsoft Visual Studio\Installer\vswhere.exe
- Could not find MSBuild with VCTools for Visual Studio 18.6.0 or later. Make sure all required components have been installed
× Could not find MSBuild with VCTools for Visual Studio 18.6.0 or later. Make sure all required components have been installed
- It is possible your installation is missing required software dependencies. Dependencies can be automatically installed by running <探针目录>\RnwProbe\node_modules\react-native-windows\scripts\rnw-dependencies.ps1 from an elevated PowerShell prompt.
For more information, go to http://aka.ms/rnw-deps
Command failed with error NoMSBuild: Could not find MSBuild with VCTools for Visual Studio 18.6.0 or later. Make sure all required components have been installed
```

**⇒ 失败点确认是"缺 VS（版本 + 工作负载）"，不是别的东西**（不是网络、不是 npm、不是 Metro、不是我们的 JS）。
代码位置：`@react-native-windows/cli/lib-commonjs/utils/msbuildtools.js:160-186`，
`findAvailableVersion()` 里 `const minVersion = process.env.MinimumVisualStudioVersion || process.env.VisualStudioVersion || '18.6.0';`
—— 18.6.0 是**硬编码的默认值**（可用环境变量覆盖，见 §6）。

---

## 2. Q1 —— RNW 0.83 在 Windows 上开发需要什么

### 2.1 权威出处与一处**文档与脚本不一致**

| 出处 | 说 VS 装什么 | 说 SDK |
|---|---|---|
| 官方文档 0.83 版 System Requirements（[0.83/rnw-dependencies](https://microsoft.github.io/react-native-windows/docs/0.83/rnw-dependencies)） | "Install the latest version of **Visual Studio 2022**"，列 `.NET Desktop development` / `Desktop development with C++`（含 MSVC v143）/ `Universal Windows Platform development`（含 C++ (v143) UWP tools） | **Windows 10 SDK (10.0.22621.0)** |
| **`react-native-windows@0.83.2` 包里自带的 `Scripts/rnw-dependencies.ps1`** | `$vsver = "18.6.1"`，检查项名字直接写 **"Visual Studio 2026 (>= 18.6.1) & req. components"** | `Microsoft.VisualStudio.Component.Windows11SDK.22621` |
| 官方 0.83 [win10-compat](https://microsoft.github.io/react-native-windows/docs/0.83/win10-compat) | —— | RNW **0.76+** 的 Target OS = **10.0.22621.0**；New Arch 的 Min OS = 10.0.18362.0 |
| RNW 自带 props：`PropertySheets/External/Microsoft.ReactNative.WindowsSdk.Default.props` | —— | New Arch（`RnwNewArch=true`）时**强制** `WindowsTargetPlatformVersion = 10.0.22621.0` |

**不一致点（这是本轮最值钱的一条纠正）**：文档页说 VS **2022**，但 **0.83.2 实际发出去的脚本与 CLI 都要 VS 2026（≥18.6）**。
我们按"文档"准备 VS 2022 会白做 —— 实测就是这么失败的（§1.6）。
（顺带：同一份脚本要 **.NET SDK 10.0**，而文档页还写着 .NET 6.0 —— 脚本同样比文档新。）

`react-native-windows@0.83.2` 的 `Scripts/rnw-dependencies.ps1` 与我们直接下载的
[`aka.ms/rnw-vs2022-deps.ps1`](https://aka.ms/rnw-vs2022-deps.ps1) **sha256 完全相同**
（`35cf27ec5ad3612f4a50b65b35085e36c4d31172bdeb2c8cb97dc15d92349e70`），
且与官方 registry tarball（`registry.npmjs.org`）里的那份一致 —— 所以这不是镜像污染。

### 2.2 逐项清单 × 本机现状（每条都有可复现的查询命令）

> 查询命令与输出合并存在 `.scratch/rnw-probe/logs/16-q1-evidence.log`（同上：**本地探针目录、未入库**，
> 所以是路径不是链接），另加 `logs/06-rnw-deps-check.log`（**官方检查脚本自己的输出**）。

| # | 要求 | 出处 | 本机现状 | 查询命令 |
|---|---|---|---|---|
| 1 | **VS 2026 ≥ 18.6.1** + 9 个组件/工作负载（见 §2.3） | `Scripts/rnw-dependencies.ps1` 的 `$vsAll`、`msbuildtools.js:160` | ❌ **不满足**（只有 VS 2022 BuildTools 17.14.36623.8） | `vswhere -version 18.6.1 -property installationPath -requires Microsoft.Component.MSBuild Microsoft.VisualStudio.Component.VC.Tools.x86.x64` → 空 |
| 2 | `Microsoft.VisualStudio.Workload.NativeDesktop` | 同上 | ❌ 缺 | `vswhere -products '*' -requires Microsoft.VisualStudio.Workload.NativeDesktop -property installationPath` → 空 |
| 3 | `Microsoft.VisualStudio.Workload.ManagedDesktop` | 同上 | ❌ 缺 | 同上，换 ID → 空 |
| 4 | `Microsoft.VisualStudio.Workload.Universal` | 同上 | ❌ 缺 | 同上 → 空 |
| 5 | `Microsoft.VisualStudio.ComponentGroup.UWP.VC`（"C++ (v143) UWP tools"） | 同上（`buildLab` 之外必装） | ❌ 缺 | 同上 → 空 |
| 6 | `Microsoft.VisualStudio.ComponentGroup.UWP.Support` | 同上 | ❌ 缺 | 同上 → 空 |
| 7 | `Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core` | 同上 | ✅ **在**（BuildTools 17.14 自带） | 同上 → `...\2022\BuildTools` |
| 8 | `Microsoft.Component.MSBuild` | 同上 | ✅ **在**（VS2022 BuildTools 带） | `ls ".../2022/BuildTools/MSBuild/Current/Bin/MSBuild.exe"` → 存在 |
| 9 | `Microsoft.VisualStudio.Component.VC.Tools.x86.x64`（MSVC v143+） | 同上 | ✅ **在**（`VC/Tools/MSVC/14.44.35207`，`cl.exe` 存在） | `ls ".../VC/Tools/MSVC/"` → `14.44.35207` |
| 10 | **`Microsoft.VisualStudio.Component.Windows11SDK.22621` + Windows SDK 10.0.22621.0** | `Component.Windows11SDK.22621` + win10-compat 表 + `Microsoft.ReactNative.WindowsSdk.Default.props` | ❌ **组件与 SDK 都没有**。Windows Kits 里只有 `10.0.19041.0`；而 `Windows11SDK.22621` **和** `Windows11SDK.19041` 两个 **VS 组件 ID 都查不到** —— 说明 19041 是**独立装的 SDK**，不是通过 VS 装的，`vswhere -requires` 认不出来 | `ls "<ProgramFiles(x86)>\Windows Kits\10\Include"` → `10.0.19041.0`；`vswhere -requires Microsoft.VisualStudio.Component.Windows11SDK.22621 -property installationPath` → 空 |
| 11 | .NET SDK **10.0**（脚本）/ 文档写 6.0 | 脚本 `$dotnetver = "10.0"` | ✅ **在**（`10.0.400`；另有 5/6/8） | `dotnet --list-sdks` |
| 12 | **Developer Mode 打开** | 脚本 `DeveloperMode` 检查 | ✅ **开** | `reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense` → `0x1` |
| 13 | **长路径（LongPathsEnabled）** | 脚本 `LongPath` 检查 | ✅ **开** | `reg query "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled` → `0x1` |
| 14 | Node.js **≥ 22**（脚本：`major>22` 或 `22.minor>=14`） | 脚本 `CheckNode` | ✅ **在**（v24.14.1） | `node -v` |
| 15 | Yarn（可选但推荐；RNW 脚本会用它自己的检查） | 脚本 `Yarn` 检查 | ✅ 通过（corepack 现场拉了 1.22.22） | 官方脚本输出里 `Checking Yarn … OK` |
| 16 | Windows 版本 ≥ 10.0.17763 | 脚本 `WindowsVersion` | ✅ **在**（10.0.19045.6456） | `cmd /c ver` |
| 17 | 内存 ≥ 16 GB（脚本实际判据是 `> 15GB`，且 **Optional**） | 脚本 `InstalledMemory` | ⚠️ 15.36 GB → **按脚本判据算过**（`Checking Installed memory >= 16 GB … OK`），但**名字与判据不符** | `powershell -c "(Get-CimInstance win32_computersystem).TotalPhysicalMemory/1GB"` |
| 18 | 当前盘可用空间 > 15 GB（Optional） | 脚本 `FreeSpace` | ✅ 通过（脚本按**自己所在盘**判 = E: 805 G） | `df -h /c /d /e` |
| 19 | **PowerShell 7（`pwsh.exe`）在 PATH 上** | `find-dotnet-tools@0.0.0` `findDotnetTools.js:46-63` —— **官方脚本与文档都没写这一条** | ⚠️ **装了但不在 PATH**（7.6.6，在 `%LOCALAPPDATA%\Microsoft\WindowsApps`） | `where pwsh.exe`（不带 WindowsApps 时返回空） |

**官方检查脚本自己怎么说**（`powershell -ExecutionPolicy Unrestricted -NoProfile Scripts\rnw-dependencies.ps1 -NoPrompt`，
完整输出见 `logs/06-rnw-deps-check.log`，退出码 **1**）：

```
Checking Free space on current drive > 15 GB                        OK
Checking Installed memory >= 16 GB                                  OK
Checking Windows version >= 10.0.17763.0                            OK
Checking Developer mode is on                                       OK
Checking Long path support is enabled                               OK
Checking Visual Studio 2026 (>= 18.6.1) & req. components       Failed
Checking Node.js (LTS, >= 22.0)                                     OK
Checking Yarn ...                                                   OK
Checking .NET SDK (LTS, = 10.0)                                     OK
WARNING: Some dependencies are not met.
```

`-Check VSUWP -Verbose` 的细节（`logs/07-rnw-deps-vsuwp-verbose.log`）：

```
VERBOSE: Looking for Visual Studio install(s)...
VERBOSE: No Visual Studio installs found.
VERBOSE: Retrying, but also including pre-releases versions...
VERBOSE: No Visual Studio installs found.
                                                                Failed
```

（`CheckVS-WithVSWhere` 用的是 `vswhere -version 18.6.1 -requires <整个 $vsAll 列表>` —— 所以
"本机一个都不满足"是 **9 个组件一起 AND** 的结果，不单是版本号。）

> **顺手多测了一步（这条比上面更有用）**：把 `-version 18.6.1` **去掉**、只留那 9 个 `-requires`，
> 输出**仍然是空** —— 也就是说 **这台机器就算不升级 VS、光是"补组件"也补不出来**：
> 缺的 4 项（`Workload.NativeDesktop` / `ManagedDesktop` / `Universal` / `ComponentGroup.UWP.VC` /
> `ComponentGroup.UWP.Support` / `Windows11SDK.22621`）是**真的没有**，不是"版本不够所以被滤掉"。

### 2.3 可以直接照抄的补齐命令

先说结论：**`modify` 现在这台 2022 BuildTools 没用** —— 它是 17.14，`-version 18.6.1` 那条查询
永远不会返回它。要补齐的是**一次 VS 2026 的安装**。

**推荐路线（winget，一条命令；本机 `winget search` 实测有这两个包）**

```powershell
# Visual Studio BuildTools 2026（18.10.2）—— 只要命令行构建能力时选这条
winget install --id Microsoft.VisualStudio.BuildTools --exact --silent `
  --accept-package-agreements --accept-source-agreements `
  --custom "--includeRecommended --add Microsoft.Component.MSBuild --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.ComponentGroup.UWP.Support --add Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --add Microsoft.VisualStudio.ComponentGroup.UWP.VC --add Microsoft.VisualStudio.Workload.ManagedDesktop --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Workload.Universal"
```

```powershell
# 想要 IDE（VS 里按 F5 调试 RNW 那条路）就换成 Community 2026（18.10.3）
winget install --id Microsoft.VisualStudio.Community --exact `
  --accept-package-agreements --accept-source-agreements `
  --custom "--includeRecommended --add Microsoft.Component.MSBuild --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 --add Microsoft.VisualStudio.ComponentGroup.UWP.Support --add Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --add Microsoft.VisualStudio.ComponentGroup.UWP.VC --add Microsoft.VisualStudio.Workload.ManagedDesktop --add Microsoft.VisualStudio.Workload.NativeDesktop --add Microsoft.VisualStudio.Workload.Universal"
```

**`vs_installer.exe modify` 形态（官方脚本自己用的形态；当 VS 2026 已经装好、只补组件时用）**

官方脚本的原文（`rnw-dependencies.ps1:259-262`）：

```powershell
$vsInstaller = Join-Path -Path (Split-Path -Parent $vsWhere) -ChildPath "vs_installer.exe"
$addWorkloads = $vsAll | % { '--add', $_ }
& $vsInstaller modify --channelId $channelId --productId $productId $addWorkloads --quiet --includeRecommended
```

照着填成一条（`channelId`/`productId` **不要抄我的**，用下面那条查询现场取，因为机器不同值不同）：

```powershell
# 先取本机 VS 2026 的 channelId / productId
& "<ProgramFiles(x86)>\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -property channelId
& "<ProgramFiles(x86)>\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -property productId

# 再照抄（把 <CHANNEL> <PRODUCT> 换成上面两条的输出）
& "<ProgramFiles(x86)>\Microsoft Visual Studio\Installer\vs_installer.exe" modify `
  --channelId <CHANNEL> --productId <PRODUCT> `
  --add Microsoft.Component.MSBuild `
  --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  --add Microsoft.VisualStudio.ComponentGroup.UWP.Support `
  --add Microsoft.VisualStudio.ComponentGroup.NativeDesktop.Core `
  --add Microsoft.VisualStudio.Component.Windows11SDK.22621 `
  --add Microsoft.VisualStudio.ComponentGroup.UWP.VC `
  --add Microsoft.VisualStudio.Workload.ManagedDesktop `
  --add Microsoft.VisualStudio.Workload.NativeDesktop `
  --add Microsoft.VisualStudio.Workload.Universal `
  --quiet --includeRecommended
```

**也可以什么都不查，直接让官方脚本干**（它会自己 `vswhere` 取 channel/product，然后 `vs_installer modify`；
必须**管理员** PowerShell）：

```powershell
Set-ExecutionPolicy Unrestricted -Scope Process -Force
iex (New-Object System.Net.WebClient).DownloadString('https://aka.ms/rnw-vs2022-deps.ps1')
# 或本地那份（版本与 RNW 0.83.2 完全一致）：
# powershell -ExecutionPolicy Unrestricted -NoProfile <工程>\node_modules\react-native-windows\Scripts\rnw-dependencies.ps1 -Install
```

⚠️ **本机现状下这条会走歪**：脚本的 `GetVSChannelAndProduct` 取到的是**已装的 VS**（= 2022 BuildTools，
`channelId=VisualStudio.17.Release`、`productId=Microsoft.VisualStudio.Product.BuildTools`），
于是它 `modify` 的是 2022 那份 —— **加完组件仍然过不了 `>=18.6` 的闸门**。
（`vswhere -property channelId/productId` 本机实测输出就是上面这两个值。）

**要不要顺手装 VS 2026 之外的东西：**

- **PowerShell 7**：如果走 winget 的 BuildTools/Community 包，pwsh 仍要自己保证在 PATH 上（见 §1.5）。
  `winget install --id Microsoft.PowerShell --exact`（本机已装 7.6.6，只是 PATH 没带 WindowsApps）。
- **MSVC v143 vs v145**：文档页写的 "MSVC v143 (Latest)" 是 2022 的说法；**生成的工程里
  `<PlatformToolset>v145</PlatformToolset>`**（VS 2026 的 toolset）。所以别按文档去配 v143。
- **ARM64**：脚本在 arm64 上把组件换成 `Microsoft.VisualStudio.Component.VC.Tools.ARM64`；文档另列
  `MSVC v143 - VS 2022 C++ ARM64 build tools (Latest)`。本机 x64，不需要。

### 2.4 缺 VS/SDK 时 MSBuild 直连的第二层报错（补充证据）

把 CLI 的版本闸门绕开（`vswhere` 那条查询能过）之后，MSBuild 报的是 **SDK**：

```
<ProgramFiles(x86)>\Microsoft Visual Studio\2022\BuildTools\MSBuild\Microsoft\VC\v170\Microsoft.Cpp.WindowsSDK.targets(46,5):
error MSB8036: 找不到 Windows SDK 版本 10.0.22621.0。请安装所需版本的 Windows SDK，
或者在项目属性页中或通过右键单击解决方案并选择"重定解决方案目标"来更改 SDK 版本。
[<探针目录>\RnwProbe\windows\RnwProbe\RnwProbe.vcxproj]
```

命令（`logs/14-msbuild-solutiondir.log`；注意 `SolutionDir` 必须给，否则 `ExperimentalFeatures.props`
的 import 失败、UseExperimentalNuget 失效，会绕到 RNW 自源码构建那条更早的分支上去）：

```bash
MSBuild.exe windows/RnwProbe/RnwProbe.vcxproj -p:SolutionDir=<探针目录>\RnwProbe\windows\ \
  -p:Configuration=Debug -p:Platform=x64 -v:m -nologo
```

⇒ **两个硬前提都缺：VS 版本 + SDK 22621**。而 `<WindowsTargetPlatformVersion>10.0</WindowsTargetPlatformVersion>`
之所以变成 22621，是 `Microsoft.ReactNative.WindowsSdk.Default.props` 里
`Condition="'$(RnwNewArch)'=='true' And VersionLessThan(...)"` 强制覆盖的 —— **不是"最新装的 SDK"**，
所以**装了 19041 也没用**。

---

## 3. Q2 —— 画布 / Skia：`@shopify/react-native-skia` 支不支持 Windows(RNW)？

### 3.1 结论：**不支持** —— Skia 本体没有 Windows 后端

三条互相独立的证据：

| 证据 | 内容 | 出处 |
|---|---|---|
| **① npm 元数据（最硬）** | `@shopify/react-native-skia@2.14.0` 的 tarball 里 **`package/windows/` 条目数 = 0**；顶层目录只有 `android/ apple/ cpp/ include/ lib/ scripts/ src/` + `react-native-skia.podspec` + `Package.swift` —— 只有 JNI/CMake 与 Apple 两套后端 | `npm pack @shopify/react-native-skia@2.14.0` 后 `tar tzf ... \| grep -c '^package/windows'` |
| **② 维护者原话** | issue [#2058 "MacOS and Windows support"](https://github.com/Shopify/react-native-skia/issues/2058)（2023-12-14 开，**2025-06-17 关**，label: enhancement）：<br>· Microsoft 侧成员 2025-04-22：「macOS support has landed」<br>· 维护者 **wcandillon** 2025-06-17 关单时写：「Closing for now, but if there is something we can do to have windows support, let me know. **The issue with Windows support is that we would need to have a dedicated backend for it** but with Graphite, we can use Dawn on Windows as well so hopefully eventually we will be able to provide that.」 | GitHub API `repos/Shopify/react-native-skia/issues/2058` |
| **③ 官方生态目录** | ReactNative.Directory（RNW 官方文档 [supported-community-modules](https://microsoft.github.io/react-native-windows/docs/0.83/supported-community-modules) 推荐的查法）的 API 返回 `@shopify/react-native-skia` = `{ios:true, android:true, web:true}`，**没有 `windows` 字段** | `https://reactnative.directory/api/libraries?search=@shopify/react-native-skia` |

**依赖链上那两个原生包也是空的 —— 但这条比看上去轻（差点写错，这里记下真因）**：

Skia 2.14 的 peer 里有 `react-native-worklets >= 0.7.0` / `react-native-reanimated >= 4.0.0`，
两者在目录 API 里都**没有 `windows`**：

| 包 | RN 0.83 线上的可用版本 | peer `react-native` | 目录 API |
|---|---|---|---|
| `react-native-reanimated` | 4.4.3 / 4.5.5 / 4.6.0（4.7+ 要 RN 0.86–0.88，与本宿主不合） | `0.83 - 0.86` / `0.83 - 0.87`（**对得上**） | `{ios, android, macos, web}`，**无 windows** |
| `react-native-worklets` | 0.7.0+ | —— | `{ios, android, web}`，**无 windows** |

⚠️ **但这两个是 `peerDependenciesMeta.optional = true`**（`npm view @shopify/react-native-skia@2.14.0 peerDependenciesMeta` 实测），
Skia 内部是**懒 require**（`src/external/reanimated/ReanimatedProxy.ts:11`、
`renderHelpers.ts:26-44`：拿不到就抛 `OptionalDependencyNotInstalledError`）。所以：

- ✅ **用 Skia 画静态/命令式 canvas 不需要 reanimated/worklets** ⇒ 它们"没有 windows"**不是额外阻塞**；
- ❌ **真正的阻塞只有一条，而且绕不过去：Skia 本体没有 Windows 后端**（上面三条证据）。

> 本仓库的既有事实也一致：`canvas/` 目前只落在 Expo 宿主上（Web 用 canvas、原生用 Skia），
> `npm/moobile-host/canvas-skia.js:26` 自己写着「**真机上的组件挂载没跑过**（要 `expo prebuild` + 重建 APK）」。

### 3.2 在 RNW 上画那张「罗盘 canvas」的四条路

| 路线 | 可行性证据 | 成本 | 判断 |
|---|---|---|---|
| **① `react-native-svg` 重画罗盘** | tarball 里 **`package/windows/` 153 个文件**，含 `windows/RNSVG/Fabric/*View.cpp`（Fabric/New Arch 实现）；目录 API 返回 `react-native-svg` = `{windows:true, macos:true, ios, android, web, newArch:true}` | 只需把 `canvas/` 的绘制原语（现在是 Skia 的 `drawCircle/drawLine/…`）换成 SVG 元素，**MoonBit 侧视图结构不变**；不新增原生依赖（RNW 侧自动链接） | ★ **最省，首选** |
| **② `react-native-webview` 里跑现成的 Web 版 canvas** | tarball 里 `package/windows/ReactNativeWebView/**` **25 个文件**（WebView2 实现）；目录 API `react-native-webview` = `{windows:true, macos:true, …}` | 要新增原生依赖 + 一座"RN ↔ WebView"的桥（把 `Msg`/手势传进去、把绘制结果传出来）；首屏与调试成本明显更高 | 备选（**罗盘本身很适合**，但会引入第二个渲染世界） |
| **③ 自绘原生组件（Fabric C++/WinRT + Direct2D/Win2D）** | RNW 文档有 [Native UI Components / View Managers](https://microsoft.github.io/react-native-windows/docs/0.83/view-managers) 这条路；RNW 0.82+ 只有 Fabric | 要写 C++、要维护一份 Windows 专有实现、要在 VS 2026 里迭代 | 最后手段，**只在 ①② 都不够时** |
| **④ 等 Skia 出 Windows 后端** | §3.1：维护者说要做"dedicated backend"，提到 Graphite/Dawn 是可能路径，但**没有时间表** | 0（等待），但**不可承诺** | 不作为方案 |

> **③ 怎么复现**：`curl "https://reactnative.directory/api/libraries?search=<包名>"`，
> 看返回 JSON 里有没有 `windows: true`（本文引用的几个：skia 无、reanimated 无、worklets 无、
> gesture-handler 无、svg 有、webview 有、expo-sqlite 无）。
> ⚠️ 这是**社区元数据**（靠库作者/爬虫维护），不是构建证据 —— 所以它是**旁证**；
> 主证据是 ① 的 tarball 内容。两者一致时才敢下结论。

**给罗盘的具体建议**：先按 ① 做 —— 罗盘的绘制元素很少（圆 + 刻度线 + 指针 + 文字），
`react-native-svg` 的 `Circle/Line/Path/Text/G` 够用，而且它的 `windows/` 里 Fabric 实现齐全，
与 RNW 0.83 的 New Arch-only 口径对得上。⚠️ **但"它能在这台机器上编过"我们没法验**（§6）。

---

## 4. Q3 —— 桌面宿主的 JS 侧最小接线

### 4.1 目录结构（**本轮真的建起来了，并且 bundle 成功**）

> 实测位置：`<探针目录>\RnwProbe\`（副本在 `.scratch/rnw-probe/host/`）。
> 文件内容**逐字**就是下面这些。

```
RnwProbe/                      ← 裸 RN 工程根（不带 Expo）
├── package.json               ← 脚本见下表；依赖只有 react / react-native / react-native-windows
│                                 / moobile-host / react-native-safe-area-context
├── app.json                   ← { name, displayName }（RN 用，不是 Expo 的 app.json）
├── index.js                   ← RN 模板自带（未改；真正的入口是 host/index.js）
├── metro.config.js            ← init-windows 生成（含 windows 平台的 resolver 配置）
├── moobile.js                 ← ★ MoonBit 产物（`moon build --target js` 后由 `moobile-host build` 搬来）
├── host/                      ← ★★ 桌面宿主的全部手写代码
│   ├── index.js               ← RN 入口：`AppRegistry.registerComponent(name, () => App)`
│   ├── App.js                 ← 宿主接线：`export default mountApp(app, { registry })`
│   └── registry.generated.js  ← `npx moobile-host regen` 生成
└── windows/                   ← `npx react-native init-windows` 生成的原生工程（28 个文件）
```

**`host/index.js`（10 行，裸 RN 替代 `registerRootComponent`）**

```js
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from '../app.json';

AppRegistry.registerComponent(appName, () => App);
```

对照：Expo 模板的 `index.js` 只有一行 `registerRootComponent(App)`（`examples/apps/template/index.js`），
它做的就是上面那件事（外加 Expo Go 的环境准备）。**换宿主改的就是这一处。**

**`host/App.js`（与 Expo 模板的 `App.js` 逐字同形）**

```js
import { mountApp } from 'moobile-host';
import { app } from '../moobile.js';
import { registry } from './registry.generated.js';

export default mountApp(app, { registry });
```

**应用侧不改一个字节**：`app.mbt` 末尾就是 `pub fn app() -> @moobile.JsValue { @moobile.handlers(...) }`
（`examples/apps/template/app.mbt` 最后一行），产物 `moobile.js` 导出 `{ app }`。
本机用的是现成产物 `examples/apps/host-swap-spike/moobile.js`（649,389 B，sha256 `1b6d07e1…`），
**和 web / Android 宿主用的是同一份东西**。

**`package.json` 的 scripts（建议）**

| script | 内容 | 说明 |
|---|---|---|
| `build` | `moon build --target js && moobile-host build` | **与 Expo 模板完全相同** —— 产物搬运走 `moobile-host build`（**发现**产物，别写死 `cp`） |
| `regen` | `moobile-host regen` | 能力注册表 |
| `windows` | `react-native run-windows` | 原生构建 + 启动（本机卡在这步） |
| `windows:build` | `react-native run-windows --no-launch` | 只编不启 |
| `start` | `react-native start` | **Metro**，见 §4.2 |
| `bundle:windows` | `react-native bundle --platform windows --dev true --entry-file host/index.js --bundle-output out/index.windows.bundle --assets-dest out` | 只打 JS 包（**本轮验过**） |
| `test` | `jest --config jest.config.windows.js` | `init-windows` 生成的 |

**没有 `web` 这一条** —— 裸 RN 工程里没有 `react-native-web`、没有 `expo start --web`，也不需要（§4.2）。

### 4.2 ① 不带 Expo：web 端不用管，Metro 怎么跑

- **web 端确实不用管**：`react-native-web` / `react-dom` 都不在依赖里，
  工程里唯一的平台是 `windows`（+ 模板自带但用不到的 android/ios）。
- **Metro 就是 RN CLI 自己的 `start`**：`npx react-native start`（不需要 Expo 的 `expo start`）。
  打生产包用 `npx react-native bundle --platform windows …`。
- **★ 一个必须知道的耦合**：Metro 认不认 `windows` 这个平台，取决于 `react-native-windows`
  的 `react-native.config.js` **能不能被 require 成功** —— 而它 require 了
  `@react-native-windows/cli`，后者**在模块加载时**就要 `pwsh.exe`（§1.5）。
  实测：PATH 里没有 WindowsApps 时 `--platform windows` 报
  `error: Invalid platform "windows" selected. Available platforms are: "ios", "android", "native"`；
  加上之后立刻成功。**排查"平台不存在"时先查 pwsh。**

### 4.3 ② `moobile-host` 在裸 RN 下有没有 Expo 强耦合？—— **运行时路径没有**

逐文件读的结论（行号按仓库当前 `npm/moobile-host/` 源码）：

| 文件 | import 了什么 | Expo？ |
|---|---|---|
| `index.js:15-23` | `react`、`react-native` 的 `View/Text/Pressable/TextInput/ScrollView/Platform` | ❌ 无 |
| `index.js:72-75` | `DEFAULT_API_BASE` 按 `Platform.OS === 'android'` 分支 | ❌ 无（windows 落到 `127.0.0.1`） |
| `index.js:98-107` | 组件表包成手势版 + `native` 替代物 + `platform: Platform.OS` | ❌ 无 |
| `core.js:14` | **只有 `react`** —— 契约装配本身与 RN、与 Expo 都无关 | ❌ 无 |
| `native-rn.js:26` | `react-native` 的 `AppState` / `Dimensions`（`visibility` / `geometry` 替代物） | ❌ 无 |
| `gesture-rn.js:30-31` | `react` + `react-native` 的 `PanResponder` / `Platform` | ❌ 无 |
| `canvas-skia.js:31-33` | `react` + `./canvas-ops.js` + `./core.js`（**Skia 是外部传进来的**） | ❌ 无 |

**唯一的 Expo 硬耦合在 `capabilities/` 这一层，而且是按需加载的**：

| 位置 | 内容 | 影响 |
|---|---|---|
| `capabilities/db.js:18` | `import * as SQLite from 'expo-sqlite'` | **整个包里唯一一处 `expo-*` import**。它在 `package.json` 的 `files` 里会随包发布，但只要没有代码 `import` 它，Metro 就不会打进 bundle |
| `lib/regen.js:42-50` | `KNOWN` 表只有一项：`db ← expo-sqlite（from: 'moobile-host/capabilities/db'）` | 只有 `package.json` 里**装了 `expo-sqlite`** 时才会被写进注册表 ⇒ **裸 RN 工程自然生成空注册表** |
| `core.js:138-154` | `installCapabilities()` 对每一项核对 `MOBILE_HOST[<name>]` 非空，否则**点名报错** | 缺能力是**响的**，不是静默 |
| `lib/placeholders.js:165-169` | 脚手架校验读 `app.json` 的 `expo.name/slug/android.package` | **只影响 `init` 出来的新工程**（Expo 模板），不影响运行时 |
| `bin/cli.js:39` | 帮助文本里 `npm run web == build + expo start --web` | 纯文案 |
| `lib/template.js:76` | `SKIP_DIRS` 里排除了 `.expo` | 纯文件遍历 |

**⇒ 结论：`moobile-host` 的运行时（`index.js` / `core.js` / `native-rn.js` / `gesture-rn.js`）
零 Expo 依赖，裸 RN 直接用。** 桌面宿主**只有一个真实缺口**：
如果应用要用 `db` 能力，`expo-sqlite` 在 RNW 上没有对应物（目录 API 里 expo-sqlite 无 windows），
需要一个 RN 侧的 SQLite 替代物（`react-native-nitro-sqlite`？其 Windows 支持**未验**）——
这与决策点 4 的"② 要维护第二个宿主"是同一件事的具体化。

### 4.4 ③ `registry.generated.js` 在裸 RN 下怎么生成

**和 Expo 宿主完全同一套**（实测跑过：`npx moobile-host regen --out host/registry.generated.js`）：

```
moobile-host regen: 写入 host/registry.generated.js —— 0 项能力，1 项未装
```

生成物（`.scratch/rnw-probe/host/registry.generated.js`）：

```js
// 由 `npx moobile-host regen` 生成 —— **不要手改**。
// 依据：本目录 package.json 的 dependencies。
// 加能力就 `npm install` 那个包，然后重跑 regen。
// 已识别：（无）
// 未装（所以不注册，MoonBit 侧用到时会 fail-fast 并说明怎么装）：
//   · db  ← expo-sqlite（本地数据库（expo-sqlite））

export const registry = [
];
```

机制（`lib/regen.js`）：读**当前目录** `package.json` 的 `dependencies` + `devDependencies`，
与 `KNOWN` 表对账，命中就写**静态 import**（Metro 不能运行时拼字符串 import），
并支持 `--check` 做 diff（可进门）。⇒ **它与宿主形态无关，裸 RN / Expo / 将来的桌面宿主都用同一份**。

### 4.5 平台名 = `'windows'`（会影响组件库的 `platforms` 闸门）

`react-native-windows/Libraries/Utilities/Platform.windows.js` 里 `OS: 'windows'`；
`index.js:107` 把它原样传给契约（`platform: Platform.OS`），`core.js:44-51` 的 `detectPlatform()`
在原生 RN 上只会给 `'unknown'`，所以**必须**由 `index.js` 这条显式路径给。
⇒ `registerLibrary({ platforms: ['web'] })` 这类组件库（如 antd）**在桌面上会被闸门挡掉**，
报的是"库不支持这个平台"，而不是静默失效（与决策点 14 的口径一致）。

### 4.6 ★ 本轮验到的 JS 侧结果

```bash
# PATH 里必须有 pwsh（§1.5）
export PATH="$LOCALAPPDATA/Microsoft/WindowsApps:$PATH"
npx react-native bundle --platform windows --dev true --entry-file host/index.js \
  --bundle-output <探针目录>\out\index.windows.bundle --assets-dest <探针目录>\out
# → Welcome to Metro v0.83.8
# → LOG:Writing bundle output to: <探针目录>\out\index.windows.bundle
# → LOG:Done writing bundle output / Copying 5 asset files / Done copying assets
# → EXIT=0
```

产物：`index.windows.bundle` **5,976,518 B**（dev=true），sha256 `f0c4ce9d…`。
在 bundle 里能直接数出来这些标记（证明三样东西都真的进去了）：

| 标记 | 命中数 | 说明 |
|---|---|---|
| `installHostCore` | 4 | `core.js` 的契约装配 |
| `mountAppCore` | 4 | 挂载序列 |
| `PanResponder` | 44 | **`gesture-rn.js` 的手势通道也在 windows bundle 里** |
| `__moobileApp` | 1 | `core.js:467` 的调试钩子 |
| `还有` | 2 | **MoonBit 产物里的界面文字**（"还有 N 件"）⇒ 应用真的被打进去了 |

⚠️ **边界**：这只证明**能被 Metro 打包**，**不证明在 RNW 运行时能渲染**（那要原生编出来，§6）。

---

## 5. 对决策点 4 的影响（②"原生 RN Windows"这一档）

`PLAN.md` §7 决策点 4 现在是 🟡「倾向 ① WebView 壳」，②写着"**可行但要维护第二个宿主**"。
本轮给它补的实测是：

| 说法 | 现在有证据了吗 |
|---|---|
| "各宿主可以各自 pin 自己的 RN 版本，共享同一个 MoonBit 产物"（§1.2 推论 2） | ✅ **有**：桌面宿主 pin `react-native@0.83.10`（与 Expo 57 的 `0.86.3` **不同**），拿的是**同一份** `moobile.js`，Metro 打包成功 |
| "写一个新宿主 ≈ 30 行 + 构建配置" | ⚠️ **JS 侧成立**（本宿主手写 20 行），但**桌面这一档的成本不在这 20 行**：在 `windows/`（28 个生成文件）+ **VS 2026 + SDK 22621 的机器前提** + 每个原生依赖的 Windows 支持（目录 API 实测：`@shopify/react-native-skia` ❌、`react-native-reanimated` ❌、`react-native-gesture-handler` ❌；`react-native-svg` ✅、`react-native-webview` ✅） |
| "② 要维护第二个宿主" | ✅ 而且比"维护"更重：**这台机器上它根本编不出来** |

**一个额外的现实约束**：RNW **0.82 起彻底删掉了 Paper 架构，只有 Fabric/New Arch**
（[0.83 getting-started](https://microsoft.github.io/react-native-windows/docs/0.83/getting-started) 原文：
"Starting with React Native Windows 0.82, the legacy Paper architecture has been completely removed"）。
所以桌面这一档没有"退回老架构"这条路。

---

## 6. 诚实清单（本轮**没**验证的东西）

| # | 没验的 | 为什么 | 怎么才能验 |
|---|---|---|---|
| 1 | **原生 Windows 应用真的编出来 / 跑起来 / 渲染出界面** | 本机无条件（VS 2026 + SDK 22621 都缺） | 按 §2.3 补齐后重跑 `npx react-native run-windows --no-launch` |
| 2 | `PlatformToolset v145` 是否**必需**（还是可用 v143 顶） | MSB8036（SDK）先报，走不到 toolset 那一步；且 CLI 的 18.6 闸门本身就把 2022 挡在外面 | 装完 VS 2026 + SDK 22621 后，用 `-p:PlatformToolset=v143` 试一次 |
| 3 | 装了 SDK 22621 **就够不够**（是否还缺别的组件） | 只到 MSB8036 就停了 | 同上 |
| 4 | `@react-native-windows/find-dotnet-tools@0.0.0` 与 0.83.2 CLI 是否**完全**配套（后面还有没有别的漏声明依赖） | 只做到静态扫出这一处不可解析的 require | 编过一次就知道了 |
| 5 | `react-native-svg` 在 RNW 上**自动链接 + 渲染** | 依赖原生编译 | 同上 |
| 6 | `react-native-webview` 在 RNW 上的行为 | 同上 | 同上 |
| 7 | Metro bundle（windows 平台）在**运行时**能否被 RNW 的 JS 引擎正确求值 | 需要原生壳 | 同上 |
| 8 | 桌面上的**手势通道**（`gesture-rn.js` 的 PanResponder 分支，`MEASURE_ORIGIN = Platform.OS !== 'web'` ⇒ 在 windows 上会走"量元素原点"那条路） | 同上 | 同上；这一条**风险最高**（FINDINGS 里那条"原生 locationX 会在中途换参照系"的坑正是这条路） |
| 9 | 桌面上的 `MOBILE_HOST.native.visibility/geometry` 替代物（`AppState` / `Dimensions` 在 RNW 上是否可用） | 同上 | 同上 |
| 10 | RNW 的 `Platform.OS === 'windows'` 会让哪些组件库闸门失效 | 只读了源码，没跑 | 接一个 `platforms:['web']` 的库看报错 |
| 11 | 磁盘：完整 RNW 原生构建**实际**吃多少 | 没编成 | 编一次 |
| 12 | NuGet restore 在**本机**能否顺利完成 | 直连 MSBuild（`-restore`）跑了 13 分钟停在「正在确定要还原的项目…」没有任何后续输出，被我 kill 了；`pkgs.dev.azure.com` 那份 RN 公开 feed 与 `api.nuget.org` 都 `curl` 得通（200/302，<0.5 s），所以**不是网络不通，原因未知** | 补齐 VS 后重跑；或在能出网的机器上对照 |
| 13 | VS 2026 的 `channelId` / `productId` 字面值 | `aka.ms/vs/18/release/channel` 与 `aka.ms/vs/18/*.exe` 在本网络**302 到 bing**（同一个 `aka.ms/vs/17/release/channel` 是好的，200/91 KB），所以拿不到 VS 18 的 channel manifest | 装完 VS 2026 用 `vswhere -latest -property channelId` 与 `... -property productId`（**`vswhere` 一次只认一个 `-property`**，实测）读出来 |
| 14 | winget 那条 `--custom` 命令**端到端**跑通 | 没真装（几 GB + 系统级改动，留给用户） | 用户跑一次 |
| 15 | `moobile-host` 的 `db` 能力在桌面上的替代物 | 没有候选包被验证过 | 真要本地库时再选型 |
| 16 | ReactNative.Directory 的 `windows` 标记本身可靠不可靠 | 那是**社区元数据**（作者填/爬虫推），我只把它当旁证 | 与 ①（tarball 内容）交叉一致时才下结论，本文就是这么做的 |

---

## 7. 建议的下一步（按性价比）

1. **先拍"要不要做桌面原生"**（决策点 4）。本轮把 ② 的成本从"另一个宿主"具体化成了
   **"VS 2026 + SDK 22621 + 每个原生依赖各自的 Windows 支持"**，而 ①（WebView 壳）的前置实验 E6 **仍然没做**。
   ⚠️ 一个新增的不对称：**若走 ①，`@shopify/react-native-skia` 那套 canvas 在桌面 WebView 里可以直接复用
   （Web 端本来就跑 canvas）**，而走 ② 必须先把罗盘改写成 `react-native-svg`。
2. **如果要做 ②**：先按 §2.3 装 VS 2026 + 组件（**一次安装、约几 GB**），
   然后**只做一件事**：把本轮的探针工程重跑 `run-windows`，直到出界面。
   这之前不要动库、不要动应用。
3. **无论选哪档，都建议先落一条"宿主矩阵"文档**：桌面宿主 pin `react-native@0.83.10` / RNW `0.83.2`，
   Expo 宿主 pin `react-native@0.86.3` —— 两边**版本线不同但产物相同**这件事，
   本轮已有一条实测（§4.6），值得写进 `docs/ARCHITECTURE.md` 的宿主一节。
4. **两个可以立刻独立收口的环境坑**（与桌面无关，但下次谁碰 RNW 都会再撞一次）：
   `@react-native-windows/find-dotnet-tools` 的漏声明（§1.4）与 `pwsh` 的 PATH（§1.5）。

---

### 附：本轮命令与日志对照表

| 编号 | 命令 | 日志 |
|---|---|---|
| 01 | `npx --yes @react-native-community/cli@latest init RnwProbe --version 0.83.10 --pm npm --skip-git-init` | `logs/01-init.log` |
| 02 | `npm install --save-exact react-native-windows@0.83.2` | `logs/02-install-rnw.log` |
| 03 | `npx react-native init-windows --overwrite --logging`（第一次，失败） | `logs/03-init-windows.log` |
| 03b | 同上（补依赖 + pwsh 后，成功） | `logs/03b-init-windows.log` |
| 04/05 | 补 `@react-native-windows/find-dotnet-tools@0.0.0` | `logs/04-*.log` `logs/05-*.log` |
| 06/07 | 官方依赖自检（全量 / VSUWP verbose） | `logs/06-*.log` `logs/07-*.log` |
| 08 | `winget install --id Microsoft.PowerShell`（发现已装） | `logs/08-install-pwsh.log` |
| 09 | **`npx react-native run-windows --no-launch --logging`（关键失败）** | `logs/09-run-windows.log` |
| 10 | MSBuild 直连（带 `-restore`，挂住，已 kill） | `logs/10-msbuild-direct.log` |
| 12/13 | MSBuild 直连（不给 `SolutionDir`，MSB4086） | `logs/12-*.log` `logs/13-*.log` |
| 14 | **MSBuild 直连（给 `SolutionDir`，MSB8036 / SDK 22621）** | `logs/14-msbuild-solutiondir.log` |
| 15 | `bundle --platform windows`（无 pwsh，平台不认识） | `logs/15-bundle-windows.log` |
| 16 | Q1 的全部环境查询命令（合并成一份快照；含两条 `reg query` 因 MSYS 改写出错后的补记） | `logs/16-q1-evidence.log` |
| 17 | **`bundle --platform windows`（有 pwsh，成功）** | `logs/17-bundle-windows-with-pwsh.log` |
