#!/usr/bin/env python3
# gen_forwarders.py —— 在模块根生成**转发包**，让消费者的 import 路径保持简短。
#
#   python3 tools/gen_forwarders.py            # 生成/更新
#   python3 tools/gen_forwarders.py --check    # 只校验磁盘上的与生成的一致（verify_all 用）
#
# ## 为什么需要它
#
# R3 把整个 fork 搬进了 `vendor/rabbita/`，于是**消费者的 import 路径也变长了**：
#
#     import { "XiLaiTL/moobile/vendor/rabbita/html" @html }    ← 又长又暴露我们的 fork
#
# 而 README（随包发布、也是 mooncakes 落地页）写的是 `XiLaiTL/moobile/html` —— 实测照抄
# **编不过**（0.2.1 发出去之后才发现）。消费者不该看见 `vendor/` 这一层。
#
# 上游 rabbita 自己就是这么做的：`rabbita/top.mbt` 里
#
#     pub using @cmd {none, batch, delay, type Cmd}
#     pub using @html {type Html}
#
# 所以这里在模块根生成一层**纯转发**包：`html/`、`cmd/`、`sub/`、`http/`。
#
# ## 为什么名字要**生成**而不是手写
#
# `pub using` **没有通配写法**（`{*}` / `{...}` / 裸包名都实测不支持），而 `html` 有
# 362 个公开函数 + 几十个 `Attrs::*` 方法。手抄既写不完、又会随上游升级悄悄过期。
# 于是名字从 `pkg.generated.mbti`（`moon info` 产物，就是这套 API 的权威清单）里抽。
#
# ## 实测边界（都验过）
#
#   · 消费者通过转发包 → 命名类型 ✅ / 调函数 ✅ / 字段访问 ✅ / 变体匹配 ✅
#   · 转发包**自己**构造转发来的 struct → ❌ `Cannot create values of the read-only type`
#     （所以转发包只能当"通道"，这正合我们用）
#
# ## 生成物入库
#
# 与 `registry.generated.js` 同一策略：**生成物入库**，所以 `--check` 能 diff 出漂移。
# 改了 `vendor/rabbita/**` 或升级 fork 之后，必须重跑本脚本。

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODNAME = "XiLaiTL/moobile"          # 从 moon.mod 读，别写死
VENDOR = "vendor/rabbita"

# 期望内容的缓存目录（`_build/` 已被 .gitignore 覆盖，也被 cr-scan 的排除规则跳过）
CACHE_ROOT = os.path.join(ROOT, "_build", "forwarders-cache")

# 要转发的包：<根上的转发包名> ← <vendor 下的真实包名>
#
# 刻意**只**转发消费者写应用真正会 import 的那几个 —— 每多一个，模块根就多一项，
# 而 R3 的成果正是"根目录变干净"。其余（dom / nav / dialog / …）要的话直接 import
# `XiLaiTL/moobile/vendor/rabbita/xxx`，属于进阶用法。
FORWARD = [
    ("html", "html"),   # @html DSL（标签助手 + Attrs）
    ("cmd", "cmd"),     # Cmd / Emit（update 的返回与副作用）
    ("sub", "sub"),     # Sub（订阅：定时器、传感器…）
    ("http", "http"),   # 网络请求（同步链路）
    # `url`：**路由与深链的载荷类型**（`on_url_changed` 推的是 `@url.Url`、`on_url_request` 是
    # `@url.UrlRequest`）。2026-10-07 实测：不加它，消费者**能订到却命名不了** ——
    # `sub/pkg.generated.mbti` 的公开签名里就写着 `@url.Url`，而根上没有 `url/`，
    # 于是应用没法把它存进 Model、也没法匹配 `Protocol`（只能调方法）。
    # ⚠️ **路由自带一个 URL 类型是明确不选的**：一个仓里两个 URL 概念，边界上到处转换，
    #    而且"哪个是真源"永远说不清（裁定见 `docs/design/DESIGN-ROUTER.md` §8）。
    ("url", "url"),
    # `common`：**同步读与订阅的载荷**都从这里来 —— `sub.current_viewport()` 返回 `@common.Viewport`，
    # `on_key_down` / `on_mouse_move` / `on_scroll` 的载荷是 `@common.Keyboard/Mouse/Scroll`。
    # 与 `url` 同一条分界线：**消费者会收下并可能存进 Model 的数据，必须可命名**。
    ("common", "common"),
]

# 转发包**可以有手写扩展**：`<转发包名>` → 那个包里有哪些**手写**文件、它们要哪些额外 import。
#
# 为什么需要这张表：`<转发包>/moon.pkg` 是**生成物**，手改会被下次重跑覆盖，而且 `--check`
# 会把改动当漂移报出来。可手写文件确实需要 import —— 例：`http/stream.mbt`（**流式**响应）
# 要用 `@cmd.custom_cmd` 拿到 scheduler，才能把"流里的每一帧"送回 update 循环。
#
# ⚠️ 为什么**不**把这个功能加进 vendor fork：`vendor/rabbita/**` 是**别人的包**，
#    我们的改动得落成 `tools/patches/*.patch`、升级时逐个重放（`FORK.md` §0）。
#    往别人的包里塞我们发明的新能力，代价大于收益。所以：**实现写在根上的转发目录里（手写），
#    vendor 一行不改** —— 而消费者看到的仍然只有 `import { "…/http" }` 这一个入口。
#
# ⚠️ 想加第二个手写扩展时：往这张表里加一条，**别忘了同时把文件真的建出来**
#    （生成器不管手写文件的内容，也不会替你建）。
#
# ⚠️⚠️ **先有鸡还是先有蛋**：本脚本要先跑 `moon info`，而那要求**工程能编译**；
#    可新的手写文件又需要新 import 才能编译。所以第一次加扩展时：
#    **照本脚本将会产出的内容，先把 `<转发包>/moon.pkg` 手写一次** → 编译通过 → 再跑本脚本
#    （它会写出同样的内容，`--check` 随即一致）。`http/stream.mbt` 就是这么落地的。
EXTRA = {
    "http": {
        # 追加到该包 `moon.pkg` 的 import 行：<模块内相对路径> → <别名>
        "imports": [("vendor/rabbita/cmd", "@cmd")],
        # 只为自述：这些手写文件必须真的在（`--check` 不会替你验，它们不进比对范围）
        "files": ["stream.mbt"],
    },
}

HEADER = """// ⚠️ **生成物，不要手改** —— 由 `tools/gen_forwarders.py` 从
// `{vendor_pkg}/pkg.generated.mbti` 生成（那个文件又是 `moon info` 的产物）。
//
// 为什么有这一层：fork 住在 `{vendor_pkg}/`，但消费者不该看见 `vendor/`。
// 这个包**只做转发**（`pub using`）—— 于是 `import {{ "{mod}/{name}" }}` 照旧可用。
//
// 改名字清单请改生成器（或先 `moon info` 再重跑），否则 `verify_all.sh` 会报漂移。
"""

TYPE_DECL = re.compile(r"^pub(?:\(all\))? (?:enum|struct) ([A-Za-z_][A-Za-z0-9_]*)")
# ⚠️ **不透明类型**在 .mbti 里是**不带 `pub` 的裸 `type NAME`**（写在 "Types and methods" 段）：
#      type Attrs            ← html 里那个 `pub type Attrs`（构造器私有）
#      type Cmd / type Sub   ← 同理
#    第一版只认 `pub(struct|enum)`，结果 `Attrs` / `Cmd` / `Sub` 这三个**最核心**的名字全漏了 ——
#    消费者照 README 写的 `@cmd.Cmd`、`@html.Attrs::build()` 直接编不过。这条是探针抓出来的。
BARE_TYPE_DECL = re.compile(r"^type ([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[|$)")
ALIAS_DECL = re.compile(r"^pub type ([A-Za-z_][A-Za-z0-9_]*)")
TRAIT_DECL = re.compile(r"^pub trait ([A-Za-z_][A-Za-z0-9_]*)")
# ⚠️ 泛型子句在 `fn` 和名字**之间**：`pub fn[C : IsChildren] div(...)` —— 所以要先吃掉
#    `[C : IsChildren]` 再取名字。第一版把 `[` 写在**名字后面**的定界符里，
#    结果 362 个公开函数只抽到 23 个（339 个泛型标签助手全被跳过，而它们正是 DSL 的主体）。
VALUE_DECL = re.compile(r"^pub (?:fn\[[^\]]*\]|fn|let)\s+?([A-Za-z_][A-Za-z0-9_]*)\s*[(\[<:]")
# ⚠️ 方法声明也**可能带泛型子句**：`pub fn[A, B] Emit::map(Self[A], (B) -> A) -> Self[B]`。
#    第一版只写了 `^pub fn (\w+)::`，于是这类方法没被当成方法，而**被"值"分支抓走了名字**
#    （`Emit` 于是同时出现在 `type Emit` 和值列表里）→ 编译报
#    `Alias for the type @vendor.Emit should be created via using @vendor {type Emit}`。
METHOD_DECL = re.compile(r"^pub fn(?:\[[^\]]*\])?\s*([A-Za-z_][A-Za-z0-9_]*)::")
USING_DECL = re.compile(r"^pub using @\w+ \{([^}]*)\}")


# 允许"公开签名里出现、但根上不转发"的包 —— **每条都要写理由**（别默默加）。
#
# 判据的由来（2026-10-07）：`sub` 的公开签名里写着 `@url.Url`，而根上没有 `url/`，
# 于是消费者**能订到 `on_url_changed` 却命名不了它的载荷类型**（只能调方法，不能存进 Model）。
# 这不是"设计取舍"，是**生成器清单漏了一个** —— 同类错误一定会再犯，所以让它有判据。
COVERAGE_ALLOW = {
    # 包名（路径最后一段）→ 为什么允许不转发。**每条都要能被挑战**，别默默加。
    #
    # 分界线（2026-10-07 定的口径）：**"消费者会收下并可能存进 Model 的数据"必须可命名**；
    # 只在回调里就地消费的事件对象、以及内部管道类型，可以不转发（要用时走 vendor 路径）。
    "core": "标准库（moonbitlang/core/*），消费者本来就能命名",
    "dom": "DOM 事件对象（`MouseEvent`/`KeyboardEvent`）—— 只在 `on_*` 回调里就地消费，"
           "不鼓励存进 Model；真要用就 import vendor 路径",
    "vdom": "低层事件载荷（`@vdom.Event`）—— 同上，且 `html` 包把它包在自己的 helper 里",
    "ref": "`@ref.Ref[...]` 只出现在 `event_decoders` 这类低层值上，应用侧不用碰",
    "vector": "`@vector.Vector` 只在 trait impl 的签名里出现（`IsChildren`），不构造它",
    "list": "同上（`IsChildren` 的 impl 签名）",
    "json": "同上（低层解码签名）",
    "debug": "`derive(Debug)` 的产物（`@debug.Debug`），消费者不命名它",
}

def referenced_foreign_types(mbti_path):
    """公开签名里引用的外部类型：返回 [(alias, TypeName, line)]。

    alias 从 mbti 的 import 块推（`"…/rabbita/url"` → alias = 路径最后一段）。
    ⚠️ 用 `splitlines()`（不是 split("\n")）—— 免得给本文件塞进转义。
    """
    txt = open(mbti_path, encoding="utf-8").read()
    aliases = set()
    for m in re.finditer(r'"([^"]+)"', txt):
        aliases.add(m.group(1).rsplit("/", 1)[-1])
    out = []
    for line in txt.splitlines():
        st = line.strip()
        if st.startswith("//") or st.startswith("import") or st in ("{", "}"):
            continue
        for m in re.finditer(r"@([A-Za-z_][A-Za-z0-9_]*)\.([A-Z][A-Za-z0-9_]*)", line):
            if m.group(1) in aliases:
                out.append((m.group(1), m.group(2), st))
    return out

def root_packages():
    """根上真实存在的包（生成的转发包 + 手写的包装，如 `style/` / `canvas/` / `sqlite/`）。

    判据要认它们：消费者**能 import** 就算"可命名"，至于是生成的还是手写的与判据无关。
    """
    out = set()
    for name in os.listdir(ROOT):
        d = os.path.join(ROOT, name)
        if os.path.isdir(d) and os.path.exists(os.path.join(d, "moon.pkg")):
            out.add(name)
    return out

def check_coverage():
    """**公开面可命名类型不许漏**：转发的包，其公开签名引用的外部包也必须在根上可命名。

    ⚠️ `.mbti` 是**构建产物、刻意不入库**（见 `ensure_mbti`）⇒ 本模式也必须先确保它们在，
    用完删掉这一次新建的。**不这么做，就会在"刚 clone 干净树"上得到一条假红** ——
    判据的读数不许取决于"本机跑没跑过 `moon info`"（本仓写下的教训）。
    """
    needed = [os.path.join(ROOT, VENDOR, v, "pkg.generated.mbti") for _, v in FORWARD]
    created, _ran = ensure_mbti(needed)
    try:
        return _check_coverage_inner()
    finally:
        for p in created:
            try:
                os.remove(p)
            except OSError:
                pass

def _check_coverage_inner():
    forwarded = {vendor for _, vendor in FORWARD} | root_packages()
    missing = {}
    for _fwd, vendor in FORWARD:
        mbti = os.path.join(ROOT, VENDOR, vendor, "pkg.generated.mbti")
        if not os.path.exists(mbti):
            print(f"ERROR: 缺少 {os.path.relpath(mbti, ROOT)}（`moon info` 没产出它）")
            return 2
        for alias, type_name, line in referenced_foreign_types(mbti):
            if alias in forwarded or alias in COVERAGE_ALLOW or alias == vendor:
                continue
            missing.setdefault(alias, []).append((vendor, type_name, line))
    if not missing:
        print("公开面可命名类型覆盖 ✓（转发包签名里引用的外部包都转发了）")
        return 0
    print("ERROR: 这些包在**公开签名**里被引用，但根上没有转发 ⇒ 消费者能拿到却命名不了：")
    for alias, hits in sorted(missing.items()):
        print(f"  · @{alias} —— 出现在 {len(hits)} 处，例如：")
        for vendor, type_name, line in hits[:3]:
            print(f"      [{vendor}] {type_name}: {line[:96]}")
    print("  修：把 `" + "、".join(sorted(missing)) + "` 加进 FORWARD（或写进 COVERAGE_ALLOW 并给出理由）")
    return 2

def parse_mbti(path):
    """从 .mbti 里抽出可转发的名字，返回 (types, traits, values)。"""
    types, traits, values = [], [], []
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        if m := TYPE_DECL.match(line):
            types.append(m.group(1))
        elif m := BARE_TYPE_DECL.match(line):
            types.append(m.group(1))
        elif m := ALIAS_DECL.match(line):
            types.append(m.group(1))
        elif m := TRAIT_DECL.match(line):
            traits.append(m.group(1))
        elif METHOD_DECL.match(line):
            # 方法（`Attrs::build`）挂在类型上 —— 转发类型即可，方法跟着走（实测）
            continue
        elif m := VALUE_DECL.match(line):
            values.append(m.group(1))
        elif m := USING_DECL.match(line):
            # 本包自己再导出的名字，也算它的公开面
            for item in m.group(1).split(","):
                item = item.strip()
                if item.startswith("type "):
                    types.append(item[5:].strip())
                elif item.startswith("trait "):
                    traits.append(item[7:].strip())
                elif item:
                    values.append(item)
    def uniq(seq):
        seen, out = set(), []
        for x in seq:
            if x not in seen:
                seen.add(x)
                out.append(x)
        return out

    # 护栏：同一个名字不能既是"类型"又是"值"（编译期报 4051/4187）。
    # 两个集合都在各自的名字空间里，重复只可能来自解析分类错误，所以这里以**类型**为准。
    types = uniq(types)
    traits = uniq(traits)
    tset = set(types)
    values = [v for v in uniq(values) if v not in tset and v not in set(traits)]
    return types, traits, values


def render(fwd_name, vendor_name, types, traits, values):
    """产出 (moon.pkg 内容, .mbt 内容)。"""
    extra = EXTRA.get(fwd_name, {})
    pkg = (
        "// ⚠️ 生成物（tools/gen_forwarders.py）—— 转发包，转出 vendor 下的真实实现。\n"
        f'import {{\n  "{MODNAME}/{VENDOR}/{vendor_name}" @vendor,\n'
    )
    for rel, alias in extra.get("imports", []):
        # 手写扩展要的 import —— 登记在 tools/gen_forwarders.py 的 EXTRA 里，别手改本文件
        pkg += "  // 下面这条是**手写扩展**要的（见同目录的手写文件）—— 改 EXTRA，别手改本文件\n"
        pkg += f'  "{MODNAME}/{rel}" {alias},\n'
    pkg += "}\n"
    body = HEADER.format(vendor_pkg=f"{VENDOR}/{vendor_name}", mod=MODNAME, name=fwd_name)
    files = extra.get("files", [])
    if files:
        body += "//\n// ⚠️ 本目录里**还有手写文件**（它们不在生成器的比对范围里）：\n"
        for f in files:
            body += f"//      · `{f}`\n"
        body += "//    它们要的 import 由 `tools/gen_forwarders.py` 的 `EXTRA` 表写进 `moon.pkg`。\n"
    body += f"\n///|\n// 转发 {MODNAME}/{VENDOR}/{vendor_name} 的公开面。\n"
    # 名字很多（html 有 400+）：分多条 pub using，便于人读 diff
    items = [f"type {t}" for t in types] + [f"trait {t}" for t in traits] + values
    if not items:
        body += "// （这个包没有公开名字）\n"
        return pkg, body
    chunk = 12
    for i in range(0, len(items), chunk):
        body += "pub using @vendor {" + ", ".join(items[i:i + chunk]) + "}\n"
    return pkg, body


def snapshot_mbti():
    """列出当前已存在的 pkg.generated.mbti（用来判断哪些是"我们这次生成的"）。"""
    out = set()
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in (".git", "_build", ".mooncakes", ".scratch")]
        for f in fn:
            if f == "pkg.generated.mbti":
                out.add(os.path.join(dp, f))
    return out


def ensure_mbti(needed):
    """确保需要的 .mbti 存在（缺就 `moon info` 跑一次）。

    返回 (新建了哪些, 是否真的跑了 moon info)。
    ⚠️ 为什么用完要删：`.mbti` 是构建产物，本仓**刻意不入库**（vendor_sync 的基准包里也删掉了
    它们），而 `vendor_sync.sh --check` 的不变量是"**197 个源文件** == pristine + patch"。
    留着 22 个 mbti 会把不变量顶成 219 → 报假漂移（实测）。所以生成器只把它们当**临时输入**。
    """
    before = snapshot_mbti()
    missing = [p for p in needed if not os.path.exists(p)]
    ran = False
    if missing:
        proc = subprocess.run(["moon", "info", "--target", "js"], cwd=ROOT,
                              capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
        ran = True
        if proc.returncode != 0:
            tail = ((proc.stdout or "") + (proc.stderr or "")).strip().splitlines()[-5:]
            print("ERROR: `moon info` 失败，无法拿到 .mbti：")
            for line in tail:
                print("   " + line)
            return None, True
    created = snapshot_mbti() - before
    return created, ran


def input_key():
    """期望内容的**唯一输入**的哈希：被转发包的 vendor 源码 + 生成器自己 + 转发配置。

    ⚠️ 为什么要缓存：每次 `--check` 都要拿 `.mbti`，而 `.mbti` 得靠 `moon info` 重生成
    （实测 ~1 秒，本仓最大的单项工具开销之一）。而 `.mbti` 只由**源码**决定 ——
    源码没变，名字清单必然一样。所以按输入哈希缓存"期望内容"，
    `--check` 在常见情况下**一次 moon info 都不用跑**（~2.0s → ~0.2s）。

    缓存失效是**自动**的：vendor 源码、`FORWARD` 表、生成器脚本任一改变，键就变。
    缓存坏了只会朝"报假漂移"失败（安全方向），不会漏掉真漂移 ——
    因为**磁盘上的转发包永远重新比**，只是"期望值"来自缓存。
    """
    h = hashlib.sha256()
    h.update(MODNAME.encode("utf-8"))
    h.update(repr(FORWARD).encode("utf-8"))
    for _, vendor_name in FORWARD:
        base = os.path.join(ROOT, VENDOR, vendor_name)
        for dp, dn, fn in os.walk(base):
            for f in sorted(fn):
                if f == "pkg.generated.mbti":
                    continue  # 生成物，不算输入（否则每次 moon info 都会改键 → 永远不命中）
                p = os.path.join(dp, f)
                h.update(os.path.relpath(p, ROOT).replace(os.sep, "/").encode("utf-8"))
                with open(p, "rb") as fh:
                    h.update(fh.read())
    with open(os.path.abspath(__file__), "rb") as fh:
        h.update(fh.read())
    return h.hexdigest()[:16]


def load_cache(key):
    """命中则返回 {绝对路径: 期望内容}，否则 None。"""
    path = os.path.join(CACHE_ROOT, key + ".json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as fh:
            raw = json.load(fh)
    except (OSError, ValueError):
        return None  # 缓存坏了就当没命中（朝重建方向失败，安全）
    return {os.path.join(ROOT, rel): text for rel, text in raw.items()}


def save_cache(key, want):
    """原子写缓存（临时文件 + rename），避免中断留下半个缓存。"""
    os.makedirs(CACHE_ROOT, exist_ok=True)
    path = os.path.join(CACHE_ROOT, key + ".json")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        json.dump({os.path.relpath(p, ROOT).replace(os.sep, "/"): t for p, t in want.items()},
                  fh, ensure_ascii=False, indent=1, sort_keys=True)
    os.replace(tmp, path)
    # 清掉旧的键（避免 _build 里越积越多）
    for name in os.listdir(CACHE_ROOT):
        if name.endswith(".json") and name != key + ".json":
            try:
                os.remove(os.path.join(CACHE_ROOT, name))
            except OSError:
                pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--coverage", action="store_true",
                    help="只查覆盖：转发包公开签名里引用的外部包，是否也在根上可命名")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    # `--coverage` 只查"公开面可命名类型"，不生成、不比对 —— 先短路
    if args.coverage:
        return check_coverage()

    # 模块名从 moon.mod 读，避免写死
    global MODNAME
    mm = open(os.path.join(ROOT, "moon.mod"), encoding="utf-8").read()
    m = re.search(r'^name\s*=\s*"([^"]+)"', mm, re.M)
    if m:
        MODNAME = m.group(1)

    key = input_key()
    want = load_cache(key)
    if want is not None:
        print(f"  （命中生成缓存 {key}：跳过 `moon info`）")
    else:
        needed = [os.path.join(ROOT, VENDOR, v, "pkg.generated.mbti") for _, v in FORWARD]
        created, ran = ensure_mbti(needed)
        if created is None:
            return 2
        try:
            if ran:
                print(f"  （.mbti 缺失 → 跑了一次 `moon info`；用完会删掉这次新生成的 {len(created)} 个）")
            want = {}
            for fwd_name, vendor_name in FORWARD:
                mbti = os.path.join(ROOT, VENDOR, vendor_name, "pkg.generated.mbti")
                if not os.path.exists(mbti):
                    print(f"ERROR: 缺少 {os.path.relpath(mbti, ROOT)}（`moon info` 没产出它）")
                    return 2
                types, traits, values = parse_mbti(mbti)
                pkg_txt, mbt_txt = render(fwd_name, vendor_name, types, traits, values)
                fdir = os.path.join(ROOT, fwd_name)
                want[os.path.join(fdir, "moon.pkg")] = pkg_txt
                want[os.path.join(fdir, "forward.generated.mbt")] = mbt_txt
        finally:
            # 只删**这次**新建的 .mbti（别人原本就有的不动）—— 见 ensure_mbti 的说明
            for p in created:
                try:
                    os.remove(p)
                except OSError:
                    pass
        save_cache(key, want)

    drift = []
    for path, text in sorted(want.items()):
        rel = os.path.relpath(path, ROOT)
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if cur == text:
            if not args.check:
                print(f"  未变：{rel}")
            continue
        if args.check:
            drift.append(rel)
            continue
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print(f"  已写：{rel}")

    if args.check:
        if drift:
            print("转发包与 mbti 不一致（漂移）：")
            for d in drift:
                print(f"  [异] {d}")
            print("修：bash tools/py.sh tools/gen_forwarders.py   （改了 vendor/rabbita/** 之后必须重跑）")
            return 1
        print("转发包一致 ✓")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
