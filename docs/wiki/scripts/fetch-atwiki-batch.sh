#!/usr/bin/env bash
# 非推奨: jina.ai は 451 ブロック。Node 版を使用すること。
exec node "$(dirname "$0")/fetch-atwiki-batch.mjs"
