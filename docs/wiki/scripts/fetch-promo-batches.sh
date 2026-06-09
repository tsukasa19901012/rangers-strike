#!/usr/bin/env bash
# プロモーションカード取得（batch103〜、追加分は batch106〜）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

echo "=== discover + stubs ==="
node docs/wiki/scripts/discover-promo-atwiki-pages.mjs
node docs/wiki/scripts/generate-promo-stubs.mjs

echo "=== build missing manifests ==="
node docs/wiki/scripts/build-promo-missing-manifests.mjs

shopt -s nullglob
SORTED=()
while IFS= read -r m; do
  SORTED+=("$m")
done < <(
  for m in docs/wiki/sources/atwiki/manifest-batch*-pr-*.json; do
    bn=$(basename "$m")
    num=${bn#manifest-batch}
    num=${num%%-*}
    printf '%s\t%s\n' "$num" "$m"
  done | sort -n -k1 | cut -f2-
)

for m in "${SORTED[@]}"; do
  bn=$(basename "$m")
  num=${bn#manifest-batch}
  num=${num%%-*}
  if [[ "$num" -ge 106 ]]; then
    echo "=== $bn ==="
    node docs/wiki/scripts/fetch-atwiki-batch.mjs "$bn"
  fi
done

echo "=== sync cards ==="
node docs/wiki/scripts/sync-cards-from-atwiki.mjs
echo "=== promo done ==="
