#!/usr/bin/env python3
# readme_probe.py —— **拿 README 的快速上手真编一次**，证明"文档承诺的路径/API 真的存在"。
#
# 为什么需要它（2026-09 实测的真实事故）：
#   R3 把 fork 从模块根搬进 `vendor/rabbita/` 之后，**README 里的 import 路径没跟着改**
#   （仍写着 `XiLaiTL/moobile/html`）。而 README 是**随发布包发出去**的，也是 mooncakes
#   与 npm 的落地页 —— 于是 0.2.1 发出去之后，照 README 写的第一行就编不过：
#
#       Cannot find import 'XiLaiTL/moobile/html' in probe/...
#
#   CHANGELOG 当时还写着"仓库结构（对使用者无影响，导入路径不变）"—— 对已发布的 0.2.0
#   成立（那一版的包确实是扁平布局），对搬家之后的工作区/0.2.1 是**假的**。
#
# 这个脚本的立场：**README 是契约**。所以它不自己写死 import 路径，而是
# **从 README 里解析**出来（`app/moon.pkg` 那个代码块），生成一个最小模块去编译。
# 文档与产物一旦漂移，这里就会红 —— 而不是等使用者来报。
#
# 用法：
#   python3 tools/readme_probe.py --target XiLaiTL/moobile@0.2.1   # 验 registry 上那一版
#   python3 tools/readme_probe.py --workspace                      # 验本地工作区
#   python3 tools/readme_probe.py --zip _build/publish/X.zip       # 验**打包好的 zip**（发版前用）
#
# ⚠️ `--zip` 那份必须是**刚打出来的**：`_build/publish/` 会被下一次 `moon package` 覆盖，
#    而文件名里的版本号取自那时的 `moon.mod` —— 于是可能出现"名字叫 0.2.1、内容已经是新版"
#    的混合体。实测踩到过：拿它当"旧版"做证伪，得到的是**假通过**。
#    发版前的顺序固定为：`moon package --list`（重打）→ 立刻 `--zip` 那一份。
#
# 退出码：0 = README 的快速上手能编过；1 = 编不过（附 moon 的真实报错）。

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
README = os.path.join(ROOT, "README.md")
MODNAME = "XiLaiTL/moobile"

# 探针要编的代码 = README §1.1 里那段 `view` / `app`（**原样抄过来**），
# 只补上它引用却没定义的 Model / Msg / initial（README 是片段，那些属于读者自己的应用）。
#
# ⚠️ 改 README 的示例时，这里也要跟着改 —— 两边不一致的话，这个探针就验不到 README 了。
README_SAMPLE = '''struct Model {
  n : Int
} derive(Eq)

enum Msg {
  Bump
  Tick
}

fn initial() -> Model {
  { n: 0 }
}

fn init_app(_emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  (initial(), @cmd.none)
}

fn update(m : Model, msg : Msg, _emit : @cmd.Emit[Msg]) -> (Model, @cmd.Cmd) {
  match msg {
    Bump => ({ n: m.n + 1 }, @cmd.none)
    Tick => ({ n: m.n }, @cmd.none)
  }
}

fn subscriptions(_m : Model, emit : @cmd.Emit[Msg]) -> @sub.Sub {
  @sub.every(5000, emit(Tick))
}

// ↓↓↓ 以下两段与 README §1.1 保持一致 ↓↓↓

fn view(m : Model, emit : @cmd.Emit[Msg]) -> @html.Html {
  @html.div(
    attrs=@html.Attrs::build().styles(
      @style.Style::new().font_size(16.0).padding_horizontal(@style.px(12.0)),
    ),
    [ @html.button(on_click=emit(Bump), "+1") ],
  )
}

/// 应用入口：交出句柄表（start / snapshot / subscribe / element）。
pub fn app() -> @moobile.JsValue {
  @moobile.handlers(model=initial(), update~, view~)
}

// README 正文提到的另一条入口：首帧之前先干活（例如"先从本地库读回清单"）
pub fn app_with_init() -> @moobile.JsValue {
  @moobile.handlers_with_init(init=init_app, update~, view~, subscriptions~)
}
'''


def readme_import_paths(readme_path):
    """从 README 里取出 `app/moon.pkg` 那个代码块中的 import 路径（剥掉 @别名）。"""
    text = open(readme_path, encoding="utf-8").read()
    blocks = re.findall(r"```moonbit\n(.*?)```", text, re.S)
    for block in blocks:
        if "moon.pkg" not in block:
            continue
        if "import {" not in block:
            continue
        paths = []
        for m in re.finditer(r'"([^"]+)"', block):
            p = m.group(1).strip()
            if p.startswith(MODNAME):
                paths.append(p.split("@")[0].strip())
        # 去重并保序
        seen, out = set(), []
        for p in paths:
            if p not in seen:
                seen.add(p)
                out.append(p)
        if out:
            return out
    return []


def local_version():
    """读本库 moon.mod 的 version —— 工作区模式用它占位（版本号会被工作区忽略）。"""
    text = open(os.path.join(ROOT, "moon.mod"), encoding="utf-8").read()
    m = re.search(r'^version\s*=\s*"([^"]+)"', text, re.M)
    return m.group(1) if m else "0.0.0"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", help=f"registry 上的目标，例如 {MODNAME}@0.2.1")
    ap.add_argument("--workspace", action="store_true", help="改为验证本地工作区")
    ap.add_argument("--zip", help="改为验证**打包好的 zip**（发版前用：验的就是将要发出去的那份）")
    ap.add_argument("--readme", default=README)
    args = ap.parse_args()
    if not (args.workspace or args.target or args.zip):
        print("ERROR: 三选一：--workspace / --target / --zip")
        return 2

    paths = readme_import_paths(args.readme)
    if not paths:
        print(f"ERROR: 从 {os.path.relpath(args.readme, ROOT)} 里读不到 import 路径")
        print("       （找的是含 app/moon.pkg 的 moonbit 代码块；README 结构改了就要同步这里）")
        return 2

    print(f"== README 承诺的 import 路径（{len(paths)} 条）")
    for p in paths:
        print(f"   {p}")

    w = tempfile.mkdtemp(prefix="readme_probe_")
    try:
        app = os.path.join(w, "app")
        os.makedirs(app)
        # 目标三种：registry 上的版本 / 本地工作区 / **打包好的 zip**（发版前用）
        member = None
        if args.zip:
            member = os.path.join(w, "pkg")
            os.makedirs(member)
            with zipfile.ZipFile(args.zip) as zf:
                zf.extractall(member)
            print(f"== 目标：打包产物 {args.zip}")
        elif args.workspace:
            member = ROOT
            print(f"== 目标：本地工作区 {ROOT}")
        else:
            print(f"== 目标：{args.target}")
        with open(os.path.join(app, "moon.mod"), "w", encoding="utf-8", newline="") as fh:
            fh.write('name = "probe/readmepaths"\n\nversion = "0.1.0"\n\npreferred_target = "js"\n\n')
            # ⚠️ 工作区/zip 模式下**也必须写版本号**：moon.mod 的 import 只认带版本的 registry 依赖
            #    （写裸模块名会报 `moon.mod only supports versioned registry dependencies`）；
            #    版本号在 moon.work 解析时被忽略，实际吃的是本地源码。
            dep = args.target if args.target else f"{MODNAME}@{local_version()}"
            fh.write(f"import {{\n  \"{dep}\",\n}}\n")

        pkg = ["supported_targets = \"+js\"", "", "import {"]
        for p in paths:
            pkg.append(f'  "{p}",')
        pkg.append("}")
        with open(os.path.join(app, "moon.pkg"), "w", encoding="utf-8", newline="") as fh:
            fh.write("\n".join(pkg) + "\n")

        # main.mbt：把 README §1.1 的 `view` / `app` **原样**搬进来（只补上它引用但没定义的
        # Model / Msg / initial —— README 是片段，故意省了这些）。
        # 这样验的不只是"路径存在"，还有**文档里的 API 名字与签名**。
        with open(os.path.join(app, "main.mbt"), "w", encoding="utf-8", newline="") as fh:
            fh.write(README_SAMPLE)

        if member:
            # 工作区 / zip 模式：用 moon.work 把本地那份挂进来（zip 先解到临时目录）。
            # ⚠️ 路径必须用**正斜杠**：反斜杠会被 moon.work 的词法器当成转义字符
            #    （实测报 `Lexing error at 14..46`，而报错完全看不出是路径分隔符的问题）。
            with open(os.path.join(w, "moon.work"), "w", encoding="utf-8", newline="") as fh:
                fh.write("members = [\n")
                for m in (member, app):
                    fh.write(f'  "{m.replace(os.sep, "/")}",\n')
                fh.write("]\n")

        env = dict(os.environ)
        # 本机 git 代理常常没开：绕过它，否则索引刷新失败会伪装成"包不存在"
        env.update({
            "GIT_CONFIG_COUNT": "2",
            "GIT_CONFIG_KEY_0": "http.proxy", "GIT_CONFIG_VALUE_0": "",
            "GIT_CONFIG_KEY_1": "https.proxy", "GIT_CONFIG_VALUE_1": "",
        })
        if args.target:
            subprocess.run(["moon", "add", args.target], cwd=app, env=env,
                           capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        # ⚠️ 必须显式 `encoding="utf-8"`：`text=True` 会用**本机 locale**（这台机器是 GBK）解码
        #    moon 的 UTF-8 输出，中文/符号直接抛 UnicodeDecodeError，而异常发生在读取线程里 ——
        #    表现成 "proc.stdout is None"。这正是本仓记过的同一个坑的解码侧。
        proc = subprocess.run(["moon", "check", "--target", "js"], cwd=app, env=env,
                              capture_output=True, text=True,
                              encoding="utf-8", errors="replace")
        out = (proc.stdout or "") + (proc.stderr or "")
        print("== moon check --target js")
        if proc.returncode == 0:
            print("   ✅ README 里写的 import 路径与 API 在目标里都成立")
            return 0
        print("   ❌ README 与产物不一致：照 README 写的代码编不过")
        lines = out.strip().splitlines()
        # 只挑错误块：moon 的输出里 warning 可能几十条，直接 tail 会被 warning 淹没
        starts = [i for i, l in enumerate(lines) if l.startswith("Error")]
        if not starts:
            for line in lines[-12:]:
                print("   " + line)
        else:
            for i in starts[:4]:
                for line in lines[i:i + 6]:
                    print("   " + line)
                print("   " + "-" * 40)
        print()
        print("   修法：把 README 的 import 路径改成产物里真实存在的那些")
        print("        （产物清单：moon package --list，或在临时模块里 moon add 后 ls .mooncakes/）")
        return 1
    finally:
        shutil.rmtree(w, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
