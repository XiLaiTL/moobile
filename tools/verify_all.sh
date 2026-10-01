#!/usr/bin/env bash
# verify_all.sh —— **一条命令跑完全部离线检查**（PLAN 的 C2）。
#
#   bash tools/verify_all.sh              # 离线四连（不需要 Metro / 模拟器 / 后端）
#   bash tools/verify_all.sh --with-e2e   # 再加 Web 端到端三门（需要 Metro 在 8081、后端在 8787）
#
# 为什么要有这个入口：这些检查散在四个脚本里，改完代码**记不住全跑**；
# 而其中任何一个单跑都很快，一起跑也就几十秒。CI（C3）接的也是这个入口。
#
# 与"端到端"的分工：
#   · 离线检查（本脚本默认）—— 编译、行尾、vendor 一致性、外部模块可用性、注册表一致性。
#     **不依赖**浏览器、模拟器、后端，所以 CI 上能跑。
#   · 端到端（`--with-e2e`）—— 真浏览器 + CDP 驱动 UI/本地库/同步；真机另跑
#     `python3 tools/verify_android.py`（需要模拟器，不进 CI）。

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WITH_E2E=0
[ "${1:-}" = "--with-e2e" ] && WITH_E2E=1

LOGDIR="$(mktemp -d)"
trap 'rm -rf "$LOGDIR"' EXIT

PASS=0
FAIL=0
SKIP=0
declare -a LINES

run() { # run <名字> <命令...>
  local name="$1"; shift
  local log="$LOGDIR/$(echo "$name" | tr -c 'A-Za-z0-9' '_').log"
  if "$@" >"$log" 2>&1; then
    PASS=$((PASS + 1))
    LINES+=("PASS  $name")
    printf 'PASS  %s\n' "$name"
  else
    FAIL=$((FAIL + 1))
    LINES+=("FAIL  $name  (日志 ${log})")
    printf 'FAIL  %s\n' "$name"
    printf '      ---- 末尾 12 行 ----\n'
    tail -12 "$log" | sed 's/^/      /'
  fi
}

skip() {
  SKIP=$((SKIP + 1))
  LINES+=("SKIP  $1（$2）")
  printf 'SKIP  %s（%s）\n' "$1" "$2"
}

cd "$ROOT"

echo "== 离线检查 =="
run "moon check --target js" moon check --target js
run "行尾规范（lf_normalize --check）" bash tools/lf_normalize.sh --check
# 文档搬家最容易留下的坑：相对链接静默失效（GitHub 上 404，本地看不出来）
run "文档相对链接（check_links）" python3 tools/check_links.py --quiet
# 公开泄漏：本机绝对路径 / 凭据（README 曾把本机路径带进发布包，所以这条必须有）
run "公开内容无本机路径与凭据（check_public_leaks）" python3 tools/check_public_leaks.py --quiet
run "vendor 一致性（vendor_sync --check）" bash tools/vendor_sync.sh --check
run "外部模块可用性（check_external）" bash tools/check_external.sh

# 转发包（根上的 html/ cmd/ sub/ http/）是从 vendor 的 .mbti **生成**的，生成物入库 → 能 diff。
# 改了 vendor/rabbita/** 或升级 fork 之后忘了重跑生成器，就会在这里红。
run "转发包与 mbti 一致（gen_forwarders --check）" python3 tools/gen_forwarders.py --check

# 能力注册表与依赖是否仍一致（生成物是入库的，所以能 diff）
if [ -d "$ROOT/examples/apps/todo-app/host/node_modules/moobile-host" ]; then
  # ⚠️ 不要用 `( cd … && run … )`：run 里改的 PASS/FAIL 落在**子 shell**，
  #    父进程的计数会少一个（第一版就这么漏掉了这项，汇总显示 4 而实际过了 5）。
  run "能力注册表一致性（moobile-host regen --check）" \
    bash -c "cd '$ROOT/examples/apps/todo-app/host' && npx moobile-host regen --check"
else
  skip "能力注册表一致性（moobile-host regen --check）" "examples/apps/todo-app/host/node_modules 里没装 moobile-host"
fi

if [ "$WITH_E2E" = "1" ]; then
  echo
  echo "== 端到端（Web）=="
  mcode="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8081 || true)"
  acode="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/health || true)"
  if [ "$mcode" = "200" ]; then
    run "Web UI 27 项（tools/verify_web.js）" node tools/verify_web.js
    run "本地库 8 项（db_probe.js）" node tools/db_probe.js
    if [ "$acode" = "200" ]; then
      run "同步 14 项（sync_probe.js）" node tools/sync_probe.js
    else
      skip "同步 14 项（sync_probe.js）" "后端不在 8787（cd server && moon build --target native && ./_build/native/debug/build/moobile-todo-server.exe）"
    fi
  else
    skip "Web UI 27 项（tools/verify_web.js）" "Metro 不在 8081（cd host && npx expo start --port 8081）"
    skip "本地库 8 项（db_probe.js）" "Metro 不在 8081"
    skip "同步 14 项（sync_probe.js）" "Metro 不在 8081"
  fi
  echo
  echo "提示：真机那套不进这个入口（需要模拟器 + APK）——"
  echo "      python3 tools/verify_android.py        # 真机 21 项"
  echo "      bash tools/check_published.sh          # 已发布版本可用性（发版后跑）"
fi

echo
echo "================ 汇总 ================"
printf '通过 %d  失败 %d  跳过 %d\n' "$PASS" "$FAIL" "$SKIP"
for l in "${LINES[@]}"; do echo "  $l"; done

[ "$FAIL" = "0" ]
