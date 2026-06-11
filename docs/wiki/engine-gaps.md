# エンジンギャップ

**更新:** 2026-06-11  
**キーワード詳細:** [keyword-implementation.md](../architecture/keyword-implementation.md)

## 意図的未実装（glossaryImplementation.ts）

| 項目 | 理由 | Block |
|------|------|-------|
| タッグストライク | 2体同時ストライク未実装 | MED |
| 先攻1ターン目スタート省略の差異 | 簡略化のまま維持 | LOW |

---

## フレームワークのみ

| 項目 | モジュール | 備考 |
|------|-----------|------|
| コマンダーカード | commander.ts | XG/拡張 |
| 除外 | exile.ts | カード少数 |
| リアニメイト | reanimate.ts | — |
| バウンス | bounce.ts | — |

---

## キーワード実装ギャップ（2026-06-11）

P0–P2 完了。詳細は [keyword-implementation.md](../architecture/keyword-implementation.md) §4。

| キーワード | 成熟度 | 残 TODO |
|-----------|--------|---------|
| 全主要キーワード | 高（代表） | P2 以降: 能動モーフ DSL 配線、全離場 chase 監査 |

---

## Legend 3 / カード別ギャップ

| 領域 | 現状 | 参照 |
|------|------|------|
| webUiEffectCoverage | 未配線効果一覧 | apps/web/lib/webUiEffectCoverage.ts |
| WIKI_ENGINE_PENDING | 空 | wikiReference.ts |
| モンキーテスト | ランダム探索 | engine monkey.test |

---

## Wiki 未照合

| 項目 | 影響 |
|------|------|
| cards.json 全弾突合 | verify-wiki-effects 未実行（1810枚） |
| wikiwiki.jp/renst エラッタ全文 | エラッタ完全性（403・atwiki 代替済） |
| grnrngr errata.html / faq/card_3〜9 | 公式エラッタ・FAQ 未全文 |

---

## 実装 vs 公式（既知）

| ルール | エンジン | 差分 |
|--------|----------|------|
| スタート戻し | 一括 return_all | FAQ上個別順も可 — 等価 |
| 同時効果順 | 配線済 | UI 不足は解消済（RULE-02） |
| 敵マルチコマンド→自パワー | なし | atwiki 110 — **HIGH** |
| スクラム | 右隣 CN+1 のみ | ✅ P0（2026-06-11） |
| ウイング | P0 骨格済 | 複数回ウイング — P2 |
| チェイス | 骨格あり | 全経路 E2E — P1 |
| タッグストライク | なし | 4人ルール、意図的 |

---

## 推奨実装順（実装エージェント向け）

1. **KW-P1** — [keyword-implementation.md](../architecture/keyword-implementation.md) §4
2. verify-wiki-effects 全弾突合・RS-143 等の cards.json 差分
3. webUiEffectCoverage 未配線の Legend3 効果
4. タッグストライク（必要時）
