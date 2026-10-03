// create.js —— E9：**从既有的 rabbita 项目生成一个 moobile 项目**。
//
//   npx moobile-host create --from-rabbita <既有项目> <新项目目录> [--name X] [--rn 0.83]
//
// ## 三件产物（SCAFFOLD §3.7.4，一件都不能省）
//
//   ① 迁移报告 `MIGRATION.md` + `migration.generated.json`（机器可读，进得了 `--check` 类的门）
//   ② 新项目：宿主四件套 + `moon.mod`/`moon.pkg` 改过的依赖 + **尽量原样搬运的视图**
//   ③ TODO 清单：报告里**每一项都有下一步指向**（F2 样式 / F3 指南 / I 组件库 / 人工），
//      不允许出现"未知"这一类（判据 S9-5）
//
// ## 明确不做（负面清单，与 SCAFFOLD §3.7.4 同规矩）
//
//   · **不重写业务逻辑**：`update` / `view` 的结构、数据模型、文案一个字都不猜着改；
//   · **不"顺手删掉"迁移不过去的代码**：整块用 `// ` 注释掉并留 `TODO(migrate)` 头，
//     决定权留在人手上（注释掉而不是删掉，见 `blockOutUnportable` 的说明）；
//   · **不承诺"迁移后效果一致"**：RN 的排版与浏览器不同，效果要重新验。
//
// ## 判据是"报告零遗漏"，不是"自动改对了多少"
//
// 这条是刻意的：自动改写猜错的代价，是把 bug 埋进用户的代码里，而他不会知道。
// 所以本文件的每一处"改写"都必须能指出它依据的是哪条**可判定的**事实
// （CSS 规则的原文、源码里的祖先链、类的字面量），判不了的一律进 TODO。

const fs = require('fs');
const path = require('path');

const { locate, read } = require('../template.js');
const { renderProject, writeProject } = require('../init.js');
const styles = require('./style-emit.js');
const classRewrite = require('./class-rewrite.js');
const { auditApp, formatFindings } = require('./app-audit.js');
const { detectClickOnView } = require('./click-on-view.js');

/**
 * 宿主版本档：**RN 版本由宿主决定，库不绑版本**（PLAN §1.2）。
 *
 * 每条都必须来自实测的配套关系，不能凭印象写：
 *   · `0.86` = 模板自己的钉法（Expo SDK 57 / RN 0.86.3）—— `npm view expo-template-blank@sdk-57`
 *   · `0.83` = 桌面端 RNW 能对上的那条线（Expo SDK 55 / RN 0.83.10 / RNW 0.83.2）
 *      —— `npm view expo-template-blank@sdk-55` + `npm view react-native-windows@0.83.2 peerDependencies`
 */
const RN_PROFILES = {
  '0.86': {
    expo: '~57.0.24',
    'expo-status-bar': '~57.0.1',
    react: '19.2.3',
    'react-dom': '19.2.3',
    'react-native': '0.86.3',
    '@expo/metro-runtime': '~57.0.16',
    'react-native-web': '^0.21.2',
  },
  '0.83': {
    expo: '~55.0.31',
    'expo-status-bar': '~55.0.6',
    react: '19.2.0',
    'react-dom': '19.2.0',
    'react-native': '0.83.10',
    '@expo/metro-runtime': '~55.0.12',
    'react-native-web': '^0.21.2',
  },
};

/** 扫描源项目时**不进**的目录（与 F1 动检同一张表的意图：只扫自己的代码）。 */
const SKIP_DIRS = new Set([
  'node_modules', '_build', 'target', '.git', '.repos', '.mooncakes', '.expo', 'dist', '.scratch',
]);

/** rabbita 的 import 路径 → moobile 的。没列的一律**原样保留并点名**（不猜）。 */
const IMPORT_MAP = {
  'moonbit-community/rabbita/html': 'XiLaiTL/moobile/vendor/rabbita/html',
  'moonbit-community/rabbita/cmd': 'XiLaiTL/moobile/vendor/rabbita/cmd',
  'moonbit-community/rabbita/sub': 'XiLaiTL/moobile/vendor/rabbita/sub',
  'moonbit-community/rabbita/js': 'XiLaiTL/moobile/vendor/rabbita/js',
  'moonbit-community/rabbita/dom': 'XiLaiTL/moobile/vendor/rabbita/dom',
  'moonbit-community/rabbita/http': 'XiLaiTL/moobile/http',
  'moonbit-community/rabbita/svg': 'XiLaiTL/moobile/vendor/rabbita/svg',
  'moonbit-community/rabbita': null, // 根包在 moobile 里没有对应物（`Html`/`Val` 见 html 包）
};

/** 无法机械迁移的构造 → 理由（块级注释时用它写 TODO）。 */
const UNPORTABLE = [
  { re: /@dom\./, why: '`@dom` 是浏览器 API 直连；RN 上没有 `document`' },
  { re: /extern\s+"js"/, why: '内联 JS FFI 是按浏览器语义写的（`window` / `devicePixelRatio`）' },
  { re: /\b(canvas|details|summary|dialog|select|iframe|video|audio|table|svg)\s*\(/, why: '标签表外的标签（RN 无对应物）' },
];

const USAGE = `用法：moobile-host create --from-rabbita <既有项目> <新项目目录> [选项]

  <既有项目>           一个用 rabbita 写的项目根目录（要能读到 moon.mod）
  <新项目目录>          生成到哪（不存在就建；已存在且非空要 --force）

选项：
  --name <应用名>      应用名（默认取目录名）：小写字母/数字/连字符
  --rn <0.83|0.86>     宿主用的 RN 版本档（决定 Expo / react-native 的版本，见 RN_PROFILES）
  --host-dep <spec>    宿主 npm 包的依赖写法（默认 registry 的 ^x.y.z；在本仓库里跑自己的应用时
                       要写 file:../../../npm/moobile-host，否则拿不到尚未发布的本地版本）
  --force              目标目录非空时也往里写
  --dry-run            只列将要写什么、报告摘要，不落盘
  -h, --help           这条帮助

产物：
  MIGRATION.md                 迁移报告（人读）
  migration.generated.json     同一份报告的机器可读形态
  styles/                      F2 生成的样式模块（CSS → @style）
  <其余>                       就是 \`moobile-host init\` 的生成物 + 搬过来的视图
`;

function parseArgs(argv) {
  const out = { src: null, dir: null, name: null, rn: null, hostDep: null, host: null, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from-rabbita') out.src = argv[++i];
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--rn') out.rn = argv[++i];
    else if (a === '--host-dep') out.hostDep = argv[++i];
    else if (a === '--host') out.host = argv[++i];
    else if (a === '--force') out.force = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else if (a.startsWith('-')) throw new Error(`不认识的选项：${a}`);
    else if (!out.src) out.src = a;
    else if (!out.dir) out.dir = a;
    else throw new Error(`多余的参数：${a}`);
  }
  return out;
}

/** 递归读源项目里的文本文件（只读自己写的代码，跳过依赖与构建产物）。 */
function walkSource(root) {
  const out = [];
  const walk = (dir, base) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const rel = base ? `${base}/${name}` : name;
      let st;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
        walk(abs, rel);
        continue;
      }
      if (!/\.(mbt|pkg|css|html|htm|json|mod)$/.test(name)) continue;
      const buf = fs.readFileSync(abs);
      if (buf.includes(0)) continue; // 二进制跳过（源项目里可能有 assets）
      out.push({ rel, text: buf.toString('utf8') });
    }
  };
  walk(root, '');
  return out;
}

/** 这个文件算不算"UI 代码"（含 `@html` 的用法）。 */
function isUiFile(text) {
  return /@html\.|using\s+@html/.test(text);
}

/**
 * 挑出要搬的包：**UI 包 + 它们依赖的本地包**。
 *
 * 为什么不能"整个搬"：源项目里常有服务端/脚本包（`interest/yi` 的 `backend/` 就是一个
 * MoonBit 异步 HTTP 服务器，只支持 native）。搬进来会让生成的项目**连 js 都编不过**，
 * 而错误信息完全指不到"这是因为你搬了一个服务器"。
 * 判据用"被 UI 包 import 的本地包"而不是目录名 —— 名字里有没有 `backend` 是碰运气。
 *
 * @returns {{packages: Map<string, any[]>, excluded: {rel: string, why: string}[]}}
 */
function pickPackages(files) {
  const uiDirs = new Set();
  for (const f of files) {
    if (f.rel.endsWith('.mbt') && isUiFile(f.text)) {
      uiDirs.add(path.dirname(f.rel) === '.' ? '' : path.dirname(f.rel));
    }
  }
  // 读这些目录的 moon.pkg，把 `import` 里指向**本模块**的路径也拉进来
  const moduleName = (files.find((f) => f.rel === 'moon.mod') || {}).text?.match(/name\s*=\s*"([^"]+)"/)?.[1];
  const wanted = new Set(uiDirs);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of files) {
      if (!f.rel.endsWith('moon.pkg')) continue;
      const dir = path.dirname(f.rel) === '.' ? '' : path.dirname(f.rel);
      if (!wanted.has(dir)) continue;
      for (const m of f.text.matchAll(/"([^"]+)"/g)) {
        const imp = m[1];
        if (!moduleName || !imp.startsWith(moduleName + '/')) continue;
        const sub = imp.slice(moduleName.length + 1);
        if (!wanted.has(sub)) {
          wanted.add(sub);
          grew = true;
        }
      }
    }
  }

  const packages = new Map();
  const excluded = [];
  for (const f of files) {
    const dir = path.dirname(f.rel) === '.' ? '' : path.dirname(f.rel);
    if (wanted.has(dir)) {
      if (!packages.has(dir)) packages.set(dir, []);
      packages.get(dir).push(f);
    } else if (f.rel.endsWith('.mbt')) {
      excluded.push({
        rel: f.rel,
        why: isUiFile(f.text)
          ? '这个包不在 UI 包的依赖闭包里'
          : '不含 `@html` 用法（多半是服务端 / 脚本 / 纯数据包）',
      });
    }
  }
  return { packages, excluded, moduleName };
}

/** `moon.pkg` 的 import 改写：rabita → moobile。返回 `{text, notes}`。 */
function rewriteMoonPkg(text, opts) {
  const notes = [];
  const lines = text.split('\n');
  const out = [];
  let inImports = false;
  for (const line of lines) {
    if (/^import\s*\{/.test(line.trim())) {
      inImports = true;
      out.push(line);
      continue;
    }
    if (inImports && /^\}/.test(line.trim())) {
      inImports = false;
      out.push(line);
      continue;
    }
    if (inImports) {
      const m = line.match(/^\s*"([^"]+)"(\s+@[\w]+)?,?\s*$/);
      if (m) {
        const imp = m[1];
        const alias = m[2] || '';
        if (Object.prototype.hasOwnProperty.call(IMPORT_MAP, imp)) {
          const mapped = IMPORT_MAP[imp];
          if (mapped === null) {
            notes.push({
              kind: 'import-dropped',
              reason: `import \`${imp}\` 在 moobile 里没有对应物（它是 rabbita 的根包：\`App\`/\`run\` 那一套由宿主接管），已去掉`,
            });
            continue; // 丢掉这一行
          }
          out.push(line.replace(`"${imp}"`, `"${mapped}"`));
          continue;
        }
        if (opts.moduleName && imp.startsWith(opts.moduleName + '/')) {
          // 模块改名：`zhouyi/zhouyi_reader/shared` → `<新模块名>/shared`
          out.push(line.replace(`"${imp}"`, `"${opts.newModule}/${imp.slice(opts.moduleName.length + 1)}"`));
          continue;
        }
        if (/rabbita/.test(imp)) {
          notes.push({
            kind: 'import-unknown',
            reason: `import \`${imp}\` 不在已登记的映射表里，**原样保留**（它多半编不过）—— 需要人判断换成哪个能力包`,
          });
        }
      }
    }
    out.push(line);
  }
  return { text: out.join('\n'), notes };
}

/** `moon.mod` 的改写：换依赖、改目标。 */
function rewriteMoonMod(text, opts) {
  const notes = [];
  let out = text
    .replace(/^name\s*=\s*"[^"]*"/m, `name = "${opts.newModule}"`)
    .replace(/^version\s*=\s*"[^"]*"/m, 'version = "0.1.0"');
  // 丢掉 rabbita 依赖，换成 moobile
  out = out.replace(/^\s*"moonbit-community\/rabbita(@[^"]*)?"\s*,?\s*$/gm, (line) => {
    notes.push({
      kind: 'dep-swapped',
      reason: `依赖 \`moonbit-community/rabbita\` 换成 \`XiLaiTL/moible\`（moobile 就是它的换后端 fork）`,
    });
    return '';
  });
  if (!/XiLaiTL\/moobile/.test(out)) {
    if (/^import\s*\{/m.test(out)) {
      out = out.replace(/^(import\s*\{)/m, `$1\n  "${opts.moobileDep}",`);
    } else {
      out += `\nimport {\n  "${opts.moobileDep}",\n}\n`;
    }
  }
  if (/^preferred_target\s*=/m.test(out)) {
    out = out.replace(/^preferred_target\s*=\s*"[^"]*"/m, 'preferred_target = "js"');
  } else {
    out += '\npreferred_target = "js"\n';
  }
  if (/^supported_targets\s*=/m.test(out)) {
    out = out.replace(/^supported_targets\s*=\s*"[^"]*"/m, 'supported_targets = "+js"');
  } else {
    out += 'supported_targets = "+js"\n';
  }
  notes.push({ kind: 'target', reason: '构建目标收敛到 `+js`（moobile 的库只支持 js，这是传递性约束）' });
  return { text: out, notes };
}

/**
 * 入口改写：rabbita 的 `app()` + `main` → moobile 的单导出。
 *
 * 依据的是两者的**对应关系**（不是猜）：rabbita 的 `create_state_with_init` 对应
 * moobile 的 `handlers_with_init`，`create_state` 对应 `handlers`；
 * TEA 的 `update` / `view` 签名两边一致（`(Model, Msg, Emit)` / `(Model, Emit)`）。
 */
function rewriteEntry(text) {
  const notes = [];
  const hasInit = /create_state_with_init/.test(text);

  /**
   * 去掉一个 `fn` 定义（连同它上面那行 `///|`）。
   *
   * ⚠️ 这里**必须**用括号配对来定边界，不能用正则的惰性量词：
   *    第一版写的是 `/\/\/\|\s*
(?:[^
]*
)*?fn app\...([\s\S]*?
\}
)/`，
   *    而 `(?:[^
]*
)*?` 可以跨任意多行去凑那个 `fn app` —— 于是它从**文件里第一个**
   *    `///|` 开始匹配，把中间的几百行一起删掉了。当时的症状是"class= 改写处数从 129 掉到 14"，
   *    而报告里看不出来。**行号/边界这类东西，正则不靠谱。**
   */
  const removeFn = (src, headerRe) => {
    const m = headerRe.exec(src);
    if (!m) return null;
    const braceAt = src.indexOf('{', m.index);
    if (braceAt === -1) return null;
    const closeAt = matchCloseForBrace(src, braceAt);
    if (closeAt === -1) return null;
    // 往上吃掉紧邻的 `///|` 文档标记行（只吃紧邻的：中间隔着别的代码就不动）
    const markIdx = src.lastIndexOf('///|', m.index);
    let begin = m.index;
    if (markIdx !== -1 && /^\s*(\/\/\/[^\n]*\n\s*)*$/.test(src.slice(markIdx, m.index))) begin = markIdx;
    return { begin, end: closeAt + 1 };
  };

  let out = text;
  const appSpan = removeFn(out, /fn app\(\)\s*->\s*Val\[Html\]\s*\{/);
  const mainSpan = removeFn(out, /fn main\s*\{/);

  if (appSpan) {
    const replacement =
      `///|
/// 应用交给宿主的全部东西（迁移生成：原来的 \`app()\` + \`fn main\` 合成这一个导出）。
` +
      `pub fn app() -> @moobile.JsValue {
` +
      `  @moobile.${hasInit ? 'handlers_with_init' : 'handlers'}(
` +
      `    ${hasInit ? 'init=init_app, ' : 'model=initial(), '}update~,
` +
      `    view~,
` +
      `  )
` +
      `}
`;
    out = out.slice(0, appSpan.begin) + replacement + out.slice(appSpan.end);
    notes.push({
      kind: 'entry',
      reason: `入口改写成单导出：\`fn main { @rabbita.new(app).mount("app") }\` → \`pub fn app() -> @moobile.JsValue\`（${hasInit ? 'handlers_with_init' : 'handlers'}）`,
      next: '自动完成；⚠️ 若原来的 `init` 名字不是 `init_app`，编译会点名',
    });
  } else {
    notes.push({
      kind: 'entry-manual',
      reason: '没有找到 `fn app() -> Val[Html]` 这个形状的入口 —— 入口要手工改',
      next: '人工：照模板的 `pub fn app() -> @moobile.JsValue { @moobile.handlers(...) }` 改（F3 指南）',
    });
  }

  if (mainSpan) {
    // 位置会因上一次替换而变，重新定位一次
    const again = removeFn(out, /fn main\s*\{/);
    if (again) {
      out = out.slice(0, again.begin) + out.slice(again.end);
      notes.push({
        kind: 'entry',
        reason: '去掉 `fn main`（挂载由宿主负责，库侧不再自己 mount）',
        next: '自动完成，无需动作',
      });
    }
  }
  return { text: out, notes };
}

/** 找与 `open`（`{` 的下标）配对的那个 `}`（跳过字符串与行注释）。 */
function matchCloseForBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? text.length : nl;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** `using @rabbita {type Html, type Val}` → `using @html {type Html}`。 */
function rewriteUsing(text) {
  const notes = [];
  const out = text.replace(/using\s+@rabbita\s*\{([^}]*)\}/g, (m, body) => {
    const keep = body
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/^type\s+Val$/.test(s));
    notes.push({
      kind: 'using',
      reason: `\`using @rabbita {…}\` 改成 \`using @html {…}\`（Html 由 html 包提供；\`Val\` 是 rabbita 根包的东西，随入口一起没了）`,
    });
    return `using @html {${keep.join(', ')}}`;
  });
  return { text: out, notes };
}

/**
 * 迁不过去的块：**尽量留成"保底桩"**，实在不行才整块注释掉。
 *
 * ## 为什么不是"一律注释掉"
 *
 * 一律注释掉会把**调用它的代码**一起拖下水：`view` 调 `bagua_view`，`bagua_view` 里有 canvas，
 * 于是 `bagua_view` 被注释 → `view` 编不过 → `view` 也被注释 → 入口 `pub fn app()` 也被注释。
 * 实测的后果是**生成物根本挂不起来**（连 report 里都看不出来），第一次跑就撞上了。
 *
 * 保底桩把这条链断掉：
 *
 *   · **签名照原样留着**（调用点一个字都不用改）；
 *   · 函数体换成 `abort("TODO(migrate): …")` —— 跑到这里会**当场炸并且报出原因**，
 *     而不是静默返回一个错的值；
 *   · **原实现以注释形式留在下面**（不删代码，决定权在人手上）。
 *
 * 什么时候仍然整块注释掉：**签名本身就迁不过去**的时候（参数的类里带 `@dom`、
 * 或者干脆不是函数定义 —— 例如 `extern "js" fn … = "…"` 这种内联 FFI）。
 * 那种块只要存在就编不过，留着只会把编译错误传给使用者。
 *
 * ## 依赖传播（只对"整块注释掉"生效）
 *
 * 桩能满足引用，所以**不需要**传播；而整块注释掉的块里定义的类型/函数会让大家编不过，
 * 所以那一小撮要迭代到不动点。
 */
function blockOutUnportable(text, opts = {}) {
  const marker = /^\/\/\/\|$/gm;
  const marks = [];
  let m;
  while ((m = marker.exec(text))) marks.push(m.index);
  const blocks = [];
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i];
    const end = i + 1 < marks.length ? marks[i + 1] : text.length;
    blocks.push({ start, end, text: text.slice(start, end) });
  }
  if (!blocks.length) return { text, blocked: [], notes: [] };

  const head = text.slice(0, marks[0]);

  /** 这一块为什么迁不过去（`null` = 没问题）。 */
  const whyOf = (t) => {
    for (const u of UNPORTABLE) if (u.re.test(t)) return u.why;
    return null;
  };

  /** 能不能做桩：块里有一个函数定义，且**签名本身**是可迁移的。 */
  const stubInfo = (t) => {
    const sig = t.match(/(^|\n)([ \t]*)(pub\s+)?fn\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(->[^{]*)?\{/);
    if (!sig) return null;
    const braceAt = t.indexOf('{', sig.index);
    const headText = t.slice(0, braceAt + 1);
    if (UNPORTABLE.some((u) => u.re.test(headText))) return null;
    return { name: sig[4], braceAt, ret: (sig[6] || '').replace(/^\s*->\s*/, '').trim() };
  };

  /**
   * 桩体里放什么 —— **按返回类型给一个"空值"，而不是一律 abort**。
   *
   * 为什么改（第一版一律 `abort`）：罗盘那类函数返回 `Html`，而它挂在**列表页**里，
   * 于是"跑到这里会炸"变成"整个页面白屏" —— 使用者看到一条与迁移毫无关系的运行时
   * panic，而真正该看见的是"其余部分照常渲染，缺的那块有 TODO 点名"。
   * 实测就是这么栽的：数据接上之后，第一屏直接 panic 在罗盘桩上。
   *
   * 拿不到合适空值时（不认识的类型）才 `abort` —— 那种情况**必须响**：
   * 静默返回一个错的值比崩溃更坏。
   */
  const stubBody = (ret) => {
    const r = String(ret || '').trim();
    if (r === 'Html' || /@html\.Html$/.test(r)) return 'nothing';
    if (r === 'Unit' || r === '') return '()';
    if (r === 'Bool') return 'false';
    if (r === 'Int') return '0';
    if (r === 'Double') return '0.0';
    if (r === 'String') return '""';
    if (/^Array\[/.test(r)) return '[]';
    if (/Cmd$/.test(r)) return '@cmd.none';
    return null; // 不认识的类型：交给 abort
  };

  const mode = blocks.map((b) => {
    const why = whyOf(b.text);
    if (!why) return { kind: 'ok' };
    const info = stubInfo(b.text);
    if (info && info.name !== 'app') return { kind: 'stub', why, info };
    return { kind: 'comment', why };
  });

  // 依赖传播：只针对"整块注释掉"的那些
  const definedIn = (t) => {
    const names = new Set();
    for (const re of [/\bfn\s+([A-Za-z_]\w*)/g, /\blet\s+([A-Za-z_]\w*)/g, /\bstruct\s+([A-Za-z_]\w*)/g, /\benum\s+([A-Za-z_]\w*)/g, /\btype\s+([A-Za-z_]\w*)/g]) {
      let mm;
      while ((mm = re.exec(t))) names.add(mm[1]);
    }
    return names;
  };
  let changed = true;
  let rounds = 0;
  while (changed && rounds < 12) {
    changed = false;
    rounds++;
    const dead = new Set();
    blocks.forEach((b, i) => {
      if (mode[i].kind === 'comment') for (const n of definedIn(b.text)) dead.add(n);
    });
    blocks.forEach((b, i) => {
      if (mode[i].kind !== 'ok') return;
      for (const n of dead) {
        if (new RegExp(`\b${n}\b`).test(b.text)) {
          mode[i] = { kind: 'comment', why: `依赖了被整块注释掉的代码（\`${n}\`）` };
          changed = true;
          return;
        }
      }
    });
  }

  const out = [head];
  const blocked = [];
  const stubbed = [];
  blocks.forEach((b, i) => {
    const md = mode[i];
    const line = text.slice(0, b.start).split('\n').length;
    if (md.kind === 'ok') {
      out.push(b.text);
      return;
    }
    if (md.kind === 'stub') {
      const { braceAt, name } = md.info;
      const headText = b.text.slice(0, braceAt + 1);
      const body = b.text.slice(braceAt + 1).replace(/\n$/, '');
      stubbed.push({ line, name, why: md.why });
      // ⚠️ 桩体里**函数自己的收尾 `}` 必须留着**：原实现的每一行都被注释掉了，
      //    如果把最后那个 `}` 一起注释，函数就没有收尾 —— 报的是
      //    `Parse error, unexpected token end of file`（第一次跑就是踩这个，3 个桩 3 条错）。
      const trimmed = body.replace(/\s+$/, '');
      const inner = trimmed.endsWith('}') ? trimmed.slice(0, trimmed.lastIndexOf('}')) : trimmed;
      const filler = stubBody(md.info.ret);
      const fillLine = filler
        ? `\n  // 桩体：先给一个空值，让**其余的界面照常渲染**（这不是"迁好了"，见 MIGRATION.md）\n  ${filler}\n`
        : `\n  abort("TODO(migrate): ${name} —— ${md.why}")\n`;
      out.push(
        `// ── TODO(migrate)：\`${name}\` 的**实现**无法机械迁移（${md.why}）。\n` +
          `//    下面是一个**保底桩**：签名照原样，${filler ? `返回空值（\`${filler}\`）` : '运行时会 abort'}；\n` +
          `//    原实现以注释保留在桩体里。处理办法见 MIGRATION.md 的「必须人工处理」一节。\n` +
          headText +
          fillLine +
          `  // ↓↓↓ 原实现（保留，未启用）\n` +
          inner
            .split('\n')
            .map((l) => (l ? `  // ${l}` : '  //'))
            .join('\n') +
          '\n}\n',
      );
      return;
    }
    blocked.push({ line, why: md.why });
    const body = b.text.replace(/\n$/, '');
    out.push(
      `// ── TODO(migrate)：这一块**整块**无法机械迁移（${md.why}）—— 连签名都迁不过去。\n` +
        `//    原代码**保留在下面**（注释掉，不是删掉）。处理办法见 MIGRATION.md 的「必须人工处理」一节。\n` +
        body
          .split('\n')
          .map((l) => (l ? `// ${l}` : '//'))
          .join('\n') +
        '\n',
    );
  });
  return { text: out.join(''), blocked, stubbed, notes: [] };
}

/** 把生成的样式模块写进项目（`styles/styles.mbt` + `moon.pkg`）。 */
function stylesFiles(gen) {
  return [
    { rel: 'styles/styles.mbt', text: gen.source },
    { rel: 'styles/moon.pkg', text: gen.moonPkg },
  ];
}

/** `sty()` 助手 —— 调用点短一半，换写法只改一处。 */
function helperFile() {
  return {
    rel: 'styles_helpers.mbt',
    text: `///|
/// 由 \`moobile-host create --from-rabbita\` 生成 —— **不要手改**。
///
/// 视图里的 \`class="a b"\` 被改写成 \`attrs=sty(@styles.…())\`，这个函数就是那个 \`sty\`。
/// 为什么不每处手写 \`@html.Attrs::build().styles(…)\`：调用点短一半，而且**将来换写法只改这一处**。
pub fn sty(s : @style.Style) -> @html.Attrs {
  @html.Attrs::build().styles(s)
}
`,
  };
}

/** 渲染报告（人读）+ 机器可读形态。 */
function renderReport(data) {
  const { src, dir, scan, gen, rewriteStats, blocked, notes, profile, moobileDep } = data;
  const L = [];
  L.push(`# 迁移报告 —— \`${src}\` → \`${dir}\``);
  L.push('');
  L.push('> 由 `moobile-host create --from-rabbita` 生成。**这份报告是产物的一部分**：');
  L.push('> 它的价值在于把"会静默失效的东西"变成一张显式清单（判据：零遗漏）。');
  L.push('');
  L.push('## 0. 一句话');
  L.push('');
  if (scan) {
    const total = scan.findings.reduce((n, f) => n + f.count, 0);
    L.push(
      `动检命中 **${scan.findings.length} 类 / ${total} 处**；样式层生成 **${gen.classes.length}** 个样式函数` +
        `（声明 ${gen.accounting.decls} 条 = 已映射 ${gen.accounting.emitted} + 有损 ${gen.accounting.lost}）；` +
        `**${rewriteStats.todos + blocked.length} 项需要人工处理**（逐条见 §4）。`,
    );
  } else {
    L.push(`样式层生成 **${gen.classes.length}** 个样式函数；**${rewriteStats.todos + blocked.length} 项需要人工处理**。`);
  }
  L.push('');
  L.push(`宿主档：RN **${profile}**（\`--rn\` 决定）；库依赖 \`${moobileDep}\`。`);
  L.push('');

  if (scan) {
    L.push('## 1. 动检（F1）：会**静默失效**的东西');
    L.push('');
    L.push('| 类别 | 条数 | 自动化 | 下一步 |');
    L.push('|---|---|---|---|');
    for (const f of scan.findings) {
      L.push(`| \`${f.id}\` | ${f.count} | ${f.auto} | ${String(f.next).replace(/\n/g, ' ').slice(0, 160)} |`);
    }
    L.push('');
    L.push(`扫描范围：${scan.files} 个文件 / ${scan.lines} 行；标签表：映射 ${scan.table.mapped} / 排除 ${scan.table.excluded}。`);
    L.push('');
  }

  L.push('## 2. 样式层（F2）：CSS → `@style`');
  L.push('');
  L.push(`源：${gen.meta.sheets.map((s) => `\`${s.file}:${s.line}\``).join(' + ')}（${gen.meta.cssLines} 行 / ${gen.meta.cssRules} 条规则）`);
  L.push('');
  L.push(`产物：\`styles/styles.mbt\` —— **每个"源码里真实用到的类组合"一个函数**（共 ${gen.classes.length} 个）。`);
  L.push('');
  L.push('**对账**（这份报告能被信任的前提）：');
  L.push('');
  L.push('```');
  L.push(`声明总数 ${gen.accounting.decls} = 已映射 ${gen.accounting.emitted} + 有损 ${gen.accounting.lost}`);
  L.push('```');
  L.push('');
  if (gen.unmatchedRules.filter((u) => u.lost).length) {
    L.push('### 2.1 祖先链对不上、样式**没有落到任何元素**的规则（真损失）');
    L.push('');
    for (const u of gen.unmatchedRules.filter((x) => x.lost)) {
      L.push(`- \`${u.selector}\`（${u.file}:${u.line}，${u.decls} 条声明）—— ${u.reason}`);
    }
    L.push('');
  }
  const lossByWhy = new Map();
  for (const c of gen.classes) for (const l of c.losses) lossByWhy.set(l.reason, (lossByWhy.get(l.reason) || 0) + 1);
  if (lossByWhy.size) {
    L.push('### 2.2 有损的声明（**逐条**给出了理由）');
    L.push('');
    for (const [why, n] of [...lossByWhy].sort((a, b) => b[1] - a[1])) L.push(`- ×${n} ${why}`);
    L.push('');
    L.push('> 这些不是"生成器漏了"，而是 `@style` **明确不表达**它们（可移植子集优先于表达力）。');
    L.push('> 逐条的位置写在 `styles/styles.mbt` 的函数头注释里（`TODO(migrate)`）。');
    L.push('');
  }
  if (gen.ruleLosses.length) {
    L.push(`### 2.3 整条规则没映射（${gen.ruleLosses.length} 条）`);
    L.push('');
    const byKind = {};
    for (const l of gen.ruleLosses) (byKind[l.kind] = byKind[l.kind] || []).push(l);
    for (const [kind, list] of Object.entries(byKind)) {
      L.push(`- **${kind}** ×${list.length}：${list[0].reason}`);
    }
    L.push('');
  }

  L.push('## 3. 改写统计');
  L.push('');
  L.push(`- \`class=\` 改写处数：**${rewriteStats.edits}**（含条件类；带祖先链上下文）`);
  L.push(`- 入口/依赖/import 改写：${notes.length} 条（见 §4 表里 \`auto\` 那几行）`);
  L.push('');

  L.push('## 4. 必须人工处理（TODO 清单）');
  L.push('');
  L.push('**每一项都指了下一步**（判据 S9-5：不许出现"未知"这一类）。');
  L.push('');
  L.push('| # | 位置 | 什么 | 为什么 | 下一步 |');
  L.push('|---|---|---|---|---|');
  let i = 0;
  for (const t of rewriteStats.todoList) {
    i++;
    L.push(`| ${i} | \`${t.file}:${t.line}\` | ${t.snippet ? `\`${String(t.snippet).slice(0, 40)}\`` : t.kind} | ${t.reason} | ${t.next} |`);
  }
  for (const b of blocked) {
    i++;
    L.push(
      `| ${i} | \`${b.file}:${b.line}\` | 整块已注释 | ${b.why} | ` +
        '人工：见 SCAFFOLD §3.7.3 的"必须改"那一栏 —— 这类构造在 moobile 里都有**现成通道**：' +
        '`@canvas.OpCtx`（画布） / `@gesture.pan`（读坐标的手势） |',
    );
  }
  for (const n of notes) {
    i++;
    L.push(`| ${i} | \`—\` | ${n.kind} | ${n.reason} | ${n.next || '人工确认'} |`);
  }
  L.push('');
  L.push('## 5. 生成物清单');
  L.push('');
  L.push('```');
  for (const f of data.written) L.push(f);
  L.push('```');
  L.push('');
  L.push('## 5. 生成后自查（库侧判据，落盘后**读生成物**跑出来的）');
  L.push('');
  // ⚠️ 这一节的两条判据在 **web 上永远看不出问题**（DOM 自己会滚、浏览器自带 body 样式），
  //    它们只在原生上现形 —— 本轮实测：真机上滚 30 次界面纹丝不动，
  //    而**同一个页面**在 web 判据里 45/45。所以报告里必须点名，别等真机才发现。
  if (data.audit && data.audit.length) {
    const musts = data.audit.filter((f) => f.level === 'must');
    L.push(`**${musts.length} 条必须处理**（共 ${data.audit.length} 条）：`);
    L.push('');
    for (const f of data.audit) {
      L.push(`- \`${f.id}\`（${f.level}）${f.message}`);
      L.push(`  - → ${f.next}`);
    }
    L.push('');
    L.push('判据出自 `npm/moobile-host/lib/migrate/app-audit.js`；离线门是 `tools/migrate_app_audit.mjs`。');
  } else if (data.audit) {
    L.push('干净：根样式（`page()`）挂上了，根上也有滚动容器（`"scroll"` 伪标签 → RN 的 `ScrollView`）。');
  } else {
    L.push('（dry-run：没落盘，所以没跑自查）');
  }
  L.push('');
  L.push('## 6. 这份报告**没有**做的事（诚实清单）');
  L.push('');
  L.push('- **不重写业务逻辑**：`update` / `view` 的结构、数据模型、文案一个字都没动；');
  L.push('- **不承诺效果一致**：RN 的排版与浏览器不同（行内流那条已被实测推翻过），效果要重新验；');
  L.push('- **不改宿主之外的工程配置**：`app.json` 的图标/包名等仍是模板默认值；');
  L.push('- 被注释掉的块**没有**给出等价改写 —— 那是人的决定。');
  L.push('');
  return L.join('\n');
}


/**
 * 给搬过来的包补 `moon.pkg`：**加它现在真的需要的 import**，入口包还要挂 `link.exports`。
 *
 * 三件事，每件都有具体的失败症状：
 *   ① 视图里写了 `@styles.…`，包里却没有那条 import → 一片
 *      `Package "styles" not found in the loaded packages`（实测 224 条错误里有 224 条是它）；
 *   ② 入口 `pub fn app()` 在 `frontend/` 包里，而模板把 `exports = ["app"]` 挂在**根包**的
 *      `options(link:)` 上 → 编译过、链接时导不出 `app`（宿主拿到的是 undefined）；
 *   ③ 源项目的包常带 `pkgtype(kind: "executable")`（因为它原来是自己的入口），
 *      而迁移后入口归宿主了 → 留着它 moon 会去找 `fn main`。
 */
function augmentMoonPkg(text, opts) {
  let out = text;

  // ① import
  const want = [];
  if (opts.usesStyles && !/"@styles"/.test(out)) want.push(`  "${opts.newModule}/styles" @styles,`);
  if (opts.usesMoobile && !/^\s*"XiLaiTL\/moobile"\s+@moobile,/m.test(out)) want.push('  "XiLaiTL/moobile" @moobile,');
  if (want.length) {
    if (/^import\s*\{/m.test(out)) {
      out = out.replace(/^(import\s*\{)/m, '$1\n' + want.join('\n'));
    } else {
      out = 'import {\n' + want.join('\n') + '\n}\n\n' + out;
    }
  }

  // ③ 去掉 executable
  out = out.replace(/^\s*pkgtype\(kind\s*:\s*"executable"\).*$/gm, '');

  // ② link exports：先删掉原有的 options(link) 块，再按"这一包是不是入口"决定挂不挂
  const optIdx = out.search(/options\s*\(/);
  if (optIdx !== -1) {
    const braceAt = out.indexOf('(', optIdx);
    const closeAt = matchCloseForBrace(out.replace(/\(/g, '{').replace(/\)/g, '}'), braceAt);
    // 用同样的括号配对思路找 `options(` 的收括号（这里括号是圆括号，单独配一次）
    let depth = 0;
    let end = -1;
    for (let i = braceAt; i < out.length; i++) {
      if (out[i] === '(') depth++;
      else if (out[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) out = out.slice(0, optIdx) + out.slice(end + 1);
  }
  if (opts.isEntry) {
    // 入口包必须自己挂 `options(link: …)` —— 导出的名字要长在**含 `app` 的那个包**上
    out =
      out.trimEnd() +
      '\n\noptions(\n  link: {\n    "js": {\n      "format": "esm",\n      "exports": [\n        "app",\n      ],\n    },\n  },\n)\n';
  }
  // 去掉多余的连续空行（生成物要能被人读）
  return out.replace(/\n{3,}/g, '\n\n');
}


/**
 * 找出**挂在不会响的标签上的 `on_click`** —— 这是迁移里最隐蔽的一类静默失效。
 *
 * 事实（`render.mbt:243`）：`on_click` 在 moobile 里被映射成 RN 的 **`onPress`**，
 * 而标签表里只有 `button` / `a` 落到 `Pressable`；`div` / `span` / `p` 落到 `View` / `Text`，
 * 那两个组件**没有 `onPress` 这个 prop** —— 于是点击被**丢掉**，不报错、不警告。
 *
 * 为什么"按行子串匹配"的 14 条规则抓不到它：它要的是"标签 + 事件"两个 token 的**结构关系**
 * （同一次调用里），单行子串判不出来。
 *
 * ★ 2026-10-02：这条**已经是 F1 的正式一条**（`scan.js` 的 `click.on-view`，报告里逐条点名）。
 *   实现只有一份 —— `click-on-view.js`，扫描器与装配器共用；`create` 用它生成 §4 的 TODO 条目。
 *
 * 实测（`interest/yi`）：5 处 `div(... on_click=...)` —— 卦卡点不动、折叠点不开。
 * 修法是换标签（`div` → `button`），不是加样式。
 */
// ⚠️ 这条判据的实现**搬到共享模块了**（`click-on-view.js`）：F1 扫描器（`scan.js`）
//    也要报同一件事，而"两份实现 = 一个必然的漂移点"（`tools/migrate_scan_reconcile.mjs`
//    记着那次事故）。这里只 require 那一份，不再自己数一遍。
//    算法、口径（**扫原始文本，注释里的代码也算命中**）与理由，都在那个文件头。

function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`moobile-host create: ${err.message}\n`);
    process.stdout.write(USAGE);
    process.exit(2);
  }
  if (args.help || !args.src || !args.dir) {
    process.stdout.write(USAGE);
    process.exit(args.help ? 0 : 2);
  }

  const srcRoot = path.resolve(args.src);
  const target = path.resolve(args.dir);
  const name = args.name || path.basename(target).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const profile = args.rn || '0.86';
  if (!RN_PROFILES[profile]) {
    console.error(`moobile-host create: 不认识的 --rn ${args.rn}（可选：${Object.keys(RN_PROFILES).join(' / ')}）`);
    process.exit(2);
  }
  if (!fs.existsSync(path.join(srcRoot, 'moon.mod'))) {
    console.error(`moobile-host create: ${args.src} 里没有 moon.mod —— 这不像一个 MoonBit 项目根目录。`);
    process.exit(2);
  }

  // ── 读源项目 ────────────────────────────────────────────────────────────────
  const srcFiles = walkSource(srcRoot);
  const { packages, excluded, moduleName } = pickPackages(srcFiles);
  const uiFiles = [];
  for (const list of packages.values()) uiFiles.push(...list);

  // ── F1 动检（纯 JS 版；与 MoonBit 版有对账门 tools/migrate_scan_reconcile.mjs）──
  let scan = null;
  let scanError = null;
  try {
    const { scanProject } = require('./scan.js');
    scan = scanProject({ root: srcRoot, lib: path.join(__dirname, '..', '..', '..', '..') });
  } catch (err) {
    scanError = err.message;
  }

  // ── F2：样式层 ──────────────────────────────────────────────────────────────
  //
  // ⚠️ 样式表的来源与视图的来源**不是同一个集合**：视图只在 UI 包里，而 CSS 常常躺在别处
  //    （`interest/yi` 的样式就在 `backend/index.html` 的内联 `<style>` 里，而 `backend/`
  //    是那个 MoonBit 服务器，根本不进 UI 包闭包）。
  //    第一版只喂 UI 包 → 只生成出 1 个样式函数，而报告里**看不出来少了什么**。
  const { sites } = classRewrite.extractSites(uiFiles.filter((f) => f.rel.endsWith('.mbt')));
  const gen = styles.generate(srcFiles, { appName: name, sites });
  const known = new Set(gen.classes.map((c) => c.key));

  // ── 逐文件改写 ──────────────────────────────────────────────────────────────
  const allNotes = [];
  const allTodos = [];
  let editsTotal = 0;
  const blockedAll = [];
  const stubbedAll = [];
  /** 每个包用得上的东西（决定 moon.pkg 要补哪几条 import）。 */
  const pkgNeeds = new Map();
  let entryPkg = null;

  /** 改写结果（还没定最终落点）—— 入口包的位置要等它自己被发现之后才能定。 */
  const rewritten = [];
  for (const [dir, list] of packages) {
    for (const f of list) {
      const rel = f.rel;
      if (f.rel.endsWith('moon.pkg')) {
        const r = rewriteMoonPkg(f.text, { moduleName, newModule: name });
        rewritten.push({ dir, rel, text: r.text, isPkg: true });
        allNotes.push(...r.notes);
        continue;
      }
      if (f.rel.endsWith('moon.mod')) {
        const r = rewriteMoonMod(f.text, { newModule: name, moobileDep: `XiLaiTL/moobile@0.4.0` });
        // moon.mod 由模板提供（名字/版本已对），这里只把依赖与目标对齐 —— 用模板的更稳妥
        allNotes.push(...r.notes);
        continue;
      }
      if (!f.rel.endsWith('.mbt')) {
        rewritten.push({ dir, rel, text: f.text }); // css/html 原样带上，供报告指回
        continue;
      }
      let text = f.text;
      const u = rewriteUsing(text);
      text = u.text;
      allNotes.push(...u.notes);
      const e = rewriteEntry(text);
      text = e.text;
      allNotes.push(...e.notes);
      // `helper: '@styles.att'` —— 桥放在 styles 包里（一处），不在每个应用包里各放一份副本
      const c = classRewrite.rewrite(text, { file: f.rel, known, helper: '@styles.att' });
      text = c.text;
      editsTotal += c.edits.length;
      allTodos.push(...c.todos);
      allTodos.push(...detectClickOnView(text, f.rel));
      const b = blockOutUnportable(text);
      text = b.text;
      if (/@styles\./.test(text)) pkgNeeds.set(dir, { ...(pkgNeeds.get(dir) || {}), usesStyles: true });
      if (/@moobile\./.test(text)) pkgNeeds.set(dir, { ...(pkgNeeds.get(dir) || {}), usesMoobile: true });
      if (/pub fn app\(\) -> @moobile\.JsValue/.test(text)) entryPkg = dir;
      blockedAll.push(...b.blocked.map((x) => ({ ...x, file: f.rel })));
      stubbedAll.push(...(b.stubbed || []).map((x) => ({ ...x, file: f.rel })));
      rewritten.push({ dir, rel, text });
    }
  }

  // ── 入口包摊到模块根 ────────────────────────────────────────────────────────
  //
  // ⚠️ **产物名跟着包名走**：`moobile-host build` 找的是"以模块命名的那个产物"
  //    （`_build/js/debug/build/<模块>/<模块>.js`）。入口包要是留在 `frontend/` 里，
  //    产物就叫 `frontend.js`，`build` 直接报"找不到产物"（实测就是这条）。
  //    仓库里其它应用（template / chat-app / canvas-demo）的入口本来就在模块根 —— 这里对齐。
  const outFiles = rewritten.map((f) => {
    if (entryPkg && f.dir === entryPkg) {
      // 入口包的文件摊到根：`frontend/main.mbt` → `main.mbt`
      return { rel: f.isPkg ? 'moon.pkg' : path.basename(f.rel), text: f.text };
    }
    return { rel: f.rel, text: f.text };
  });

  // ── 补 moon.pkg（import 与 link.exports）────────────────────────────────────
  //    必须在所有 .mbt 都改完之后做：判断"这一包用不用 @styles"靠的是**改完的**文本。
  for (let i = 0; i < outFiles.length; i++) {
    const f = outFiles[i];
    if (!f.rel.endsWith('moon.pkg')) continue;
    // 摊平之后，入口包的那份 moon.pkg 就住在模块根（`rel === 'moon.pkg'`），
    // 所以"是不是入口"看的是它的来源包，不是它的路径。
    const src = rewritten.find((r) => r.isPkg && (r.dir === entryPkg ? path.basename(r.rel) === f.rel : r.rel === f.rel));
    const srcDir = src ? src.dir : path.dirname(f.rel) === '.' ? '' : path.dirname(f.rel);
    const needs = pkgNeeds.get(srcDir) || {};
    outFiles[i] = {
      ...f,
      text: augmentMoonPkg(f.text, {
        newModule: name,
        usesStyles: Boolean(needs.usesStyles),
        usesMoobile: Boolean(needs.usesMoobile),
        isEntry: entryPkg === srcDir,
      }),
    };
  }
  const entryProvidesRootPkg = outFiles.some((f) => f.rel === 'moon.pkg');

  // ── 工程骨架（模板，复用 init 的渲染与三条断言）────────────────────────────
  let plan;
  try {
    plan = renderProject(name, { host: args.host });
  } catch (err) {
    console.error(`moobile-host create: ${err.message}`);
    process.exit(2);
  }
  if (plan.problems.length) {
    console.error('moobile-host create: 模板本身是坏的（生成器/模板的问题，不是你的操作）：');
    for (const p of plan.problems) console.error('  ! ' + p);
    process.exit(1);
  }

  // 宿主版本档：**只改 package.json 的依赖版本**（MoonBit 侧一行都不用动 —— 库不绑版本）
  const pkg = plan.files.find((f) => f.rel === 'package.json');
  if (pkg) {
    const j = JSON.parse(pkg.text);
    for (const [dep, ver] of Object.entries(RN_PROFILES[profile])) {
      if (j.dependencies && Object.prototype.hasOwnProperty.call(j.dependencies, dep)) j.dependencies[dep] = ver;
    }
    j.name = name;
    // 宿主 npm 包：默认是**给消费者的写法**（registry 版本号）；`--host-dep` 可覆盖。
    // 在库仓库里跑我们自己的应用时要写 `file:../../../npm/moobile-host` ——
    // 否则会去 registry 拿一个**还没有的版本**（本地 0.4.0 尚未发布，实测安装直接失败）。
    // 仓库里其它应用（todo-app / chat-app / canvas-demo）全是这么写的。
    if (args.hostDep) j.dependencies['moobile-host'] = args.hostDep;
    pkg.text = JSON.stringify(j, null, 2) + '\n';
  }
  // 视图文件与样式模块并进生成物；`app.mbt`（模板的 Todo）让位给搬来的视图
  // 模板的 `app.mbt`（Todo 演示）让位给搬来的视图；模板根包的 `moon.pkg` 也一样 ——
  // 搬来的入口包自带一份（它知道入口要哪些 import），两份会打架。
  const finalFiles = plan.files.filter(
    (f) => f.rel !== 'app.mbt' && !(entryProvidesRootPkg && f.rel === 'moon.pkg'),
  );
  finalFiles.push(...stylesFiles(gen), ...outFiles);

  // ── 报告 ────────────────────────────────────────────────────────────────────
  const NEXT_OF = {
    'dynamic-class': '人工：把类名收敛成字面量（或在 Model 里表达状态），再决定样式',
    'unstyled-class': '人工：确认这是状态标记还是有遗漏的规则',
    'attrs-conflict': '人工：把两处 `attrs=` 合并成一个 `Attrs` 链',
    'click-on-view': '人工：把标签换成 `button`（或 `a`）—— 它们才映射到 `Pressable`；只加样式不管用',
    stub: '人工：用 moobile 的对应通道重写实现 —— canvas 走 `@canvas.OpCtx`、读坐标的手势走 `@gesture.pan`、`details/summary` 改成受控组件（见 SCAFFOLD §3.7.3）',
    blocked: '人工：整块重写（签名也迁不过去）—— 同上',
  };
  const todoList = [
    ...allTodos,
    ...stubbedAll.map((b) => ({ ...b, kind: 'stub', reason: `\`${b.name}\` 的实现迁不过去（${b.why}）`, snippet: b.name })),
    ...blockedAll.map((b) => ({ ...b, kind: 'blocked', reason: b.why, snippet: '' })),
  ].map((t) => ({ ...t, next: NEXT_OF[t.kind] || '人工：见 SCAFFOLD §3.7.3 的迁移矩阵' }));
  const notesWithNext = allNotes.map((n) => ({ ...n, next: NEXT_OF[n.kind] || '自动完成，无需动作' }));

  const reportData = {
    src: (path.relative(process.cwd(), srcRoot) || '.').split(path.sep).join('/'),
    dir: (path.relative(process.cwd(), target) || '.').split(path.sep).join('/'),
    scan,
    gen,
    rewriteStats: { edits: editsTotal, todos: todoList.length, todoList },
    blocked: blockedAll,
    stubbed: stubbedAll,
    notes: notesWithNext,
    profile,
    moobileDep: 'XiLaiTL/moobile@0.4.0',
    written: [...finalFiles.map((f) => f.rel), 'MIGRATION.md', 'migration.generated.json'].sort(),
    // 生成后自查：机械迁移**移不过来**的那两块（根样式 `page()` 没人挂、根上没有滚动容器）。
    // ⚠️ 它在**落盘之后**才算得出来：审计是**读文件**的（`lib/migrate/app-audit.js`），
    //    所以报告里给的是**生成物真实的样子**，而不是"我打算生成的样子"。
    audit: null,
  };
  const machine = {
    tool: 'moobile-host create --from-rabbita',
    // ⚠️ 绝对路径**不能进生成物**：`tools/check_public_leaks.py` 会把 `D:\…` 这类路径
    //    判成泄漏（真发生过：生成物一落地那条门就红了）。所以这里一律写 cwd 相对路径。
    from: reportData.src,
    to: reportData.dir,
    rnProfile: profile,
    packages: [...packages.keys()],
    excluded,
    // 动检报告里的 `root` 是绝对路径（MoonBit 侧也这样），落地前抹掉
    scan: scan ? { ...scan, root: reportData.src } : scan,
    scanError,
    styles: {
      classes: gen.classes.length,
      accounting: gen.accounting,
      unmatchedLost: gen.unmatchedRules.filter((u) => u.lost).length,
      ruleLosses: gen.ruleLossSummary,
      keys: gen.classes.map((c) => c.key),
    },
    classRewrite: { edits: editsTotal, todos: todoList },
    blocked: blockedAll,
    stubbed: stubbedAll,
    notes: notesWithNext,
  };

  if (args.dryRun) {
    console.log(`moobile-host create（dry-run）：${reportData.src} → ${reportData.dir}`);
    console.log(`  UI 包：${[...packages.keys()].map((d) => d || '.').join(' / ') || '（没找到）'}`);
    console.log(
      `  样式函数 ${gen.classes.length} 个；class= 改写 ${editsTotal} 处；TODO ${todoList.length} 项；` +
        `保底桩 ${stubbedAll.length} 个 / 整块注释 ${blockedAll.length} 个`,
    );
    console.log(`  将写入 ${finalFiles.length + 2} 个文件（含 MIGRATION.md / migration.generated.json）`);
    if (scanError) console.log(`  ⚠️ 动检没跑成：${scanError}`);
    return;
  }

  // ── 落盘 ────────────────────────────────────────────────────────────────────
  const exists = fs.existsSync(target);
  if (exists && !args.force && fs.readdirSync(target).filter((n) => n !== '.git').length) {
    console.error(`moobile-host create: ${reportData.dir} 已存在且非空 —— 换一个目录，或加 --force。`);
    process.exit(2);
  }
  writeProject(target, finalFiles);
  // 落盘之后**再自查**（审计读文件，读的是生成物本身），然后把结果补进报告与收尾输出。
  reportData.audit = auditApp(target);
  fs.writeFileSync(path.join(target, 'MIGRATION.md'), renderReport(reportData));
  fs.writeFileSync(
    path.join(target, 'migration.generated.json'),
    JSON.stringify({ ...machine, audit: reportData.audit }, null, 2) + '\n',
  );

  console.log(`moobile-host create: 生成 ${reportData.dir} —— ${finalFiles.length + 2} 个文件`);
  console.log(`  源：${reportData.src}（UI 包：${[...packages.keys()].map((d) => d || '.').join(' / ')}）`);
  console.log(`  宿主档 RN ${profile} · 库依赖 ${reportData.moobileDep}`);
  console.log('');
  console.log(`  样式层：${gen.classes.length} 个函数（声明对账 ${gen.accounting.decls} = ${gen.accounting.emitted} + ${gen.accounting.lost}）`);
  console.log(
    `  视图：改写了 ${editsTotal} 处 \`class=\`；${stubbedAll.length} 个函数留成保底桩（调用会 abort）、` +
      `${blockedAll.length} 个块整块注释掉`,
  );
  console.log(`  待人工：${todoList.length} 项 —— **先读 MIGRATION.md 的 §4**`);
  console.log('');
  // ⚠️ 这段**不是**"提示一下"：这两条在 web 上**永远看不见**（DOM 自己会滚、浏览器自己有 body 样式），
  //    只在原生上现形（实测：真机滚 30 次界面纹丝不动，而同一页面 web 判据 45/45）。
  const musts = reportData.audit.filter((f) => f.level === 'must');
  if (reportData.audit.length) {
    console.log(`  生成后自查：${musts.length} 条必须处理 / 共 ${reportData.audit.length} 条 —— 见 MIGRATION.md §5`);
    for (const line of formatFindings(reportData.audit)) console.log(line);
  } else {
    console.log('  生成后自查：干净（根样式与滚动容器都在）');
  }
  console.log('');
  console.log('  接下来：');
  const cd = path.relative(process.cwd(), target);
  if (cd) console.log(`    cd ${cd}`);
  console.log('    npm install');
  console.log('    npm run web        # 或 npm run android');
}

module.exports = {
  main,
  RN_PROFILES,
  IMPORT_MAP,
  walkSource,
  pickPackages,
  rewriteMoonPkg,
  rewriteMoonMod,
  rewriteEntry,
  matchCloseForBrace,
  rewriteUsing,
  blockOutUnportable,
  detectClickOnView,
  renderReport,
  augmentMoonPkg,
};
