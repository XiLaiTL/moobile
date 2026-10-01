# chat-app

用 [moobile](https://github.com/XiLaiTL/moobile) 写的跨端应用（Web / Android / iOS 同一份 UI）。
界面与逻辑是 **MoonBit**，宿主是 **React Native / Expo** —— 你不需要写 React 组件。

## 环境要求

只要两样，**不需要 Python**：

| 工具 | 下限 | 装 |
|---|---|---|
| [MoonBit](https://www.moonbitlang.com/download/) | `moon` 0.1.2026xxxx 以上 | `curl -fsSL https://cli.moonbitlang.com/install/unix.sh \| bash` |
| Node.js | 20 以上 | 见 [nodejs.org](https://nodejs.org/) |

跑 Android 另需 Android SDK（`adb` 在 `PATH` 里）；跑 iOS 需要 macOS + Xcode（**本模板未在
iOS 上实测过**，只生成不承诺）。

## 三条命令跑起来

```bash
npm install          # 装宿主与 Expo
npm run web          # 浏览器里打开（会先自动编 MoonBit）
npm run android      # 或：模拟器 / 真机上跑
```

`npm run web` / `android` / `ios` 都会**先跑 `npm run build`**：

```
npm run build  ==  moon build --target js      # MoonBit → _build/js/.../<模块名>.js
                   + moobile-host build        # 把它搬到 ./moobile.js（Metro 只认工程目录内的路径）
```

## 你要改的是哪个文件

| 文件 | 谁写 | 说明 |
|---|---|---|
| **`app.mbt`** | **你** | 全部业务：`Model` / `Msg` / `update` / `view` |
| `App.js` | 生成后不用改 | 4 行：`mountApp(app, { registry })` |
| `moon.mod` / `moon.pkg` | 基本不动 | 加能力时才加一条 import |
| `moon.pkg` 的 `exports` | 不动 | 应用只导出 `app` 一个名字 |
| `moobile.js` | **构建产物** | 不要手写、不要提交（已在 `.gitignore` 里） |
| `registry.generated.js` | `npm run regen` 生成 | 能力注册表，不要手改 |

## 开发闭环

改 `app.mbt` 里的 `view` → 存盘 → 重跑 `npm run web`（或 `npm run android`）→ 页面变。
MoonBit 侧编译错误会直接打在终端上，**不会**变成页面上的空白屏。

界面上那行"本次会话 N 秒"是 `subscriptions` 的样本（运行时每 5 秒推一个消息回来，
不需要用户交互）。不用它就把 `subscriptions` 那一行从 `app()` 里去掉。

## 加能力

能力（本地库、网络、剪贴板…）**不是新 API，是加一个 npm 包 + 一条 import**：

```bash
npm install expo-sqlite            # 1. 装宿主侧的实现
npm run regen                      # 2. 重生成 registry.generated.js（生成物入库，能 diff）
```

```moonbit
// 3. moon.pkg 里加一条 import
import { "XiLaiTL/moobile/sqlite" @sqlite }
```

然后 `@sqlite` 就能用了；缺包时库侧会**点名报错并说清装什么**，而不是 `undefined`。
完整的"本地库 + 网络同步 + 多页面"参考实现见仓库的 `examples/apps/todo-app/`。

## 出问题时

| 现象 | 原因 |
|---|---|
| `Cannot find module './moobile.js'` | 没跑 `npm run build`（或 `moon build` 失败被忽略了） |
| `契约版本不匹配 —— 库=X，宿主=Y` | `moon.mod` 里的库与 `package.json` 里的 `moobile-host` 不是同一代，把两个都升级（见库的 CHANGELOG） |
| `能力 xxx 声明由 yyy 提供，但安装后仍然是空的` | 装了包但没重跑 `npm run regen` |
| 改了 `metro.config.js` 没生效 | 要**重启** Metro |
