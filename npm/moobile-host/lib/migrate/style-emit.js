// style-emit.js —— 把「CSS 规则表」变成「一个能编译的 MoonBit 样式模块」。
//
// ## 输出是什么
//
// 一个 `styles/` 包（`styles.mbt` + `moon.pkg`），里面有**每一个"源码里真实用到的类组合"一个函数**：
//
//     ///| `.topnav` —— backend/index.html:27
//     pub fn topnav() -> @style.Style { … }
//
//     ///| `.bagua-mode on` —— frontend/main.mbt:1175
//     pub fn bagua_mode_on() -> @style.Style { … }   ← 把 `.bagua-mode` 与 `.bagua-mode.on` 合并
//
// 于是视图侧的 `div(class="topnav")` 迁移成 `div(attrs=sty(@styles.topnav()))`。
//
// **为什么按"类组合"生成，而不是"一个类一个函数"**：CSS 里真正决定一个元素长相的
// 是它**同时带的那几个类**（`.bagua-mode` + `.bagua-mode.on`）。只生成单类函数的话，
// 组合态的样式就落在 `.on` 这种**根本没有独立规则**的名字上 —— 那个函数不存在，
// 生成物编不过；就算编过了，高亮态也会**静默消失**。按组合生成把这件事变成"源码写了什么，
// 就有对应的函数"，而且级联顺序按 CSS 源序做，不猜。
//
// **为什么用函数而不是一张按名字查表**：查表要字符串，字符串要运行时才知道对不对；
// 函数名有编译器兜着（类名改了、函数没了，编译期就红）。迁移工具最怕的正是
// "名字对不上但不报错"。
//
// ## 有损的东西怎么处理（这一节是设计，不是实现细节）
//
// 每条声明只有两种归宿：**生成调用** 或 **记进 `losses` 并写清理由**。
// 一个类如果一条声明都没映射成功，**函数照样生成**（返回空 `Style`），
// 但头上带 `TODO(migrate)` 把丢失的每一条列出来 —— 理由是"删掉调用点"会让界面
// **静默变空**，而留一个空样式只是"没样式"，并且报告里点得出名字
// （SCAFFOLD §3.7.4 的负面清单：不顺手删代码）。
//
// ## 对账（本文件的硬断言）
//
// `声明总数 = 已映射 + 有损`，不闭合就抛。这条断言是"零遗漏"从口号变成事实的地方：
// 任何"我以为处理了"的漏网都会在这里变成一次崩溃，而不是报告里少一行。

const css = require('./css.js');
const map = require('./style-map.js');

/** MoonBit 的保留字 —— 类名撞上就加后缀（否则生成的模块直接编不过）。 */
const KEYWORDS = new Set([
  'let', 'fn', 'if', 'else', 'match', 'type', 'struct', 'enum', 'pub', 'priv', 'mut', 'while',
  'for', 'in', 'break', 'continue', 'return', 'true', 'false', 'import', 'as', 'with', 'derive',
  'trait', 'impl', 'guard', 'async', 'extern', 'init', 'test', 'try', 'catch', 'throw', 'is',
  'not', 'noraise', 'suberror', 'using', 'where', 'const',
]);

/** 一个类组合串 → MoonBit 标识符（`hex-index title` → `hex_index_title`）。 */
function fnName(classString) {
  let n = String(classString)
    .trim()
    .split(/\s+/)
    .map((c) => c.replace(/[^A-Za-z0-9_]/g, '_'))
    .join('_');
  n = n.replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
  if (!n) n = 'unnamed';
  if (/^[0-9]/.test(n)) n = '_' + n;
  if (KEYWORDS.has(n)) n = n + '_s';
  return n;
}

/** 组合串的规范化：多个类按**字母序**排（`"on bagua-mode"` 与 `"bagua-mode on"` 是同一个组合）。 */
function normalizeClassString(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** 展开选择器里的类名（`.a.b` → `['a','b']`）；非纯类选择器返回 null。 */
function selectorClasses(selector) {
  const cls = css.classifySelector(selector);
  if (cls.kind === 'class') return [cls.className];
  if (cls.kind === 'compound-class') {
    return selector
      .split('.')
      .filter(Boolean)
      .map((x) => x.trim());
  }
  return null;
}

/**
 * 一个选择器的每一段是不是能匹配一个元素。
 * 元素 = `{tag, classes}`；段 = `{tag|null, classes[]}`。
 */
function partMatches(part, el) {
  if (!el) return false;
  if (part.tag && el.tag !== part.tag) return false;
  return part.classes.every((c) => (el.classes || []).includes(c));
}

/**
 * 选择器能不能匹配到某个**源码用法**（site）。
 *
 * 这是"后代选择器如实展开"的核心：从最后一段（元素自己）开始往回走，
 * `>` 要求正好是直接父级，空格则允许在更外层找到（就近优先，与 CSS 一致）。
 *
 * @param {{parts: any[], combinators: string[]}} parsed
 * @param {{own: any, chain: any[]}} site
 */
function selectorMatchesSite(parsed, site) {
  const { parts, combinators } = parsed;
  if (!partMatches(parts[parts.length - 1], site.own)) return false;
  // pos = 已匹配元素在 site.chain 里的下标；-1 表示"就是 site 自己"
  let pos = -1;
  for (let p = parts.length - 2; p >= 0; p--) {
    const comb = combinators[p];
    const parentIdx = pos === -1 ? 0 : pos + 1;
    let matched = -1;
    if (comb === '>') {
      if (parentIdx < site.chain.length && partMatches(parts[p], site.chain[parentIdx])) matched = parentIdx;
    } else {
      for (let k = parentIdx; k < site.chain.length; k++) {
        if (partMatches(parts[p], site.chain[k])) {
          matched = k;
          break;
        }
      }
    }
    if (matched === -1) return false;
    pos = matched;
  }
  return true;
}

/**
 * 收集"每个源码用法最终生效的那组声明"。
 *
 * **级联按 CSS 源序做**：所有能匹配这个用法的规则按文件里的先后顺序依次覆盖，同属性后者胜。
 * 这里**不做选择器权重运算** —— 权重反转（`.a.b` 写在 `.a` 之前）在真实样式表里极少，
 * 真遇到会在 `notes` 里提醒，而不是猜一个顺序。
 *
 * @param {any[]} rules 全部规则（已带 file/line/media）
 * @param {Record<string,string>} vars 已解析的 CSS 变量
 * @param {any[]} sites 源码用法（`class-rewrite.js` 的 `scanSites` 产出：key/own/chain）
 *                      传空数组 = 退化成"CSS 里每个纯类各一个函数"（单独试跑用）
 */
function collectStyles(rules, vars, sites) {
  const useSites = Array.isArray(sites) && sites.length > 0;
  /** @type {Map<string, {key: string, classes: string[], decls: Map<string, any>, order: string[], sources: string[]}>} */
  const sets = new Map();
  const ensure = (key) => {
    let e = sets.get(key);
    if (!e) {
      e = { key, classes: key.split('>').pop().split('.').slice(1), decls: new Map(), order: [], sources: [] };
      sets.set(key, e);
    }
    return e;
  };

  if (useSites) {
    for (const s of sites) ensure(s.key);
  }

  // ── grid 容器的列宽（`grid-template-columns` 认得出才记）────────────────────
  //
  // 为什么要在这里先扫一遍：`display:grid` 的降级是**两半** —— 容器上加 `flex_wrap`，
  // **子项**上加 `min_width + flex_grow`。而"谁是子项"这件事只有**祖先链**知道
  // （`sites[].chain`），单条声明里没有。所以先把"类名 → 列宽"攒出来，再让
  // `mapClass` 按祖先链判断某个用法是不是 grid 格。
  // 同时收集"`display:grid` 的类组合"（判"父元素是网格"用）。
  const gridBases = new Map();
  for (const rule of rules) {
    // ⚠️ **`@media` 里的规则不算**（实测踩到）：源 CSS 在窄屏把列宽从 116px 改成 96px，
    //    收进来的话会让桌面宽度也变成 96（实测：生成物里出现 `min_width(96.0)`）。
    //    RN 没有媒体查询（本来就要在 Model 里按窗口宽度表达），窄屏那条仍进 `ruleLosses`。
    if (rule.media) continue;
    const decl = rule.decls.find((d) => d.prop === 'grid-template-columns');
    if (!decl) continue;
    const basis = map.gridCellBasis(css.substituteVars(decl.value, vars));
    if (basis === null) continue;
    for (const cls of rule.selector.split(',')) {
      const m = cls.trim().match(/\.([A-Za-z_][\w-]*)\s*$/);
      if (m) gridBases.set(m[1], basis);
    }
  }
  const gridContainers = new Set();
  for (const [key, e] of sets) {
    const d = e.decls.get('display');
    if (d && String(d.value).trim().toLowerCase() === 'grid') gridContainers.add(key);
  }

  const ruleLosses = [];
  const unmatchedRules = [];
  const pageRules = [];
  /** `:hover` 的规则（转成按下态用；见下面的 hook） */
  const pressRules = [];

  // ── ★ 源侧账本（2026-10-23 新）───────────────────────────────────────────────
  //
  // **为什么需要它**：第十八轮做过一次人工清点（源 `<style>` 的 656 条声明逐条对账，
  // 结论"无痕消失 0"）—— 但那次清点是**只读的、没变成判据**，所以"下次动生成器会不会又漏"
  // 没人知道。这个账本把那一次清点变成**每次生成都算一遍**的东西：
  // **每一条源声明都必须落进一个有名字的桶**（桶里的条目各自带 `file:line`，见
  // `ruleLosses` / `unmatchedRules`）。
  //
  // ⚠️ 三条口径，写清楚免得下一个人对着数字打架：
  //   ① **`sourceDecls` 只数"非自定义属性"**（`--x` 那些是给 `var()` 展开用的，不是样式本身）。
  //      被跳过的自定义属性另记在 `customProps`，所以 `sourceDecls + customProps` = 源文件里的声明总数。
  //   ② **桶划分的是"源声明"（每条一次）**；"逐规则 × 命中数"另记在 `applications`，
  //      而 `accounting.decls` 是**条目侧、按属性去重**的 —— 这三个是**三种不同单位**，
  //      **互不相等、也别互相对账**（级联覆盖、一规则多命中都会让它们分开）。
  //   ③ 这个"Σ 桶 = 源总数"**不是判据**（它就是同一次遍历里加的，自己跟自己闭合 ——
  //      正是第十八轮批评过的"计数闭合不是对账"那个形状）。**真判据在门那一侧**：
  //      `tools/migrate_ledger_check.mjs` 会**自己**从源 CSS 数一遍再来比。
  //      所以这里**不 throw**：账本歪了的时候，数字本身是最有用的现场，抛掉就看不见了。
  const ledger = {
    rules: 0,
    sourceDecls: 0,
    customProps: 0,
    /**
     * ⚠️★ **这一组桶是对"源声明"的划分：每条声明恰好进一个桶、只算一次。**
     * 所以 `Σ buckets === sourceDecls` 才有意义。
     * （2026-10-23 实测踩到：第一版把"逐规则 × 命中数"也混进了 `applied`，
     *  于是真实应用上 Σ桶 = 1026 而源声明只有 660 —— 两个**不同的单位**被加在了一起。
     *  那一次读数是 `applied 726` vs `matched 360`（后面这个才是源侧口径）。）
     */
    buckets: {
      /** 命中至少一个源码用法（源侧算一次；"命中几次"见 `applications`） */
      matched: 0,
      pageRoot: 0,
      pressHover: 0,
      media: 0,
      hoverDescendant: 0,
      hoverSameElementOff: 0,
      unparsable: 0,
      unmatchedLost: 0,
      unmatchedUnused: 0,
    },
    /**
     * **应用次数**（逐规则 × 命中数）—— 与上面那组桶**不是一个单位**，别相加、别互相对账。
     * 它回答的是"一共往产物里写了多少次声明"（同一格被多轮级联覆盖时会被算多次）。
     */
    applications: 0,
  };
  /** 这条规则里"算样式"的声明有几条（`--x` 不算）。 */
  const styleDecls = (r) => r.decls.filter((d) => !d.prop.startsWith('--')).length;

  for (const rule of rules) {
    ledger.rules++;
    ledger.sourceDecls += styleDecls(rule);
    ledger.customProps += rule.decls.length - styleDecls(rule);
    if (rule.media) {
      ledger.buckets.media += styleDecls(rule);
      ruleLosses.push({
        kind: 'media',
        reason: `@media ${rule.media} 里的 \`${rule.selector}\` —— RN 没有媒体查询，断点要在 Model 里按窗口宽度表达`,
        file: rule.file,
        line: rule.line,
        decls: rule.decls.length,
      });
      continue;
    }
    if (css.classifySelector(rule.selector).kind === 'root') {
      ledger.buckets.pageRoot += styleDecls(rule);
      pageRules.push(rule);
      continue;
    }
    // ── `:hover` ⇒ **按下态**（2026-10-23 落地）────────────────────────────────
    //
    // 以前这一类整个进 `ruleLosses`（"RN 没有伪类，`:hover` 在触屏上本来也不存在"）。
    // 后果实测：源项目的 16 处 `:hover` **全部消失**，卡片/按钮/链接点了没有任何反馈。
    // 现在降级成 `Pressable` 的按下态（`Style::press()`，键加 `press:` 前缀）：
    // 触屏按下即生效，web 上鼠标按下同样算（`react-native-web` 遵守同一套契约）。
    //
    // ⚠️ 只认"**hover 打在同一个元素上**"的写法（`.card:hover` / `.a.b:hover`）。
    //    后代写法（`.card:hover .child`）改的是**子元素**，按下态表达不了 —— 那种如实点名。
    // ⚠️★ 默认**关闭**（2026-10-23 决定）：按下态的生成已经做完了、也验过（10 个函数生成
    //    `.press()` 块），但**库侧的消费通道还没接对**（`Pressable` 包裹 + 函数式 style
    //    那一套改了六轮没稳）。而 `Style::press()` 产出的是 `press:` 前缀键 ——
    //    库不拆就会原样进 `style`，让 RN 收到非法样式名。
    //    所以：**先不生成**，把这条能力留在代码里等库侧就绪；开关是下面这个环境变量
    //    （门与所有应用都按"关闭"跑，判定标准仍是"生成物与生成器逐字一致"）。
    const pressEnabled = process.env.DSH_PRESS_FROM_HOVER === '1';
    // "hover 打在**同一个元素**上"（`.card:hover` / `.a.b:hover`）—— 与"hover 打在后代上"
    // （`.card:hover .child`）是**两件不同的事**，理由必须分开写（见下面那个 if 里的实测）。
    const sameElementHover = rule.selector.match(/^((?:\.[A-Za-z_][\w-]*)+):hover$/);
    const hoverMatch = pressEnabled ? sameElementHover : null;
    if (hoverMatch && !rule.media) {
      pressRules.push({ own: hoverMatch[1].split('.').filter(Boolean), rule });
      continue;
    }
    if (/:hover/.test(rule.selector)) {
      // ⚠️★ 2026-10-23 实测：这一段原来**只有一条理由**（"hover 打在后代上"），而在
      //    按下态默认关闭的配置下，16 条同元素 `:hover` 里有 **14** 条落到这里
      //    ⇒ **理由说反了**（真后代只有 2 条）。
      //    理由写反比不写更贵：下一个人会照着它去找"后代表达不了"的解法，而真正的原因是
      //    "已经实现了、只是还没接线"。
      if (sameElementHover) {
        ledger.buckets.hoverSameElementOff += styleDecls(rule);
        ruleLosses.push({
          kind: 'hover-same-element',
          reason:
            '`' +
            rule.selector +
            '` —— hover 打在**同一个元素**上：按下态这条链**已经实现**（`Style::press()` + 生成器都会产），' +
            '但生成器**默认不产出**它（`DSH_PRESS_FROM_HOVER=1` 才开）—— 库侧的消费通道' +
            '（`Pressable` + 函数式 `style`）还没接稳，产出会让 RN 收到非法的 `press:` 样式名。' +
            '**这不是"表达不了"，是"还没接线"。**',
          file: rule.file,
          line: rule.line,
          decls: rule.decls.length,
        });
        continue;
      }
      ledger.buckets.hoverDescendant += styleDecls(rule);
      ruleLosses.push({
        kind: 'hover-descendant',
        reason:
          '`' +
          rule.selector +
          '` —— hover 打在**后代**上，按下态表达不了"父元素被按住时的子元素颜色"；要么改成条件状态（进 Model），要么放弃这一处的反馈',
        file: rule.file,
        line: rule.line,
        decls: rule.decls.length,
      });
      continue;
    }
    const parsed = css.parseSelectorParts(rule.selector);
    if (!parsed) {
      const cls = css.classifySelector(rule.selector);
      ledger.buckets.unparsable += styleDecls(rule);
      ruleLosses.push({
        kind: cls.kind,
        reason: `${cls.reason}（\`${rule.selector}\`）`,
        file: rule.file,
        line: rule.line,
        decls: rule.decls.length,
      });
      continue;
    }

    if (!useSites) {
      // 退化成"每条规则的最后一个类"的单类函数（不依赖源码）
      const last = parsed.parts[parsed.parts.length - 1];
      ledger.buckets.matched += styleDecls(rule);
      ledger.applications += styleDecls(rule) * last.classes.length;
      for (const c of last.classes) {
        const e = ensure(c);
        applyDecls(e, rule, vars);
        e.sources.push(`${rule.file}:${rule.line}`);
      }
      continue;
    }

    let matchedAny = false;
    let hits = 0;
    for (const site of sites) {
      if (selectorMatchesSite(parsed, site)) {
        const e = sets.get(site.key);
        applyDecls(e, rule, vars);
        e.sources.push(`${rule.file}:${rule.line}`);
        matchedAny = true;
        hits++;
      }
    }
    if (!matchedAny) {
      // 这条规则没匹配上任何用法。两种情形要分开报：
      //   ① 它要的类/标签源码里根本没用到 → 规则用不上，不是损失；
      //   ② 它要的那个元素**存在**，只是**上下文（祖先链 / 标签）对不上** → 那组样式
      //      在这个元素上**静默丢了**，必须点名。
      //
      // ⚠️★ 2026-10-23 实测（这条以前是错的）：`lost` 原来只按**祖先链长度**判
      //    （`parsed.parts.length > 1`），于是"**单段 + 带标签**"的选择器
      //    （`button.primary`）+ 源码里写的是 `div.primary` 时：
      //      · 理由文字走的是"上下文不一致 —— 这一组样式没有落到任何元素上"（**承认是损失**），
      //      · 而 `lost` 是 `false` ⇒ 报告 §2.1 **只印 `lost` 的条目** ⇒ 它哪都不出现。
      //    即**标志与理由打架**（比两者都错更难发现）。现在 `lost` 也认标签。
      //
      // ⚠️ 另一处（同一次实测）：`usedOwn` 原来用 `last.classes.every(...)` —— 空数组的
      //    `every` **恒真**，于是**纯标签**选择器（`input {}`）的 `usedOwn` 永远是 `true`。
      //    现在空类集时改看标签。
      const last = parsed.parts[parsed.parts.length - 1];
      const hasClasses = last.classes.length > 0;
      const classUsed =
        hasClasses && sites.some((site) => last.classes.every((c) => (site.own.classes || []).includes(c)));
      const tagUsed = last.tag ? sites.some((site) => (site.own.tag || '') === last.tag) : false;
      const usedOwn = hasClasses ? classUsed : tagUsed;
      /** 选择器要的那个元素**逐字**存在吗（标签与类都对得上）。 */
      const targetExists = sites.some(
        (site) =>
          (!last.tag || (site.own.tag || '') === last.tag) &&
          last.classes.every((c) => (site.own.classes || []).includes(c)),
      );
      const lost = usedOwn && !targetExists;
      ledger.buckets[lost ? 'unmatchedLost' : 'unmatchedUnused'] += styleDecls(rule);
      unmatchedRules.push({
        selector: rule.selector,
        file: rule.file,
        line: rule.line,
        decls: rule.decls.length,
        // ② 这一类才是"损失"：它要的元素在源码里出现过（同类或同标签），
        //    只是上下文（祖先链 / 标签）与选择器要求的不一样
        lost,
        reason: usedOwn
          ? `源码里用了 \`${last.classes.length ? last.classes.join(' ') : last.tag}\`，但**祖先链/标签与该选择器要求的上下文不一致**（\`${rule.selector}\`）——这一组样式没有落到任何元素上`
          : `\`${rule.selector}\` 里的类/标签在源码里没被用到（规则用不上，不是损失）`,
      });
    } else {
      ledger.buckets.matched += styleDecls(rule);
      ledger.applications += styleDecls(rule) * hits;
    }
  }

  const page = ensure('__page__');
  for (const r of pageRules) {
    applyDecls(page, r, vars);
    page.sources.push(`${r.file}:${r.line}`);
  }

  // ── grid 子项：链认不出来时的兜底（2026-10-23 实测定型）──────────────────────
  //
  // 判据两条同时成立：**循环体里生成 + 源码里祖先链为空**。
  //   · "循环体里" —— 源 CSS 里 `display:grid` 的子元素常常是循环里攒进容器的
  //     （`let card = div(...)` + `shang.push(card)`）；`class-rewrite` 现在认得出这一位
  //     （`sites[].inLoop`）。实测：127 条用法里 7 条在循环体里。
  //   · "祖先链为空" —— 把"在循环里、但内联嵌在某个祖先里"的那些排掉。实测：那 7 条里
  //     只有 `div.hex-card` 是空链，另外 6 条本来靠链就判对了。
  //
  // 之前两条更宽的规则都有实测反例（留档，别重犯）：
  //   ① "凡与网格容器同名的类组合都算子项" → 把**容器自己**也补上 `min_width`，
  //      容器被挤成 116px、64 张卡塞成一列（比修之前更窄）；
  //   ② "凡祖先链为空的用法都算" → 空链有 8 条，只有 1 条该算（精度 1/8）。
  {
    const containersWithBasis = [...gridBases.keys()].filter((cls) =>
      [...sets.values()].some((e) => e.classes.includes(cls)),
    );
    let hit = 0;
    for (const s2 of sites) {
      if (!s2.inLoop) continue;
      if (s2.chain && s2.chain.length) continue;
      const e = sets.get(s2.key);
      if (!e || e.gridBasis !== undefined) continue;
      const d = e.decls.get('display');
      if (d && String(d.value).trim() === 'grid') continue;
      const basis = Math.max(...containersWithBasis.map((c) => gridBases.get(c)));
      if (!Number.isFinite(basis)) continue;
      e.gridBasis = basis;
      e.gridBasisFromFallback = true;
      hit++;
    }
    // 一条都没兜到 ⇒ 认不出子项：点名（交给 MIGRATION.md 与生成后自查），**不猜**
    if (!hit) {
      for (const cls of containersWithBasis) {
        const entry = [...sets.values()].find((e) => e.classes.includes(cls) && e.key.split('>').pop().endsWith('.' + cls));
        if (entry) {
          entry.gridItemsUnknown = true;
          entry.gridCellBasis = gridBases.get(cls);
        }
      }
    }
  }

  // ── 按下态：把 `:hover` 的声明写到"命中它的那些类组合"上 ────────────────────
  //
  // 用与普通规则**同一套** `selectorMatchesSite` 的判据精神：这里只要求"自己的类完全一致"
  // （`.a.b:hover` 命中 `class="a b"` 的用法）。写进去的键统一加 `press:` 前缀。
  for (const pr of pressRules) {
    const want = pr.own;
    let hit = 0;
    for (const s2 of sites) {
      const self = (s2.own && s2.own.classes) || [];
      if (want.length !== self.length || !want.every((c) => self.includes(c))) continue;
      const e = sets.get(s2.key);
      if (!e) continue;
      for (const d of pr.rule.decls) {
        if (d.prop.startsWith('--')) continue;
        const key = 'press:' + d.prop;
        if (!e.decls.has(key)) e.order.push(key);
        e.decls.set(key, {
          value: css.substituteVars(d.value, vars),
          line: d.line,
          file: pr.rule.file,
        });
      }
      hit++;
    }
    if (!hit) {
      ledger.buckets.unmatchedUnused += styleDecls(pr.rule);
      ruleLosses.push({
        kind: 'hover-unmatched',
        reason: '`' + pr.rule.selector + '` —— 这个 :hover 的宿主类在源码里没找到用法',
        file: pr.rule.file,
        line: pr.rule.line,
        decls: pr.rule.decls.length,
      });
    } else {
      ledger.buckets.pressHover += styleDecls(pr.rule);
      ledger.applications += styleDecls(pr.rule) * hit;
    }
  }

  return { sets, ruleLosses, unmatchedRules, ledger };
}

/** 把一条规则的声明并进某个类组合的声明表（后写覆盖先写 —— CSS 的级联）。 */
function applyDecls(entry, rule, vars) {
  for (const d of rule.decls) {
    if (d.prop.startsWith('--')) continue; // 自定义属性只用于展开，本身不是样式
    // `class=` 之类的非样式声明不会走到这里；CSS 变量已被 substituteVars 展开
    const value = css.substituteVars(d.value, vars);
    if (!entry.decls.has(d.prop)) entry.order.push(d.prop);
    entry.decls.set(d.prop, { value, line: d.line, file: rule.file });
  }
}

/**
 * 一个类组合的声明 → MoonBit 调用串 + 有损清单 + 提醒清单。
 *
 * @returns {{calls: string[], losses: {prop: string, value: string, reason: string, line: number, file: string}[], notes: string[], emitted: number, lost: number}}
 */
function mapClass(entry) {
  const calls = [];
  const losses = [];
  const notes = [];
  /** ★ "算成已映射、却一条调用都没有"的声明（见下面那个 `silentEmpty.push`）。 */
  const silentEmpty = [];
  const props = new Set(entry.decls.keys());
  // `display:flex` 要不要补 `flex_direction(Row)`，取决于这一条里**有没有**显式写方向
  const hasExplicitDirection = props.has('flex-direction');
  // em 字距/行高要靠同一样式里的 font-size 换算
  const hasFontSize = props.has('font-size');
  let emitted = 0;
  let lost = 0;

  // 同属性的去重已经在 applyDecls 里做掉（后者胜），这里保留**最后一次出现**的顺序：
  // 先按 order 出现的位置排，被覆盖过的属性沿用最初的位置（对样式结果无影响，对 diff 稳定有影响）。
  const seen = new Set();
  const orderedProps = [];
  for (const p of entry.order) {
    if (seen.has(p)) continue;
    seen.add(p);
    orderedProps.push(p);
  }

  for (const prop of orderedProps) {
    const { value, line, file } = entry.decls.get(prop);
    const r = map.mapDeclaration(prop, value, { emWithoutFontSize: !hasFontSize });
    if (r.loss) {
      losses.push({ prop, value, reason: r.loss, line, file });
      lost++;
      continue;
    }
    emitted++;
    if (prop === 'display' && hasExplicitDirection) {
      // 显式方向优先：只发 display，别补 Row
      calls.push(...r.calls.filter((c) => !c.includes('flex_direction')));
    } else {
      calls.push(...r.calls);
    }
    // ── ★ "声称已映射，却一条调用都没发、也一句说明都没有"（2026-10-23 新增）──────
    //
    // 这是"静默丢键"的**同一个形状**，只是发生在声明层：`emitted++` 与"真的产出了调用"
    // 是**两件独立的事**，而以前没有任何东西把它们绑在一起。
    // 现网实例（第十八轮审计点名、本轮实测复现）：`letter-spacing: normal` 走
    // `mapped([])` ⇒ 零调用、零 note，却计入"已映射"（`style-map.js` 里已修）。
    //
    // ⚠️ 判据是"零调用 **且零说明**"，不是"零调用" —— 因为**有些声明本来就该零调用**，
    //    只要它说清了自己去哪了。实测例子：`grid-template-columns` 在网格**容器**上
    //    就是把列宽**交给子项**（子项上补 `min_width` + `flex_grow`），容器自身没有调用
    //    —— 那是设计，不是丢失。所以下面这种情形要**给一句说明**（`propExplained`）。
    //
    // ⚠️ 为什么这也**不 throw**：抛掉就看不见是哪几条了。这里只把它记进账本，
    //    由 `tools/migrate_ledger_check.mjs` 断言"真实应用上必须是 0"，
    //    并让报告把它印出来（`create.js` 的 §2）。
    const propNotes = [...(r.notes || [])];
    if (
      prop === 'grid-template-columns' &&
      (entry.gridBasis !== undefined || entry.gridCellBasis !== undefined)
    ) {
      propNotes.push(
        '`grid-template-columns` ⇒ **列宽已经提取给子项**（子项上补 `min_width` + `flex_grow`，见本函数末尾），' +
          '容器自身没有对应调用 —— 这不是丢失',
      );
    }
    if ((r.calls || []).length === 0 && propNotes.length === 0) {
      silentEmpty.push({ prop, value, file, line });
    }
    notes.push(...propNotes);
  }

  // ── grid 格的降级：列宽写在**子项**上 ──────────────────────────────────────
  //
  // `display:grid` 那一半由 `mapDeclaration` 负责（容器 → flex(row) + wrap）。
  // 这一半是"子项至少多宽、富余怎么分"：`min_width(列宽)` + `flex_grow(1)`。
  // 为什么列宽只能写在子项上：flex 的容器**没有"列宽"这个概念** —— 换行之后每一行
  // 各自分配宽度，所以"每列至少 116px、有富余时各列平分"只能用子项的
  // `min_width + flex_grow` 表达。
  //
  // 判据（实测）：`interest/yi` 的六十四卦速查 —— 修前容器塌成 331px、卡片 54px、
  // 一行 5 张；修后容器撑满、一行 10~11 张（旧版 `auto-fill` 网格的形状）。
  if (entry.gridBasis) {
    const basis = entry.gridBasis % 1 === 0 ? `${entry.gridBasis}.0` : String(entry.gridBasis);
    calls.push(`.min_width(@style.px(${basis}))`, '.flex_grow(1.0)');
    notes.push(
      `grid 子项：补 min_width(${basis}) + flex_grow(1.0) —— 列宽取自源 CSS 的 minmax 那一档`,
    );
  }

  return { calls, losses, notes, emitted, lost, silentEmpty };
}

/** 生成 `styles.mbt` 的源码文本。 */
function emitModule(collected, meta) {
  const classes = [];
  const usedNames = new Map();
  const accounting = { decls: 0, emitted: 0, lost: 0 };
  /** ★ "算成已映射、却一条调用都没有"的声明（逐条带 `file:line`；判据在 `tools/migrate_ledger_check.mjs`）。 */
  const silentEmpty = [];
  const unstyled = [];

  for (const entry of collected.sets.values()) {
    const m = mapClass(entry);
    accounting.decls += entry.decls.size;
    accounting.emitted += m.emitted;
    accounting.lost += m.lost;
    for (const s of m.silentEmpty || []) silentEmpty.push({ ...s, cls: entry.key });
    if (!entry.decls.size && entry.key !== '__page__') {
      unstyled.push(entry.key);
      continue; // 一条规则都没匹配上：不生成空函数（调用点会由 class-rewrite 记为 TODO）
    }

    let name = fnName(entry.key === '__page__' ? 'page' : entry.key);
    if (usedNames.has(name)) {
      let i = 2;
      while (usedNames.has(`${name}_${i}`)) i++;
      const renamed = `${name}_${i}`;
      m.notes.push(`与 \`${usedNames.get(name)}\` 的函数名撞了，已改名为 ${renamed}`);
      name = renamed;
    }
    usedNames.set(name, entry.key);
    classes.push({ ...entry, fnName: name, ...m });
  }

  // 排序：让生成物**稳定**（同样输入 → 逐字节相同的输出，才可能进 `--check` 这类门）
  classes.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const L = [];
  L.push('///|');
  L.push('/// 由 `moobile-host create --from-rabbita` 生成 —— **不要手改**。');
  L.push('///');
  L.push(`/// 源：${meta.sheets.map((s) => `${s.file}:${s.line}`).join(' + ')}`);
  L.push(`///     共 ${meta.cssLines} 行 / ${meta.cssRules} 条规则 → 这里 ${classes.length} 个样式函数。`);
  L.push('///');
  L.push('/// 每个函数对应**源码里真实用到的一个类组合**（`class="a b"` 就是 `a_b`）。');
  L.push('/// 有损的条目在函数头上以 `TODO(migrate)` 列出 —— 那些是 `@style` 明确不表达的东西');
  L.push('/// （grid / sticky / transform / box-shadow / 伪类…），不是生成器漏了。');
  L.push('');

  // `att` 这座桥：视图侧的写法是 `attrs=@styles.att(@styles.<类>())`。
  // 放在这个包里而不是每个应用包里各放一份 —— 副本少一份就少一个漂移点。
  L.push('///|');
  L.push('/// `Style` → `Attrs` 的桥。视图里的写法：`attrs=@styles.att(@styles.<类>())`。');
  L.push('pub fn att(s : @style.Style) -> @html.Attrs {');
  L.push('  @html.Attrs::build().styles(s)');
  L.push('}');
  L.push('');

  for (const c of classes) {
    const isPage = c.key === '__page__';
    L.push('///|');
    if (isPage) {
      L.push('/// 页面根样式（源 CSS 里的 `body` / `html`）—— 挂在最外层容器上。');
    } else {
      L.push(
        `/// \`class="${c.key}"\` —— ${c.sources[0]}` +
          (c.sources.length > 1 ? ` （另见 ${c.sources.slice(1).join('、')}）` : ''),
      );
    }
    for (const note of c.notes) L.push(`///   · ${note}`);
    for (const l of c.losses) {
      // `reason` 里已经带了 `prop:value`（style-map 的约定），这里不再重复
      L.push(`///   · TODO(migrate) ${l.reason}  （${l.file}:${l.line}）`);
    }
    L.push(`pub fn ${c.fnName}() -> @style.Style {`);
    L.push('  @style.Style::new()');
    // ── 按下态（`press:` 前缀）的调用：**hover 在前 → `.press()` → 常态在后** ──────
    //
    // `Style::press` 的语义是"把**它前面**的键都加上 `press:` 前缀"（见 `style/style.mbt`）。
    // 所以要让"常态是常态、hover 是按下态"，链的形状只能是：
    //
    //     .hover 的那些键      ← 落在 `.press()` 之前 ⇒ 被加前缀 ⇒ 变成按下态 ✅
    //     .press()
    //     .常态的那些键        ← 落在 `.press()` 之后 ⇒ 不加前缀 ⇒ 仍是常态 ✅
    //
    // ⚠️ **2026-10-23 实测：这里原先正好写反了**（常态在前、hover 在 `.press()` 之后），
    //    于是两边**整体互换**：常态拿到源 CSS 的 `:hover` 值、按下态拿到常态值。
    //    后果不止"颜色反了" —— grid 子项的 `min_width` / `flex_grow` 是**常态调用**，
    //    被标成按下态之后"网格只在按住时才是网格"（`button_bagua_mode` 的常态更只剩
    //    两条：没内边距、没底色、没边框、没字号，按住才变成一个按钮）。
    //    当时那句注释 `// ↓ 以下仅在按下时生效` 也**说的是反的**（它标的是常态那一串）。
    //    复现与判据见 `tools/regen_styles_check.mjs` 的"按下态组装顺序"那一节。
    //
    // 逐条各调一次 `.press()` 不是错的（键不冲突），但会把写在它后面的常态键也标成按下态，
    // 而且产物会变成一长串 `.press().x().press().y()`。这里仍然**只调一次**。
    const plainCalls = [];
    const pressCalls = [];
    for (const call of c.calls) {
      if (call === '@style.Style::new()') continue;
      if (call.startsWith('.press()')) pressCalls.push(call.slice('.press()'.length));
      else plainCalls.push(call);
    }
    if (pressCalls.length) {
      L.push('    // ↓ 以下在 `.press()` **之前**：仅**按下时**生效（源 CSS 的 `:hover`；触屏按下 / web 鼠标按下同一套）');
      for (const call of pressCalls) L.push(`    ${call}`);
      L.push('    .press()');
      L.push('    // ↓ 以下在 `.press()` **之后**：常态（含 grid 子项的 min_width / flex_grow）');
    }
    for (const call of plainCalls) L.push(`    ${call}`);
    if (!c.calls.length && c.losses.length) {
      L.push(`  // ↑ 这个类有 ${c.losses.length} 条声明没有对应物，逐条列在上面（别当它已经迁好了）`);
    }
    L.push('}');
    L.push('');
  }

  while (L.length && L[L.length - 1] === '') L.pop();
  const out = L.join('\n') + '\n';
  return { source: out, classes, accounting, unstyled, silentEmpty };
}

/** 生成 `styles/moon.pkg`。 */
function emitMoonPkg() {
  return `// 由 \`moobile-host create --from-rabbita\` 生成 —— **不要手改**。
//
// 两个依赖：样式层（\`@style\`）+ 视图属性（\`att\` 这个桥要把 \`Style\` 变成 \`Attrs\`）。
supported_targets = "+js"

import {
  "XiLaiTL/moobile/style",
  "XiLaiTL/moobile/vendor/rabbita/html" @html,
}
`;
}

/**
 * 顶层入口：从一组源码文件里抽出 CSS、映射、生成模块。
 *
 * @param {{rel: string, text: string}[]} files
 * @param {{appName?: string, sites?: any[]}} [opts]
 *        `sites` = 源码里真实用到的 `class=` 用法（含祖先链）。给了就按它生成；
 *        没给就退化成"CSS 里每条规则的最后一个类各一个函数"（单独试跑 CSS → Style 用）。
 */
function generate(files, opts = {}) {
  const { sheets, losses: sheetLosses } = css.extractSheets(files);
  const rules = [];
  const vars = {};
  const parseLosses = [];
  for (const s of sheets) {
    // ⚠️ `s.line`：内联 `<style>` 的内容在 HTML 文件里的起始行 —— 报告的行号就是靠它对齐的
    const r = css.parse(s.text, s.file, s.line);
    for (const rule of r.rules) rules.push(rule);
    Object.assign(vars, r.vars);
    parseLosses.push(...r.losses);
  }
  const resolved = css.resolveVars(vars);
  const collected = collectStyles(rules, resolved.vars, opts.sites);
  const meta = {
    appName: opts.appName || 'app',
    sheets: sheets.map((s) => ({ file: s.file, line: s.line })),
    cssLines: sheets.reduce((n, s) => n + s.text.split('\n').length, 0),
    cssRules: rules.length,
  };
  const { source, classes, accounting, unstyled, silentEmpty } = emitModule(collected, meta);

  // ── 对账：不留第三种结果 ────────────────────────────────────────────────────
  if (accounting.decls !== accounting.emitted + accounting.lost) {
    throw new Error(
      `样式对账不闭合：声明 ${accounting.decls} 条，已映射 ${accounting.emitted}，有损 ${accounting.lost}。` +
        ' 这说明 style-map.js 里有一条既没生成调用、也没记为有损的路径。',
    );
  }

  const ruleLossSummary = {};
  for (const l of collected.ruleLosses) ruleLossSummary[l.kind] = (ruleLossSummary[l.kind] || 0) + 1;

  return {
    source,
    moonPkg: emitMoonPkg(),
    classes,
    meta,
    vars: resolved.vars,
    unresolvedVars: resolved.unresolved,
    accounting,
    /**
     * ★ **算成"已映射"、却一条调用都没有**的声明（逐条带 `file:line`）。
     * 这是"静默丢键"在**声明层**的同一个形状（现网实例：`letter-spacing: normal`，已修）。
     * 判据：`tools/migrate_ledger_check.mjs` 断言真实应用上必须是 0。
     */
    silentEmpty,
    /**
     * ★ **源侧账本**（2026-10-23 新）：每一条源声明落进哪个桶、各多少条。
     * ⚠️ 口径与"别拿它跟 `accounting` 互相对账"的说明写在 `collect()` 里那段注释上。
     */
    ledger: collected.ledger,
    /** 规则级的有损（整条规则都没映射：伪类 / @media / 认不出的写法） */
    ruleLosses: collected.ruleLosses,
    /** 规则存在、但没落到任何源码用法上（其中 `lost: true` 的那些是真损失） */
    unmatchedRules: collected.unmatchedRules,
    ruleLossSummary,
    /** 认得出列宽、认不出子项的网格容器（要人看一眼） */
    gridItemsUnknown: collected.gridItemsUnknown || [],
    /** 源码用过、但 CSS 里没有对应规则的类组合（多半是状态标记，例如单独的 `on`） */
    unstyledClasses: unstyled,
    parseLosses: [...sheetLosses, ...parseLosses],
  };
}

module.exports = {
  generate,
  selectorMatchesSite,
  partMatches,
  fnName,
  normalizeClassString,
  selectorClasses,
  collectStyles,
  mapClass,
  emitModule,
  emitMoonPkg,
};
