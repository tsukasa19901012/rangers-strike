# AI 自己対戦シミュレーションレポート

生成日時: 2026-06-10T15:21:00.000Z  
サイクル: 1  
担当: Manager Agent

## サマリー

| 指標 | 値 |
|------|-----|
| 実施試合数（本サイクル） | 100 |
| 勝敗確定 | 100/100 (100%) |
| apply_failed | 0 |
| step_limit 到達 | 0 |
| no_legal_actions | 0 |
| pending 残存 | 0 |
| 無限ループ疑い | 0 |
| 不正勝敗 | 0 |
| **自己対戦成功率** | **100%** |

## スイート別結果

### L1 スターター 100 試合（`simulate100.test.ts`）

実行: `npm test -w @rangers-strike/engine -- src/verticalSlice/simulate100.test.ts`

| 指標 | 値 |
|------|-----|
| total | 100 |
| winner | 100 |
| damage_win | 38 |
| deck_out_win | 62 |
| unknown_win | 0 |
| apply_failed | 0 |
| games_with_strike | 53 |
| games_with_battle | 0 |
| steps (winner) min/max/avg | 126 / 520 / 373 |
| phase_coverage | start:100, charge:100, rush:100, battle:100 |

### Full Promoted 50 試合（直近 `sim-metrics.json`）

| 指標 | 値 |
|------|-----|
| suite | simulateFullPromoted |
| games | 50 |
| winner | 50/50 |
| apply_failed | 0 |
| unresolved_rate | 0% |
| with_rush_phase | 50 |
| with_battle_phase | 50 |

## 完了条件との差分

| 目標 | 現状 | ギャップ |
|------|------|----------|
| 100 試合/サイクル | ✅ 100 試合 PASS | — |
| 1000 試合連続成功 | ❌ 未実施 | 900 試合不足 |
| 部分実装カード含有デッキ検証 | ⚠️ 未実施 | Worker 完了後に promoted デッキへ追加 |

## 確認項目チェック

| 項目 | 結果 |
|------|------|
| クラッシュ | なし |
| pending 残存 | なし |
| 無限ループ | なし（max 15,000 steps 内完走） |
| 不正勝敗 | なし（damage / deck_out のみ） |

## 次サイクル計画

1. 部分実装 10 枚完了後、対象カードを含む promoted hybrid デッキで 100 試合
2. 全 partial 解消確認後、`simulateFullPromoted` を 1000 試合に拡張（または専用スクリプト追加）
3. `apply_failed > 0` または `winner < games` の場合はブロッカーとしてマージ禁止

## 実行コマンド

```bash
# 100 試合（L1 スターター）
npm test -w @rangers-strike/engine -- src/verticalSlice/simulate100.test.ts

# 50 試合（full promoted、metrics 出力付き）
npm test -w @rangers-strike/engine -- src/verticalSlice/simulateFullPromoted.test.ts

# エンジン全テスト
npm test -w @rangers-strike/engine
```
