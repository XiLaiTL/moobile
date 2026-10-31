# moobile —— 用 MoonBit 写一次 UI，跑 Android / iOS / Web

moobile 是 [rabbita](https://github.com/moonbit-community/rabbita)（MoonBit 的 TEA 声明式 UI 框架）
的 **React 渲染后端**：`Model` / `Msg` / `update` / `view` 与 `@html` DSL 都不变，只把最后一跳从
"操作 DOM"换成"产出 React 元素"——同一份 MoonBit 代码，经 React Native 上 Android / iOS，
经 react-native-web 上浏览器。布局、排版、文字引擎交给 React / RN，moobile 不自己实现渲染。

已实测 Web、Android 真机、Electron 真窗口；iOS 的宿主工程能生成，但还没实测。

这站是那批 skill 的**人读侧**：机器读 `md/**` 原文与 `llms.txt`，人读这里，两边出自同一次解析
—— 所以不用在两份文档之间对哪份是新的，改内容只改内容源。

**第一次来**，点顶栏那栏「从零起一个应用」，或直接在左边书架里点第一份 —— 它从 TEA 四件套
一路讲到接上 Expo 宿主跑起来。其余五份按下面这张表选。

| 你要做的事 | 读哪一份 |
|---|---|
| 新建应用、加页面、改视图与样式、接宿主 | `moobile-app-development` |
| 加一个库里没有的组件（写宿主侧 React 实现 + 注册） | `moobile-custom-component` |
| 用现成的第三方 React / RN 组件库（antd 这类，走 `libgen`） | `moobile-react-library` |
| 把老的 rabbita 项目搬过来（判据是「报告零遗漏」） | `moobile-migrate-from-rabbita` |
| 改 moobile 本体：库、宿主包、生成器、发版 | `moobile-library-development` |
| 「编过了、界面对，但行为或外观不对」 | `moobile-pitfalls` |

每份的主文档都会指到它的 `references/` —— 那才是深水区，按需读，不用一次读完。

另外两条给读者的：**搜索** `⌘K`（Windows 上 `Ctrl+K`），命中分「整页 / 某一节」；
每份 skill 的**原文**在 `/md/...`，给 agent 的整站索引在 `/llms.txt`。

## [从零起一个应用](../moobile-app-development/SKILL.md)
