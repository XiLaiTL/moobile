// libgen 的**证伪探针**：一个假的组件库 + 三条负例。
//
//   node tools/libgen_probe.mjs
//
// ## 为什么必须有这一条
//
// `libgen` 的产物是**两侧共同的承诺面**（MoonBit 侧的 `@antd.button(...)` 与宿主侧的
// 注册表同源于一份 manifest）。而文档里写的判据只有**真组件库**验得到：
// antd 那条要 `npm install antd`（几十 MB + 联网），chat-app 那条要
// `react-native-markdown-display`。于是"生成器自己的规则"（哪一档算 children、
// 哪一档算原始字符串、拼错名字会不会报错）**没有任何一条离线门看得见** ——
// 改坏了只有下一个接组件库的人会发现，而那时症状是"组件内部报一句与 prop 无关的错"。
//
// 这个探针就在**临时目录里手写一个假包**（三个组件，各代表一档规则）：
//   · `Wrapped` —— `ComponentType<PropsWithChildren<WrappedProps>>`（**洞一**：
//       children 藏在泛型包裹里，`PropsWithChildren` 不是透明的）；
//   · `Texty`   —— `children: string`（**类型直接说了是字符串** → 原始字符串，无需声明）；
//   · `Plain`   —— 没有 children（**不能生成那个参数**）；
//   · `Refd`    —— `ComponentType<PropsWithoutRef<PlainProps>>`（**透明**：`value` 必须还在）。
//
// 再加上 `libgen.config.json` 的 `content`（**洞二**：类型在撒谎时由人声明），
// 以及三条**负例** —— 拼错的组件名 / 拼错的 prop 名 / 去掉声明后不能自己变成原始字符串。
// 负例是这条门存在的理由：只验"正例能过"的话，把规则改成"全都当原始字符串"也能过。
//
// 全程**离线**（不装任何包、不联网），临时目录跑完就删。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "npm", "moobile-host", "bin", "cli.js");

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  <- " + detail : ""}`);
}

// ── 临时工作区：一个假的组件库 ────────────────────────────────────────────────
//
// 类型定义刻意用**真实的生态写法**（React 的包装类型 + 泛型），而不是简化版 ——
// 简化版会让这条门对"包装类型认不认"这件事失去分辨力（那正是洞一）。
const PKG_DTS = `import { ComponentType, PropsWithChildren, PropsWithoutRef, ReactNode } from 'react';

export interface WrappedProps {
  label?: string;
  onPress?: () => void;
}

/** 洞一：children 在 PropsWithChildren 里（不是直接写在 props 接口上）。 */
export declare const Wrapped: ComponentType<PropsWithChildren<WrappedProps>>;

export interface TextyProps {
  /** 类型直接说了是字符串 → 内容走原始字符串通道，不需要人声明。 */
  children: string;
  size?: number;
}

export declare const Texty: ComponentType<TextyProps>;

export interface PlainProps {
  value?: string;
}

/** 没有 children：生成物里**不能**多出那个参数。 */
export declare const Plain: ComponentType<PlainProps>;

export interface RefdProps {
  value?: string;
}

/** PropsWithoutRef 是**透明**的：value 必须还在参数表里。 */
export declare const Refd: ComponentType<PropsWithoutRef<RefdProps>>;
`;

const PKG_JSON = JSON.stringify(
  { name: "widgetish", version: "1.2.3", main: "index.js", types: "index.d.ts" },
  null,
  2,
);

function makeConfig(content, defaultExports) {
  const lib = {
    namespace: "w",
    package: "widgetish",
    platforms: ["web"],
    out: {
      manifest: "generated/w.manifest.json",
      host: "libraries.generated.js",
      moonbit: "w",
    },
  };
  if (content !== undefined) lib.content = content;
  if (defaultExports !== undefined) lib.defaultExports = defaultExports;
  return JSON.stringify({ libraries: [lib] }, null, 2) + "\n";
}

function writeWorkspace(dir, content, defaultExports) {
  const pkgDir = path.join(dir, "node_modules", "widgetish");
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, "package.json"), PKG_JSON);
  fs.writeFileSync(path.join(pkgDir, "index.d.ts"), PKG_DTS);
  fs.writeFileSync(path.join(pkgDir, "index.js"), "module.exports = {};\n");
  fs.writeFileSync(path.join(dir, "libgen.config.json"), makeConfig(content, defaultExports));
}

/** 跑一次 libgen；返回 {code, stdout, stderr}（**不抛**，负例要看退出码与那句话）。 */
function libgen(dir, args = []) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, "libgen", ...args], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    return { code: err.status, stdout: err.stdout || "", stderr: err.stderr || "" };
  }
}

/**
 * 取出某个生成函数的整段源码（从签名到收尾的 `}`）。
 *
 * ⚠️ 不能按 `pub fn <名字>(` 去找：有 children 的那一档签名是
 * `pub fn[C : @html.IsChildren] <名字>(` —— 名字前面挂着 trait 约束。
 * （第一版就是这么写的，于是"带 children 的函数找不到"被当成了"生成器没生成它"，
 * 差点去改生成器。判据自己的盲点与生成器的 bug 长得一模一样，所以这里的正则要能同时认两种。）
 */
function fnBody(mbt, name) {
  const re = new RegExp(`pub fn(?:\\[[^\\]]*\\])? ${name}\\(`);
  const m = re.exec(mbt);
  if (!m) return null;
  const end = mbt.indexOf("\n}", m.index);
  return mbt.slice(m.index, end + 2);
}

/**
 * 宿主侧那一半：`defaultExports` 到底能不能从 `default` 上取到组件。
 *
 * 生成器只负责把声明**写进**注册调用（上面已验）；真正取值的是 `core.js` 的
 * `resolveExport`。而那个文件 `import React from 'react'`，仓库里没装 react ——
 * 所以照 `tools/native_rn_check.mjs` 的老办法：**临时目录 + stub 的 react + 一份拷贝**，
 * 真 import、真调 `registerLibrary`、真断言注册表里的对象是不是那个组件。
 *
 * 为什么必须验运行时这一半（2026-10-02 真机逼出来的）：`defaultExports` 的第一版实现
 * 是"从 `default` 里找**同名属性**"，而 `export default Markdown` 的组件**名字不在自己身上**
 * —— 于是声明写了、错误照旧，只有真机看得见（web 的 interop 恰好能看见具名导出）。
 */
async function checkDefaultResolution() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moobile-defaultexport-"));
  try {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module" }));

    const reactDir = path.join(dir, "node_modules", "react");
    fs.mkdirSync(reactDir, { recursive: true });
    fs.writeFileSync(
      path.join(reactDir, "package.json"),
      JSON.stringify({ name: "react", version: "0.0.0-stub", type: "module", main: "index.js" }),
    );
    // 只提供 core.js 在**定义期**用得到的那两个（本探针不渲染任何东西）。
    fs.writeFileSync(
      path.join(reactDir, "index.js"),
      [
        "export const createElement = (type, props, ...children) => ({ type, props, children });",
        "export const useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();",
        "export default { createElement, useSyncExternalStore, Fragment: { $$typeof: Symbol.for('react.fragment') } };",
        "",
      ].join("\n"),
    );
    fs.copyFileSync(path.join(ROOT, "npm", "moobile-host", "core.js"), path.join(dir, "core.js"));

    // ① 只有 default 的模块（正是 `react-native-markdown-display` 的形状：
    //    类型定义说 `Markdown` 是具名导出，JS 里 `export default Markdown`）
    fs.writeFileSync(
      path.join(dir, "only-default.js"),
      [
        "const Widget = function Widget() { return null };",
        "export default Widget;",
        "",
      ].join("\n"),
    );
    // ② default 是个**命名空间**（CJS `module.exports = { … }` 经 interop 后的形状，含复合子组件）
    fs.writeFileSync(
      path.join(dir, "cjs-ish.js"),
      [
        "const Button = function Button() { return null };",
        "const Item = function Item() { return null };",
        "export default { Button, Form: { Item } };",
        "",
      ].join("\n"),
    );

    const core = await import(pathToFileURL(path.join(dir, "core.js")).href);
    const onlyDefault = await import(pathToFileURL(path.join(dir, "only-default.js")).href);
    const cjsIsh = await import(pathToFileURL(path.join(dir, "cjs-ish.js")).href);
    core.installHostCore({ platform: "web", reset: true });

    const reg = core.registerLibrary({
      namespace: "x",
      module: onlyDefault,
      components: ["Widget"],
      defaultExports: ["Widget"],
      platforms: ["web"],
      quiet: true,
    });
    check(
      "宿主：`defaultExports` 让「只在 default 上」的组件注册成功",
      reg.length === 1 && globalThis.MOBILE_HOST.components["x:Widget"] === onlyDefault.default,
      `注册了 ${JSON.stringify(reg)}；是不是那个组件对象：${globalThis.MOBILE_HOST.components["x:Widget"] === onlyDefault.default}`,
    );

    let threw = null;
    try {
      core.registerLibrary({
        namespace: "y",
        module: onlyDefault,
        components: ["Widget"],
        platforms: ["web"],
        quiet: true,
      });
    } catch (err) {
      threw = err;
    }
    check(
      "宿主：**没声明**时不回落到 default，而是点名报错（并指路 defaultExports）",
      !!threw && /没有这个导出/.test(threw.message) && /defaultExports/.test(threw.message),
      threw ? threw.message.split("\n")[0].slice(0, 100) : "没有抛错（那就是静默绑了别的组件）",
    );

    const reg2 = core.registerLibrary({
      namespace: "z",
      module: cjsIsh,
      components: ["Button", "Form.Item"],
      defaultExports: ["Button", "Form.Item"],
      platforms: ["web"],
      quiet: true,
    });
    check(
      "宿主：default 是命名空间时按名字下钻（含复合子组件 `Form.Item`）",
      reg2.length === 2 &&
        globalThis.MOBILE_HOST.components["z:Button"] === cjsIsh.default.Button &&
        globalThis.MOBILE_HOST.components["z:Form.Item"] === cjsIsh.default.Form.Item,
      JSON.stringify(reg2),
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moobile-libgen-probe-"));
  try {
    // ── 1) 正例：声明了 content 的那一档 ──────────────────────────────────────
    console.log("── 正例：三个组件各代表一档规则（temp: " + dir + "）");
    writeWorkspace(dir, ["Wrapped"]);
    const first = libgen(dir);
    if (first.code !== 0) {
      check("libgen 能在假包上跑通", false, (first.stderr || first.stdout).trim().slice(0, 200));
      return;
    }
    check("libgen 能在假包上跑通", true, first.stdout.trim().split("\n")[0]);

    const manifestPath = path.join(dir, "generated", "w.manifest.json");
    const mbtPath = path.join(dir, "w", "components.generated.mbt");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const mbt = fs.readFileSync(mbtPath, "utf8");
    const c = (name) => (manifest.components[name] || {}).props || {};

    // ① 洞一：PropsWithChildren 里的 children 必须被看见
    check(
      "洞一：`ComponentType<PropsWithChildren<X>>` 里的 children 被认出来",
      !!c("Wrapped").children && c("Wrapped").children.kind === "children",
      JSON.stringify(c("Wrapped").children || null),
    );
    // ② 洞二：显式声明的原始字符串
    check(
      "洞二：`content` 声明后 children 走**原始字符串**（deliver=raw）",
      c("Wrapped").children.deliver === "raw" &&
        c("Wrapped").children.prop === "children" &&
        c("Wrapped").children.deliver_from === "config:content",
      JSON.stringify(c("Wrapped").children || null),
    );
    check(
      "manifest 顶层记下 `content`（谁走了这条通道、为什么）",
      manifest.content && manifest.content.Wrapped === "children",
      JSON.stringify(manifest.content || null),
    );
    // ③ 类型自己说是字符串的那一档
    check(
      "`children: string` 无需声明就判成原始字符串（deliver_from=type）",
      c("Texty").children &&
        c("Texty").children.deliver === "raw" &&
        c("Texty").children.deliver_from === "type",
      JSON.stringify(c("Texty").children || null),
    );
    // ④ 没有 children 的组件不能凭空长出来
    check("没有 children 的组件：清单里也没有这个条目", !c("Plain").children, JSON.stringify(Object.keys(c("Plain"))));
    // ⑤ PropsWithoutRef 是透明的（**不是**像 PropsWithChildren 那样加字段）
    check(
      "PropsWithoutRef 透明：它的 prop 仍然进参数表",
      c("Refd").value && c("Refd").value.kind === "str",
      JSON.stringify(c("Refd").value || null),
    );

    // ── 生成物（MoonBit 侧）的形状 ────────────────────────────────────────────
    const wrapped = fnBody(mbt, "wrapped");
    const texty = fnBody(mbt, "texty");
    const plain = fnBody(mbt, "plain");
    check(
      "原始字符串：签名是 `children : String`，且**不带** IsChildren 约束",
      !!wrapped && /children : String,/.test(wrapped) && !/IsChildren/.test(wrapped),
      wrapped ? wrapped.split("\n")[0] : "(没有 wrapped)",
    );
    check(
      "原始字符串：内容经 `prop_str(\"children\", children)`，且**不**当子节点传",
      !!wrapped &&
        wrapped.includes('a.prop_str("children", children)') &&
        wrapped.includes('@html.node("w:Wrapped", a, ([] : Array[@html.Html]))'),
      wrapped ? wrapped.trim().split("\n").slice(-2).join(" / ") : "",
    );
    check(
      "`children: string` 的组件同样走原始字符串",
      !!texty && /children : String,/.test(texty) && texty.includes('a.prop_str("children", children)'),
      texty ? texty.split("\n")[0] : "(没有 texty)",
    );
    check(
      "没有 children 的组件：生成物里既无参数也无 `children` 这一行",
      !!plain && !/children/.test(plain),
      plain ? plain.split("\n").join(" ") : "(没有 plain)",
    );

    // ── `--check`：产物与 manifest 一致（且**可重复**）────────────────────────
    const again = libgen(dir, ["--check"]);
    const changed = libgen(dir);
    check("`libgen --check` 一致（同一份输入跑两次也一样）", again.code === 0, again.stdout.trim() || again.stderr.trim().slice(0, 120));
    check("重跑不写坏产物（`--check` 之后仍然一致）", changed.stdout.includes("写入 0 份"), changed.stdout.trim().split("\n")[0]);

    // ── 负例 A：拼错的组件名 ──────────────────────────────────────────────────
    // 静默放过的下场：人以为声明了，其实没有 —— 而症状是组件内部一句与 prop 无关的报错。
    writeWorkspace(dir, ["Wrapepd"]);
    const badName = libgen(dir);
    check(
      "负例 A：`content` 里的组件名拼错 → 退出码 2 且**点名**那个名字",
      badName.code === 2 && badName.stderr.includes("Wrapepd") && badName.stderr.includes("没有这个组件"),
      `code=${badName.code} :: ${badName.stderr.trim().split("\n")[0].slice(0, 90)}`,
    );

    // ── 负例 B：拼错的 prop 名 ────────────────────────────────────────────────
    // 静默放过的下场：字符串进了一个没人读的 prop，界面上是**空白**（不是报错）。
    writeWorkspace(dir, { Wrapped: "labell" });
    const badProp = libgen(dir);
    check(
      "负例 B：`content` 里的 prop 名拼错 → 退出码 2 且点名那个 prop",
      badProp.code === 2 && badProp.stderr.includes("labell") && badProp.stderr.includes("prop"),
      `code=${badProp.code} :: ${badProp.stderr.trim().split("\n")[0].slice(0, 90)}`,
    );

    // ── 负例 C：**没有声明**时不能自己变成原始字符串 ───────────────────────────
    // 这一条是探针的**主判据**：它挡住"把规则放宽成全都当原始字符串"这种改动 ——
    // 那样做正例也全绿，而真实后果是**普通组件的子树全被塞进一个 prop**。
    writeWorkspace(dir, undefined);
    const noDecl = libgen(dir);
    const m2 = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const wrapped2 = m2.components.Wrapped.props.children;
    const mbt2 = fs.readFileSync(mbtPath, "utf8");
    const wrapped2Body = fnBody(mbt2, "wrapped");
    check(
      "负例 C：`PropsWithChildren` 的类型**不足以**判成原始字符串（要人声明）",
      noDecl.code === 0 && wrapped2 && wrapped2.deliver === undefined,
      JSON.stringify(wrapped2 || null),
    );
    check(
      "负例 C：这时 children 走**子节点**（`children : C` + IsChildren）",
      !!wrapped2Body && /children : C,/.test(wrapped2Body) && /IsChildren/.test(wrapped2Body),
      wrapped2Body ? wrapped2Body.split("\n")[0] : "(没有 wrapped)",
    );
    check(
      "负例 C：没声明时**不**凭空生成 `defaultExports`",
      Array.isArray(m2.host.defaultExports) && m2.host.defaultExports.length === 0,
      JSON.stringify(m2.host.defaultExports || null),
    );

    // ── 正例：`defaultExports`（类型定义谎报导出时的声明）─────────────────────────
    writeWorkspace(dir, ["Wrapped"], ["Refd"]);
    libgen(dir);
    const m3 = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const host3 = fs.readFileSync(path.join(dir, "libraries.generated.js"), "utf8");
    check(
      "`defaultExports` 进 manifest 的 host 段（可 diff、可核对）",
      Array.isArray(m3.host.defaultExports) && m3.host.defaultExports.join() === "Refd",
      JSON.stringify(m3.host.defaultExports || null),
    );
    check(
      "`defaultExports` 进宿主注册调用（`registerLibrary({ defaultExports })`）",
      host3.includes("defaultExports: ['Refd']"),
      (host3.split("\n").find((l) => l.includes("defaultExports: [")) || "(没有这一行)").trim(),
    );

    // ── 负例 D：`defaultExports` 里拼错的组件名 ────────────────────────────────
    writeWorkspace(dir, undefined, ["Nope"]);
    const badDe = libgen(dir);
    check(
      "负例 D：`defaultExports` 里拼错组件名 → 退出码 2 且点名",
      badDe.code === 2 && badDe.stderr.includes("Nope") && badDe.stderr.includes("没有这个组件"),
      `code=${badDe.code} :: ${badDe.stderr.trim().split("\n")[0].slice(0, 90)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  // ── 宿主侧那一半：`defaultExports` 真的取到组件了吗 ─────────────────────────
  console.log("\n── 宿主侧：`defaultExports` 的解析（stub react + 临时目录）");
  try {
    await checkDefaultResolution();
  } catch (err) {
    check("宿主侧的 default 解析探针能跑起来", false, String((err && err.message) || err).slice(0, 200));
  }

  const pass = results.filter((r) => r.ok).length;
  const fail = results.length - pass;
  console.log("\n================ libgen 探针 汇总 ================");
  console.log(`通过 ${pass}  失败 ${fail}`);
  for (const r of results.filter((x) => !x.ok)) console.log(`  FAIL  ${r.name}`);
  process.exit(fail === 0 ? 0 : 1);
}

// 顶层 await：宿主侧那一段要 `import()` 临时目录里的 ESM。
await main();
