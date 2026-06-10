# Vertical Slice — 実装と設計ギャップ

**日付:** 2026-06-10（G4 拡張反映）  
**目的:** スターターおよび full-promoted / 自作 hybrid デッキで  
ゲーム開始 → ドロー → チャージ → ラッシュ → バトル → ストライク → 勝敗まで完走  
**実装:** `packages/engine/src/verticalSlice/`  
**関連:** [full-card-rollout-process.md](./full-card-rollout-process.md)（G4）, [web-full-playable-requirements.md](./web-full-playable-requirements.md)（G5）

---

## 実装サマリー

| 項目 | 内容 |
|------|------|
| ゲーム生成 | `createStarterGame()` / `createFullPromotedGame()` / `createGameForDecks()` — `definitionScope: "full"` |
| 対戦ループ | `playStarterMatchUntilEnd()` — CPU Lv1 双方 |
| エクスポート | `packages/engine/src/index.ts` から公開 |
| テスト | `starterMatch.test.ts`、`simulate100.test.ts`、`simulatePromoted.test.ts`、`simulateFullPromoted.test.ts`、`simulateCustomFullDeck.test.ts` |
| G4 ゲート | `sim-metrics.json` — `apply_failed=0`（50 games full-promoted） |

### 完走可能なフェイズ

| フェイズ | 経路 | 備考 |
|----------|------|------|
| ゲーム開始 | `createGame` | 先攻1Tは `charge` から開始 |
| ドロー | `start` → `draw` | 2T目以降 |
| チャージ | `charge_power` / `charge_command` | |
| ラッシュ | `rush` + コマンド支払い | スターター固有効果は TS ハンドラ |
| バトル進入 | `move_to_battle` | 強制進入ルールあり |
| バトル | `battle` | エンジン実装済み |
| ストライク | `strike` | SP ダメージ |
| 勝敗 | `WIN_DAMAGE` (7) / デッキアウト | |

---

## 本スライスで修正したエンジンバグ

| ID | 問題 | 修正 |
|----|------|------|
| VS-BUG-01 | `state.effectStack` キャッシュが `pending*` クリア後も残り、`getLegalActions` が誤プレイヤーの手を列挙、`isLegalAction` が `illegal_action` | `peekEffectStackTop` 等を常に `buildEffectStack(state)` から導出（`effectStack.ts`） |

**再現:** seed=2、L1 スターター CPU 対戦、step 155 付近で `move_to_battle` が合法リストにいるのに `apply_failed: illegal_action`。

---

## 設計ギャップ（Vertical Slice 範囲外・未接続）

### エンジン / アーキテクチャ

| ID | 不足 | 重要度 | 現状 |
|----|------|--------|------|
| VS-01 | **DSL インタープリタ未接続** | High | スターターは TS `effects.ts` ハンドラで動作。DSL オーバーレイはロードのみ |
| VS-02 | **`applyAction` 一部パスが `withSyncedEffectStack` を通らない** | Medium | `ok()` 以外の `{ ok: true, state }` 返却が複数。キャッシュ不整合の温床 |
| VS-03 | **`end` フェイズ未到達** | Low | 100試合で `end: 0`。勝利がバトルフェイズ中に確定しフェイズ遷移前に終了 |
| VS-04 | **Event 層 / リプレイ** | Low | 未実装（`event-architecture.md` 参照） |
| VS-05 | **Web UI 効果の完全配線** | Medium | G5 完了: `GameApp` は full-playable 接続済み。promoted の named effect UI は W4 緩和（バッジ・汎用 modal）で継続改善 |

### CPU / ゲームプレイ品質

| ID | 不足 | 重要度 | 100試合観測 |
|----|------|--------|-------------|
| VS-AI-01 | **バトル宣言がほぼ発生しない** | Medium | `games_with_battle: 0` |
| VS-AI-02 | **勝利の大半がデッキアウト** | Medium | 59/100 が deck_out、41/100 が damage |
| VS-AI-03 | **Lv1 CPU がスターター最適化なし** | Low | 汎用ヒューリスティックのみ |
| VS-AI-04 | **`pickCpuAction` が `end_phase` を返すが非法のケース** | Low | フォールバックで `actions[0]` に退避（VS-BUG-01 修正後は顕在化しにくい） |

### カード効果（L1 スターター）

DSL ギャップの詳細は [legend1-starter-dsl-gaps.md](./legend1-starter-dsl-gaps.md) を参照。

| カテゴリ | 例 | Vertical Slice での扱い |
|----------|-----|------------------------|
| コンボ / NC | RS-032, RS-033 | TS ハンドラで部分対応 |
| 常駐 OP | RS-030, RS-045 | TS ハンドラ |
| カウンター | RS-027 等 | 反応窓は動作、DSL 未接続 |
| ゾード | スターターに少 | 未検証 |

---

## テスト

| ファイル | 内容 |
|----------|------|
| `verticalSlice/starterMatch.test.ts` | 生成・ドロー・seed 完走 |
| `verticalSlice/simulate100.test.ts` | L1 スターター 100 試合 |
| `verticalSlice/simulatePromoted.test.ts` | hybrid promoted（10/25/35 枚差し替え） |
| `verticalSlice/simulateFullPromoted.test.ts` | full-promoted 40 枚 × 50 試合 → `sim-metrics.json` |
| `verticalSlice/simulateCustomFullDeck.test.ts` | 自作 hybrid（abarenoh + BK-001）× 10 試合（AC-07） |
| `effectStack.test.ts` | スタック順序 + ステールキャッシュ回帰 |

---

## 使い方

```typescript
import {
  createStarterGame,
  playStarterMatchUntilEnd,
  LEGEND1_STARTER_IDS,
} from "@rangers-strike/engine";

const state = createStarterGame({
  player1Starter: "magiking",
  player2Starter: "abarenoh",
});

const result = playStarterMatchUntilEnd(state);
// result.reason === "winner" | ...
```
