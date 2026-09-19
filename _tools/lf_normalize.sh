#!/usr/bin/env bash
# lf_normalize.sh —— 行尾预处理：把文本文件统一成 LF。
#
# 为什么需要它（三条都是实际会踩的）：
#   1. patch 的上下文行一旦是 CRLF，`patch -p1` 就贴不上 —— vendor_sync.sh 会把
#      铺开的 pristine 规范成 LF，两边就对不上了。
#   2. 本机全局 `core.autocrlf=true`：某个 clone 若没吃到 .gitattributes（或有人在
#      clone 之后改了属性），检出内容就会带 CRLF。
#   3. Windows 编辑器（记事本、部分 IDE 默认设置）会把改过的文件写回 CRLF。
# `.gitattributes` 能防住"检出"，防不住"别人写回来"，所以要有这条能主动修的路径。
#
# 用法：
#   bash _tools/lf_normalize.sh            # 就地转成 LF（只动文本文件）
#   bash _tools/lf_normalize.sh --check    # 只报告哪些文件带 CR，退出码非 0 表示有
#
# ⚠️ 只处理**文本扩展名白名单**，二进制（png/zip/apk/…）一律不碰。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-apply}"

# 文本扩展名白名单（含无扩展名的特例）
EXTS="mbt mbti md json js jsx ts sh ps1 py txt pkg mod patch yml yaml toml css html xml gradle properties lock gitignore moonignore gitattributes"

# 不进的目录（生成物/依赖/构建产物）
PRUNE="-path $ROOT/.git -o -path $ROOT/_build -o -path $ROOT/.mooncakes -o -path $ROOT/host/node_modules -o -path $ROOT/host/android -o -path $ROOT/host/dist -o -path $ROOT/host/.expo -o -path $ROOT/vendor"

has_cr() { [ "$(tr -cd '\r' < "$1" 2>/dev/null | wc -c)" -gt 0 ]; }

files=0
while IFS= read -r f; do
  base="$(basename "$f")"
  ext="${base##*.}"
  # 无扩展名的文件（.gitignore / .moonignore / .gitattributes 有扩展名形式；moon.pkg 有 .pkg）
  case "$base" in .gitignore|.moonignore|.gitattributes) ext="${base#.}";; esac
  matched=0
  for e in $EXTS; do [ "$ext" = "$e" ] && matched=1 && break; done
  [ "$matched" = 1 ] || continue
  has_cr "$f" || continue
  files=$((files + 1))
  if [ "$MODE" = "--check" ]; then
    printf '  [CR] %s\n' "${f#$ROOT/}"
  else
    sed -i 's/\r$//' "$f"
    printf '  已转 LF: %s\n' "${f#$ROOT/}"
  fi
done < <(find "$ROOT" \( $PRUNE \) -prune -o -type f -print 2>/dev/null)

if [ "$MODE" = "--check" ]; then
  if [ "$files" -eq 0 ]; then
    echo "行尾检查通过：没有带 CR 的文本文件。"
    exit 0
  fi
  echo "发现 $files 个带 CR 的文本文件。跑 bash _tools/lf_normalize.sh 修掉。"
  echo "（修完记得跑 bash _tools/vendor_sync.sh --check —— patch 的上下文会被 CRLF 打乱）"
  exit 1
fi

if [ "$files" -eq 0 ]; then
  echo "无需修改：所有文本文件已是 LF。"
else
  echo "已转 $files 个文件。建议接着跑：bash _tools/vendor_sync.sh --check"
fi
