---
title: 应用骨架：模块、出口名字、首帧入口、update 是纯的
description: 一个 moobile 应用由哪几个文件组成、出口为什么只能叫 app、首帧之前的事怎么排、以及 update 的副作用边界。
---

# 应用骨架：模块、出口名字、首帧入口、update 是纯的

主文档（`SKILL.md`）是**门禁**（最贵的几条上桌）；本文件是它的**细则** —— 按主题展开，按需读。

## 一、应用 = 一个独立模块 + 这几个文件

| 文件 | 谁写 | 作用 |
|---|---|---|
| `app.mbt` | **你** | 全部业务：`Model` / `Msg` / `update` / `view`（+ `subscriptions`） |
| `moon.pkg` | 基本不动 | `supported_targets = "+js"`（库只有 js 目标）+ 5 条 import + `link: { "js": { "format": "esm", "exports": ["app"] } }` |
| `App.js` | 生成后不动 | 4 行：`mountApp(app, { registry })` |
| `registry.generated.js` | `npm run regen` 生成 | 能力注册表，**不要手改** |
| `moobile.js` | `npm run build` 生成 | 构建产物，不要手写、不要提交 |

分工与理由见 `examples/apps/template/README.md`。

- **应用必须是独立模块**（自己的 `moon.mod`）：库的 `moon.mod` 随发布包发出去，应用塞进去等于让所有使用者下载你的依赖。
- import 路径**照抄模板**：库本体 + `style` + `vendor/rabbita/{html,cmd,sub}`。⚠️ 模板注释里那句"写 `XiLaiTL/moobile/html` 是**错的**"**已过期** —— 根上的短路径（`README.md` §1.1）现在也解析得到，两条都能编。

## 二、出口只有一个名字：`app`

```moonbit
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~, subscriptions~)
}
```

- 导出名 `app` 必须与 `moon.pkg` 的 `exports`、`App.js` 的 import **三处一致** —— 不一致编译器不报，宿主挂不起来。

## 三、首帧之前要干的事：`handlers_with_init`

- 读本地库、发第一个请求走 `handlers_with_init(init=..., update~, view~)`：`init` 返回的命令由运行时排队执行，**不阻塞挂载**（范例 `examples/apps/todo-app/main.mbt`）。
- **别塞进模块初始化**（那时宿主还没装 `MOBILE_HOST`），也**别塞进 `view`**（`view` 每帧都跑）。
- ⚠️ 那个初始化函数**不能叫 `init`** —— MoonBit 里 `init` 是保留形状（必须无参无返回值），报错是
  `init function must have no arguments and no return value`；todo-app 叫 `init_app`（`examples/apps/todo-app/model.mbt`）。

## 四、`update` 是纯的，副作用走 `Cmd`

```moonbit
pub fn update(model : Model, msg : Msg, emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    SetDraft(s) => ({ ..model, draft: s }, @cmd.none)
    Add => ({ ..model, draft: "" }, add_cmd(emit, model.draft))
  }
}
```

- 形状 `(Model, Msg, Emit[Msg]) -> (Model, Cmd)`，与上游 rabbita / elmish 同款。
- **写库、发请求都不在 `update` 里做**：返回 `Cmd`，结果作为一条 `Msg` 回到 `update`。todo-app 的纪律是
  "清单只在 `Loaded` 这条臂上被改写"，于是界面与库里不可能不一致。
- 顺序型副作用（推完再拉）用计数器 + `@cmd.batch([...])` 组合，**不用 sleep**。
