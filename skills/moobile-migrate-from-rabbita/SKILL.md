---
name: moobile-migrate-from-rabbita
description: 把一份既有的 rabbita（MoonBit TEA）项目搬成 moobile 项目的作业规程 —— 判据是「报告零遗漏」，不是「自动改对了多少」。
whenToUse: 用户说"把老项目 / rabbita 项目搬到 moobile""跑 `create --from-rabbita`""MIGRATION.md 怎么读""迁移后样式没了 / 点击点不动""重跑 create 会不会冲掉我的改动"时加载；也用于判断某处改写该自动做还是必须留给人。要改库本身、要接第三方 React 组件库、要从零新建应用——用别的 skill。
---

# 从既有 rabbita 项目迁移到 moobile（A6）

**解决什么**：把一份已经在浏览器里跑着的 rabbita 项目搬成 moobile 项目，
并把**搬不动的东西一条不落地报出来**。
**先跑什么**：`npx moobile-host create --from-rabbita <既有项目> <新目录> --dry-run`（先看清单，**不落盘**）。

这份 skill 的重点**不是"自动改对了多少"，而是纪律**：什么许自动改、什么必须留给人、
报告里每一项都要指得出下一步。判据的原文在 `npm/moobile-host/lib/migrate/create.js` 的文件头与
`docs/design/SCAFFOLD.md` §3.7.4。

## 一、三条最贵的纪律（错了代价最大）

| 纪律 | 错了会怎样 |
|---|---|
| **判据是"报告零遗漏"，不是"自动改对多少"** | 每一处自动改写都要说得出它依据哪条**可判定**的事实（CSS 原文 / 祖先链 / 类的字面量）；判不了的一律进 TODO |
| **不"顺手删掉"迁不过去的代码** | 整块注释 + `TODO(migrate)` 头，决定权留在人手上；一律注释会让**生成物根本挂不起来**，而报告里看不出来 |
| **别靠重跑 `create --force` 来"同步"** | `writeProject` 无条件 `writeFileSync` ⇒ **覆盖所有生成文件**（包括你手改过的视图）；只有 `MIGRATION.md` 的**手写区**被保住 |

## 二、入口与三件产物

```bash
npx moobile-host create --from-rabbita <既有项目> <新项目目录> [--name X] [--rn 0.83]
```

- 三件产物**一件都不能省**：① 报告（`MIGRATION.md` ＋ `migration.generated.json` 两个形态）
  ② 新项目 ③ TODO 清单（住在报告 §4 里，**每一项都有下一步**）。
- ⚠️ **在 moobile 仓库里跑自己的应用必须写** `--host-dep file:../../../npm/moobile-host`，
  否则会去 registry 拿一个**还没发布**的版本。
- 七个选项的逐条作用、以及"**入口包的文件被摊到模块根**"（`frontend/main.mbt` → `main.mbt`，
  否则 `moobile-host build` 报"找不到产物"）→ `references/entry-and-artifacts.md`。

## 三、报告怎么读：两个区不许搞反

- **生成区**：`create` **每次重新生成**；别在这里手改，会被覆盖。
- **手写区**：生成器**只读不写**，重新生成时**逐字节保留** —— **你的补记写这里**。
- 找不到标记（老报告 / 标记被删）⇒ **不猜也不丢**：整份旧文件当手写区保留并加一句提示。
- ⚠️ 实现里「生成物清单」与「生成后自查」**都编号 §5** —— **按内容找，别按号找**。
- §4 的 TODO 只有**四类去向**（F2 样式 / F3 指南 / I 组件库 / 人工），**"未知"不许出现**；
  实现侧的 `NEXT_OF` 表里没有"未知"分支 ⇒ "零遗漏"是**可断言**的，不是承诺。
- 数字要分清：`migration.generated.json` 的 **`facts` 块 = 当前事实**；
  顶层 `styles` / `scan` 与整份 `MIGRATION.md` 是**迁移当天**的叙述。
- 两个区、四类去向、生成后自查的完整读法 → `references/report-and-audit.md`。

## 四、迁不过去的代码：保底桩优先，整块注释是下策

可判定的事实："这块里有没有一个**签名本身可迁移**的函数定义。"

- **有 ⇒ 保底桩**：签名照原样（调用点一个字不用改），函数体给空值（`Html` → `nothing`…），
  拿不到合适空值才 `abort("TODO(migrate): …")`，**原实现以注释保留在下面**。
- **没有 ⇒ 整块注释**（连签名都迁不过去）。
- 桩体为什么不一律 `abort`：返回 `Html` 的函数一 `abort` 就变成**整页白屏**，
  用户看到一条与迁移无关的 panic。
- 什么自动改、什么留给人（八行对照表）、三类"算账"断言 → `references/migration-discipline.md`。

## 五、迁移之后要跑什么

```bash
cd my-app && npm install
moon check --target js    # 判据 S9-3：0 错误（动不了的部分以 TODO 标出，而不是删掉）
npm run web
```

- **样式层**要跟着生成器走，**用这一个入口**（出处：`npm/moobile-host/lib/migrate/regen-diff.js` 的
  文件头 + `npm/moobile-host/lib/regen.js` 的 `--styles`）：先 `npx moobile-host regen --styles --diff`
  看清逐函数差异（`changed` / `orphan` 是必须人看一眼的两类），确认没有人工改动再 `--sync`；
  判据模式是 `--check`。
- **应用自己的判据**：web 用应用根的 `verify.mjs`，真机用 `device_check.mjs` ——
  参照 `examples/apps/zhouyi-reader/`。

## 六、迁移特有的坑（只列最贵的三条）

- **样式表的来源与视图的来源不是同一个集合**：CSS 常在别处（内联 `<style>`），
  只喂 UI 包 ⇒ 样式函数少生成，而**报告里看不出来**。
- **`on_click` 挂在 `div` / `span` / `p` 上 = 点不动**：只有 `button` / `a` 落到 `Pressable`，
  点击被丢掉、**不报错**、`moon check` **全绿** —— 修法是**换标签**，不是加样式。
- **只在原生上现形的两块**：源 CSS 的 `body` / `html` 抽成 `page()` 却没人挂到根上；
  根上没有滚动容器。实测代价：真机"**滚 30 次、界面纹丝不动**"，而同一个页面在 web 判据里 **45/45**。
  修法是**两层根容器**。

## 七、门与未验

- **一句话版**：合集入口是 `bash tools/verify_all.sh`；其中**最要紧的是那条硬耦合** ——
  改 `npm/moobile-host/lib/migrate/scan.js` **必须同时改** `tools/mbtools/src/migrate_scan.mbt`
  （"两份实现 = 一个必然的漂移点"，对账门钉的就是这件事，两侧要**逐字节一致**）。
- 八道门各守什么、以及"改文案后怎么安全地重生成产物（**别对真实应用跑 `create --force`**）"
  → `references/gates.md`。
- **未验**：真机字形 vs web 的差异**没有判据**、画布 `devicePixelRatio` 换算未验、
  `facts` 块只覆盖样式层与 F1 动检两组数字、迁移后效果**不承诺一致**。
- 五个实测教训的逐条展开 + 完整"未验清单" + 去哪看 → `references/lessons-and-unverified.md`。
