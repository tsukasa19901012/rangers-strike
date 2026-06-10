# Event 基盤実装レポート（Phase 2 準備）

**日付:** 2026-06-09  
**スコープ:** `packages/engine/src/events` 新規追加  
**カード効果移行:** 未実施（インフラのみ）  
**回帰:** `npm test -w @rangers-strike/engine` — **537/537 PASS**

---

## 1. 目的と達成状況

| 目標 | 状態 |
|------|------|
| `GameEvent` 型定義（7 種） | ✅ 完了 |
| `EventQueue` FIFO キュー | ✅ 完了 |
| `EventDispatcher` Listener 登録・実行 | ✅ 完了 |
| `EventResolver` `resolveUntilBlocked` ループ | ✅ 完了 |
| 既存 `applyAction` への接続 | ⏸ 意図的に未接続 |
| カード効果の Listener 移行 | ⏸ Phase 2 本番 |

**設計方針:** `event-architecture.md` のハイブリッド構成に従い、`pending*` を正としたまま Event 層を **並行追加**。既存の命令型ハンドラはそのまま動作する。

---

## 2. 追加ファイル一覧

```
packages/engine/src/events/
├── types.ts           # GameEvent union, EventListener, 共通ヘルパ
├── EventQueue.ts      # FIFO キュー
├── EventDispatcher.ts # 種別別 Listener 登録・dispatch
├── EventResolver.ts   # resolveUntilBlocked ループ
├── blocking.ts        # Pending / winner による停止判定
├── builders.ts        # 7 種イベントのビルダー
├── index.ts           # 公開 API
└── events.test.ts     # 基盤ユニットテスト（9 ケース）
```

**公開:** `packages/engine/src/index.ts` から `export * from "./events"` を追加。

---

## 3. GameEvent 一覧

| type | 用途（将来の接続点） | ビルダー |
|------|---------------------|----------|
| `UnitRushed` | ラッシュ配置完了 → on_rush | `buildUnitRushedEvent` |
| `UnitEnteredBattle` | バトルゾーン進入 → enter_battle / NC | `buildUnitEnteredBattleEvent` |
| `BattleDeclared` | アタック宣言 → on_attack | `buildBattleDeclaredEvent` |
| `StrikeDeclared` | ストライク宣言 → 反応窓 | `buildStrikeDeclaredEvent` |
| `UnitLeftZone` | 離場確定 → on_leave / destroy | `buildUnitLeftZoneEvent` |
| `DamageApplied` | ダメージ確定 → aura 等 | `buildDamageAppliedEvent` |
| `TurnEnding` | ターン終了 → on_turn_end | `buildTurnEndingEvent` |

全イベントは共通フィールドを持つ:

- `id`, `seq` — 解決順序追跡
- `phasePlayerId`, `activePlayerId`, `phase` — コンテキスト

---

## 4. コンポーネント責務

### EventQueue

- `enqueue` / `dequeue` / `peek` / `isEmpty` / `size` / `drain` / `clone`
- 単一 Action 内の事実を FIFO で保持

### EventDispatcher

- `on(type, listener)` — 登録順に実行、unsubscribe 関数を返す
- `dispatch(event, state)` → `{ state, events?, stopResolution? }`
- `createDefaultEventDispatcher()` — **Listener 未登録の空 Dispatcher**（現行デフォルト）

### EventResolver

```typescript
resolveUntilBlocked(state, queue, dispatcher) → {
  state,           // withSyncedEffectStack 済み
  processedEvents,
  stoppedReason,   // queue_empty | pending_blocked | winner | listener_stop | max_iterations
}
```

**停止条件（`blocking.ts`）:**

1. `state.winner` が確定
2. `hasOpenEffectStack(state)` — `pending*` 導出スタックが非空
3. `deferredBattleEntry` が存在
4. `pendingBattleToRushQueue` が非空
5. Listener が `stopResolution: true` を返す
6. キューが空

### 解決フロー（将来の applyAction 統合イメージ）

```
applyAction → zone/cost 変異
           → EventQueue.enqueue(events)
           → resolveUntilBlocked()
           → withSyncedEffectStack()  // Resolver 内で実施済み
```

---

## 5. テスト結果

### 新規（`events.test.ts`）

| テスト | 検証内容 |
|--------|----------|
| EventQueue FIFO | 投入順 = 取出順 |
| Dispatcher 順序 | 登録順に Listener 実行、state 連鎖 |
| Dispatcher follow-up | Listener の `events` が収集される |
| Resolver 空キュー | デフォルト Dispatcher で queue_empty |
| Resolver listener_stop | `stopResolution` で残キュー保持 |
| Resolver pending_blocked | 既存 Pending 時は dequeue しない |
| Resolver 連鎖 enqueue | Listener 投入イベントを続けて処理 |
| shouldStopEventResolution | winner / effectStack 検出 |

### 回帰（既存 528 テスト）

- `applyAction` 未変更のため **挙動差分なし**
- monkey 80 ゲーム、vertical slice 100 ゲームすべて完走

---

## 6. 意図的に未実施の項目

| 項目 | 理由 |
|------|------|
| `applyAction.ts` からの Event 発行 | 本タスクは基盤のみ。接続は Phase 2 本番で段階実施 |
| カード効果 Listener 登録 | `rushEffects.ts` 等の移行は別 PR |
| `types/events.ts` への分離 | `events/types.ts` に集約（モジュール単位で自己完結） |
| Event 永続ログ `state.eventLog` | MVP 不要（`event-architecture.md` 準拠） |

---

## 7. Phase 2 本番移行の推奨手順

### Step 1 — `UnitRushed` パイロット

1. `applyAction` の `rush` 成功経路末尾で `buildUnitRushedEvent` を enqueue
2. `namedUnitEffects.resolveNamedOnRushEffects` を `UnitRushed` Listener に移動
3. 旧直呼びを削除（テスト `rushEffects.test.ts` で回帰）

### Step 2 — 残り 6 イベント

| 順序 | Event | 現行モジュール |
|------|-------|---------------|
| 2 | `UnitEnteredBattle` | `combo.ts`, `ncEffects.ts` |
| 3 | `BattleDeclared` | `legend2/3/battleEffects.ts` |
| 4 | `StrikeDeclared` | `strikeReactions.ts` |
| 5 | `UnitLeftZone` | `operationCounters.ts`, `destroyEffects.ts` |
| 6 | `DamageApplied` | `postDamageEffects.ts` |
| 7 | `TurnEnding` | `endTurnEffects.ts` |

### Step 3 — Orchestrator 統合

```typescript
// applyAction.ts（将来）
const queue = new EventQueue();
// ... action handler mutates state, enqueues events ...
const { state: resolved } = resolveUntilBlocked(
  state,
  queue,
  getGlobalEventDispatcher(),
);
return { ok: true, state: resolved };
```

**Dispatcher 共有:** ゲーム起動時に `createDefaultEventDispatcher()` + Listener 登録モジュール（`events/registerListeners.ts`）を追加予定。

---

## 8. API クイックリファレンス

```typescript
import {
  EventQueue,
  EventDispatcher,
  EventResolver,
  resolveUntilBlocked,
  createDefaultEventDispatcher,
  buildUnitRushedEvent,
} from "@rangers-strike/engine";

const dispatcher = createDefaultEventDispatcher();
dispatcher.on("UnitRushed", (event, state) => {
  // 将来: effect handler
  return { state };
});

const queue = new EventQueue();
queue.enqueue(buildUnitRushedEvent({
  state,
  rusherPlayerId: "player1",
  instanceId: "inst-1",
  cardId: "RS-050",
}));

const result = resolveUntilBlocked(state, queue, dispatcher);
// result.state, result.stoppedReason, result.processedEvents
```

---

## 9. リスクと緩和

| リスク | 緩和 |
|--------|------|
| 二重解決（直呼び + Event） | 移行時は **イベント経路のみ** に切替えてから旧コード削除 |
| Pending 優先順位崩れ | 各イベント移行後に `effectStack.test.ts` + 該当 integration test |
| 無限ループ（Listener が自身を再 enqueue） | `maxIterations` デフォルト 10,000 + テスト |

---

## 10. 関連ドキュメント

- `docs/architecture/event-architecture.md` — 全体設計
- `docs/architecture/card-flags-migration.md` — Phase 2–5 計画
- `docs/architecture/state-gap-analysis.md` — Pending / Stack 分析
