#!/usr/bin/env node
// build-web.mjs —— 把 MoonBit 产物打成一个静态站点（`dist/`）。
//
//   npm run build     # moon build + moobile-host build + 这个脚本（**默认 prod 档**）
//   npm run build:dev # 同上，但打 **dev 档**（阅读报错/警告用；体积大得多）
//   npm run serve     # 起静态服务看一眼（零依赖）
//
// ## 两个产物档位（对标表 #14：VitePress 那档体积）
//
//   · **prod（默认）**：`process.env.NODE_ENV = "production"` + `minify` —— React 走生产构建、
//     产物压缩。**这是交付形态**。
//   · **dev**：`"development"` + 不压缩 —— React 的开发版会在控制台说很多话（重复 key、弃用警告…），
//     排查界面问题时有用，但**别拿它当交付物**（体积差好几倍）。
//   ⚠️ 这个开关是 **构建期** 的：`NODE_ENV` 在打包时被**替换成字面量**（见下面的 `define`），
//      运行时再设环境变量**改不动**已经打好的产物。
//
// ## 这条流水线里"宿主"是哪几步
//
//   ① 编产物：`moon build --target js` + `moobile-host build`（**发现**产物，不写死路径）
//   ② 打包：esbuild —— **一行 `alias` 把 `react-native` 指到 `react-native-web`**
//      （Metro / Expo 在 web 平台干的也是这件事，只是藏在预设里）
//   ③ 外壳：一份静态 `index.html` + `#root`
//
// 打出来的 `dist/` 扔进任何静态服务器就能跑 —— PWA / Tauri / Electron 那一类外壳要的正是这个形态。
//
// ⚠️ **必须钉住 `absWorkingDir`**：esbuild 的 `alias` 值是**按 cwd 解析**的（不是按 import
//    它的那个文件）。不写这一行，从仓库根跑就会红在 `Could not resolve "react-native-web"`，
//    而 cd 进这个目录跑却是绿的 —— 构建脚本该与 cwd 无关。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT = path.join(HERE, 'moobile.js');
const DIST = path.join(HERE, 'dist');

if (!fs.existsSync(ARTIFACT)) {
  console.error(`build-web.mjs: 找不到产物 ${ARTIFACT}\n  先跑 \`npm run build\`（它会先编 MoonBit 产物）`);
  process.exit(2);
}

const esbuild = await import('esbuild').catch(() => null);
if (!esbuild) {
  console.error('build-web.mjs: esbuild 没装 —— 先 `npm install`');
  process.exit(2);
}

const bytes = fs.readFileSync(ARTIFACT);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.copyFileSync(path.join(HERE, 'index.html'), path.join(DIST, 'index.html'));

// ── Agent 出口：`llms.txt` + 每页原文（`md/**`）────────────────────────────────────────
// ⚠️ 为什么在**构建**这一步拷进 `dist/`：它们由 `press` 生成在实例根（`APP/`），而站点只服务 `dist/`
//    ⇒ 不拷，浏览器就永远拿不到（"生成好了但拿不到"是最容易当成已完成的假象）。
// ⚠️ 缺了**不静默**：`llms.txt` 不在就报一句 —— 否则"人机共读"那条线会安静地少一半。
{
  const llms = path.join(HERE, 'llms.txt');
  if (fs.existsSync(llms)) {
    fs.copyFileSync(llms, path.join(DIST, 'llms.txt'));
  } else {
    console.error('build-web.mjs: ⚠️ 实例根没有 llms.txt（先跑 `press`）—— 这次产物里没有 Agent 索引');
  }
  const mdDir = path.join(HERE, 'md');
  if (fs.existsSync(mdDir)) {
    fs.cpSync(mdDir, path.join(DIST, 'md'), { recursive: true });
  } else {
    console.error('build-web.mjs: ⚠️ 实例根没有 md/（先跑 `press`）—— 这次产物里没有每页原文');
  }
}

// ── 构建戳：注入 `globalThis.__skillpress_build`（页脚"构建于"那一项的真源）─────────────
// ⚠️ 为什么由**构建**而不是 `press` 给：内容包必须逐字节可复现（`press --check` 逐行比对），
//    时间戳进内容包会让那条门每跑必红 ⇒ 只能落在构建这一步（每个实例产物一份，不进内容）。
// ⚠️ 形态是**本地短时间**（`YYYY-MM-DD HH:mm`，`sv-SE` 的本地格式恰好就是这个形状）——
//    页脚是给人看的，ISO 那一串带时区既长又难读；要机器可读另有 `artifact.json`。
{
  const stamp = new Date().toLocaleString('sv-SE').slice(0, 16);
  const p = path.join(DIST, 'index.html');
  const html = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(
    p,
    html.replace('</head>', `    <script>globalThis.__skillpress_build={generatedAt:${JSON.stringify(stamp)}};</script>
  </head>`),
  );
}

// 产物档位：**默认 prod**（交付形态）；只有**明确要 dev**（`--dev` 或 `NODE_ENV=development`）才打 dev。
// ⚠️ 写成"默认 prod"而不是"默认 dev + 记得加 --prod"：交付物的默认值必须是对的那个
//    （否则"忘了加参数"这件事会安静地把一个几 MB 的开发版发出去）。
const DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const PROD = !DEV;
const built = await esbuild.build({
  entryPoints: [path.join(HERE, 'index.js')],
  bundle: true,
  outfile: path.join(DIST, 'bundle.js'),
  platform: 'browser',
  format: 'iife',
  metafile: true,
  logLevel: 'silent',
  absWorkingDir: HERE,
  alias: { 'react-native': 'react-native-web' },
  minify: PROD,
  define: {
    'process.env.NODE_ENV': PROD ? '"production"' : '"development"',
    __ARTIFACT_SHA__: JSON.stringify(sha),
  },
  loader: { '.js': 'jsx' },
});

// 依赖图与产物指纹都落盘：前者是"包里有没有 Expo"最硬的证据（看输入清单，不看产物文本），
// 后者让页面/服务能自证"跑的是**这一次**编的产物"。
fs.writeFileSync(
  path.join(DIST, 'metafile.json'),
  JSON.stringify({ inputs: Object.keys(built.metafile.inputs) }, null, 2),
);
fs.writeFileSync(
  path.join(DIST, 'artifact.json'),
  JSON.stringify(
    { sha, bytes: bytes.length, builtAt: new Date().toISOString(), host: 'webview', mode: PROD ? 'prod' : 'dev' },
    null,
    2,
  ),
);

const size = fs.statSync(path.join(DIST, 'bundle.js')).size;
console.log(
  `build-web.mjs[${PROD ? 'prod' : 'dev'}]: dist/bundle.js ${(size / 1024).toFixed(0)} KB · moobile.js ${(bytes.length / 1024).toFixed(0)} KB · sha256 ${sha.slice(0, 16)}…`,
);
