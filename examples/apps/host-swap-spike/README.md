# host-swap-spike —— C0：换掉宿主，库与应用一行都不用改

**这是 `PLAN.md` §3.4 的 C0 实验的落地物**（背景：§1.2「宿主是可替换件 —— 库与具体 RN 版本
无关，也与 Expo 无关」）。在这之前那句话只有**读代码 + 间接证据**支撑：全文搜 `AppRegistry`
只搜得到「注释里说换成它会怎样」。

```bash
cd examples/apps/host-swap-spike
npm install          # react / react-dom / react-native-web / esbuild / moobile-host（**没有 expo**）
node verify.mjs      # 27 项断言，约 20 秒（要本机有 Chrome）
```

## 这个宿主与 Expo 那个差在哪

| | Expo 宿主（`examples/apps/template/` 或 `todo-app/host/`） | 这里 |
|---|---|---|
| 入口 | `import { registerRootComponent } from 'expo'` | **`import { AppRegistry } from 'react-native'`**（RN 自己的 API） |
| 平台映射 | `expo` 的 Metro 预设把 `react-native` 指到 `react-native-web` | **esbuild 一行 `alias`**（`verify.mjs` 里） |
| 打包/服务 | Metro + `expo start --web` | **esbuild 打包 + 一个 node http 静态服务**（连 Metro 都没有） |
| `App.js`（应用侧手写代码） | `mountApp(app, { registry })`，4 行 | **逐字相同**（见 `App.js` 的头注释） |
| MoonBit 产物 | `moon build --target js` → `moobile-host build` | **同一条流水线**（`verify.mjs` 现编现搬） |

**结论（实测，不是推理）**：同一份 `moobile.js` 在**零 Expo、零 Metro**的宿主下渲染出来了，
并且 输入 / 添加 / 勾选 / 删除 四条交互都回到了 MoonBit 的 `update`。

## 为什么用**模板应用**的产物，而不是 todo-app 的

因为要**只换一个变量**。`todo-app` 除了界面还用了两个**能力**（`@sqlite` 本地库、`@http` 网络），
而能力的实现本来就是宿主侧的东西（§1.2 推论 1：支持一个新平台 = 写一个新宿主 + 适配能力）——
把它混进来，"宿主能不能换"这件事就被"有没有 sqlite"盖住了。

模板应用（`examples/apps/template/`）带的是**最小 Todo、零能力**，所以这一轮证明的是纯粹的
那句话：**换宿主，库与产物不用动**。带能力的宿主（换个 db 实现）是下一步，不是这一轮的结论。

## `verify.mjs` 都断言了什么（27 项）

1. **前提**：这个工程 `import('expo')` 直接失败（不然"不含 Expo"就是空话）；
2. 编产物 → 搬产物（走 `moon build` + `moobile-host build`，**发现**产物而不是写死 `cp`）；
3. 打包 → **依赖图里一个 `node_modules/expo*` 都没有**、没有 Metro/`@expo` 运行时、
   原生 `react-native` 本体没被卷进来（只有 `react-native-web`）；
4. 起服务 → 真 Chrome（headless + CDP）加载页面；
5. 渲染：首屏出现「待办 / 还有 0 件」，`#root` 里有真实节点；
6. **新鲜度**：页面上的 `__ARTIFACT_SHA__` == 磁盘上 `moobile.js` 的 sha256
   （这条由 `index.js` + `verify.mjs` 的 define 注入，防的是"浏览器吃的是旧包"——本仓库
   在别处踩过"读到陈旧产物"的坑）；
7. 交互：输入 → 添加 → 勾选 → 删除，每一步都看 DOM 变没变；
8. 全程没有 `console.error` / 未捕获异常。

截图落在 `docs/evidence/shot-c0-bare-host.png`（⚠️ 按仓库惯例 `shot-*.png` 是 **gitignore** 的，
所以它只在你本机跑完之后存在 —— 仓库里的"证据"是那 27 条断言与它们的输出，不是这张图）。

## 几个记下来的坑

- **`npm install` 不一定装 devDependencies**：本机 npm 的生效配置是 `omit=["dev"]`，
  所以 `esbuild` 写在 `devDependencies` 里会被**静默跳过**（`npm install` 报"成功"，
  然后 `verify.mjs` 找不到 esbuild）。这里因此把它放在 `dependencies` —— spike 没有发布/
  生产的区分，宁可让一条命令一次到位。
- **RNW 的 `<Text>` 是两层**（外层 `div` + 内层 `span`）：按"文本最内层元素"定位时，
  它的 `parentElement` 是文本自己那一层，**不是行**。行要在往上找一层（这里是"最近的、
  同时包含「删」的祖先"）。
- **RNW 这一版没给 `Pressable` 加 `role="button"`**：靠 `[role=button]` 找按钮会扑空。
  按结构找（行的第一个子元素）比按属性找稳。
- 详细的真因与处置见 [`docs/FINDINGS.md`](../../../docs/FINDINGS.md) 的 C0 补记。

## 它不是什么

- **不是**新的官方宿主包（`moobile-host` 仍是 RN/Expo 那一份；这里只是证明"换得掉"）。
- **不是**"多端支持"的完成——它证明的是 §1.2 那条**机制**成立，桌面/WebView 宿主仍然要做。
- **不进** `tools/verify_all.sh` 的默认（离线）那一组：它要 Chrome + `node_modules`。
  它挂在 `--with-e2e` 那一组的尾巴上（没有 node_modules / 没有 Chrome 就 SKIP）。
