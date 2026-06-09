#!/usr/bin/env bash
# スペシャルメタルエディション取得（バッチ59〜62）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

PAGES="packages/cards/src/metal-edition-atwiki-pages.json"
if [[ ! -f "$PAGES" ]]; then
  echo "=== discover + stubs ==="
  node docs/wiki/scripts/discover-metal-edition-atwiki-pages.mjs
  node docs/wiki/scripts/generate-metal-edition-stubs.mjs
else
  echo "=== using existing $PAGES (skip discover) ==="
fi

shopt -s nullglob
ME_MANIFESTS=(docs/wiki/sources/atwiki/manifest-batch*-me-*.json)
if [[ ${#ME_MANIFESTS[@]} -eq 0 ]]; then
  TOTAL=$(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$PAGES','utf8'))).length)")
  BATCH_SIZE=20
  BATCHES=$(( (TOTAL + BATCH_SIZE - 1) / BATCH_SIZE ))
  echo "=== build $BATCHES manifests ==="
  for ((i=0; i<BATCHES; i++)); do
    node docs/wiki/scripts/build-metal-edition-manifest.mjs "$i" "$BATCH_SIZE"
  done
  ME_MANIFESTS=(docs/wiki/sources/atwiki/manifest-batch*-me-*.json)
fi

MANIFESTS=("${ME_MANIFESTS[@]}")
for m in "${MANIFESTS[@]}"; do
  echo "=== $(basename "$m") ==="
  node docs/wiki/scripts/fetch-atwiki-batch.mjs "$(basename "$m")"
done

echo "=== sync cards ==="
node docs/wiki/scripts/sync-cards-from-atwiki.mjs
echo "=== metal-edition done ==="
