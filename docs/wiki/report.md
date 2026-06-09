# Wiki 調査レポート

更新日: 2026-06-09（XG1〜7・プロモ・用語集・メタルエディション追記）

## 調査完了

| STEP | 状態 | 備考 |
|------|------|------|
| 出典収集 | **atwiki 2022ページ** | カード1849 + 用語167 + ルール等 |
| ルール抽出 | 完了 | |
| 仕様化 | 更新 | カード md 1849件（atwiki セクション付き） |
| カード同期 | 完了 | sync-cards-from-atwiki.mjs |
| 必要要素整理 | 完了 | state/action/event/timing 各 md |
| 既存実装差分 | 更新 | 敵マルチ→パワー gap 追加 |
| ファイル保存 | 完了 | sources/atwiki/ + scripts |
| report更新 | 本ファイル |

---

## カード Wiki 収集（atwiki）

| セット | 枚数 | バッチ | 状態 |
|--------|------|--------|------|
| L1/L2 | 122 | 6〜12 | 完了 |
| L3 | 57 | 2〜4 | 完了 |
| 4〜9弾 | 512 | 13〜38 | 完了 |
| ベルト + EXP | 358 | 39〜56 | 完了 |
| SR（SC） | 7 | 57 | 完了 |
| SK（5弾SC） | 1 | 58 | 完了 |
| メタルエディション | 63 | 59〜62 | 完了 |
| クロスギャザー XG1〜7 | 649 | 70〜102 | 完了（実装スコープ外） |
| プロモ PR/PK/PM/XP/XC | 80 | 103〜107 | 完了（実装スコープ外） |
| **合計** | **1849** | | |

ページマップ: `packages/cards/src/*-atwiki-pages.json`

---

## 用語集

| 項目 | 状態 |
|------|------|
| 用語 md | 167件（`docs/wiki/glossary/`） |
| atwiki 取得 | batch63〜69 完了 |
| 同期 | sync-glossary-from-atwiki.mjs |

---

## 追加ファイル（主要）

### コア仕様
* docs/wiki/core-rules.md, phases.md, battle.md, rush.md, damage.md
* docs/wiki/keywords.md, timing.md, faq.md, state-mapping.md, engine-gaps.md
* docs/wiki/unresolved.md, report.md

### カード・用語
* docs/wiki/cards/*.md（1810件）
* docs/wiki/glossary/*.md（167件）

### atwiki ソース・スクリプト
* docs/wiki/sources/atwiki/page-*.md（1983件）
* docs/wiki/sources/atwiki/manifest-batch*.json（104件）
* docs/wiki/scripts/fetch-atwiki-batch.mjs
* docs/wiki/scripts/sync-cards-from-atwiki.mjs
* discover/generate/build/fetch 系（legend12/49, rider-belt, metal-edition, sr, sk, xg, promo, glossary）

---

## カード md フィールド規約（現行）

* `作品:` — atwiki から自動反映
* `収録:` — 弾名・セット名・配布キャンペーン名（`自販`  suffix は除去）
* `## atwiki 取得` — 効果文・ステータス・Q&A 抜粋

---

## 矛盾

| 矛盾 | 出典A | 出典B | 候補 | confidence |
|------|-------|-------|------|------------|
| glossary「先攻スタート簡略化」| glossaryImplementation.ts | grnrngr rule_phase1-2 + createGame | 実装は省略準拠。glossary 記述古い可能性 | MEDIUM |
| （その他） | — | — | エラッタ優先で RS-026 等は確定 | — |

---

## 不足情報

* wikiwiki.jp/renst（403）— atwiki + grnrngr で代替済
* ルール質問所(1974) コメント — コミュニティ回答（補助情報扱い）
* エンドフェイズ詳細テキスト（grnrngr 画像のみ）
* XG 専用ルール（スコープ外）
* grnrngr faq/card_3〜9.html — 未全文取得（優先度低）

## atwiki 取得規約（遵守済）

* 間隔 3〜10 秒 / 最大 20 ページ / 逐次 / grnrngr break で同一ドメイン連続回避
* jina.ai → 451 のため **Node direct fetch** を採用

---

## 設計リスク

1. **boolean 増殖** — PlayerState hold-ready フラグ群
2. **同時解決順** — プレイヤー選択未実装
3. **タッグストライク** — 未実装のまま仕様書に記載
4. **XG / プロモ** — Wiki のみ。エンジン未対応

---

## 次の推奨

1. `node scripts/verify-wiki-effects.mjs` で cards.json と atwiki 突合（全弾）
2. grnrngr faq/errata.html 全文取得 → errata.ts 突合
3. 実装: 敵マルチ→パワー、`webUiEffectCoverage` 未配線
4. sources/atwiki/README.md のバッチ履歴更新

---

## Confidence

| 領域 | Level |
|------|-------|
| フェイズ・勝敗・ゾーン | HIGH |
| バトル・NC・ストライク | HIGH |
| ラッシュ・ゾード | HIGH |
| FAQ 一般裁定 | HIGH |
| タイミングスタック | HIGH（実装）/ MEDIUM（公式文言） |
| L1〜9 カード atwiki | **HIGH**（691/691 RS+SR） |
| ベルト+EXP atwiki | **HIGH**（358/358） |
| メタルエディション atwiki | **HIGH**（63/63） |
| 用語集 atwiki | **HIGH**（167/167） |
| XG / プロモ atwiki | **HIGH**（Wiki のみ・実装スコープ外） |
| L1/L2 grnrngr FAQ | **HIGH**（68/122 公式Q&A） |
| 敵マルチ→パワー gap | HIGH |
| ウイング | HIGH（ルール）/ 未実装 |
| XG エンジン | LOW（スコープ外） |

---

## Coverage

| 対象 | 率 |
|------|-----|
| grnrngr コアルールページ | 7/7 主要 HTML 取得 |
| grnrngr FAQ 一般 | 主要 Q&A 取得 |
| atwiki カード | **1849/1849** |
| atwiki 用語集 | **167/167** |
| atwiki ルール・用語（初期） | **40/40**（バッチ1+5） |
| カード md | 1849ファイル |
| エンジン state マッピング | 主要 Pending/Zone 網羅 |

---

## 完了前チェック

- [x] 出典あり（grnrngr + atwiki 1983ページ）
- [x] unresolved 更新
- [x] report 更新
- [x] state mapping 更新
- [x] 矛盾整理
- [x] コード未変更（Wiki 収集のみ）

---

## 主要出典一覧

| URL | 用途 |
|-----|------|
| https://www.grnrngr.com/documents/rangersstrike/rule/ | 公式ルール索引 |
| https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase1-2.html | スタート・チャージ |
| https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase3.html | ラッシュ |
| https://www.grnrngr.com/documents/rangersstrike/rule/rule_phase4.html | バトル・NC・ストライク |
| https://www.grnrngr.com/documents/rangersstrike/faq/ | Q&A・リファレンス |
| https://w.atwiki.jp/renst/pages/11.html | カテゴリ・世界観 |
| https://w.atwiki.jp/renst/pages/1.html | wiki 索引 |
| https://w.atwiki.jp/renst/pages/513.html | プロモーションカード索引 |
| https://www.grnrngr.com/documents/xgather/information/ | XG商品（補助） |

**補助情報:** packages/cards/src/errata.ts, wikiReference.ts, engine types（差分照合用のみ、ルールソースではない）
