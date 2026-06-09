#!/usr/bin/env bash
# 4〜9弾バッチ38完了を待ってからベルト+ライダーEXP取得
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
LOG="docs/wiki/sources/atwiki/fetch-log.txt"

echo "Waiting for 4-9弾 batch38 to finish..."
while ! grep -q "manifest-batch38-l49-RS-679-RS-690.json finished" "$LOG" 2>/dev/null; do
  sleep 60
done
echo "4-9弾 complete. Starting rider-belt fetch..."
chmod +x docs/wiki/scripts/fetch-rider-belt-batches.sh
docs/wiki/scripts/fetch-rider-belt-batches.sh
