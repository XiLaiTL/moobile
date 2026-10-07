---
title: 注册：一次调用、两种形状，以及顺序与幂等
description: installHost / registerLibrary / mountApp 的顺序契约、components 的两种写法、注册时一并决定的四个参数、平台闸门没有默认值这条实测更正。
---

# 注册：一次调用、两种形状，以及顺序与幂等

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、顺序固定：install → register → mountApp

```js
installHost();                        // ① 先装：registerLibrary 要求 MOBILE_HOST 已存在
registerLibrary({
  namespace: 'app',
  components: { Gauge: makeGauge() }, // 手写组件 = 直接给实现，不需要 module
});
export default mountApp(app, { registry });   // ③ 内部还会再装一次（幂等合并）
```

- 少了第一步，**真机启动即抛** `registerLibrary 必须在 installHost 之后调用`
  （`npm/moobile-host/core.js`；`docs/FINDINGS.md` 的「接一个现成的 RN 组件」补记坑二）。
- ⚠️ 生成路径（`mountApp(app, { registry })` 与生成的 `registerX(registerLibrary)`）注册发生在 install
  **之后**，撞不上这条 —— **只有手写 `registerLibrary` 会**。

## 二、`components` 的两种形状

| 形状 | 含义 |
|---|---|
| `['Button', 'Table']` + `module` | 按**名字**从模块里挑（接别人的库走这条） |
| `{ Gauge: makeGauge() }` | 直接给**实现** —— 手写组件走这条，**不需要 `module`** |

- **名字两边必须一模一样**：MoonBit 侧写 `@html.node("app:Gauge", …)`。含冒号的标签在 `map_tag` 里
  **原样直通**（`render.mbt`）；写成 `Gauge`（忘命名空间）不报错，但会回落成 `View` 并计入 `unmapped` 计数
  —— 不报错、画错东西。
- **覆盖内置的 5 个**（`View` / `Text` / `Pressable` / `TextInput` / `ScrollView`）**不走这里**，
  走 `installHost({ components })`（见 `npm/moobile-host/index.js`）。
- `registerLibrary` 的**返回值**是实际注册进去的键数组 —— 启动日志与断言都拿它，
  **别只凭"没抛错"下结论**。

## 三、幂等：再装一次是**合并**，不是替换

- 注册之后 `mountApp` 内部再装一次，已注册的组件**保留**
  （`npm/moobile-host/README.md` 的「两个容易踩的形状」）。
  实测：注册 → 再 `installHostCore()` 一次 → 那个键还在。
- ⚠️ 只有 `reset: true` 才是"干净宿主"，那是**给测试用的开关**：合并是**全局**的，于是
  "没注册时应当无效"这类负例可能**假绿**（代价记在 `npm/moobile-host/core.js` 的 `reset` 注释里）。

## 四、注册时一并决定的四件事

| 参数 | 决定什么 | 注意 |
|---|---|---|
| `platforms` | 平台闸门：当前平台不在表里就**在注册时抛** | **没有默认值** ⇒ 不写 = **闸门不存在**（见下） |
| `jsonProps` | 哪个组件的哪些 prop 键走 JSON | 漏了 → 组件拿到**字符串**（在组件里当场抛是最好的处置） |
| `events` | 事件键 → 真正的 React prop 名，写进库级通配键 | 不声明就落到 RN 默认表（`click → onPress`），手写组件不认 ⇒ **回调永远不响、也不报错** |
| `wrap` | 每个根外面套一层（Provider） | 只作用于**应用根**，不是每个组件 |

### 平台闸门：`platforms` 的"默认值"是个流传的说法

- ⚠️ **"平台闸门默认是 `['web']`"不是代码**：`npm/moobile-host/README.md` 与
  `npm/moobile-host/canvas-skia.js` 的文件头都这么写，而 `npm/moobile-host/core.js` 里 `platforms`
  **没有默认值**、判定写作 `if (platforms && …)`。
  实测（platform = android）：**不写 `platforms` → 组件照常注册、不抛**；写 `['web']` → 注册时抛并点名平台。
  那句"默认 web"其实是 `libgen` 生成器那一侧的默认（`npm/moobile-host/libgen/index.js`）。
- ⇒ **手写注册要自己写 `platforms`**：要么诚实列出（同一命名空间可按平台注册不同实现），
  要么明知"它在每个平台都会被注册"。
- ⚠️ 想表达"不设闸门"就**不要写这个键** —— 写 `platforms: []` 不是"没有闸门"，而是"哪个平台都不允许"：
  实测（platform = web）注册时直接抛 `声明只在 [] 上可用`，等于应用**在每个平台都启动不了**。
