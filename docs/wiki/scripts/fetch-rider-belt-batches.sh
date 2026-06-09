#!/usr/bin/env bash
# ベルトコレクション + マスクドライダーEXP vol.1〜4 取得（バッチ39〜56）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

PAGES="packages/cards/src/rider-belt-atwiki-pages.json"
if [[ ! -f "$PAGES" ]]; then
  echo "=== discover + stubs ==="
  node docs/wiki/scripts/discover-rider-belt-atwiki-pages.mjs
  node docs/wiki/scripts/generate-rider-belt-stubs.mjs
else
  echo "=== using existing $PAGES (skip discover) ==="
fi

shopt -s nullglob
MANIFESTS=(docs/wiki/sources/atwiki/manifest-batch*-rb-*.json)
for m in "${MANIFESTS[@]}"; do
  echo "=== $(basename "$m") ==="
  node docs/wiki/scripts/fetch-atwiki-batch.mjs "$(basename "$m")"
done

echo "=== sync cards ==="
node docs/wiki/scripts/sync-cards-from-atwiki.mjs
echo "=== rider-belt done ==="
