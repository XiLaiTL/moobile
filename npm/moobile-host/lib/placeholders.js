// 生成器要替换的**字面量清单** —— 它是生成器的配置，所以住在生成器里。
//
// ⚠️ 为什么不在 tools/template/placeholders.txt：那一份**不会随 npm 包发布**，
//    而 `npx create-…`/`moobile-host init` 是在别人的机器上跑的 ——
//    清单必须跟着包走，否则线上那份生成器就瞎了。tools/template/ 里留 deltas（T1 用）
//    与维护说明，见其 README。
//
// 规矩（SCAFFOLD §3.4.2）：**模板里写真字面量，生成器替换 + 断言替换干净。**
//   · 模板能编译 → 能进 verify_all → "用户会拿到什么"每次都被验证过；
//   · 代价是"漏参数化"，由 `assertClean()` 兜住（残留即红），代价可检测。
//
// 顺序敏感：**长的先替** —— `XiLaiTL/moobile-template` 里已经含了 `moobile-template`，
// 反过来替会得到 `XiLaiTL/<新名>` 之外的怪东西。

/**
 * @typedef {{ literal: string, key: string, why: string }} Placeholder
 */

/** @type {Placeholder[]} */
const PLACEHOLDERS = [
  {
    literal: 'XiLaiTL/moobile-template',
    key: 'MODULE_NAME',
    why: 'moon.mod 的模块名（moonbit 侧身份，决定产物路径里那一层目录）',
  },
  {
    literal: 'com.anonymous.moobiletemplate',
    key: 'ANDROID_PACKAGE',
    why: 'app.json 的 android.package（Android 上装机的身份，同机不能重复）',
  },
  {
    literal: 'moobile-template',
    key: 'APP_NAME',
    why: 'package.json 的 name、app.json 的 name/slug、README 标题',
  },
];

/** 模板里**不该出现**、生成物里**必须没有**的东西。 */
const FORBIDDEN = ['{{', '}}'];

/**
 * 从应用名派生的三个真值。**只有一个输入**（`--name`），其余都是导出 ——
 * 让用户分别指定模块名/包名，等于把"这三个必须配套"这件事交给运气。
 *
 * @param {string} name 应用名，kebab-case（`my-app`）
 * @returns {{APP_NAME: string, MODULE_NAME: string, ANDROID_PACKAGE: string}}
 */
function derive(name) {
  const slug = String(name || '').trim();
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error(
      `应用名 \`${name}\` 不合法：只允许小写字母、数字、连字符，且以字母开头（例：my-app）。\n` +
        '  为什么卡这么死：这个名字会同时变成 npm 包名、moon 模块名与 Android 包名的一段。',
    );
  }
  const compact = slug.replace(/[^a-z0-9]/g, '');
  return {
    APP_NAME: slug,
    MODULE_NAME: slug,
    ANDROID_PACKAGE: `com.anonymous.${compact}`,
  };
}

/**
 * 对一段文本做替换。**纯字符串替换，没有模板语言**（SCAFFOLD §3.4.2 的取舍：
 * 一旦需要 `{{#if}}`，就是把占位符升级成模板引擎，而那正是 §7 说不做的）。
 *
 * @param {string} text
 * @param {Record<string,string>} values
 */
function apply(text, values) {
  let out = text;
  for (const p of PLACEHOLDERS) {
    out = out.split(p.literal).join(values[p.key]);
  }
  return out;
}

/**
 * 断言生成物里没有残留。
 *
 * ⚠️ 这条断言是**用真字面量的代价的对价**（§3.4.2）：模板不写占位符，于是"忘了参数化"
 * 不会在生成时自动暴露，只能靠事后 grep。它对应用户视角的一句话：
 * **"你拿到的项目里不该还叫别人的名字。"**
 *
 * ⚠️ **只查已登记的字面量是不够的**（险过一次）：`apply()` 一定会替换它们，所以那部分是
 * 同义反复 —— 真正会漏的是"模板里出现了清单**没登记**的写法"（`moobile_template`、
 * `MoobileTemplate`、`com.example.moobiletemplate`…）。所以这里连**派生写法**一起查，
 * 身份锚点由 `assertIdentity()` 兜（那一条抓的是"模板改了名而清单没跟着改"）。
 *
 * @param {{rel: string, text: string}[]} files 相对路径 + 内容
 * @returns {string[]} 人话形式的残留描述（空数组 = 干净）
 */
function assertClean(files) {
  const bad = [];
  for (const f of files) {
    for (const p of PLACEHOLDERS) {
      if (f.text.includes(p.literal)) bad.push(`${f.rel}: 残留 \`${p.literal}\``);
    }
    for (const t of FORBIDDEN) {
      if (f.text.includes(t)) bad.push(`${f.rel}: 残留占位符记号 \`${t}\``);
    }
    for (const v of derivedForms(TEMPLATE_APP_NAME)) {
      if (f.text.includes(v)) bad.push(`${f.rel}: 残留模板身份的派生写法 \`${v}\``);
    }
  }
  return bad;
}

/** 模板自己的应用名（= 清单里 APP_NAME 那条的左值）。派生写法都从它算。 */
const TEMPLATE_APP_NAME = PLACEHOLDERS.find((p) => p.key === 'APP_NAME').literal;

/**
 * 一个名字的几种常见写法 —— 模板里可能以任何一种是出现（Android 包名要紧凑、
 * MoonBit 标识符要 snake、JS 里常写 camel/Pascal）。
 *
 * 只查 `moobile-template` 会漏掉 `moobile_template` 这种"看起来已经改过了"的残留。
 */
function derivedForms(name) {
  const compact = name.replace(/[^a-z0-9]/g, "");
  const snake = name.replace(/[^a-z0-9]+/g, "_");
  const camel = name.replace(/[^a-z0-9]+([a-z0-9])/g, (_, c) => c.toUpperCase());
  const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
  // 去重（`moobile` 这类单段名字的几种写法可能重合）
  return [...new Set([snake, camel, pascal, compact])].filter(Boolean);
}

/**
 * **身份锚点**：生成物里那三处"这个名字就是这个项目"的地方，必须正好是请求的名字。
 *
 * 为什么单独有这一条：`assertClean()` 查的是"旧名字有没有残留"，而它**查不到**
 * "模板改了名、清单没跟着改" —— 那种情况下旧字面量根本没被匹配到，生成物里躺着的是
 * **第三个名字**（既不是模板的旧名，也不是用户要的名）。锚点断言直接对着结果问
 * "你到底叫什么"，绕开了这个盲区。
 *
 * @param {{rel: string, text: string}[]} files
 * @param {{APP_NAME: string, MODULE_NAME: string, ANDROID_PACKAGE: string}} values
 * @returns {string[]}
 */
function assertIdentity(files, values) {
  const bad = [];
  const get = (rel) => files.find((f) => f.rel === rel)?.text;

  const moonMod = get("moon.mod");
  if (moonMod && !new RegExp(`^\\s*name\\s*=\\s*"${values.MODULE_NAME}"`, "m").test(moonMod)) {
    const got = (moonMod.match(/^\s*name\s*=\s*"([^"]*)"/m) || [])[1];
    bad.push(`moon.mod: 模块名是 \`${got}\`，应当是 \`${values.MODULE_NAME}\``);
  }

  const pkgText = get("package.json");
  if (pkgText) {
    try {
      const pkg = JSON.parse(pkgText);
      if (pkg.name !== values.APP_NAME) {
        bad.push(`package.json: name 是 \`${pkg.name}\`，应当是 \`${values.APP_NAME}\``);
      }
    } catch (err) {
      bad.push(`package.json: 生成后不是合法 JSON（${err.message}）`);
    }
  }

  const appJsonText = get("app.json");
  if (appJsonText) {
    try {
      const expo = JSON.parse(appJsonText).expo || {};
      if (expo.name !== values.APP_NAME || expo.slug !== values.APP_NAME) {
        bad.push(`app.json: name/slug 是 \`${expo.name}\`/\`${expo.slug}\`，应当是 \`${values.APP_NAME}\``);
      }
      const android = (expo.android || {}).package;
      if (android !== undefined && android !== values.ANDROID_PACKAGE) {
        bad.push(`app.json: android.package 是 \`${android}\`，应当是 \`${values.ANDROID_PACKAGE}\``);
      }
    } catch (err) {
      bad.push(`app.json: 生成后不是合法 JSON（${err.message}）`);
    }
  }

  return bad;
}

module.exports = {
  PLACEHOLDERS,
  FORBIDDEN,
  derive,
  apply,
  assertClean,
  assertIdentity,
  derivedForms,
  TEMPLATE_APP_NAME,
};
