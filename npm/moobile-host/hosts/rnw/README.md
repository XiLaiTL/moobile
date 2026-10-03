# moobile-template（`--host rnw`：Windows 桌面宿主）

用 [moobile](https://github.com/XiLaiTL/moobile) 写的跨端应用，**宿主是裸 RN + react-native-windows**。
界面与逻辑是 **MoonBit**（`app.mbt`），你不需要写 React 组件。

> 这是 `moobile-host init <目录> --host rnw` 生成出来的样子。
> **应用侧（`moon.mod` / `moon.pkg` / `app.mbt`）与 `--host expo` 那份逐字相同** ——
> 换的只是宿主，这正是"宿主是可替换件"。

## 环境要求

| 工具 | 下限 | 装 |
|---|---|---|
| [MoonBit](https://www.moonbitlang.com/download/) | `moon` 0.1.20260827 以上 | `curl -fsSL https://cli.moonbitlang.com/install/unix.sh \| bash` |
| Node.js | 20 以上 | 见 [nodejs.org](https://nodejs.org/) |
| **pwsh（PowerShell 7）在 PATH 上** | —— | ⚠️ 不在 PATH 时，RNW **看不见 `windows` 平台**（报 `Invalid platform "windows"`），见下 |

**要起原生窗口还需要**（本机不需要这一档也能验"能不能把界面打进宿主"）：

| 要什么 | 为什么 |
|---|---|
| **VS 2026 ≥ 18.6.1**（不是文档写的 VS 2022） | RNW 包内自带的 `rnw-dependencies.ps1` 写的是 `$vsver = "18.6.1"` |
| `Desktop development with C++` / `.NET Desktop` / `UWP + C++ (v143) UWP tools` | 同上脚本 |
| Windows SDK **10.0.22621.0** | RNW 在 New Arch 下强制它 |

## 三条命令

```bash
npm install
npm run build        # moon build --target js + moobile-host build（出 moobile.js）
npm run windows      # 生成 native 工程并起窗口（第一次会跑 init-windows，较慢）
```

## 不上工具链也能跑的判据

```bash
npm run bundle:windows
```

它只走 Metro + RNW 的平台解析 + `AppRegistry` 入口，验的是
**"同一份 MoonBit 产物能不能进这个宿主"** —— 与"窗口能不能起来"是两件事（后者要上面那套 VS）。

⚠️ **三个坑（都会把报错指向错的地方）**：

1. `@react-native-windows/find-dotnet-tools` 在 RNW 0.83.2 里**漏声明**（0.84.0 才修）→
   已写进本项目的 `dependencies`（**不能**放 devDependencies，`npm install` 会把它剪掉）。
   缺了它，`init-windows` / `run-windows` 会报"未知命令"。
2. **`pwsh` 必须在 PATH 上**：缺了它，RNW 的配置加载会抛错而 RN CLI **静默吞掉**，
   于是报的是 `Invalid platform "windows" selected`（看着像"RNW 没装"）。
3. Windows 上把 `pwsh` 目录拼进 PATH 时，**在 bash 里要用 `/c/...`、在 node 里要用 `C:/...`**
   —— 两种写错都报同一句 `Unable to find pwsh.exe. It should have been made available by yarn install`。

细节与 16 条诚实清单：[`docs/design/DESKTOP-RNW.md`](https://github.com/XiLaiTL/moobile/blob/main/docs/design/DESKTOP-RNW.md)。

## 目录

| 文件 | 干什么 |
|---|---|
| `app.mbt` | **你要改的就是这个**：`Model` / `Msg` / `update` / `view` |
| `moon.mod` / `moon.pkg` | MoonBit 模块与包的声明（与 Expo 那份相同） |
| `App.js` | 宿主侧接线：`installHost()` + 注册 SVG 画布后端 + `mountApp(app, …)` |
| `index.js` | 裸 RN 入口：`AppRegistry.registerComponent(...)` |
| `moobile.js` | **构建产物**（`npm run build` 生成），不要手写、不要提交 |
| `registry.generated.js` | `npm run regen` 生成的能力注册表，不要手改 |
| `windows/` | `npx react-native init-windows` 生成的原生工程（不入库） |
