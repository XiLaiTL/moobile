# tools/template —— 生成器的**配置与说明**（不是模板）

⚠️ 先看这一条：**模板的真身不在这里**。它是 `examples/apps/template/` ——
一个真的能编译、能跑、进 `verify_all` 的最小工程（设计见
[`docs/design/SCAFFOLD.md`](../../docs/design/SCAFFOLD.md) §3.4）。

**这个目录里不许放任何工程文件**（`app.mbt` / `App.js` / `package.json`…）。
放进来就是第二份真源，而"两份手写的同类文件必然漂移"这件事本仓库已经吃过一次。

## 这里现在有什么

| 文件 | 是什么 | 状态 |
|---|---|---|
| `README.md` | 本文件 | ✅ |
| `deltas.txt` | T1 的**允许差异清单**：生成物与 `examples/apps/todo-app/` 之间的差异，只许命中清单里显式列出的项 | ✅ **已量出、已装门**（见下） |

## 占位符清单为什么**不**在这里

它住在 `npm/moobile-host/lib/placeholders.js`。理由是一条推论：
**`moobile-host init` 跑在使用者的机器上**（`npx moobile-host init my-app`），
所以生成器要用的每一样配置都**必须随 npm 包发布** —— 而 `tools/` 不随包走
（`.moonignore` 里就排除着它）。

这条与 §3.4.1 原来的写法不一致（那里写的是"占位符清单住在 `tools/template/`"），
2026-09-20 落地时按"配置跟着使用者走"改正了。**工程文件仍然只有一份**（在 `examples/apps/`），
这条规矩没有被放松。

## `deltas.txt` 是怎么来的（**已经做完了**）

设计稿 §3.4.4 第 4 步说得很直白：**清单里该有几行是量出来的，不是猜的**。四步都走完了：

1. ✅ 用 `moobile-host init` 生成一个临时项目；
2. ✅ 与 `examples/apps/todo-app/` **逐文件比对**；
3. ✅ 把**每一处**差异写进 `deltas.txt`，并逐条写清"为什么这是允许的"；
4. ✅ 装成门（T1）：`tools/template_compare.mjs` —— **清单之外的任何差异 = 红**
   （在 `tools/verify_all.sh` 里；证伪见 `tools/template_compare_falsify.sh`）。

⚠️ 第 3 步**手量出来的第一版是错的**（漏登 3 处、多登 1 处）—— 真因是"手量差异靠印象，
不靠集合"。教训与解法见 [`docs/FINDINGS.md`](../../docs/FINDINGS.md) 的 T1 补记。

⚠️ 一条自查：**清单一旦长到几十条，说明这条路没走通** —— 那时应该老实回到
"两份真源 + 一条独立闸门"，而不是继续往清单里加行（§3.4.4 末段）。条数**不抄在这里**，
`node tools/template_compare.mjs` 会打出来（含"死条目"）。

## 维护者常用命令

```bash
node tools/template_check.mjs        # 生成 / 替换干净 / 生成物能编能构建 / 无头跑（约 6 秒）
node tools/template_check.mjs --keep # 留下临时目录（调试）
node tools/scaffold_probe.mjs        # 把"多文件+多页面+过滤"的应用覆盖进生成物里再跑（约 6 秒）
node tools/template_compare.mjs      # T1：生成物与 demo 的差异逐条对着 deltas.txt 判（约 1 秒）
bash tools/template_compare_falsify.sh  # 证伪上面那条门（**会临时改工作区、跑完还原**，手动跑）
node tools/package_check.mjs         # **打包形态**：真打 tarball → 真 npm install → 用装好的 CLI init（发布前必跑）
node tools/verify_headless.mjs       # 只跑模板自己的无头验证
bash npm/moobile-host/publish.sh --dry-run   # 发包前的全部自检（含"包内模板"是否齐全）
```
