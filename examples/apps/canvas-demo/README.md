# canvas-demo —— 画布通道 + 手势通道的示例

一个**可选特性**的示例应用：用 `@canvas` 画一个环，用 `@gesture` 拖动它。
两条通道在同一个界面里闭环：

```
手指拖动（手势通道）→ Msg → Model.angle → view 算出新的绘制指令（画布通道）→ Skia 重画
```

## 为什么它单独存在（而不是塞进 todo-app / template）

`examples/apps/todo-app` 与 `examples/apps/template` 是 **T1 锁步**的一对
（模板是真源、demo 是它的产物）—— 往 demo 里加依赖会**直接让 T1 门变红**，
而模板是**每个使用者拿到的东西**，不该背 Skia 这个原生依赖（它连带
`reanimated` + `worklets`，且要 `prebuild` + 重建 APK）。
所以**可选特性各自有自己的示例** —— 先例是 `examples/apps/antd-demo`。

这个工程本身是 `npx moobile-host init` 生成的（脚手架真源是 `examples/apps/template`），
只改了四处：`app.mbt`（换成画布+拖动）、`moon.pkg`（加两条 import）、
`App.js`（注册 Skia）、`package.json`（加三个原生依赖）。

## 跑起来

```bash
npm install                # ⚠️ 见下面"两个必读的坑"
npm run android            # 或 npm run web（web 上画布要另配 CanvasKit，见下）
```

真机验证（模拟器 + Metro + 已装的 APK）：

```bash
cd examples/apps/canvas-demo
node device_check.mjs      # 12 项：token / 像素 / 拖动 / 点按 / 证伪
```

**实测结果（2026-10-01，Android 模拟器 `moobile64`，12 / 12 全过）**：

| 判据 | 实测 |
|---|---|
| 画布挂载 | `画布 ops=13 边长 200` |
| 真绘制（截图像素） | 品红圆环 **3798 px** · 绿方块 **324 px** · 蓝指针 **424 px** |
| 手势 → Model | 横滑 80px → `dx=80 dy=0 n=9`（**逐位对上滑动距离**） |
| Model → 画布 | 蓝指针质心移动 **74.5 px**（整条链的见证） |
| 点按 | `点按 0 → 1` |
| 证伪 | 界面外滑动 → 三个 token 全不变 |

## 两个必读的坑（都实测踩过）

### 1. 原生依赖的版本必须用 **Expo 认的那一套**

用 `npm install <native-lib>` 会装到**比 SDK 期望更新**的版本，而原生构建会以
**完全看不出是版本问题**的方式失败：

```
Failed to apply plugin 'expo-autolinking'.
> A problem occurred configuring project ':expo-modules-core'.
   > Task with name 'mergeDebugNativeLibs' not found in project ':react-native-worklets'.
```

实测（Expo SDK 57）：装 `skia@2.13.1 / reanimated@4.7.0 / worklets@0.13.0` 必挂；
换成 SDK 期望的 **`skia@2.6.2 / reanimated@4.5.1 / worklets@0.10.1`** 立刻成功。

```bash
npx expo install --check          # ← 先问 Expo 期望哪些版本（这条最省事）
# 或者直接指版本装（本机 npmmirror 的 audit 端点 404，所以要 --no-audit）
npm install --no-audit @shopify/react-native-skia@2.6.2 react-native-reanimated@4.5.1 react-native-worklets@0.10.1
```

### 2. 这个组合下 **`babel.config.js` 仍然必须有**（尽管 Expo 文档说不用）

Expo 的 reanimated 那页写着 "No additional configuration is required. Reanimated Babel plugin
is automatically configured in `babel-preset-expo`"。**实测在 SDK 57 + `babel-preset-expo@57.0.13`
这个组合下不成立**：原生侧 `libreanimated.so` / `libworklets.so` 都进了 APK，
但 JS 侧一加载就报（Skia 把真因吞了，只留一句）：

```
Error: react-native-reanimated is not installed!   (OptionalDependencyNotInstalledError)
```

补上 `babel.config.js`（插件**放最后**）即好 —— 见本目录那个文件里的说明。

> ⚠️ **改完要 `--clear` 重启 Metro**：我改完配置后没清缓存，跑的还是旧 bundle，
> 白排查了一轮（症状与"配置没生效"一模一样）。

## 还没验 / 不支持的

- **Web 上的画布**：Skia 在 web 需要额外加载 CanvasKit（见 Skia 官方 web 安装说明），
  本示例**只验了 Android**。手势通道与画布无关，web 上已验证（见 `examples/apps/gesture-spike`）。
- **文字**：画布上没画文字（`registerSkiaCanvas` 没传 `makeFont`，而指令里没有 `fill_text`）——
  所以"canvas 上画中文"仍未上过真机。
- **多指 / pinch / rotate**：手势通道 v1 只做单指拖动 + 点按（契约里留了 `pointers` 字段）。
- **iOS**：未验。
