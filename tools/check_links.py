#!/usr/bin/env python3
"""check_links.py —— 检查仓库里所有 Markdown 的**相对链接**是否指得到东西。

    python3 tools/check_links.py            # 有问题就非零退出（CI / 提交前跑）
    python3 tools/check_links.py --quiet    # 只打汇总

为什么需要它：文档一挪目录，链接就会静默失效 —— 在 GitHub 上表现为"点进去 404"，
本地看不出来。仓库治理那一轮（`_tools/` → `tools/`、`demo/` → `examples/apps/todo-app/`、
`docs/EVIDENCE.md` → `docs/design/DESIGN-FEASIBILITY.md` …）一口气动了几十处引用，
所以先把检查工具立起来、再动文件。

判据：**每个相对链接都要能在磁盘上找到**。跳过 http(s)/mailto、纯锚点，
以及 `vendor/`（第三方代码）、`.scratch/`、`_build/`、`node_modules/` 等目录。
"""

import sys as _sys

# ⚠️ Windows 上 Python 的输出编码默认跟随 locale（GBK）。本脚本会打印中文，
#    一旦输出被**重定向到文件**（CI、`verify_all.sh` 的 `run()` 都是这样），
#    非 GBK 字符（比如 ✓）会直接抛 UnicodeEncodeError —— 表现是"检查失败"，
#    而同样一条命令直接跑却是通过的（实测踩到过）。
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {
    "vendor", ".git", "node_modules", "_build", ".scratch", ".mooncakes",
    ".expo", "android", "dist", "target",
}

# [文本](目标)；目标里可能带 "标题"
LINK_RE = re.compile(r"\[[^\]]*\]\(\s*([^)\s]+)(?:\s+\"[^\"]*\")?\s*\)")

# 必须先剥掉代码再找链接：文档里常有 `struct Val[A](@duplix.Node[A])` 这种看着像
# Markdown 链接的代码，不剥就会误报（第一版就误报了 2 处）。
FENCE_RE = re.compile(r"^```.*?^```", re.S | re.M)
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")


def strip_code(text):
    """把围栏代码块与行内代码换成等长空白（保住行号与字符偏移）。"""

    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))

    return INLINE_CODE_RE.sub(blank, FENCE_RE.sub(blank, text))


SKIP_PREFIX = ("http://", "https://", "mailto:", "#", "data:")


def md_files():
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        for f in fn:
            if f.endswith(".md"):
                yield os.path.join(dp, f)


def main():
    quiet = "--quiet" in sys.argv
    files = sorted(md_files())
    broken = []
    checked = 0

    for path in files:
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        scan = strip_code(text)
        for m in LINK_RE.finditer(scan):
            target = m.group(1)
            if target.startswith(SKIP_PREFIX) or "://" in target:
                continue
            t = target.split("#", 1)[0].split("?", 1)[0]
            if not t:
                continue
            checked += 1
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), t))
            if not os.path.exists(resolved):
                line = scan[: m.start()].count("\n") + 1
                broken.append((rel, line, target))

    print(f"检查了 {len(files)} 个 Markdown、{checked} 个相对链接")
    if broken:
        print(f"\n断链 {len(broken)} 个：")
        for rel, line, target in broken:
            print(f"  {rel}:{line}  ->  {target}")
        if not quiet:
            print("\n提示：跨文件指路要用**相对本文档**的路径，GitHub 上才点得动。")
    else:
        print("所有相对链接都能指到东西 ✓")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
