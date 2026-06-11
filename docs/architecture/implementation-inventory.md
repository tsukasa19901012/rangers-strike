# 未実装機能・カード一覧（開発準備）

**更新:** 2026-06-11（残課題 1–4 対応後）  
**再生成:** `npx tsx packages/cards/scripts/audit-implementation-gaps.ts`  
**機械可読データ:** `packages/cards/pipeline/data/implementation-gaps.json`

---

## 1. 結論

| 観点 | 数字 | 状態 |
|------|------|------|
| カタログ総数 | **1,849** | — |
| DSL 部分実装（catchall） | **0** | 監査 0 件 |
| RULE-01 パワー計算 | 完了 | `power.ts` |
| RULE-02 同時順序 | 配線済み | `simultaneousEffects.ts` |
| Promoted UI 警告 | DSL-ready は除外 | `deckWarnings.ts` |

---

## 2. 残課題 1–4 対応サマリー

| # | 項目 | 対応 |
|---|------|------|
| 1 | RULE-02 配線 | `withSyncedEffectStack` → 同時反応検出 → `simultaneous_order` Pending → `reactionResolutionOrder` |
| 2 | catchall 監査 13件 | `engineImplementedCatchall.ts` + スタブ再バンドル → **partial 0** |
| 3 | deck_out 偏り | AI スコアリング強化（ダメージ勝ち優先・山札薄時のチャージ抑制） |
| 4 | Promoted UI | DSL-ready を汎用 UI 対応扱い（`promoted-ui` tier、警告除外） |

### deck_out について

100 試合シミュ（L1 スターター）では **damage 12 / deck_out 88** のまま。スターター同士の長期戦では山札切れが支配的。ダメージ勝ちへの誘導はスコアリングで強化済み。さらなる改善はデッキ別チューニングが必要。

---

## 3. 主要ファイル

| 領域 | ファイル |
|------|----------|
| 同時効果 | `packages/engine/src/rules/simultaneousEffects.ts` |
| 監査 | `packages/cards/src/engineImplementedCatchall.ts` |
| AI | `packages/engine/src/ai/scoring.ts`, `helpers.ts`, `level1.ts` |
| Web UI | `apps/web/lib/webUiEffectCoverage.ts`, `deckWarnings.ts`, `estimateCardUiCoverage.ts` |

---

## 4. キーワード P0（2026-06-11 完了）

詳細: [keyword-implementation.md](./keyword-implementation.md)

| ID | 項目 | 状態 |
|----|------|------|
| KW-P0-01 | スクラム: 右隣 CN+1 のみ | ✅ |
| KW-P0-02 | ウイング: 事前ホールド + BA 禁止 | ✅ |
| KW-P0-03 | ウイング: 当ターンストライク禁止 | ✅ |
| KW-P0-04 | RC `no_strike_after_rideoff` | ✅ |
| KW-P0-05 | レジスト: バトル BP 撃破のみ | ✅ |

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-06-11 | キーワード P0（KW-P0-01〜05）完了 |
| 2026-06-11 | P0–P2 一括対応 |
| 2026-06-11 | 残課題 1–4 対応 |
