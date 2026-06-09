#!/usr/bin/env bash
# L1/L2 カード atwiki 取得（バッチ6〜12、逐次実行）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
for m in \
  manifest-batch6-l12-RS-001-RS-020.json \
  manifest-batch7-l12-RS-021-RS-040.json \
  manifest-batch8-l12-RS-041-RS-060.json \
  manifest-batch9-l12-RS-061-RS-080.json \
  manifest-batch10-l12-RS-081-RS-100.json \
  manifest-batch11-l12-RS-101-RS-120.json \
  manifest-batch12-l12-RS-121-RS-122.json
do
  echo "=== $m ==="
  node docs/wiki/scripts/fetch-atwiki-batch.mjs "$m"
done
echo "=== sync cards ==="
node docs/wiki/scripts/sync-cards-from-atwiki.mjs
echo "=== L1/L2 done ==="
