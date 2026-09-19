#!/usr/bin/env bash
# vendor_sync.sh —— 生成式 vendor：第三方代码（rabbita fork）不进仓，靠「版本 + patch 系列」重建。
#
# 为什么这么做：MoonBit 的 `internal` 可见性按**包路径前缀**判，所以 fork 必须铺在模块根
#   （放 `vendor/` 子目录的话，`vendor/rabbita/internal/*` 对模块根包不可见 —— 实测报
#    `Cannot import internal package … due to internal visibility rules`）。
#   于是「铺开」这一步只能是生成物；真相 = `_tools/vendor.lock` 的版本 + `_tools/patches/*.patch`。
#
# 基准为什么用注册表版本号而不是 git tag：上游 0.15.x 只有 `rabbita-v0.15.6` 这一个 tag，
#   我们 vendor 的 0.15.4 没有 tag，最近的提交跟注册表那份也差 49 处 —— 能精确钉住的只有注册表制品。
#
# 用法：
#   bash _tools/vendor_sync.sh --check      # 只验证「树 == pristine + patch」，不改任何文件（CI/提交前跑）
#   bash _tools/vendor_sync.sh --apply      # 按基准重建第三方代码（新克隆、或升级后）
#   bash _tools/vendor_sync.sh --capture    # 把工作区里的改动回写成 patch（改完 fork 代码后必须跑！）
#   bash _tools/vendor_sync.sh --from 0.16.0   # 换基准版本试升级（配合 --check 看冲突落在哪）
#
# ⚠️ 第三方目录是 gitignore 的，`git status` 不会提醒你漏了 --capture —— 所以提交前一定跑 --check。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PATCHDIR="$ROOT/_tools/patches"

# 基准版本（可被 --from 覆盖）
VERSION="$(sed -n 's/^RABBITA_VERSION=//p' "$ROOT/_tools/vendor.lock" | tr -d '\r')"
[ -n "$VERSION" ] || { echo "ERROR: _tools/vendor.lock 里没有 RABBITA_VERSION"; exit 1; }

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
FORK_DIRS="clipboard cmd common dialog dom html http internal js nav server sub svg url variant websocket"
# fork 的根文件（我们自己占用了模块根，所以它们落到 internal/rabbita/）
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

# ---------------------------------------------------------------- 4) 执行模式
case "$MODE" in
  --apply)
    for d in $FORK_DIRS; do
      rm -rf "$ROOT/$d"
      cp -r "$W/expected/$d" "$ROOT/"
    done
    # internal/rabbita 也在 internal 里，跟着上面一起铺好了
    echo "已按 $UP_NAME@$VERSION + $(ls "$PATCHDIR" | wc -l) 个 patch 重建第三方代码。"
    # 顺手把整棵树的行尾规范成 LF（含我们自己的文件）
    bash "$ROOT/_tools/lf_normalize.sh" | tail -2
    echo "接着跑：moon check --target js && bash _tools/check_external.sh && node _verify.js"
    ;;

  --check)
    # 先查行尾：CRLF 会把 patch 的上下文打乱，必须优先报出来（否则被误读成"内容漂移"）
    if ! bash "$ROOT/_tools/lf_normalize.sh" --check > "$W/lf.log" 2>&1; then
      cat "$W/lf.log"
      exit 1
    fi
    # 逐文件比：expected vs 工作区（忽略行尾差异，单独标注）
    PYTHONIOENCODING=utf-8 python3 - "$W/expected" "$ROOT" "$FORK_DIRS" "$FORK_ROOT_FILES" <<'PY'
import os,sys
exp,root,dirs,rootfiles=sys.argv[1],sys.argv[2],sys.argv[3].split(),sys.argv[4].split()
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
e=walk(exp, set(dirs))
r=walk(root, set(dirs))
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
      echo "有漂移。若你是**有意**改了 fork 代码，跑：bash _tools/vendor_sync.sh --capture"
      echo "若是无意的（改了却没留 patch），先把改动挪进 patch 再提交。"
      exit $RC
    fi
    ;;

  --capture)
    # 把工作区相对 BASE 的差异回写成 patch（已有 patch 按原文件名更新，新文件另起编号）
    PYTHONIOENCODING=utf-8 python3 - "$W/base" "$ROOT" "$PATCHDIR" "$FORK_DIRS" "$OUR_NAME" <<'PY'
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
    echo "接着跑：bash _tools/vendor_sync.sh --check 确认一致"
    ;;
esac
