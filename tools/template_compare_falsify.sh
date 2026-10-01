#!/usr/bin/env bash
# template_compare_falsify.sh —— 证伪 T1 门本身（**手动跑，不进 verify_all**）。
#
#   bash tools/template_compare_falsify.sh
#
# 规矩来自 docs/FINDINGS.md：**新闸门必须能被证伪**。分两类用例：
#   red    —— 塞一处"清单外的差异"，门**必须**红（否则门是摆设）
#   green  —— 塞一处"清单里已登记的差异"，门**不许**红（否则门会逼人删真条目）
#
# 为什么它**不**进 verify_all：它会**临时改工作区里真实的文件**（模板与 demo），跑完再还原。
# 一条"每次跑都改源码"的门不适合放进日常入口 —— 但它必须在"改了比对器或清单之后"手动跑一次，
# 否则你没法回答"我是不是把门改瞎了"。
#
# 安全措施（两条，缺一不可）：
#   · 每个用例先备份、再改、跑完立刻还原；
#   · `trap` 保证**被 Ctrl-C 打断也会还原**（不然证伪会把工作区改坏，而你以为是门红了）。
# 最后还会逐文件 `cmp` 校验"确实还原了"——工具的产出要能自证。

set -uo pipefail
cd "$(dirname "$0")/.."

TPL=examples/apps/template
DEMO=examples/apps/todo-app
DELTAS=tools/template/deltas.txt
BAK="$(mktemp -d)"

# 会碰到的文件（还原范围就是它）—— trap 与末尾校验共用
TOUCHED=(
  "$TPL/package.json"
  "$TPL/moon.pkg"
  "$TPL/App.js"
  "$TPL/app.json"
  "$DEMO/host/.gitignore"
  "$DELTAS"
)
PROBE="$DEMO/host/PROBE_EXTRA.txt"

bak_of() { echo "$BAK/$(echo "$1" | tr '/' '_')"; }

restore_all() {
  for f in "${TOUCHED[@]}"; do
    b="$(bak_of "$f")"
    [ -f "$b" ] && cp "$b" "$f"
  done
  rm -f "$PROBE"
}
trap 'restore_all' EXIT INT TERM

for f in "${TOUCHED[@]}"; do cp "$f" "$(bak_of "$f")"; done

PASS=0
FAIL=0

# run_case <名字> <期望 red|green> <输出里必须出现的字样>
run_case() {
  local name="$1" want="$2" needle="${3:-}"
  local out rc ok=1 why=""
  out="$(node tools/template_compare.mjs 2>&1)"
  rc=$?
  if [ "$want" = red ] && [ "$rc" -eq 0 ]; then ok=0; why="门**没有**红（rc=0）"; fi
  if [ "$want" = green ] && [ "$rc" -ne 0 ]; then ok=0; why="门红了（rc=$rc，期望绿）"; fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -q -- "$needle"; then
    ok=0; why="$why；输出里没出现「$needle」"
  fi
  if [ "$ok" = 1 ]; then
    PASS=$((PASS + 1)); printf 'PASS  %-44s 期望 %s ✓\n' "$name" "$want"
  else
    FAIL=$((FAIL + 1)); printf 'FAIL  %-44s 期望 %s —— %s\n' "$name" "$want" "$why"
    printf '%s\n' "$out" | tail -12 | sed 's/^/      /'
  fi
}

echo "== 基线（什么都没塞时必须是绿的）=="
run_case "基线：清单与两侧一致" green "失败 0"

echo
# probe_case <名字> <文件> <sed 表达式> <塞进去后文件里该出现的字样> <期望 red|green> <输出里该出现的字样>
#
# ⚠️ 为什么要有 `landed` 这一环（**这条踩过**）：第一版的 sed 模式写漏了一个前缀，
#    探针根本没塞进去，而报出来的是"门**没有**红" —— 看着像门坏了，其实是**假证伪**
#    （FINDINGS 里记过同一个坑：拿错的样本跑出了 ✅ 通过）。
#    所以"探针真的落进去了"必须自己先验一遍：工具的产出要能自证。
probe_case() {
  local name="$1" file="$2" expr="$3" landed="$4" want="$5" needle="$6"
  sed -i "$expr" "$file"
  if ! grep -q -- "$landed" "$file"; then
    FAIL=$((FAIL + 1))
    printf 'FAIL  %-44s 探针没塞进去（sed 没匹配上 %s）—— 不是门的错，是脚本的错\n' "$name" "$file"
    restore_all
    return
  fi
  run_case "$name" "$want" "$needle"
  restore_all
}

echo "== 该红的：清单外的差异 =="

# 1) demo 多出一个文件（这个不用 sed，直接写文件）
printf 'probe\n' > "$PROBE"
run_case "demo 多出一个未登记的文件" red "PROBE_EXTRA.txt"
rm -f "$PROBE"

# 2) 模板改了"没登记的键"（react-native 的版本不在清单里）
probe_case "模板改了共享依赖的版本（未登记的键）" "$TPL/package.json" \
  's/"react-native": "0.86.3"/"react-native": "0.86.4"/' '"0.86.4"' red "dependencies.react-native"

# 3) 模板多一条 demo 没有的 import → demo 只许多、不许少
probe_case "模板多一条 demo 没有的 import" "$TPL/moon.pkg" \
  's|"XiLaiTL/moobile/vendor/rabbita/sub" @sub,|"XiLaiTL/moobile/vendor/rabbita/sub" @sub,\n  "XiLaiTL/moobile/probe_capability" @probe,|' \
  'probe_capability' red "probe_capability"

# 4) 模板改了 App.js 的**代码**（清单说这里只有注释不同）
probe_case "模板改了 App.js 的代码（清单说只有注释不同）" "$TPL/App.js" \
  's|mountApp(app, { registry });|mountApp(app, { registry, probe: true });|' 'probe: true' red "App.js"

# 5) 模板改了 app.json 里没登记的字段（orientation 不在清单里）
probe_case "模板改了 app.json 的未登记字段" "$TPL/app.json" \
  's/"orientation": "portrait"/"orientation": "landscape"/' 'landscape' red "app.json"

echo
echo "== 不许红的：清单里已经登记的差异 =="

printf '\n# probe\n' >> "$DEMO/host/.gitignore"
# 6) `.gitignore` 在清单里是"整份文件允许不同"（最弱的一档）→ **不该**红。
#    记下来：这一档是门**有意**放过的，不是门漏了（这也是"清单要写准"的原因）。
run_case "demo 改 .gitignore（清单登记为整份文件）" green ""
restore_all

printf 'file-extra    | PROBE_GHOST.mbt | 证伪用：这个文件根本不存在\n' >> "$DELTAS"
# 7) 死条目**不弄红**，但必须点名 —— 红的意思是"有清单外的漂移"，
#    而"清单该删一行"是另一件事（弄红会诱人去删真条目）。
run_case "清单里的死条目（不弄红，但要点名）" green "PROBE_GHOST.mbt"
restore_all

echo
echo '== 还原校验（逐文件 cmp，不是"我记得还原了"）=='
for f in "${TOUCHED[@]}"; do
  if cmp -s "$(bak_of "$f")" "$f"; then echo "  还原 OK  $f"; else echo "  !! 没还原  $f"; FAIL=$((FAIL + 1)); fi
done
[ -e "$PROBE" ] && { echo "  !! 探针文件还在：$PROBE"; FAIL=$((FAIL + 1)); }

rm -rf "$BAK"
trap - EXIT INT TERM

echo
echo "================ 证伪汇总 ================"
printf '用例通过 %d  失败 %d\n' "$PASS" "$FAIL"
[ "$FAIL" = 0 ]
