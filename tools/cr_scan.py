#!/usr/bin/env python3
# cr_scan.py —— lf_normalize.sh 的扫描内核：找出（或修掉）带 CR 的文本文件。
#
# 为什么要单独一个 Python 进程，而不是在 bash 里逐文件判断：
#   原写法 `has_cr() { [ "$(tr -cd '\r' < "$1" | wc -c)" -gt 0 ]; }` 对**每个**候选文件
#   起两个进程（tr + wc）。本仓有 ~2500 个候选文件 → ~5000 次进程启动，而 Windows 上
#   每次 spawn 是几十毫秒，实测**单这一项 260 秒**（verify_all.sh 因此全程 9 分钟）。
#   现在一次进程扫完，实测 ~1 秒。
#
# ⚠️ 为什么不用 `grep -rlU $'\r'`：在本机 Git Bash（MSYS）上**不可靠** ——
#   命令行参数里的裸 CR 会被 MSYS 的 argv 处理弄坏，结果是匹配到几乎每个文件
#   （实测对 0 个 CR 的仓库报出 2537 个假阳性）。改用 Python 按**字节**读，
#   判据只看 `b"\r" in data`，不经过任何文本模式或 argv 编码。

import argparse
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 文本扩展名白名单（含无扩展名的特例）—— 与 lf_normalize.sh 原来那份保持一致
EXTS = {
    "mbt", "mbti", "md", "json", "js", "jsx", "ts", "sh", "ps1", "py", "txt", "pkg",
    "mod", "patch", "yml", "yaml", "toml", "css", "html", "xml", "gradle",
    "properties", "lock", "gitignore", "moonignore", "gitattributes",
}
DOTFILES = {".gitignore", ".moonignore", ".gitattributes"}

# 不进的目录 —— **按相对路径**排除（与原来 bash 里的 -path 列表逐条对应）
PRUNE = {
    ".git",
    "_build",
    ".mooncakes",
    "vendor",
    "examples/apps/todo-app/host/node_modules",
    "examples/apps/todo-app/host/android",
    "examples/apps/todo-app/host/dist",
    "examples/apps/todo-app/host/.expo",
}


def candidates(root):
    """产出所有需要关心的文本文件（绝对路径）。"""
    for dirpath, dirnames, filenames in os.walk(root):
        rel = os.path.relpath(dirpath, root).replace(os.sep, "/")
        rel = "" if rel == "." else rel
        dirnames[:] = [
            d for d in dirnames if (f"{rel}/{d}" if rel else d) not in PRUNE
        ]
        for name in filenames:
            ext = name.rsplit(".", 1)[-1] if "." in name else ""
            if name in DOTFILES:
                ext = name[1:]
            if ext in EXTS:
                yield os.path.join(dirpath, name)


def strip_cr(data):
    """与原来的 `sed -i 's/\\r$//'` 等价：去掉紧邻 LF 的 CR，以及文末孤立的 CR。"""
    out = data.replace(b"\r\n", b"\n")
    if out.endswith(b"\r"):
        out = out[:-1]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--mode", choices=["check", "fix"], default="check")
    args = ap.parse_args()

    root = os.path.abspath(args.root)
    total = 0
    crfiles = []
    for path in candidates(root):
        total += 1
        with open(path, "rb") as fh:
            data = fh.read()
        if b"\r" in data:
            crfiles.append((path, data))

    shown = 0
    for path, data in crfiles:
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        if args.mode == "check":
            print(f"  [CR] {rel}")
        else:
            with open(path, "wb") as fh:
                fh.write(strip_cr(data))
            print(f"  已转 LF: {rel}")
        shown += 1

    # 把"查了多少个"也打出来：一个**什么都不查**的检查同样会报"通过"，
    # 所以候选数要能被看见（这个数字本身就是"检查有效"的证据）。
    print(f"候选 {total} 个文本文件，带 CR 的 {len(crfiles)} 个")
    return 1 if crfiles else 0


if __name__ == "__main__":
    sys.exit(main())
