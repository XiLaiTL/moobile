# moobile-host

[moobile](https://github.com/XiLaiTL/moobile)（用 MoonBit 写 UI、交给 React Native 渲染）在
**React Native / Expo** 上的宿主。

它只做三件事：

1. 装 `globalThis.MOBILE_HOST`（React、5 个基础组件、两个调度钩子、后端地址）；
2. **契约版本比对** —— 库与宿主各自声明自己实现的契约版本，不等就当场报错并说出两个版本号；
3. 装**能力注册表**（本地数据库等），并核对每一项真的装上了。

## 用法

```js
// App.js —— 整个宿主侧就这几行
import { mountApp } from 'moobile-host';
import { app } from './moobile.js';            // MoonBit 侧编译产物
import { registry } from './registry.generated.js';

export default mountApp(app, { registry });
```

MoonBit 侧只需要一个导出：

```moonbit
pub fn app() -> @moobile.JsValue {
  @moobile.handlers_with_init(init=init_app, update~, view~)   // 或 handlers(...)
}
```

## 能力注册表（`registry.generated.js`）

不要手写它，**从依赖生成**：

```bash
npx moobile-host regen          # 读 package.json，写 registry.generated.js
npx moobile-host regen --check  # CI 用：不一致就非零退出
```

加能力 = `npm install` 那个包 + 重跑 `regen`。生成物是**静态 import**（Metro 不能靠运行时
拼字符串 import），并在注释里列出"识别了什么、哪些没装"。

运行时还会再核对一遍：注册表里声明了 `db`，但 `MOBILE_HOST.db` 装完是空的 →
报错会点名 `db` 与提供它的 `expo-sqlite`，而不是让你对着
`Cannot read properties of undefined` 猜。

## 后端地址

RN 里没有"同源"这回事，`fetch('/todos')` 没有意义：地址由宿主给（`MOBILE_HOST.apiBase`），
默认 Android 走 `http://10.0.2.2:8787`、其余走 `http://127.0.0.1:8787`。
真机可以改用 `adb reverse tcp:8787 tcp:8787`。

## 兼容性

| moobile（MoonBit 包） | moobile-host | MOBILE_HOST 契约 |
|---|---|---|
| 0.2.x | 0.2.x | 1 |

契约版本写在两边：`app.mbt` 的 `host_contract_version` 与 `index.js` 的 `CONTRACT`。
**改契约形状必须同时 +1。**

## 发布（维护者）

本机默认 registry 是淘宝镜像（只读），**发布必须显式指向官方**：

```bash
npm publish --registry=https://registry.npmjs.org/     # package.json 里也写了 publishConfig
```
