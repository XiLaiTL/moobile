# zhouyi-reader-desktop —— 《御纂周易折中》阅读器的 **Windows 桌面宿主**

同一个应用（`examples/apps/zhouyi-reader/`）的第三个宿主：**裸 RN + `react-native-windows`**。
另两个是那里的 Expo 宿主（web / Android）。

```
examples/apps/zhouyi-reader/            ← MoonBit 应用 + Expo 宿主（web / Android）
examples/apps/zhouyi-reader-desktop/    ← 这个（Windows 桌面，裸 RN + RNW）
```

**应用侧一行都不用改**：`App.js` 只是把同一份 `moobile.js` 交给宿主，
`moon.mod` / `moon.pkg` / `app.mbt` 三端完全一样 —— 这就是"宿主是可替换件"。

## 为什么是"裸 RN"而不是 Expo

`Expo SDK 57` 钉 `react-native@0.86.3`，而 `react-native-windows@0.83.2` 要 `react-native@0.83.x`
（**RN 版本由宿主决定，库不绑版本**）。所以桌面这份**不带 Expo**、自己 pin 0.83.10：
两个宿主各自 pin 一个 RN，**共用同一份 MoonBit 产物**。

## 为什么画布走 SVG

Windows 上 **Skia 没有后端**（`@shopify/react-native-skia` 的 tarball 里 `package/windows/`
是 0 个文件），也没有 DOM canvas。`react-native-svg` 是 RNW 上唯一现成的矢量通道
（它自带 153 个 windows 文件，含 Fabric 实现）—— 就是 `moobile-host/canvas-svg.js` 那条。

## 本地能跑的判据（不需要 VS 工具链）

```bash
cd examples/apps/zhouyi-reader && npm install && npm run build   # 先出 moobile.js
cd ../zhouyi-reader-desktop && npm install
node verify.mjs                                                  # ← 判据在这
```

它做一件事：`react-native bundle --platform windows`，然后断言
**产物真的生成了、而且里面带着这个应用的文本**（从 `moobile.js` 里读一段真串去比对）。
这也顺带证明"同一份 MoonBit 产物能进第三个宿主"。

## 前置（**装不齐就跑不了原生窗口**，但上面那条判据不需要）

| 要什么 | 为什么 | 本机 |
|---|---|---|
| **VS 2026 ≥ 18.6.1**（不是文档写的 VS 2022） | RNW 0.83.2 **包内自带**的 `rnw-dependencies.ps1` 写的是 `$vsver = "18.6.1"`；CLI 的闸门在 `msbuildtools.js:160` | ❌ 只有 VS 2022 BuildTools |
| `Desktop development with C++` / `.NET Desktop` / `UWP + C++ (v143) UWP tools` | 同上脚本的 `$vsWorkloads` / `$vsComponents` | ❌ 全缺 |
| Windows SDK **10.0.22621.0** | RNW 的 `WindowsSdk.Default.props` 在 New Arch 下强制它 | ❌ 只有 10.0.19041.0 |
| `pwsh`（PowerShell 7）**在 PATH 上** | `@react-native-windows/find-dotnet-tools` 会 require 它；**缺了表现为"`windows` 平台不存在"** | ⚠️ 装了但不在 PATH |
| `@react-native-windows/find-dotnet-tools@0.0.0` **在 `dependencies` 里** | RNW 0.83.2 的 CLI **漏声明**这个依赖（0.84.0 才修）→ `require` 抛错被 RN CLI 静默吞掉 → `init-windows` 报"未知命令" | ✅ 已写在 `package.json` |

补齐命令、原始报错与 16 条诚实清单都在
[`../../../docs/design/DESKTOP-RNW.md`](../../../docs/design/DESKTOP-RNW.md)。

补齐之后：

```bash
export PATH="$LOCALAPPDATA/Microsoft/WindowsApps:$PATH"   # pwsh
npx react-native init-windows --overwrite --logging       # 生成 windows/（28 个文件，工具产物、不入库）
npx react-native run-windows                              # 编译 + 起窗口
```
