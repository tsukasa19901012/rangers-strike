# ADR: ブラスト追加条件バイパス（KW-P2-02）

**Status:** Accepted (2026-06-11)  
**Context:** [p1701.md](../wiki/glossary/p1701.md) — 敗北直前に追加条件無視でラッシュ

## 決定

`blastBypassesRushAdditionalCondition` は **次のいずれか** で true:

1. **ダメージ閾値:** `player.damage >= WIN_DAMAGE - 1`（敗北直前）
2. **表パワー代理:** オモテ向きパワー ≤ 1 枚（従来実装）

両条件は OR。どちらか一方を満たせば追加条件ゲートを短絡する。

## 理由

- atwiki は「負ける直前」を明示。本エンジン `WIN_DAMAGE = 7` のため `damage >= 6` を第一条件とする。
- 表パワー ≤ 1 は「6枚以上貯まっている」状況の実務代理として維持（テスト・既存カード互換）。
- 両方を残すことで、ダメージ操作カード（ファイブテクター等）とパワー消費後のピンチの両方をカバー。

## 代替案（却下）

| 案 | 却下理由 |
|----|----------|
| ダメージのみ | 既存 blast テスト・多数シミュレーションが表パワー代理前提 |
| 表パワーのみ | wiki「敗北直前」と不一致 |

## 実装

- `packages/engine/src/keywords/battleKeywords.ts` — `blastBypassesRushAdditionalCondition`
- 回帰: `keyword.integration.test.ts`, `battleKeywords.test.ts`
