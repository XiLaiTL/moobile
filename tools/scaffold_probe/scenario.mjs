// 探针应用的剧本（多页面 + 过滤）—— 由 `tools/verify_headless.mjs --scenario` 加载。
//
// 上面的通用断言只覆盖"每个 moobile 应用都该过"的那几条（首屏 / 输入 / 增 / 勾 / 删）。
// 这个应用多出来的东西（过滤、编辑页）写在这里 —— 它**跟着应用走**，不污染 harness。
//
// 前提：通用断言跑完之后，清单是空的（那条唯一的事项被删掉了）。

export async function run(d) {
  const { must, click, type, text, check, settle } = d;

  // ── 过滤：同一个 Model 的另一种读法 ─────────────────────────────────────────
  const ITEM = "改写我";
  const input = must("输入框", (el) => typeof el.props.onChangeText === "function");
  await type(input.element, ITEM);
  const add = must("按钮「添加」", (el, t) => el.props.onPress && t.includes("添加"));
  await click(add.element);
  check(`添加一条「${ITEM}」`, text().includes(ITEM), text().slice(0, 120));

  const done = must("过滤「已完成」", (el, t) => el.props.onPress && t.includes("已完成"));
  await click(done.element);
  check("切到「已完成」之后未完成的条目被滤掉", !text().includes(ITEM), text().slice(0, 120));

  const active = must("过滤「未完成」", (el, t) => el.props.onPress && t.includes("未完成"));
  await click(active.element);
  check("切回「未完成」之后条目又出现", text().includes(ITEM), text().slice(0, 120));

  const all = must("过滤「全部」", (el, t) => el.props.onPress && t.includes("全部"));
  await click(all.element);

  // ── 编辑页：`view` 上的一条分发（多页面）────────────────────────────────────
  const open = must(`条目文字（点它进编辑页）`, (el, t) => el.props.onPress && t.includes(ITEM));
  await click(open.element);
  check("进了编辑页", text().includes("编辑这一条"), text().slice(0, 120));

  // ⚠️ 回填的是**输入框的 value**，不是界面文字 —— 第一版这里写成了 `text().includes(ITEM)`
  //    于是红了一次。输入框没有子节点文字，这是"按文字找控件"这个剧本的固有边界，
  //    记在这里免得下次又踩：**要读 prop 就读 prop。**
  const editInput = must("编辑页的输入框", (el) => typeof el.props.onChangeText === "function");
  const filled = editInput.element.props.value;
  check(`编辑页回填了原文（value=${JSON.stringify(filled)}）`, filled === ITEM);

  const NEW = "已经改好了";
  await type(editInput.element, NEW);
  const save = must("按钮「保存」", (el, t) => el.props.onPress && t.includes("保存"));
  await click(save.element);

  check("保存后回到清单页", text().includes("待办") && !text().includes("编辑这一条"), text().slice(0, 120));
  check(`清单上显示改后的文字「${NEW}」`, text().includes(NEW), text().slice(0, 120));
  check(`旧文字消失了`, !text().includes(ITEM), text().slice(0, 120));

  // ── 第二条返回路径：「← 返回清单」不保存也要回得去 ──────────────────────────
  const open2 = must("条目文字", (el, t) => el.props.onPress && t.includes(NEW));
  await click(open2.element);
  const back = must("按钮「← 返回清单」", (el, t) => el.props.onPress && t.includes("返回清单"));
  await click(back.element);
  check(
    "「← 返回清单」回到清单页且没改内容",
    text().includes("待办") && !text().includes("编辑这一条") && text().includes(NEW),
    text().slice(0, 120),
  );

  // ── 计数：勾选后「还有 0 件」────────────────────────────────────────────────
  const toggle = must(
    "条目的勾选按钮（空框 / ✓）",
    (el, t) => el.props.onPress && (t === "" || t === "✓"),
  );
  await click(toggle.element);
  check("勾选后计数归零", text().includes("还有 0 件"), text().slice(0, 120));

  await settle(0);
}
