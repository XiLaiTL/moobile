// app-audit.js —— **生成后的自查**：迁移能编译、甚至 web 上能跑，却会在原生上"少一块"的两类洞。
//
// 为什么需要它（都是**实测**踩出来的，不是假想）：
//
//   ① `page()` 没人挂。CSS 里 `body` / `html` 上的声明被样式转换器抽成了一个独立的
//      `page()` 函数（`style-emit.js` 的 `__page__` 组），**但生成物的根元素是裸的** ——
//      于是页面底色 / 字体族 / 行高悄悄没了。web 上看不出来（浏览器自己有 `body` 样式兜着），
//      原生上就很明显：整页只剩各区块自己的背景色。
//
//   ② 根上没有滚动容器。HTML 靠 `overflow` 做**文档级滚动**，而 RN 的 `View` **不滚动** ——
//      不套 `ScrollView`（moobile 的 `"scroll"` 伪标签），手机上**过了第一屏就再也够不着**。
//      这一条在浏览器里**永远看不见**（DOM 自己会滚），实测的表现是：
//      Android 上滚动 30 次、界面纹丝不动，而同一个页面在 web 判据里 45/45。
//
// 这个模块**只读文件、不执行代码**，所以能当离线门用（见 `tools/migrate_app_audit.mjs`）。
// 它也是 `create` 报告里那段"生成后自查"的来源 —— 判据写在库里，指南里的清单就不再是口口相传。

const fs = require('fs');
const path = require('path');

/** 递归收集目录下的 `.mbt`（跳过生成物目录与 node_modules）。 */
function mbtFiles(dir, out = [], depth = 0) {
  if (depth > 6) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '_build' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) mbtFiles(p, out, depth + 1);
    else if (e.name.endsWith('.mbt')) out.push(p);
  }
  return out;
}

/** 去掉行注释 —— 判据不能被"我自己的注释里写了这个字符串"满足（踩过：断言 grep 注释也会命中）。 */
function stripLineComments(text) {
  return text
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i === -1 ? l : l.slice(0, i);
    })
    .join('\n');
}

/**
 * 自查一个**迁移生成的应用目录**。
 *
 * 返回 `[{ id, level, message, next }]`；`level` 为 `'must'`（原生上一定有可见后果）
 * 或 `'info'`（值得看一眼，但可能是有意的）。**没有任何命中就返回空数组** ——
 * 离线门用"空数组"当通过判据。
 */
function auditApp(dir) {
  const findings = [];
  const files = mbtFiles(dir);
  if (files.length === 0) {
    return [
      {
        id: 'no-mbt',
        level: 'must',
        message: `${dir} 下没找到 .mbt —— 这不是一个 MoonBit 应用目录`,
        next: '检查路径（要指向生成出来的应用根目录，不是 monorepo 根）',
      },
    ];
  }
  const sources = files.map((f) => ({ file: f, rel: path.relative(dir, f), text: fs.readFileSync(f, 'utf8') }));

  // ── ① 根样式 `page()` 定义了却没人用 ─────────────────────────────────────────
  // 只在**定义文件**里出现 = 没有任何视图引用它。
  const definesPage = sources.filter((s) => /pub fn page\s*\(\s*\)\s*->/.test(s.text));
  if (definesPage.length) {
    const users = sources.filter(
      (s) => !definesPage.includes(s) && /\bpage\s*\(\s*\)/.test(stripLineComments(s.text)),
    );
    if (users.length === 0) {
      findings.push({
        id: 'page-style-unused',
        level: 'must',
        message:
          `${definesPage.map((s) => s.rel).join(' / ')} 里生成了 \`page()\`（源 CSS 的 \`body\`/\`html\` 声明），` +
          `但**没有任何视图引用它** —— 页面底色 / 字体族 / 行高没落到任何元素上`,
        next:
          '把最外层容器改成 `div(attrs=@styles.att(@styles.page()))`（native 上还要 `.flex(1.0)`，' +
          '否则套在里面的滚动容器量不出视口）',
      });
    }
  }

  // ── ② 根上没有滚动容器（原生上内容够不着）────────────────────────────────────
  // ⚠️ 只认**伪标签的用法** `node("scroll", …)`，不认裸的 `"scroll"`：
  //    组件库里的属性名也叫 `scroll`（`antd-demo` 的 `opt_json(a, "scroll", scroll)`），
  //    第一版用裸串，于是把组件属性当成了滚动容器。
  const scrollUsers = sources.filter((s) => /\bnode\s*\(\s*"scroll"/.test(stripLineComments(s.text)));
  if (scrollUsers.length === 0) {
    findings.push({
      id: 'no-native-scroll',
      level: 'must',
      message:
        '没有任何 `.mbt` 用到滚动容器（`@html.node("scroll", …)` → RN 的 `ScrollView`）—— ' +
        'HTML 的文档级滚动在原生上**不存在**，超过一屏的内容用户滚不到',
      next:
        '把页面内容包一层 `@html.node("scroll", @styles.att(@style.Style::new().flex(1.0)), [...])`；' +
        'web 上观感不变（DOM 自己会滚），原生上才有得滚',
    });
  }

  // ── ③ 用了滚动容器，但它没有 `flex(1)`：RN 里会量成 0 高 ──────────────────────
  // 只在**同一行/紧邻几行**里找 `flex` —— 这是启发式，所以给 `info` 而不是 `must`。
  if (scrollUsers.length) {
    const suspicious = [];
    for (const s of scrollUsers) {
      // ⚠️ 行扫描也必须用**去过注释**的文本：第一版拿原文扫，于是**文档注释里那句**
      //    `用 node("scroll", …)` 被当成了真代码，报了个不存在的 `ui.mbt:261`
      //    （todo-app 实测）—— 过滤器用了去注释文本、行扫描忘了，两边不是同一份。
      const lines = stripLineComments(s.text).split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!/\bnode\s*\(\s*"scroll"/.test(lines[i])) continue;
        // 窗口给 8 行、且**认 `height(...)` 也算**：滚动容器有确定高度就够了
        // （`gesture-edges` 用的是 `width/height` 定尺寸，4 行窗口够不着 → 报过一条假的）。
        const near = lines.slice(i, i + 8).join(' ');
        if (!/flex\s*\(/.test(near) && !/height\s*\(/.test(near)) suspicious.push(`${s.rel}:${i + 1}`);
      }
    }
    if (suspicious.length) {
      findings.push({
        id: 'scroll-without-flex',
        level: 'info',
        message: `滚动容器附近没看到 \`flex(...)\`：${suspicious.join(' / ')} —— RN 里没有确定高度会量成 0`,
        next: '确认父级有确定高度（根容器 `.flex(1.0)` + 滚动容器 `.flex(1.0)`）',
      });
    }
  }

  return findings;
}

/** 把 findings 渲染成给终端看的几行（`create` 的收尾与门都用它，格式就只有一处）。 */
function formatFindings(findings) {
  return findings.map((f) => {
    const tag = f.level === 'must' ? '必须处理' : '看一下';
    return `  · [${tag}] ${f.id}：${f.message}\n      → ${f.next}`;
  });
}

module.exports = { auditApp, formatFindings, mbtFiles, stripLineComments };
