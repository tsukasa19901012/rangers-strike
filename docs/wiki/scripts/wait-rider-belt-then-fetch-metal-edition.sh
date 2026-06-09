#!/usr/bin/env bash
# ベルト+EXP 取得完了を待ってからメタルエディション取得
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

LOG="docs/wiki/sources/atwiki/fetch-log.txt"
TARGET="=== batch manifest-batch56-rb-RK-319-SK-004.json finished"

echo "=== waiting for rider-belt fetch ==="
while true; do
  if grep -qF "$TARGET" "$LOG" 2>/dev/null; then
    echo "rider-belt complete (batch56 finished)"
    break
  fi
  if ! pgrep -f "fetch-rider-belt-batches.sh" >/dev/null 2>&1; then
    echo "rider-belt process ended (batch56 not confirmed — continuing)"
    break
  fi
  sleep 30
done

docs/wiki/scripts/fetch-metal-edition-batches.sh
