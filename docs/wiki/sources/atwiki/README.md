# atwiki 取得ソース

更新日: 2026-06-09

## アクセス規約（必須）

| ルール | 値 |
|--------|-----|
| 取得間隔 | 3〜10 秒（ランダム） |
| 1 実行上限 | 20 ページ |
| 同時取得 | 禁止（逐次のみ） |
| 同一ドメイン連続 | 禁止 — 各 atwiki 取得前に grnrngr へ break |

## 実行方法

```bash
# 単一バッチ
node docs/wiki/scripts/fetch-atwiki-batch.mjs manifest-batch{N}-....json

# セット別一括（discover → stubs → manifest → fetch → sync）
docs/wiki/scripts/fetch-legend12-batches.sh    # L1/L2
docs/wiki/scripts/fetch-legend49-batches.sh    # 4〜9弾
docs/wiki/scripts/fetch-rider-belt-batches.sh  # ベルト+EXP
docs/wiki/scripts/fetch-metal-edition-batches.sh
docs/wiki/scripts/fetch-glossary-batches.sh
docs/wiki/scripts/fetch-xg-batches.sh          # XG1〜7
docs/wiki/scripts/fetch-promo-batches.sh       # PR/PK
```

* ログ: `fetch-log.txt`
* 出力: `page-{id}-{label}.md`
* マニフェスト: `manifest-batch*.json`（104件）

## 取得方式

| 方式 | 結果 |
|------|------|
| r.jina.ai 経由 | 451 SecurityCompromiseError — **使用禁止** |
| Node direct fetch | **成功** — `User-Agent: rangers-strike-wiki-agent/1.0` |

## 収集状況（完了）

| セット | 枚数/件数 | バッチ | ページマップ |
|--------|-----------|--------|--------------|
| ルール・用語（初期） | 40 | 1, 5 | — |
| L3 | 57 | 2〜4 | legend3/atwiki-pages.json |
| L1/L2 | 122 | 6〜12 | legend12-atwiki-pages.json |
| 4〜9弾 | 512 | 13〜38 | legend49-atwiki-pages.json |
| ベルト + EXP | 358 | 39〜56 | rider-belt-atwiki-pages.json |
| SR（SC） | 7 | 57 | sr-atwiki-pages.json |
| SK（5弾SC） | 1 | 58 | sk-atwiki-pages.json |
| メタルエディション | 63 | 59〜62 | metal-edition-atwiki-pages.json |
| 用語集 | 167 | 63〜69 | glossary-atwiki-pages.json |
| クロスギャザー XG1〜7 | 649 | 70〜102 | xg-atwiki-pages.json |
| プロモ PR/PK/PM/XP/XC | 80 | 103〜107 | promo-atwiki-pages.json |

**合計:** atwiki ソース **2022** ページ / カード md **1849** 件（`## atwiki 取得` 付き）

## カード仕様同期

```bash
node docs/wiki/scripts/sync-cards-from-atwiki.mjs
node docs/wiki/scripts/sync-cards-from-grnrngr-faq.mjs   # L1/L2 公式FAQ
node docs/wiki/scripts/sync-glossary-from-atwiki.mjs
```

反映フィールド:
* `作品:` / `収録:` / `特徴:` — トップレベル
* `## atwiki 取得` — 効果文・ステータス・Q&A 抜粋

## スクリプト一覧

| 用途 | discover | generate stubs | build manifest | fetch |
|------|----------|----------------|----------------|-------|
| L1/L2 | discover-legend12-* | — | build-legend12-* | fetch-legend12-batches.sh |
| 4〜9弾 | discover-legend49-* | generate-card-stubs.mjs | build-legend49-* | fetch-legend49-batches.sh |
| ベルト+EXP | discover-rider-belt-* | generate-rider-belt-stubs.mjs | build-rider-belt-* | fetch-rider-belt-batches.sh |
| メタル | discover-metal-edition-* | generate-metal-edition-stubs.mjs | build-metal-edition-* | fetch-metal-edition-batches.sh |
| SR / SK | discover-sr-* / discover-sk-* | generate-sr/sk-stubs.mjs | build-sr/sk-manifest.mjs | （rb/me バッチに含む） |
| 用語集 | discover-glossary-* | generate-glossary-stubs.mjs | build-glossary-* | fetch-glossary-batches.sh |
| XG | discover-xg-* | generate-xg-stubs.mjs | build-xg-* | fetch-xg-batches.sh |
| プロモ | discover-promo-* | generate-promo-stubs.mjs | build-promo-* | fetch-promo-batches.sh |

## 残タスク（低優先）

* grnrngr faq/card_3〜9.html 全文取得
* `node scripts/verify-wiki-effects.mjs` 全弾突合

詳細: [docs/wiki/report.md](../../report.md) / [docs/wiki/unresolved.md](../../unresolved.md)
