#!/usr/bin/env bash
# 4〜9弾カード atwiki 取得（バッチ13〜38、逐次実行）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

echo "=== discover + stubs ==="
node docs/wiki/scripts/discover-legend49-atwiki-pages.mjs
node docs/wiki/scripts/generate-card-stubs.mjs

MANIFESTS=(docs/wiki/sources/atwiki/manifest-batch*-l49-*.json)
for m in "${MANIFESTS[@]}"; do
  echo "=== $(basename "$m") ==="
  node docs/wiki/scripts/fetch-atwiki-batch.mjs "$(basename "$m")"
done

echo "=== sync cards ==="
node docs/wiki/scripts/sync-cards-from-atwiki.mjs
echo "=== legend49 done ==="
