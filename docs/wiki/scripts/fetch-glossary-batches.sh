#!/usr/bin/env bash
# レンスト用語集（page 57 一覧）取得（batch63〜）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

PAGES="packages/cards/src/glossary-atwiki-pages.json"
if [[ ! -f "$PAGES" ]]; then
  echo "=== discover + stubs ==="
  node docs/wiki/scripts/discover-glossary-atwiki-pages.mjs
  node docs/wiki/scripts/generate-glossary-stubs.mjs
else
  echo "=== using existing $PAGES ==="
fi

PENDING=$(node -e "
const fs=require('fs');
const map=JSON.parse(fs.readFileSync('$PAGES','utf8'));
const src='docs/wiki/sources/atwiki';
const fetched=new Set(fs.readdirSync(src).map(f=>{const m=f.match(/^page-(\\d+)-/);return m?m[1]:null}).filter(Boolean));
const n=Object.values(map).filter(e=>!fetched.has(String(e.page))).length;
console.log(n);
")
BATCH_SIZE=20
BATCHES=$(( (PENDING + BATCH_SIZE - 1) / BATCH_SIZE ))
echo "=== pending $PENDING terms, build $BATCHES manifests ==="
for ((i=0; i<BATCHES; i++)); do
  node docs/wiki/scripts/build-glossary-manifest.mjs "$i" "$BATCH_SIZE" || break
done

shopt -s nullglob
MANIFESTS=(docs/wiki/sources/atwiki/manifest-batch*-gl-*.json)
for m in "${MANIFESTS[@]}"; do
  echo "=== $(basename "$m") ==="
  node docs/wiki/scripts/fetch-atwiki-batch.mjs "$(basename "$m")"
done

echo "=== sync glossary ==="
node docs/wiki/scripts/sync-glossary-from-atwiki.mjs
echo "=== glossary done ==="
