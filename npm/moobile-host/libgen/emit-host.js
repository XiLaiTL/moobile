'use strict';
// emit-host.js —— 由 manifest 生成**宿主侧注册调用**（PLAN 的 I5）。
//
// 产物长这样（`host/libraries.antd.generated.js`）：
//
//     import * as antd from 'antd';
//     import React from 'react';
//     export function registerAntd(registerLibrary) {
//       return registerLibrary({ namespace: 'antd', module: antd, components: [...], … });
//     }
//
// **为什么组件名要显式列出来**（而不是让 `registerLibrary` 自动挑）：
// 自动挑的判据是"导出值看起来像组件"（函数 / 带 `$$typeof`），实测在 antd 6.6.4 上多挑一个
// `unstableSetRender`（一个普通函数，不是组件）。更要紧的是：**组件清单是两侧共同的承诺面** ——
// MoonBit 侧生成的那些 `@antd.button` 函数与宿主侧的注册表必须**同源于一份 manifest**，
// 各写一份就是等着漂。显式列出还顺带把"manifest 里的名字在这个版本里不存在"变成启动即报错。

const IDENTITY_EVENTS_NOTE =
  '// 事件键 → 组件库的 prop 名。**这里刻意是身份映射**：生成的 MoonBit 侧写的是\n' +
  '// `.on_raw("onClick", …)`（键就是 prop 名），于是不需要"猜落点"这一层 ——\n' +
  '// 而 `MOBILE_HOST.events["<ns>:*"]` 是库级通配，任何组件共用同一张表。';

/** 生成宿主侧注册文件。 */
function emitHost(manifest, opts = {}) {
  const ns = manifest.library.namespace;
  const pkg = manifest.library.package;
  // 组件清单 = 顶层组件 + **复合子组件**（`Form.Item` / `Layout.Header` / `Radio.Group`…）。
  // 子组件用点号路径写进同一个 `components` 数组：`registerLibrary` 会按 `.` 逐段下钻取值，
  // 取不到就启动即报错（不是渲染成空盒子）。宿主侧的键因此是 `antd:Form.Item`。
  const components = [];
  for (const c of Object.keys(manifest.components).sort()) {
    components.push(c);
    const subs = manifest.components[c].subcomponents || {};
    for (const s of Object.keys(subs).sort()) components.push(`${c}.${s}`);
  }
  const provider = manifest.host.provider;
  const platforms = manifest.host.platforms || [];
  const events = manifest.host.events || {};
  const jsonProps = manifest.host.jsonProps || {};
  const defaultExports = manifest.host.defaultExports || [];
  const exportName = opts.exportName || `register${ns[0].toUpperCase()}${ns.slice(1)}`;

  const L = [];
  L.push(`// 由 \`moobile-host libgen\` 生成 —— **不要手改**。`);
  L.push('//');
  L.push(`// 组件库：${pkg}@${manifest.library.version}（命名空间 \`${ns}:\`）`);
  L.push(`// 生成器：${manifest.$generator.tool} ${manifest.$generator.version}｜manifest 版本 ${manifest.$generator.manifest_version}`);
  L.push('// 清单：改动请改 manifest 后重跑 `libgen`，或改这里的 `libgen.config.json`。');
  L.push('//');
  const topCount = Object.keys(manifest.components).length;
  L.push(
    `// 组件 ${topCount} 个（含复合子组件共 ${components.length} 个键）｜平台 [${platforms.join(', ')}]｜JSON 通道的组件 ${Object.keys(jsonProps).length} 个`,
  );
  L.push('');
  L.push(`import * as ${ns} from '${pkg}';`);
  if (provider) L.push(`import React from 'react';`);
  L.push('');
  L.push(`/** 在宿主启动时调用一次；返回实际注册的组件名（便于启动日志与验证脚本断言）。 */`);
  L.push(`export function ${exportName}(registerLibrary) {`);
  L.push('  return registerLibrary({');
  L.push(`    namespace: '${ns}',`);
  L.push(`    module: ${ns},`);
  L.push('    // 显式清单：与 MoonBit 侧生成物同源（见本文件头部说明）');
  L.push('    components: [');
  for (let i = 0; i < components.length; i += 6) {
    const row = components.slice(i, i + 6).map((c) => `'${c}'`).join(', ');
    L.push(`      ${row},`);
  }
  L.push('    ],');
  L.push(`    platforms: [${platforms.map((p) => `'${p}'`).join(', ')}],`);
  if (defaultExports.length) {
    L.push('    // ⚠️ 这几个名字**只在模块的 `default` 导出上**（类型定义说有具名导出，JS 里没有）：');
    L.push('    //    这是人声明的（libgen.config.json 的 defaultExports），因为类型定义看不出来。');
    L.push('    //    不声明的话宿主**不会**回落，而是启动即报错（那样才知道是哪里不对）。');
    L.push(`    defaultExports: [${defaultExports.map((n) => `'${n}'`).join(', ')}],`);
  }
  L.push('    // 结构化 prop（MoonBit 侧用 `prop_json` 传 JSON 文本，宿主这里 JSON.parse 后交给组件）');
  L.push('    jsonProps: {');
  for (const name of Object.keys(jsonProps).sort()) {
    const list = jsonProps[name];
    L.push(`      ${jsonKey(name)}: [`);
    for (let i = 0; i < list.length; i += 5) {
      L.push(`        ${list.slice(i, i + 5).map((p) => `'${p}'`).join(', ')},`);
    }
    L.push('      ],');
  }
  L.push('    },');
  // ⚠️ 别在这里 `.trimStart()`：注释块**每一行**（含第一行）都要落在 `events:` 那一层的
  //    缩进上，trim 掉首行会让它贴到第 0 列、读起来像被注释掉的代码而不是说明。
  L.push(IDENTITY_EVENTS_NOTE.replace(/^/gm, '    '));
  L.push('    events: {');
  const evNames = Object.keys(events).sort();
  for (let i = 0; i < evNames.length; i += 5) {
    L.push(`      ${evNames.slice(i, i + 5).map((e) => `${eventKey(e)}: '${events[e]}'`).join(', ')},`);
  }
  L.push('    },');
  if (provider) {
    L.push('    // Provider 包裹：组件库的组件要在它的 Provider 里面才算"装配完整"');
    L.push(
      `    wrap: (el) => React.createElement(${ns}.${provider}, null, el),`,
    );
  }
  L.push('  });');
  L.push('}');
  L.push('');
  return L.join('\n');
}

/** 需要引号的键（含 `-` 之类）才加引号，其余保持可读。 */
function jsonKey(name) {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`;
}
function eventKey(name) {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : `'${name}'`;
}

module.exports = { emitHost };
