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
#
# 扫描内核是 **MoonBit 写的** `tools/mbtools/src/cr_scan.mbt`（子命令 `cr-scan`），
# 经 `tools/mb.sh` 调用。白名单、排除目录、判据都在那边（单一实现）。
#
# ## 性能这一路是怎么走过来的（都是实测）
#
#   · 最早：`has_cr() { [ "$(tr -cd '\r' < "$1" | wc -c)" -gt 0 ]; }` —— 对每个候选文件
#     起两个进程。Windows 上每次 spawn 几十毫秒 → **单这一项 260 秒**，
#     而 `vendor_sync.sh --check` 内部还会再调一次本脚本，`verify_all.sh` 全程 ≈ 9 分钟。
#   · 中间试过 `grep -lU $'\r'`：**快（0.19s）但是坏的** —— 本机 Git Bash（MSYS）会把
#     命令行参数里的裸 CR 弄坏，对一个 0 个 CR 的仓库报出 **2537 个假阳性**。
#   · 然后：Python 一次进程按字节扫（~1s），并加了"候选文件数"输出 ——
#     一个"什么都没查"的检查同样会报通过，这个数字是它真在查东西的证据。
#   · 现在：MoonBit 版，实测 ~0.3s（含 `moon run` 的构建新鲜度检查）。
#
# ⚠️ **检查工具本身必须能被证伪**：换实现后一定要塞一个 CRLF 诱饵文件，
#    确认它点名 + 非零退出；再跑 apply 确认真的改成了 LF。历史上有两次"检查看起来
#    没问题其实什么都没查"（见 `docs/FINDINGS.md` R6/R7）。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-apply}"

case "$MODE" in
  --check) SCANMODE=check ;;
  apply|"") SCANMODE=fix ;;
  *) echo "未知参数: $MODE（用法：lf_normalize.sh [--check]）"; exit 2 ;;
esac

if [ "$SCANMODE" = "check" ]; then
  if bash "$ROOT/tools/mb.sh" cr-scan --root "$ROOT" --mode check; then
    echo "行尾检查通过：没有带 CR 的文本文件。"
    exit 0
  fi
  echo "发现带 CR 的文本文件（见上）。跑 bash tools/lf_normalize.sh 修掉。"
  echo "（修完记得跑 bash tools/vendor_sync.sh --check —— patch 的上下文会被 CRLF 打乱）"
  exit 1
fi

bash "$ROOT/tools/mb.sh" cr-scan --root "$ROOT" --mode fix || exit 1
echo "（若上面没有列出文件，说明所有文本文件已是 LF。）"
echo "建议接着跑：bash tools/vendor_sync.sh --check"
