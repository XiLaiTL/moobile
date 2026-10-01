#!/usr/bin/env bash
# vendor_sync.sh —— 生成式 vendor：第三方代码（rabbita fork）不进仓，靠「版本 + patch 系列」重建。
#
# 布局：fork 铺在 **`vendor/rabbita/`**（不是模块根）。
#
# ⚠️ 这里曾写着一句"fork 必须铺在模块根"，理由是 `internal` 的可见性。**那句结论不完整**，
#    2026-09 实测（见 docs/FINDINGS.md 的 R3）：
#      · `internal` 的可见性只认**路径段恰好等于 `internal`**；
#      · 所以把 `internal/*` **摊平**成 `vendor/rabbita/*`（丢掉那一段）之后，
#        模块根包照样能 import 并使用它们 —— 包括枚举变体匹配、结构体构造、字段访问、方法调用；
#      · 而"加一层公开再导出包"那条路**不通**：类型只能被命名，不能被使用
#        （`is an alias to a type in …, which is not imported` / `Cannot define method for foreign type`）。
#    于是：**摊平改名**是唯一可行的搬家方式，本脚本负责这件事（步骤 3.5）。
#
#    「铺开」这一步只能是生成物；真相 = `tools/vendor.lock` 的版本 + `tools/patches/*.patch`。
#
# 基准为什么用注册表版本号而不是 git tag：上游 0.15.x 只有 `rabbita-v0.15.6` 这一个 tag，
#   我们 vendor 的 0.15.4 没有 tag，最近的提交跟注册表那份也差 49 处 —— 能精确钉住的只有注册表制品。
#
# 用法：
#   bash tools/vendor_sync.sh --check      # 验证「vendor/ == pristine + patch + 布局搬家」，不改文件（CI/提交前跑）
#   bash tools/vendor_sync.sh --apply      # 按基准重建第三方代码（新克隆、或升级后）
#   bash tools/vendor_sync.sh --capture    # 把工作区里的改动回写成 patch（改完 fork 代码后必须跑！）
#   bash tools/vendor_sync.sh --from 0.16.0   # 换基准版本试升级（配合 --check 看冲突落在哪）
#
# ⚠️ 第三方目录是 gitignore 的，`git status` 不会提醒你漏了 --capture —— 所以提交前一定跑 --check。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATCHDIR="$ROOT/tools/patches"

# 基准版本（可被 --from 覆盖）
VERSION="$(sed -n 's/^RABBITA_VERSION=//p' "$ROOT/tools/vendor.lock" | tr -d '\r')"
[ -n "$VERSION" ] || { echo "ERROR: tools/vendor.lock 里没有 RABBITA_VERSION"; exit 1; }

MODE="--check"
while [ $# -gt 0 ]; do
  case "$1" in
    --check|--apply|--capture) MODE="$1" ;;
    --from) shift; VERSION="${1:-}" ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
  shift
done

# 我们自己的模块名（从 moon.mod 读，避免写死）
OUR_NAME="$(sed -n 's/^name = "\(.*\)"/\1/p' "$ROOT/moon.mod" | tr -d '\r')"
[ -n "$OUR_NAME" ] || { echo "ERROR: 读不到 moon.mod 的 name"; exit 1; }
UP_NAME="moonbit-community/rabbita"

# fork 的目录（铺在模块根）
# fork 的目录（铺在模块根）。
# ⚠️ `examples/services/todo-server/`（rabbita 的 SSR/HTTP）**有意裁掉**：它是 moonback 与 moonbitlang/x 的唯一使用者，
#    而它自己从没被编译过（声明 native+wasm，我们只跑 js），也没有任何包依赖它。
#    裁掉它 = 发布依赖从 3 个降到 1 个（只剩 moonbitlang/async）。理由见 FORK.md §2.5。
FORK_DIRS="clipboard cmd common dialog dom html http internal js nav sub svg url variant websocket"
# `internal/` 底下的子包 —— 搬家时要**摊平**到 `vendor/rabbita/`（丢掉 `internal` 这一段）
INTERNAL_SUBS="any duplix key rabbita runtime slotmap vdom"
# fork 的根文件（上游把它们放在模块根，我们落到 internal/rabbita/，搬家后就是 vendor/rabbita/rabbita/）
FORK_ROOT_FILES="top.mbt incremental.mbt deprecated.mbt tea.mbt render_test.mbt moon.pkg README.mbt.md"

W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT

echo "== vendor_sync: 基准 $UP_NAME@$VERSION  目标模块 $OUR_NAME"

# ---------------------------------------------------------------- 1) 拉 pristine
printf 'name = "vendor/fetch"\n\nversion = "0.1.0"\n' > "$W/moon.mod"
if ! (cd "$W" && moon add "$UP_NAME@$VERSION" >"$W/add.log" 2>&1); then
  echo "ERROR: 拉取 $UP_NAME@$VERSION 失败："; tail -5 "$W/add.log"; exit 1
fi
PRISTINE="$W/.mooncakes/$UP_NAME"
[ -d "$PRISTINE" ] || { echo "ERROR: 注册表里没有 $PRISTINE"; exit 1; }

# ---------------------------------------------------------------- 2) 铺 BASE（pristine + 布局搬家 + 改名，不打 patch）
mkdir -p "$W/base"
for d in $FORK_DIRS; do cp -r "$PRISTINE/$d" "$W/base/" 2>/dev/null; done
mkdir -p "$W/base/internal/rabbita"
for f in $FORK_ROOT_FILES; do cp "$PRISTINE/$f" "$W/base/internal/rabbita/" 2>/dev/null; done
find "$W/base" -name 'pkg.generated.mbti' -delete
# 行尾统一成 LF（patch 的上下文必须稳定；Windows 上 autocrlf 会让工作区变 CRLF）
find "$W/base" -type f -exec sed -i 's/\r$//' {} +
# 模块名替换（这一步必须在 patch 之前：上游将来新增的文件 patch 覆盖不到，sed 才能全覆盖）
grep -rl "$UP_NAME" "$W/base" 2>/dev/null | xargs -r sed -i "s|$UP_NAME|$OUR_NAME|g"

# ---------------------------------------------------------------- 3) EXPECTED = BASE + patch 系列
cp -r "$W/base" "$W/expected"
if [ "$MODE" != "--capture" ]; then
  for p in "$PATCHDIR"/*.patch; do
    [ -e "$p" ] || continue
    if ! (cd "$W/expected" && patch -p1 --no-backup-if-mismatch --silent < "$p"); then
      echo "ERROR: patch 打不上：$(basename "$p")"
      (cd "$W/expected" && patch -p1 --dry-run < "$p") 2>&1 | head -8
      exit 1
    fi
  done
  find "$W/expected" -name '*.orig' -o -name '*.rej' | head -3
fi

# ---------------------------------------------------------------- 3.5) 布局搬家 → $W/relocated
# 把 expected（旧布局：模块根下铺着 internal/、html/…）搬到最终布局 `vendor/rabbita/`。
# 必须在 patch **之后**做：patch 的 `+++ b/路径` 是按旧布局写的。
# 具体逻辑（摊平 internal/* + 改写 import + 自检）见 tools/vendor_relocate.py。
python3 "$ROOT/tools/vendor_relocate.py" to-vendor   "$W/expected" "$W/relocated" "$OUR_NAME" $FORK_DIRS --internal $INTERNAL_SUBS || exit 1
[ -d "$W/relocated" ] || { echo "ERROR: 布局搬家失败"; exit 1; }

# ---------------------------------------------------------------- 4) 执行模式
case "$MODE" in
  --apply)
    rm -rf "$ROOT/vendor/rabbita"
    mkdir -p "$ROOT/vendor"
    cp -r "$W/relocated" "$ROOT/vendor/rabbita"
    echo "已按 $UP_NAME@$VERSION + $(ls "$PATCHDIR" | wc -l) 个 patch 重建第三方代码 → vendor/rabbita/"
    # 根上的转发包（html/ cmd/ sub/ http/）的名字清单是从 vendor 的 .mbti 生成的 ——
    # 换了 vendor 就必须重跑，否则消费者 import 的 `XiLaiTL/moobile/html` 会缺名字。
    echo "接着跑：python3 tools/gen_forwarders.py    # 重生成根上的转发包"
    # 顺手把整棵树的行尾规范成 LF（含我们自己的文件）
    bash "$ROOT/tools/lf_normalize.sh" | tail -2
    echo "接着跑：moon check --target js && bash tools/check_external.sh && node tools/verify_web.js"
    ;;

  --check)
    # 先查行尾：CRLF 会把 patch 的上下文打乱，必须优先报出来（否则被误读成"内容漂移"）
    if ! bash "$ROOT/tools/lf_normalize.sh" --check > "$W/lf.log" 2>&1; then
      cat "$W/lf.log"
      exit 1
    fi
    # 逐文件比：expected vs 工作区（忽略行尾差异，单独标注）
    PYTHONIOENCODING=utf-8 python3 - "$W/relocated" "$ROOT/vendor/rabbita" ALL "$FORK_ROOT_FILES" <<'PY'
import os,sys
exp,root,dirarg,rootfiles=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4].split()
# 搬家之后整棵 relocated 树就是 vendor/rabbita/ 的内容 —— 不过滤顶层目录
dirs=[] if dirarg=="ALL" else dirarg.split()
only=None if dirarg=="ALL" else set(dirs)
def walk(r, only=None):
    o={}
    for dp,dn,fn in os.walk(r):
        rel=os.path.relpath(dp,r).replace(os.sep,'/')
        top=rel.split('/')[0]
        if only is not None and top not in only: continue
        for f in fn:
            p=os.path.join(dp,f)
            k=os.path.relpath(p,r).replace(os.sep,'/')
            if only is not None and k.split('/')[0] not in only: continue
            o[k]=open(p,'rb').read().replace(b'\r\n',b'\n')
    return o
e=walk(exp, only if only is not None else None)
r=walk(root, only if only is not None else None)
missing=[k for k in sorted(e) if k not in r]
extra=[k for k in sorted(r) if k not in e]
diffc=[k for k in sorted(set(e)&set(r)) if e[k]!=r[k]]
print(f"  期望 {len(e)} 个文件 / 工作区 {len(r)} 个")
if missing: print(f"  [缺] 工作区缺 {len(missing)} 个：{missing[:6]}")
if extra:   print(f"  [多] 工作区多出 {len(extra)} 个（漏了 --capture？）：{extra[:6]}")
if diffc:   print(f"  [异] 内容不同 {len(diffc)} 个：{diffc[:8]}")
if not (missing or extra or diffc):
    print("  [OK] 一致：工作区 == pristine + patch 系列")
    sys.exit(0)
sys.exit(1)
PY
    RC=$?
    if [ $RC -ne 0 ]; then
      echo ""
      echo "有漂移。若你是**有意**改了 fork 代码，跑：bash tools/vendor_sync.sh --capture"
      echo "若是无意的（改了却没留 patch），先把改动挪进 patch 再提交。"
      exit $RC
    fi
    ;;

  --capture)
    # 把工作区相对 BASE 的差异回写成 patch（已有 patch 按原文件名更新，新文件另起编号）
    # ⚠️ patch 是按**旧布局**（`internal/…`、`html/…` 铺在树根）写的，所以先把
    #    工作区的 vendor/rabbita/ 反向搬回去，再照旧 diff —— 否则生成的 patch 打不上 pristine。
    python3 "$ROOT/tools/vendor_relocate.py" to-legacy       "$ROOT/vendor/rabbita" "$W/ws_pre" "$OUR_NAME" $FORK_DIRS --internal $INTERNAL_SUBS || exit 1
    PYTHONIOENCODING=utf-8 python3 - "$W/base" "$W/ws_pre" "$PATCHDIR" "$FORK_DIRS" "$OUR_NAME" <<'PY'
import os,sys,subprocess,difflib,re
base,root,pdir,dirs,ourname=sys.argv[1],sys.argv[2],sys.argv[3],set(sys.argv[4].split()),sys.argv[5]
def walk(r):
    o={}
    for dp,dn,fn in os.walk(r):
        for f in fn:
            p=os.path.join(dp,f); k=os.path.relpath(p,r).replace(os.sep,'/')
            if k.split('/')[0] in dirs: o[k]=p
    return o
b,w=walk(base),walk(root)
# 已有 patch 覆盖哪些路径
covered={}
for name in sorted(os.listdir(pdir)):
    if not name.endswith('.patch'): continue
    txt=open(os.path.join(pdir,name),encoding='utf-8').read()
    for m in re.finditer(r'^\+\+\+ b/(.+)$', txt, re.M): covered[m.group(1)]=name
changed=[k for k in sorted(w) if k in b and open(b[k],'rb').read().replace(b'\r\n',b'\n')!=open(w[k],'rb').read().replace(b'\r\n',b'\n')]
added=[k for k in sorted(w) if k not in b]
def mkpatch(rel, oldpath, newpath, name):
    a=open(oldpath,'rb').read().replace(b'\r\n',b'\n').decode('utf-8','replace').splitlines(keepends=True) if oldpath else []
    c=open(newpath,'rb').read().replace(b'\r\n',b'\n').decode('utf-8','replace').splitlines(keepends=True)
    d=list(difflib.unified_diff(a,c,fromfile=('a/'+rel) if oldpath else '/dev/null',tofile='b/'+rel,n=3))
    open(os.path.join(pdir,name),'w',encoding='utf-8',newline='').write(''.join(d))
n=len([x for x in os.listdir(pdir) if x.endswith('.patch')])
nxt=max([int(x[:2]) for x in os.listdir(pdir) if x.endswith('.patch') and x[:2].isdigit()] or [0])
for rel in changed:
    name=covered.get(rel)
    if name: mkpatch(rel, b[rel], w[rel], name); print("  更新", name, "<-", rel)
    else:
        nxt+=1; name=f"{nxt:02d}-new-{rel.replace('/','-')}.patch"; mkpatch(rel,b[rel],w[rel],name); print("  新建", name)
for rel in added:
    name=covered.get(rel)
    if name: mkpatch(rel, None, w[rel], name); print("  更新(新增)", name)
    else:
        nxt+=1; name=f"{nxt:02d}-new-{rel.replace('/','-')}.patch"; mkpatch(rel,None,w[rel],name); print("  新建", name)
print(f"  capture 完成：改动 {len(changed)} 个、新增 {len(added)} 个")
PY
    echo "接着跑：bash tools/vendor_sync.sh --check 确认一致"
    ;;
esac
