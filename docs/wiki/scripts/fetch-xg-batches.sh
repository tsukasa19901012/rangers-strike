#!/usr/bin/env bash
# クロスギャザー XG1〜XG7 取得（batch70〜）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

PAGES="packages/cards/src/xg-atwiki-pages.json"
if [[ ! -f "$PAGES" ]]; then
  echo "=== discover + stubs ==="
  node docs/wiki/scripts/discover-xg-atwiki-pages.mjs
  node docs/wiki/scripts/generate-xg-stubs.mjs
else
  echo "=== using existing $PAGES ==="
fi

shopt -s nullglob
XG_MANIFESTS=(docs/wiki/sources/atwiki/manifest-batch*-xg-*.json)
if [[ ${#XG_MANIFESTS[@]} -eq 0 ]]; then
  TOTAL=$(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$PAGES','utf8'))).length)")
  BATCH_SIZE=20
  BATCHES=$(( (TOTAL + BATCH_SIZE - 1) / BATCH_SIZE ))
  echo "=== build $BATCHES manifests ==="
  for ((i=0; i<BATCHES; i++)); do
    node docs/wiki/scripts/build-xg-manifest.mjs "$i" "$BATCH_SIZE" || break
  done
  XG_MANIFESTS=(docs/wiki/sources/atwiki/manifest-batch*-xg-*.json)
fi

SORTED=()
while IFS= read -r m; do
  SORTED+=("$m")
done < <(
  for m in "${XG_MANIFESTS[@]}"; do
    bn=$(basename "$m")
    num=${bn#manifest-batch}
    num=${num%%-*}
    printf '%s\t%s\n' "$num" "$m"
  done | sort -n -k1 | cut -f2-
)

for m in "${SORTED[@]}"; do
  echo "=== $(basename "$m") ==="
  node docs/wiki/scripts/fetch-atwiki-batch.mjs "$(basename "$m")"
done

echo "=== sync cards ==="
node docs/wiki/scripts/sync-cards-from-atwiki.mjs
echo "=== xg done ==="
