# 実装可能性分析（A / B / C）

**生成:** `npm run extract-implementation-feasibility -w @rangers-strike/cards`
**日付:** 2026-06-09
**対象:** Wiki 全カード 1849 枚

## 結論

| 区分 | 意味 | 枚数 | 割合 |
|------|------|------|------|
| **A** そのまま実装可能 | バニラ、または TS 効果ハンドラ接続済み | 266 | **14.4%** |
| **B** Effect 追加で可能 | 新規 effectId / DSL primitive 追加で対応（エンジン構造は現状のまま） | 1259 | **68.1%** |
| **C** Engine 改修必要 | コマンダー・母艦・ウイング・レジスト等の基盤未実装 | 324 | **17.5%** |

```
A ████████████████████ 14.4%
B ████████████████████ 68.1%
C ████████████████████ 17.5%
```

- うち **TS 実装済み**（A に含む）: 161 枚 (8.7%)
- **A+B 合計**（現エンジン拡張のみ）: 1525 枚 (82.5%)

## 区分定義

### A — そのまま実装可能

- 効果文なし（バニラ）— ステータス・CN のみで対戦可能
- `operationCatalog` / `unitEffectCatalog` / `NUMBER_COMBO_EFFECTS` に接続済み

### B — Effect 追加で実装可能

- 既存フェイズ・誘発・`pending*` フローで表現可能
- 新規 `effectId` ハンドラ、または DSL primitive + インタープリタ接続で対応
- ABCDE の B/C 大半、FAQ 依存の D の一部

### C — Engine 改修必要

- ABCDE **E**（コマンダー・多段ウィザード・母艦・State 書き換え）
- **ウイング / チェイス / レジスト / JC・RC** キーワード未実装
- `state_rewrite` 裁定（デッキ増減・コピー・コマンダーゾーン等）

## ABCDE → A/B/C クロス集計

| 旧区分 | A | B | C | 合計 |
|--------|---|---|---|------|
| A | 117 | 0 | 0 | 117 |
| B | 15 | 31 | 0 | 46 |
| C | 51 | 857 | 5 | 913 |
| D | 68 | 371 | 97 | 536 |
| E | 15 | 0 | 222 | 237 |

## C 区分の主な理由

| 理由 | 枚数 |
|------|------|
| `abcde_E` | 222 |
| `engine_pattern_text` | 97 |
| `ruling_state_rewrite` | 5 |

## データソース

- `pipeline/data/card-classification.json`（ABCDE 区分）
- `unitEffectCatalog.ts` / `operationCatalog.ts` / `comboEffects.ts`（実装済み判定）
- `rulingCatalog.ts` / `effectPatternCatalog.ts`（裁定・Effect パターン）

## 限界・注意

- **DSL インタープリタ未接続**のカードは多くが B（Effect 層）— A には TS 接続済みのみカウント
- B の工数は effectId 数に比例。913 枚の C 区分も個別ハンドラで B に落ちる
- 本分析は静的テキスト分類。実装順序は [effect_catalog.md](./effect_catalog.md) の優先度を参照
