---
title: libgen：一份配置 + 一条命令，以及它猜不出来的三件事
description: libgen 的四份产物、--check 为什么是判据、配置形状，以及 content / defaultExports / platforms 这三处"类型定义在撒谎"必须由人声明。
---

# libgen：一份配置 + 一条命令

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、命令与产物

```bash
cd <应用>/host && npx moobile-host libgen          # 生成
cd <应用>/host && npx moobile-host libgen --check  # 只校验（生成物被手改就红，进 CI）
```

- `libgen.config.json` 从 cwd **往上找**（最多 8 层，与 `node_modules` 同一规矩）；
  `out` 里的路径**相对配置文件**，所以不用写 `../`（**G** 的 `index.js`）。

| # | 产物 | 是什么 |
|---|---|---|
| ① | `<应用根的 out.manifest>`（例 `generated/md.manifest.json`） | 组件 → prop 名 + 类别，入库、可 diff |
| ② | `<应用根的 out.host>`（例 `libraries.generated.js`） | `registerLibrary(...)` 的调用 |
| ③ | `<out.moonbit>/components.generated.mbt` | 与 `@html` 平级的 MoonBit DSL 包 |
| ④ | `<out.moonbit>/moon.pkg` | 那个包的 `moon.pkg`（`supported_targets = "+js"`） |

⚠️ **M** 的那一节写「一条流水线出**三**份产物」，**少列了 ④**；代码落 **4 个文件**，
工具自己也打印「4 份产物」（**G** 的 `index.js` 的 `plan()`；实测 `libgen --check` 输出）。

## 二、为什么必须同源

宿主侧认的是**名字**、MoonBit 侧发的也是**名字**；两边各写一份清单就是等着漂。
`--check` 就是这件事的判据 —— **任一侧被手改都会报「第 N 行起不一致」**（**D** 的 §5 T6）。

## 三、应用侧配置（字段全部可选，只列要动的那几个）

```jsonc
{ "libraries": [{
  "namespace": "md",
  "package": "react-native-markdown-display",
  "platforms": ["android", "ios", "web"],
  "content": ["Markdown"],
  "defaultExports": ["Markdown"],
  "out": { "manifest": "generated/md.manifest.json",
           "host": "libraries.generated.js", "moonbit": "md" }
}]}
```

## 四、三件事生成器猜不出来，必须由人声明

共同规矩：**类型定义说不准的事由人声明，声明错了就报错**（不猜、不回落）。

| 声明 | 什么时候必须写 | 不写会怎样 |
|---|---|---|
| `content` | 组件把 children 当**数据**用（`.d.ts` 写 `ReactNode`，运行期却要字符串） | 字符串子节点变成 `<Text>` **元素** → 真机上报 `Input data should be a String`（每个字符一次）；web 上未必同时炸 |
| `defaultExports` | 那个名字**只在模块的 `default` 导出上**（`.d.ts` 谎报了具名导出） | 启动即抛「`registerLibrary("md")` 里列了 `Markdown`，但模块里没有这个导出」 |
| `platforms` | 库只在部分平台可用（RN 库、带原生依赖的库） | 默认 `["web"]` ⇒ 在真机上**启动即抛**平台闸门错（**G** 的 `index.js`） |

- `content` 两种写法：`["Markdown"]` = 内容进 `children` prop；`{"Fancy": "text"}` = 点名落点 prop。
  `.d.ts` 真写着 `children: string` 时会自动判成原始字符串（manifest 里 `deliver_from: "type"`），
  **不需要**声明。
- 原始字符串这条通道**不需要宿主适配层**：`prop_str("children", …)` 到宿主就是
  `props.children === "…"`，它本来就是那个组件的 `children` prop（**D** 的 §N3b）。
- `defaultExports` 的错**只在真机（Hermes）露头** —— web/node 上打包器的 ESM interop 恰好看得见
  具名导出，所以「无头判据全绿」**推不出**「真机也对」（**M**）。
- 配置里写了清单里**没有**的组件名 / prop 名 ⇒ `libgen` 阶段**退出码 2**，不是静默忽略。
- 逐条证据：`examples/apps/chat-app/libgen.config.json`（带血泪注释的那份：两处「类型在撒谎」
  写在同一个配置里）与它的产物 `examples/apps/chat-app/libraries.generated.js`。
