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
#   bash tools/lf_normalize.sh            # 就地转成 LF（只动文本文件）
#   bash tools/lf_normalize.sh --check    # 只报告哪些文件带 CR，退出码非 0 表示有
#
# ⚠️ 只处理**文本扩展名白名单**，二进制（png/zip/apk/…）一律不碰。
#    白名单与排除目录、以及扫描逻辑，都在 `tools/cr_scan.py` 里（单一实现）。
#
# 为什么要独立成 Python 进程（性能，实测数据）：
#   原写法是 `has_cr() { [ "$(tr -cd '\r' < "$1" | wc -c)" -gt 0 ]; }`，
#   对每个候选文件起两个进程。本仓 ~2500 个候选文件 = ~5000 次 spawn，
#   Windows 上每次几十毫秒 → **单这一项 260 秒**（verify_all.sh 因此要跑 9 分钟，
#   而 vendor_sync.sh --check 内部还会再调一次本脚本，等于跑两遍）。
#   改成一次进程扫完：**1 秒**，快 ~260 倍。
#
# ⚠️ 也别改回 `grep -rlU $'\r'`：本机 Git Bash（MSYS）会把命令行参数里的裸 CR 弄坏，
#   实测对一个 0 个 CR 的仓库报出 **2537 个假阳性**（而且它"很快"——
#   因为匹配了所有文件）。**检查工具本身必须能被证伪**：换写法后一定要拿
#   `python3 tools/cr_scan.py --root . --mode check` 的候选数对账，
#   确认它真的在查东西，而不是永远说"通过"。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-apply}"

case "$MODE" in
  --check) SCANMODE=check ;;
  apply|"") SCANMODE=fix ;;
  *) echo "未知参数: $MODE（用法：lf_normalize.sh [--check]）"; exit 2 ;;
esac

if [ "$SCANMODE" = "check" ]; then
  if python3 "$ROOT/tools/cr_scan.py" --root "$ROOT" --mode check; then
    echo "行尾检查通过：没有带 CR 的文本文件。"
    exit 0
  fi
  echo "发现带 CR 的文本文件（见上）。跑 bash tools/lf_normalize.sh 修掉。"
  echo "（修完记得跑 bash tools/vendor_sync.sh --check —— patch 的上下文会被 CRLF 打乱）"
  exit 1
fi

python3 "$ROOT/tools/cr_scan.py" --root "$ROOT" --mode fix || exit 1
echo "（若上面没有列出文件，说明所有文本文件已是 LF。）"
echo "建议接着跑：bash tools/vendor_sync.sh --check"
