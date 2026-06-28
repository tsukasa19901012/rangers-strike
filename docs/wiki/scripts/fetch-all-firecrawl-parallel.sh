#!/usr/bin/env bash
# Firecrawl で atwiki マニフェストを並列取得
# 使い方:
#   docs/wiki/scripts/fetch-all-firecrawl-parallel.sh
#   WORKERS=6 docs/wiki/scripts/fetch-all-firecrawl-parallel.sh
#   docs/wiki/scripts/fetch-all-firecrawl-parallel.sh manifest-batch70-*.json
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then set -a; source .env; set +a; fi

WORKERS="${WORKERS:-4}"
SCRIPT="docs/wiki/scripts/fetch-atwiki-firecrawl-batch.mjs"

if ! command -v firecrawl >/dev/null 2>&1; then
  echo "firecrawl CLI not found" >&2
  exit 1
fi

shopt -s nullglob
if (($# > 0)); then
  MANIFESTS=("$@")
else
  MANIFESTS=(docs/wiki/sources/atwiki/manifest-batch*.json)
fi

echo "=== firecrawl parallel fetch: ${#MANIFESTS[@]} manifests, workers=$WORKERS ==="

export FIRECRAWL_NO_TELEMETRY=1
printf '%s\n' "${MANIFESTS[@]}" | xargs -P "$WORKERS" -I{} bash -c '
  m="$1"
  echo "[start] $(basename "$m")"
  node "'"$SCRIPT"'" "$(basename "$m")"
' _ {}

echo "=== sync cards + glossary ==="
node docs/wiki/scripts/sync-cards-from-atwiki.mjs
node docs/wiki/scripts/sync-glossary-from-atwiki.mjs

echo "=== firecrawl fetch complete ==="
