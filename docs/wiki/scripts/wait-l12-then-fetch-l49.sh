#!/usr/bin/env bash
# L1/L2 バッチ12完了を待ってから 4〜9弾取得を開始
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
LOG="docs/wiki/sources/atwiki/fetch-log.txt"

echo "Waiting for L1/L2 batch12 to finish..."
while ! grep -q "manifest-batch12-l12-RS-121-RS-122.json finished" "$LOG" 2>/dev/null; do
  sleep 30
done
echo "L1/L2 complete. Starting 4-9弾 fetch..."
chmod +x docs/wiki/scripts/fetch-legend49-batches.sh
docs/wiki/scripts/fetch-legend49-batches.sh
