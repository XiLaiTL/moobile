#!/usr/bin/env python3
"""vendor_relocate.py —— fork 的「布局搬家」与「反向搬回」。

`vendor_sync.sh` 用它在两种坐标之间转换：

    旧布局（patch 是按它写的）          最终布局（工作区里铺的样子）
    internal/vdom/…                     vendor/rabbita/vdom/…
    internal/rabbita/…（fork 根文件）    vendor/rabbita/rabbita/…
    html/… cmd/… dom/…                  vendor/rabbita/html/…

**为什么要搬家**：`internal` 的可见性只认**路径段恰好等于 `internal`**，而铺在模块根时
模块根包没法 import sys as _sys

# ⚠️ Windows 上 Python 的输出编码默认跟随 locale（GBK）。本脚本会打印中文，
#    一旦输出被**重定向到文件**（CI、`verify_all.sh` 的 `run()` 都是这样），
#    非 GBK 字符（比如 ✓）会直接抛 UnicodeEncodeError —— 表现是"检查失败"，
#    而同样一条命令直接跑却是通过的（实测踩到过）。
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import 子目录里的 internal 包。摊平（丢掉 `internal` 这一段）之后就可以了 ——
2026-09 实测，见 `docs/FINDINGS.md` 的 R3。反过来"加一层公开再导出包"**不通**：
类型只能被命名、不能被使用（变体匹配 / 构造 / 字段 / 方法全报错）。

用法（`vendor_sync.sh` 内部调用）：

    python3 tools/vendor_relocate.py to-vendor <src> <dst> <模块名> [fork 目录…] --internal <子包…>
    python3 tools/vendor_relocate.py to-legacy <src> <dst> <模块名> [fork 目录…] --internal <子包…>

`to-vendor` 把 `<src>`（旧布局）拷成 `<dst>`（最终布局）；`to-legacy` 反之。
`--internal` 之后是 `internal/` 下的子包名 —— 它们搬家时换位置，所以两个方向都要知道。
"""

import os
import re
import shutil
import sys


def die(msg):
    print("ERROR(vendor_relocate): " + msg, file=sys.stderr)
    sys.exit(1)


def rewrite_imports(root, pairs):
    """把 root 下所有 moon.pkg 里的 import 路径按 pairs（旧前缀→新前缀）改写。

    只在**路径段边界**上替换：`"<mod>/vdom` 后面必须跟 `"` 或 `/`，
    这样 `vdom` 不会误伤 `vdomx`，也不会碰到我们自己的包（`style/`、`sqlite/`）。
    """
    n = 0
    for dp, _, files in os.walk(root):
        for f in files:
            if f != "moon.pkg":
                continue
            p = os.path.join(dp, f)
            with open(p, encoding="utf-8") as fh:
                s = fh.read()
            orig = s
            for old, new in pairs:
                s = re.sub(
                    r'"%s(?=["/])' % re.escape(old),
                    '"%s' % new,
                    s,
                )
            if s != orig:
                with open(p, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(s)
                n += 1
    return n


def to_vendor(src, dst, mod, fork_dirs, internals):
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)

    # 1) 摊平 internal/*（丢掉 `internal` 这一段 —— 整个搬家的关键）
    intdir = os.path.join(dst, "internal")
    if os.path.isdir(intdir):
        for name in os.listdir(intdir):
            target = os.path.join(dst, name)
            if os.path.exists(target):
                die(f"摊平冲突：{name} 在顶层已存在")
            shutil.move(os.path.join(intdir, name), target)
        os.rmdir(intdir)

    # 2) 改写 import：<mod>/<fork 目录> → <mod>/vendor/rabbita/<fork 目录>
    #    ⚠️ internal 的子包**源路径带 `internal/` 前缀**（`<mod>/internal/vdom`），
    #    目标不带（`<mod>/vendor/rabbita/vdom`）—— 第一版漏了这个前缀，
    #    结果 cmd/ 里 `XiLaiTL/mobile/internal/key` 没人改，编译报 "Cannot find import"。
    #    `internal` 本身不出现在通用表里（否则会生成 vendor/rabbita/internal/… 这种错映射）。
    pairs = [(f"{mod}/{d}", f"{mod}/vendor/rabbita/{d}") for d in fork_dirs if d != "internal"]
    pairs += [(f"{mod}/internal/{x}", f"{mod}/vendor/rabbita/{x}") for x in internals]
    n = rewrite_imports(dst, pairs)

    # 3) 自检：搬家后不该再有路径段恰好是 internal 的目录
    bad = [
        os.path.relpath(os.path.join(dp, d), dst).replace(os.sep, "/")
        for dp, dn, _ in os.walk(dst)
        for d in dn
        if d == "internal"
    ]
    if bad:
        die("搬家后仍存在 internal 目录：" + ", ".join(bad[:4]))
    print(f"  布局搬家：internal/* 摊平 + {n} 个 moon.pkg 的 import 已改写 → {dst}")


def to_legacy(src, dst, mod, fork_dirs, internals):
    if os.path.exists(dst):
        shutil.rmtree(dst)
    os.makedirs(dst)
    for name in sorted(os.listdir(src)):
        s = os.path.join(src, name)
        if name in internals:
            d = os.path.join(dst, "internal", name)
        else:
            d = os.path.join(dst, name)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)

    # import 反向改写：先精确匹配 internal 子包，再把剩下的 vendor/rabbita/ 前缀去掉
    pairs = [(f"{mod}/vendor/rabbita/{x}", f"{mod}/internal/{x}") for x in internals]
    n = rewrite_imports(dst, pairs)
    n += rewrite_imports(dst, [(f"{mod}/vendor/rabbita/", f"{mod}/")])
    print(f"  反向搬家：{n} 个 moon.pkg 的 import 已还原 → {dst}")


def main(argv):
    if len(argv) < 3 or argv[0] not in ("to-vendor", "to-legacy"):
        die(__doc__ or "用法见文件头")
    mode, src, dst = argv[0], argv[1], argv[2]
    rest = argv[3:]
    if "--internal" not in rest:
        die("缺少 --internal 参数")
    cut = rest.index("--internal")
    mod = rest[0]
    fork_dirs = rest[1:cut]
    internals = rest[cut + 1 :]
    if not os.path.isdir(src):
        die(f"源目录不存在：{src}")
    if mode == "to-vendor":
        to_vendor(src, dst, mod, fork_dirs, internals)
    else:
        to_legacy(src, dst, mod, fork_dirs, internals)


if __name__ == "__main__":
    main(sys.argv[1:])
