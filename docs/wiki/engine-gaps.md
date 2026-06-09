# エンジンギャップ

## 意図的未実装（glossaryImplementation.ts）

| 項目 | 理由 | Block |
|------|------|-------|
| タッグストライク | 2体同時ストライク未実装 | MED |
| 先攻1ターン目スタート省略の差異 | 簡略化維持（実際は公式準拠で省略済） | LOW |

---

## フレームワークのみ

| 項目 | モジュール | 備考 |
|------|-----------|------|
| コマンダーカード | commander.ts | XG/拡張 |
| 除外 | exile.ts | カード少数 |
| リアニメイト | reanimate.ts | — |
| バウンス | bounce.ts | — |

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
| ウイング | atwiki 取得済、エンジン未実装 |
| XG / プロモ | atwiki 取得済（649+41）、エンジンスコープ外 |

---

## 実装 vs 公式（既知）

| ルール | エンジン | 差分 |
|--------|----------|------|
| スタート戻し | 一括 return_all | FAQ上個別順も可 — 等価 |
| 同時効果順 | 部分 auto | プレイヤー選択不足 |
| 敵マルチコマンド→自パワー | なし | atwiki 110 — **HIGH** |
| チェイス | なし | atwiki 1292 |
| ウイング | なし | atwiki 1537 |
| タッグストライク | なし | 4人ルール、意図的 |

---

## 推奨実装順（実装エージェント向け）

1. verify-wiki-effects 全弾突合・RS-143 等の cards.json 差分
2. webUiEffectCoverage 未配線の Legend3 効果
3. 同時解決プレイヤー順序 UI
4. タッグストライク（必要時）
