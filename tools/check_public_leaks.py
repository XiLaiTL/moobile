#!/usr/bin/env python3
"""check_public_leaks.py —— 扫描"不该公开"的内容：本机绝对路径、账号名、凭据。

    python3 tools/check_public_leaks.py                    # 扫仓库里会被公开的文件
    python3 tools/check_public_leaks.py --zip <包.zip>      # 扫**已发布产物**（最该扫的）
    python3 tools/check_public_leaks.py --all              # 连开发文档一起扫（DEV.md 等）

为什么要有它：本仓库曾经把 `D:/ai_project/interest/moobile` 写进 **README**（而 README 是
**随发布包一起发出去**的），也把本机 SDK/JDK 路径写在 DEV.md 里。前者是真实泄漏，
后者虽然不进包、但公开仓库里同样不该出现。这类问题靠"记得检查"必然漏，
所以做成脚本 + 接进 verify_all / 发布流程。

判定分两级：
  · **LEAK**（必须改）：本机绝对路径、家目录用户名、凭据类字符串
  · **WARN**（看情况）：机器特有的名字/端口/路径片段（如 AVD 名、`E:\\Android\\Sdk`）
"""

import sys as _sys

# Windows 上 Python 的输出编码跟随 locale（GBK）；打印中文里的 ✓ 在
# **输出被重定向到文件**时（CI / verify_all.sh）会抛 UnicodeEncodeError，
# 表现成"检查失败"而手敲却通过。见 docs/FINDINGS.md 的 R4。
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- 必须改：这些一旦公开就是本机信息或凭据 ----
LEAK_PATTERNS = [
    # ⚠️ 盘符必须是**一个 token 的开头**：`(?<![A-Za-z0-9])` 用来排除 `https://` 里的 `s:` ——
    #    第一版没有这个 lookbehind，结果把满篇 URL 都报成"盘符绝对路径"（590 处噪声），
    #    真正的泄漏（README 里的 `D:/ai_project`）反而淹没在里面。
    (r"(?<![A-Za-z0-9])[A-Za-z]:[\\/]{1,2}(?:Users|Program Files|ai_project|Android|BACKUP|Program)", "本机绝对路径（盘符 + 常见目录）"),
    (r"(?<![A-Za-z0-9])[A-Za-z]:[\\/]{1,2}[A-Za-z0-9_.\-]+[\\/]", "盘符绝对路径"),
    (r"/(?:c|d|e)/Users/", "MSYS 形式的家目录路径"),
    (r"/(?:d|e)/ai_project", "MSYS 形式的项目绝对路径"),
    (r"Users[\\/][A-Za-z0-9_.\-]{2,}", "家目录用户名"),
    (r"_authToken|npm_AuthToken|NPM_TOKEN\s*=", "npm 凭据"),
    (r"credentials\.json", "凭据文件"),
    (r"\bnpm_[A-Za-z0-9]{30,}\b", "npm token 形状的字符串"),
    (r"\bgh[pousr]_[A-Za-z0-9]{20,}\b", "GitHub token 形状的字符串"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "私钥"),
    (r"\bAuthorization:\s*Bearer\s+[A-Za-z0-9._\-]{10,}", "Bearer token"),
    (r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", "邮箱地址"),
]

# ---- 看情况：机器特有，但往往是**有意写进开发文档**的（这类只在 --all 里报）----
WARN_PATTERNS = [
    (r"\bE:\\+Android\\+Sdk\b|\bE:\\+BACKUP\b|\bE:\\+moobile-build\b|\bE:\\+avd\b", "本机迁移过的路径"),
    (r"\bjdk-17[\w.]*\b|\bgraalvm[\w.\-]*\b", "本机 JDK 版本/发行版"),
    (r"\bAVD\b|\bmoobile64\b|\bemulator-\d+\b", "本机模拟器信息"),
    (r"\bvswhere\b|Microsoft Visual Studio", "本机构建工具链"),
    (r"\bStep-?[Ff]ile\b|\b9G\b", "与本机磁盘容量有关的细节"),
]

# 扫描哪些文件：默认只扫"会公开"的（README 等会进包；docs/ 进公开仓库）
SKIP_DIRS = {"vendor", ".git", "node_modules", "_build", ".scratch", ".mooncakes",
             ".expo", "android", "dist", "target"}
# 生成物：里面的 URL 与本机无关，扫它只会淹掉真信号
SKIP_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json"}
TEXT_EXT = {".md", ".mbt", ".pkg", ".mod", ".json", ".js", ".py", ".sh", ".ps1",
            ".yml", ".yaml", ".toml", ".work", ".txt", ".gitignore", ".moonignore"}
# 这些文件只进仓库、不进发布包 —— 开发笔记式的本机信息写在这里是**有意的**
DEV_ONLY = {"DEV.md", "AGENTS.md", "CONTRIBUTING.md", "PLAN.md", "FINDINGS.md",
            "DESIGN.md", "DESIGN-FEASIBILITY.md", "DESIGN-README.md",
            "PLAN-2026Q3-yi-port.md", "PLAN.md"}


# 显式豁免：**同一行**里出现这个标记就不报（用于"文档里必须举一个本机路径的反例"这类场景）。
# 设计成显式 + 可 grep：`grep -rn "leak-ok" .` 能一次看全所有豁免。
ALLOW_MARKER = "leak-ok"


def scan_text(text, name, include_warn):
    hits = []
    # 上游/第三方测试夹具里的示例邮箱（如 MoonBit core 的 geekwagon 假数据）不是泄漏，
    # 降级成 WARN；否则每次都要人工排除（很烦，而且会让人开始忽略这个检查）。
    # 注意：归档里的名字形如 `xxx.zip::vendor/rabbita/js/value_test.mbt`，
    # 所以判据要用 `vendor/`（不带前导斜杠），第一版写了 `/vendor/` 于是没生效。
    is_test_fixture = "vendor/" in name or name.endswith(("_test.mbt", "_wbtest.mbt"))
    for pat, why in LEAK_PATTERNS:
        for m in re.finditer(pat, text):
            line = text[: m.start()].count("\n") + 1
            kind = "WARN" if (is_test_fixture and why == "邮箱地址") else "LEAK"
            if kind == "WARN" and not include_warn:
                continue
            hits.append((kind, name, line, why, m.group(0)[:80]))
    if include_warn:
        for pat, why in WARN_PATTERNS:
            for m in re.finditer(pat, text):
                line = text[: m.start()].count("\n") + 1
                hits.append(("WARN", name, line, why, m.group(0)[:80]))
    return hits


def scan_tree(include_warn, include_dev):
    hits = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in SKIP_DIRS]
        for f in fn:
            if f in SKIP_FILES:
                continue
            if os.path.splitext(f)[1] not in TEXT_EXT and f not in (".gitignore", ".moonignore", "moon.work"):
                continue
            rel = os.path.relpath(os.path.join(dp, f), ROOT).replace(os.sep, "/")
            if not include_dev and (f in DEV_ONLY or rel.startswith("tools/")):
                continue
            try:
                text = open(os.path.join(dp, f), encoding="utf-8").read()
            except Exception:
                continue
            hits += scan_text(text, rel, include_warn)
    return hits


def scan_archive(path, include_warn):
    """扫发布产物：zip（mooncakes）或 tgz（npm）都支持。"""
    hits = []
    base = os.path.basename(path)
    if path.endswith((".tgz", ".tar.gz")):
        import tarfile
        with tarfile.open(path) as t:
            for m in t.getmembers():
                if not m.isfile():
                    continue
                ext = os.path.splitext(m.name)[1]
                if ext not in TEXT_EXT:
                    continue
                f = t.extractfile(m)
                if f is None:
                    continue
                hits += scan_text(f.read().decode("utf-8", "replace"), f"{base}::{m.name}", include_warn)
        return hits
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            ext = os.path.splitext(info.filename)[1]
            if ext not in TEXT_EXT and not info.filename.endswith((".gitignore",)):
                continue
            try:
                text = z.read(info).decode("utf-8", "replace")
            except Exception:
                continue
            hits += scan_text(text, f"{base}::{info.filename}", include_warn)
    return hits


def main():
    args = sys.argv[1:]
    include_warn = "--all" in args
    include_dev = "--all" in args or "--dev" in args
    quiet = "--quiet" in args   # 给 verify_all.sh / CI 用：只在有问题时打细节
    hits = []

    if "--zip" in args:
        zp = args[args.index("--zip") + 1]
        hits = scan_archive(zp, include_warn)
        if not quiet:
            print(f"扫描发布产物：{zp}")
    else:
        hits = scan_tree(include_warn, include_dev)
        if not quiet:
            print(f"扫描仓库（{'含开发文档与工具' if include_dev else '只看会公开的内容'}）")

    leaks = [h for h in hits if h[0] == "LEAK"]
    warns = [h for h in hits if h[0] == "WARN"]

    if leaks:
        print(f"\nLEAK（必须改）{len(leaks)} 处：")
        for kind, name, line, why, sample in leaks[:60]:
            print(f"  {name}:{line}  [{why}]  {sample}")
    if warns and not quiet:
        print(f"\nWARN（看情况）{len(warns)} 处：")
        seen = set()
        for kind, name, line, why, sample in warns:
            key = (name, why)
            if key in seen:
                continue
            seen.add(key)
            print(f"  {name}:{line}  [{why}]  {sample}")
        print(f"  （同类只列首个；共 {len(warns)} 处）")

    if not leaks and not warns:
        print("\n没发现问题 ✓")
    elif not leaks and warns:
        print(f"\n没有 LEAK；{len(warns)} 处 WARN（本机信息，多在开发文档/工具脚本里）✓")
    return 1 if leaks else 0


if __name__ == "__main__":
    sys.exit(main())
