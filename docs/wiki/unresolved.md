# 未解決事項

## Issue: atwiki L3 カード — バッチ2-4完了

Block Level: 解消

関連: docs/wiki/cards/RS-123〜RS-178, SR-001

取得済:
* manifest-batch2/3/4 — 57ページ
* sync-cards-from-atwiki.mjs で card md 更新

---

## Issue: atwiki ルールページ — バッチ1完了

Block Level: 解消（部分）

関連: core-rules, rush, keywords

取得済（20ページ）:
* manifest.json 全件 — `docs/wiki/sources/atwiki/page-*.md`
* 方式: Node direct fetch（jina.ai は 451 で使用不可）

残タスク:
* 1974 コミュニティQ&A — faq.md に補助情報として抜粋済

---

## Issue: atwiki 一括取得不可（jina.ai）

Block Level: LOW（回避済）

関連: —

不足情報:
* r.jina.ai 経由は w.atwiki.jp 451 ブロック

必要調査:
* **direct Node fetch を標準方式とする**（README 参照）

候補:
* jina は block 解除まで使用しない

---

## Issue: L1/L2 カード Q&A — 完了

Block Level: 解消

関連: docs/wiki/cards/RS-001〜RS-122

取得済:
* atwiki バッチ6〜12 — 122/122 OK
* grnrngr FAQ — 68/122 公式Q&A

---

## Issue: 4〜9弾カード Wiki — 完了

Block Level: 解消

関連: docs/wiki/cards/RS-179〜RS-690（512枚）

取得済:
* `legend49-atwiki-pages.json` — 512/512
* バッチ13〜38 — 完了

残:
* grnrngr faq/card_3〜9.html — 未確認（優先度低）

---

## Issue: ベルトコレクション + マスクドライダーEXP — 完了

Block Level: 解消

関連: docs/wiki/cards/BK-*, RK-*, SK-*（358枚）

取得済:
* `rider-belt-atwiki-pages.json` — 358/358
* バッチ39〜56 — 完了

---

## Issue: SC（SR/SK）— 完了

Block Level: 解消

関連: docs/wiki/cards/SR-002〜008, SK-000

取得済:
* SR 7枚（batch57）、SK 1枚（batch58）

---

## Issue: スペシャルメタルエディション — 完了

Block Level: 解消

関連: docs/wiki/cards/RM-001〜062, SM-001（63枚）

取得済:
* `metal-edition-atwiki-pages.json` — 63/63
* バッチ59〜62 — 完了

---

## Issue: 用語集個別ページ — 完了

Block Level: 解消

関連: docs/wiki/glossary/*.md（167件）

取得済:
* `glossary-atwiki-pages.json` — 167/167
* バッチ63〜69 — 完了
* sync-glossary-from-atwiki.mjs

---

## Issue: クロスギャザー XG1〜7 — 完了（Wiki のみ）

Block Level: 解消（実装スコープ外）

関連: docs/wiki/cards/XG1〜XG7, SX-*, XP-*（649枚）

取得済:
* `xg-atwiki-pages.json` — 649/649
* バッチ70〜102 — 完了

残:
* XG 専用ルール — 商品ページ断片のみ（エンジン未対応）

---

## Issue: プロモーションカード — 完了（Wiki のみ）

Block Level: 解消（実装スコープ外）

関連: docs/wiki/cards/PR/PK/PM/XP/XC（80枚）

取得済:
* `promo-atwiki-pages.json` — 80/80（PR/PK 41 + PM-001 + XP-[RS/RK] 30 + XC 大会専用 8）
* バッチ103〜107 — 完了
* 索引: pages/513.html

---

## Issue: エンドフェイズ(5) 公式テキスト

Block Level: LOW（部分解消）

関連: phases.md

取得済:
* atwiki 155 — 基本手順・タイミング順序

不足情報:
* grnrngr rule_tarn.html#5 画像部の追加ステップ

候補:
* atwiki 155 + エンジン end_phase を暫定仕様とする

---

## Issue: XG / クロスギャザー コアルール

Block Level: LOW（本プロジェクトスコープ外）

関連: keywords.md ブラスト等

不足情報:
* xgather 専用 rule ページ 404
* 商品ページのみ断片的記述

候補:
* Legend 1-9 + ベルト/EXP 実装に集中。XG カード仕様は Wiki 収集のみ完了

---

## Issue: 禁止カードリスト

Block Level: 解消

関連: core-rules デッキ

取得済:
* page-2079-banned.md（バッチ1）
* タッグストライク等 — 4人モード向け、本シミュレーター非対象

---

## Issue: 先攻1ターン目スタート — glossary 記載

Block Level: LOW

関連: glossaryImplementation.ts

矛盾:
* glossary「簡略化のまま」 vs createGame「公式準拠で省略」

実装影響:
* 実際は省略実装済み

候補:
* glossary コメント更新は実装エージェント判断（本調査では docs のみ）

confidence: 実装は HIGH / glossary 記述は LOW

---

## Issue: カード個別裁定（cards.json 突合）

Block Level: MEDIUM

関連: docs/wiki/cards/*.md, packages/cards/src/

L3 verify（過去）:
* match=54, mismatch=2, missingLocal=1（RS-143）

残:
* RS-143 cards.json 効果文追加
* 全弾 verify-wiki-effects 実行（1810枚）
* grnrngr FAQ 未反映カードの confidence 更新

---

## Issue: sources/atwiki/README.md — 完了

Block Level: 解消

関連: docs/wiki/sources/atwiki/README.md

取得済:
* batch105 までの収集状況・スクリプト一覧を反映（2026-06-09）
