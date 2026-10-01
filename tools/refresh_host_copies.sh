#!/usr/bin/env bash
# refresh_host_copies.sh -- reinstall the `moobile-host` copy inside EVERY app that has one.
#
#   bash tools/refresh_host_copies.sh
#
# WHY THIS EXISTS (measured 2026-10-01)
#   Applications depend on the host package through a `file:` spec, so npm COPIES it into
#   `<app>/node_modules/moobile-host`. There are 7 such copies in this repo. Every edit to
#   `npm/moobile-host/**` therefore leaves 7 stale copies behind, and a stale copy is not a
#   cosmetic problem:
#     * `check_npm_fresh` (an offline gate) goes red -- correct, but the fix is 7 slow
#       `npm install` runs that are easy to do half-way;
#     * worse, a STALE COPY SILENTLY TESTS THE OLD CODE. That actually happened: the
#       `gesture-spike` copy was old, so a whole round of "boundary" probes measured the
#       previous implementation and produced three conclusions about code we had already
#       replaced. The tell was that two runs produced byte-identical output.
#   So: after touching the host package, run this; then `node tools/check_npm_fresh.mjs`.
#
# It discovers the copies the same way the gate does (so the two cannot drift apart):
#   examples/apps/<app>/node_modules/moobile-host
#   examples/apps/<app>/host/node_modules/moobile-host

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

DIRS=()
for app in examples/apps/*/; do
  for rel in "node_modules/moobile-host" "host/node_modules/moobile-host"; do
    if [ -d "${app}${rel}" ]; then
      # The directory that holds package.json is TWO levels up from the copy:
      #   <here>/node_modules/moobile-host  ->  dirname twice == <here>
      # ⚠️ Taking only ONE dirname lands on `node_modules` itself. That "works" by accident
      #    (npm walks upward looking for package.json / node_modules and finds the real
      #    project), which is exactly the kind of accidental success that breaks later.
      DIRS+=("$(dirname "$(dirname "${app}${rel}")")")
    fi
  done
done

if [ "${#DIRS[@]}" -eq 0 ]; then
  echo "refresh_host_copies: 一个副本都没找到（应用都还没 npm install？）" >&2
  exit 2
fi

fail=0
for d in "${DIRS[@]}"; do
  printf '%-46s ' "${d#"$ROOT"/}"
  if (cd "$d" && rm -rf node_modules/moobile-host && npm install --no-audit --no-fund >/tmp/refresh_host_copy.log 2>&1); then
    echo "ok"
  else
    echo "FAIL"
    tail -5 /tmp/refresh_host_copy.log
    fail=1
  fi
done

echo
if [ "$fail" -ne 0 ]; then
  echo "refresh_host_copies: 有副本没刷新成功，别急着往下走。" >&2
  exit 1
fi
node tools/check_npm_fresh.mjs
