# イベント駆動アーキテクチャ（最終提案）

**対象:** レンジャーズストライク エンジン（Legend 1–3 コアループ）  
**参照:** `docs/wiki/*`, `state-gap-analysis.md`, `spec-review.md`, `packages/engine/src/types/game.ts`  
**日付:** 2026-06-09  
**コード変更:** なし（設計提案のみ）

---

## 設計方針

現行実装は **Action → 直接 State 変異 → Pending 開閉 → EffectStack 同期** の命令型パイプラインである。Wiki 上の「タイミング」「反応窓」「段階解決」は概ね `pending*` と `buildEffectStack` で表現できているが、カード効果の増殖に伴い `applyAction.ts` / `pendingChoices.ts` への集中が進んでいる。

本提案は **全面リライトではなく、現行 State / Pending / EffectStack を維持したまま Event 層を挟む** ハイブリッド構成を推奨する。

| 原則 | 内容 |
|------|------|
| Pending が正 | ブロック状態・プレイヤー入力待ちの唯一のソース |
| EffectStack は導出 | 優先順位の単一ソース（`timing.md` 準拠）。直接 mutate しない |
| Event は事実 | 「何が起きたか」を記録し、Resolver が効果を連鎖 |
| Action は意図 | プレイヤー/AI の入力。Event を直接発行しない（Orchestrator 経由） |
| State はスナップショット | ゾーン・修飾子・勝敗。解決ロジックを持たない |

---

## 1. 推奨エンジン構成

### 1.1 レイヤ図

```
┌──────────────────────────────────────────────────────────────┐
│  Presentation (apps/web, AI)                                  │
│    getLegalActions(state) → UI                                │
│    applyAction(state, action) ← ユーザー入力                   │
└────────────────────────────┬─────────────────────────────────┘
                             │ GameAction
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Orchestrator — applyAction.ts                                │
│    ① isLegalAction ゲート                                     │
│    ② Action Handler（フェイズ行動 / Pending 応答）              │
│    ③ Zone / Cost 純関数（helpers, catalog）                   │
│    ④ EventQueue へ事実を投入                                   │
│    ⑤ resolveUntilBlocked() — キュー空 or Pending で停止        │
│    ⑥ withSyncedEffectStack()                                  │
└────────────────────────────┬─────────────────────────────────┘
                             │ GameEvent[]
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Resolution Engine（新規 — packages/engine/src/events/）       │
│    EventQueue（FIFO + 優先挿入）                               │
│    TimingRouter → Resolver ディスパッチ                        │
│    SimultaneousGroup 管理（将来）                              │
└──────────────┬───────────────────────────────┬─────────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│  Resolvers（タイミング別）  │    │  Effect Handlers（カード別）   │
│  onRush, onLeave, ...     │    │  legend2/, legend3/, cards   │
└──────────────────────────┘    └──────────────────────────────┘
               │                               │
               └───────────────┬───────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  GameState（スナップショット）                                 │
│    players / phase / turnModifiers / CardInstance 修飾子       │
│    pending* — 入力ブロック（正）                               │
│    effectStack? — buildEffectStack 導出（ビュー）              │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 解決ループ（1 Action あたり）

```
applyAction(state, action):
  state' = actionHandler(state, action)     // 意図の適用・即時変異
  enqueue(events from actionHandler)        // 事実をキューへ
  loop:
    if hasBlockingPending(state'): break
    event = dequeue()
    if event is null: break
    outcome = TimingRouter.dispatch(event, state')
    state' = outcome.state
    enqueue(outcome.newEvents)
    if outcome.openedPending: break        // 反応窓・選択で停止
  return withSyncedEffectStack(state')
```

**停止条件（いずれかでループ終了）:**

1. `pending*` が開いている（プレイヤー入力待ち）
2. Event キューが空
3. `winner` が確定

### 1.3 モジュール配置（目標ディレクトリ）

| パス | 責務 |
|------|------|
| `types/game.ts` | GameState, Pending*, EffectStack 型 |
| `types/actions.ts` | GameAction（プレイヤー意図） |
| `types/events.ts` | **新規** GameEvent, EventContext |
| `core/applyAction.ts` | Orchestrator。Action 分岐のみ |
| `core/legalActions.ts` | 合法 Action 生成（Pending トップ参照） |
| `events/queue.ts` | EventQueue |
| `events/router.ts` | TimingRouter |
| `events/resolvers/*.ts` | タイミング別 Resolver |
| `rules/effectStack.ts` | 導出・peek・hasOpenReactionWindow |
| `rules/*` | 既存ドメイン（damage, battle, rush, ...） |
| `effects/` | カード effectId → handler マップ |

### 1.4 現行からの移行段階

| 段階 | 内容 | リスク |
|------|------|--------|
| **Phase 0（現状）** | Action 内で直接 tryLeaveField / openPending | — |
| **Phase 1** | `types/events.ts` 定義。rush/leave/strike の主要経路のみ Event 発行 | LOW |
| **Phase 2** | Resolver 抽出。`operationCounters.ts` の窓開閉を Event 駆動に | MED |
| **Phase 3** | `pendingEffectChoice` kind 別ファイル分割 + Event 連携 | MED |
| **Phase 4** | 同時解決 `simultaneousGroupId` 書き込み + 順序選択 Pending | MED |

Phase 0 のままでも Legend 1–3 は動作する。Phase 1 以降は **新規カード効果を Resolver / EffectHandler に追加する規約** を先に固定することが目的である。

---

## 2. Event 一覧

Event は **永続ログではなく解決キュー内の事実** とする。`GameState.log` とは別。必要なら将来 `state.eventLog` を追加可能だが、MVP では不要。

### 2.1 分類

#### A. フェイズ・ターン

| Event | 発火タイミング | 主な購読 Resolver |
|-------|---------------|-------------------|
| `turn_started` | スタートフェイズ突入（2T目以降） | startPhase |
| `turn_ended` | エンドフェイズ完了 → 手番交代前 | endTurnEffects |
| `phase_entered` | `end_phase` で次フェイズへ | phaseModifiers |
| `phase_exited` | フェイズ離脱直前 | endPhaseHooks |

#### B. ゾーン・リソース

| Event | 発火タイミング | 主な購読 Resolver |
|-------|---------------|-------------------|
| `card_drawn` | ドロー成功 | onDraw 系 |
| `card_charged` | チャージ（power/command） | — |
| `card_moved` | ゾーン間移動確定 | zoneAuras, fieldEffects |
| `command_released` | スタート一括リリース・個別リリース | — |
| `power_flipped` | ダメージ支払いで裏返し | auraPower 等 |

#### C. ラッシュ

| Event | 発火タイミング | 主な購読 Resolver |
|-------|---------------|-------------------|
| `rush_declared` | rush アクション検証後 | rushEffects, RS-026 順序 |
| `rush_completed` | ラッシュゾーン配置完了 | onRush（**ラッシュされたとき**） |
| `operation_played` | オペ使用・常駐配置 | operationEffects |
| `counter_played` | カウンター解決完了 | counterEffects |

#### D. バトル

| Event | 発火タイミング | 主な購読 Resolver |
|-------|---------------|-------------------|
| `battle_entry_declared` | move_to_battle 開始 | restrictions |
| `battle_entered` | バトルエリア配置・NC 判定前 | enterBattleEffects |
| `nc_triggered` | comboNumber=N の NC 発動 | ncEffects |
| `battle_entry_completed` | 進入効果・選択完了 | — |
| `attack_declared` | attack アクション | onAttack |
| `battle_resolved` | BP 比較・撃破確定後 | onDestroy, register |
| `strike_declared` | strike アクション | onStrike |
| `strike_resolved` | ストライク効果・ダメージ確定後 | postDamageEffects |

#### E. 離場・破壊

| Event | 発火タイミング | 主な購読 Resolver |
|-------|---------------|-------------------|
| `leave_intent` | 離場処理開始（tryLeaveField 入口） | leaveReactions |
| `leave_completed` | 離場確定（反応・レジスト後） | onLeave, destroyEffects |
| `register_offered` | レジスト選択窓オープン | — |
| `register_resolved` | 留場 or 捨札確定 | — |
| `unit_destroyed` | バトル撃破・効果破壊 | onDestroy |

#### F. ダメージ

| Event | 発火タイミング | 主な購読 Resolver |
|-------|---------------|-------------------|
| `damage_assigned` | ダメージ量確定 | — |
| `damage_payment_started` | PendingDamagePayment オープン | — |
| `damage_payment_completed` | 支払い完了 | resumeStrike 等 |
| `player_damaged` | `PlayerState.damage` 更新後 | auraPower, winCheck |

#### G. スタック・反応窓

| Event | 発火タイミング | 主な購読 Resolver |
|-------|---------------|-------------------|
| `reaction_window_opened` | pending* 設定時 | — |
| `reaction_passed` | pass_*_reaction | finalize* |
| `stack_frame_resolved` | Pending クリア・次フレームへ | stackSync |
| `choice_requested` | pendingEffectChoice オープン | — |
| `choice_resolved` | effect choice 完了 | continuation |

#### H. コマンド支払い・ゾード

| Event | 発火タイミング | 主な購読 Resolver |
|-------|---------------|-------------------|
| `command_payment_started` | PendingCommandPayment | — |
| `command_payment_completed` | ホールド確定 | continuation 実行 |
| `zord_setup_step` | PendingZordSetup 各 step | zordSetup |

### 2.2 Event ペイロード（共通フィールド）

```typescript
type GameEventBase = {
  id: string;
  timestamp: number;        // 解決順序（同一 Action 内）
  phasePlayerId: PlayerId;  // フェイズのターンプレイヤー
  activePlayerId: PlayerId; // イベント発生時の手番
  phase: Phase;
};

// 例
type RushCompletedEvent = GameEventBase & {
  type: "rush_completed";
  rusherPlayerId: PlayerId;
  instanceId: string;
  cardId: string;
};
```

### 2.3 Wiki タイミングとの対応

| Wiki タイミング（代表） | 入口 Event | 備考 |
|------------------------|-----------|------|
| ラッシュされたとき | `rush_completed` | 効果ラッシュは `rush_declared` 時点でスキップ可 |
| バトルに出たとき | `battle_entered` | NC は直後 `nc_triggered` |
| アタックするとき | `attack_declared` | 窓は `pendingBattle` |
| ストライクしたとき | `strike_declared` | 窓は `pendingStrike` |
| 離れたとき | `leave_completed` | 窓は `leave_intent` → `pendingLeave` |
| 破壊されたとき | `unit_destroyed` | バトル撃破・効果破壊を統合 |
| ターンを終えるとき | `turn_ended` | エンドフェイズ内サブステップは将来拡張 |
| 自軍エンドフェイズ | `phase_entered` (end) | `end_turn_menu` choice 経由 |

---

## 3. Resolver 一覧

Resolver は **Event + 現在 State を受け取り、State 更新と後続 Event を返す** 純関数群。カード固有ロジックは EffectHandler に委譲する。

### 3.1 コア Resolver

| Resolver | ファイル（現行 → 目標） | 担当 Event | 責務 |
|----------|------------------------|-----------|------|
| **PhaseResolver** | `startPhase.ts`, `applyAction` end_phase | `phase_*`, `turn_*` | フェイズ遷移、スタート行程、TurnModifiers クリア |
| **ZoneResolver** | `helpers.ts` | `card_moved`, `card_drawn` | ゾーン移動、デッキアウト判定 |
| **RushResolver** | `rushEffects.ts` | `rush_*`, `operation_played` | ラッシュ配置、RS-026 順序、pendingRush オープン |
| **BattleEntryResolver** | `battleEntry.ts`, `combo.ts` | `battle_entry_*`, `battle_entered`, `nc_triggered` | 進入制限、NC、deferred/pendingBattleEntry |
| **AttackResolver** | `applyAction` battle 分岐 | `attack_declared`, `battle_resolved` | BP 比較、相討ち、pendingBattle |
| **StrikeResolver** | `strikeReactions.ts` | `strike_*` | pendingStrike、five-tech、ダメージ割当 |
| **LeaveResolver** | `operationCounters.ts` | `leave_*`, `register_*` | tryLeaveField、レジスト、followUp キュー |
| **DamageResolver** | `damagePayment.ts`, `postDamageEffects.ts` | `damage_*`, `player_damaged` | 支払い選択、resume、勝利判定 |
| **CommandPaymentResolver** | `commandPayment.ts` | `command_payment_*` | ホールド支払い、continuation |
| **ZordResolver** | `zordSetup.ts`, `zord.ts` | `zord_setup_step` | 素材・行き先・母艦 |
| **ChoiceResolver** | `pendingChoices.ts` | `choice_*` | 14+ kind の選択 UI ブロック |
| **StackResolver** | `effectStack.ts` | `stack_frame_resolved` | Pending クリア後の再入、activePlayer 復帰 |

### 3.2 カード EffectHandler（Resolver から呼び出し）

| タイミング購読 | 代表モジュール | effectId 例 |
|---------------|---------------|-------------|
| on_rush | `legend2/rushEffects`, `legend3/rushEffects` | falcon_claw, ... |
| on_enter_battle | `legend3/enterBattleEffects` | conditional NC |
| on_attack / on_destroy | `legend2/battleEffects`, `legend3/battleEffects` | mirage_beam |
| on_turn_end | `legend3/endTurnEffects` | end_turn_menu |
| field_aura | `fieldAuras.ts`, `fieldEffects.ts` | BP 常駐修正 |
| operation | `effects/resolveOperation.ts` | オペ効果全般 |

### 3.3 Resolver 呼び出し順（単一 Event 内）

```
1. 否定チェック（「～できない」優先 — FAQ）
2. 強制効果の対象有無
3. カード EffectHandler（ターンプレイヤー順 / simultaneousGroup）
4. ルール強制処理（ゾーン移動、ダメージ）
5. 反応窓オープン判定 → Pending 設定で停止
6. 後続 Event エンキュー
```

### 3.4 同時解決（将来）

| 状況 | 処理 |
|------|------|
| 同一タイミング複数効果 | `simultaneousGroupId` を付与 → `PendingEffectChoice` kind: `simultaneous_order` |
| BP「～になる」複数 | FAQ: 低い方優先 — Resolver 内で自動 |
| 無限ループ懸念 | ターンプレイヤーが適用効果を選択（将来 Pending） |

---

## 4. EffectStack 責務

### 4.1 担うもの

| 責務 | 詳細 |
|------|------|
| **優先順位の単一ソース** | `FRAME_PRIORITY` = Wiki `timing.md` の 10 段階 |
| **応答プレイヤーの導出** | `actorPlayerId` — 反応窓の手番切替 |
| **スタックトップ参照** | `peekEffectStackTop`, `getStackActorPlayerId` |
| **ブロック判定** | `hasOpenEffectStack` — フェイズ行動可否 |
| **反応窓判定** | `hasOpenReactionWindow` — 5 kind のみ（離場〜ラッシュ） |

### 4.2 担わないもの

| 非責務 | 理由 |
|--------|------|
| Pending の作成・削除 | `pending*` が正。Stack は同期ビューのみ |
| 効果の実行 | Resolver / EffectHandler の領域 |
| カードテキスト解釈 | `effects/` + cards パッケージ |
| `deferredBattleEntry` の管理 | **現状ギャップ** — 未登録。将来 `deferred_battle_entry` kind 追加 |
| `pendingBattleToRushQueue` | スタート専用キュー。Stack 外で維持 or 内部キュー化 |

### 4.3 同期契約

```
// 不変条件
effectStack === buildEffectStack(state)  // applyAction 終端で保証

// 禁止
state.effectStack.frames.push(...)       // 直接 mutate しない
```

### 4.4 優先度表（確定）

| priority | kind | Pending ソース |
|----------|------|----------------|
| 0 | leave_reaction | pendingLeave |
| 1 | register_choice | pendingRegister |
| 2 | strike_reaction | pendingStrike |
| 3 | battle_reaction | pendingBattle |
| 4 | rush_reaction | pendingRush |
| 5 | damage_payment | pendingDamagePayment |
| 6 | effect_choice | pendingEffectChoice |
| 7 | battle_entry | pendingBattleEntry |
| 8 | command_payment | pendingCommandPayment |
| 9 | zord_setup | pendingZordSetup |

---

## 5. Pending 系責務

### 5.1 設計原則

**Pending = 「ゲーム進行をブロックし、特定プレイヤーの入力を待つ状態」**

- 同時に複数 Pending フィールドが非 null になりうるが、**EffectStack トップのみが「今解くべき窓」**
- `activePlayer` はトップフレームの `actorPlayerId` に合わせて切替
- Pending 解決 → `stack_frame_resolved` Event → 同一 Action 内で次フレームへ

### 5.2 Pending 種別と責務

| Pending | ブロック種別 | 応答 Action | 解決後の典型遷移 |
|---------|-------------|-------------|-----------------|
| `pendingLeave` | 反応窓 | pass_leave, use_super_shield, play_counter* | leave_completed → register? |
| `pendingRegister` | 選択 | use_register, pass_register | leave_completed |
| `pendingStrike` | 反応窓 | pass_strike, five_tech, play_counter | damage_payment or strike_resolved |
| `pendingBattle` | 反応窓 | pass_battle, play_counter | battle_resolved |
| `pendingRush` | 反応窓 | pass_rush, play_counter | rush 効果続行 |
| `pendingDamagePayment` | 選択 | resolve_damage_payment | resume / player_damaged |
| `pendingEffectChoice` | 選択 | resolve/skip/confirm_effect_choice | 効果続行 or 新 Pending |
| `pendingBattleEntry` | 行動選択 | attack, strike, pass_battle_entry | バトルフェイズ行動 |
| `pendingCommandPayment` | 選択 | resolve/cancel_command_payment | continuation アクション |
| `pendingZordSetup` | ウィザード | resolve/cancel_zord_setup | command_payment or rush |
| `deferredBattleEntry` | **暗黙ブロック** | effect choice 完了後に昇格 | → pendingBattleEntry |
| `pendingBattleToRushQueue` | **暗黙ブロック** | return_all 後の自動処理 | startPhase 専用 |

\* 離場窓中のカウンターはカードにより `play_counter` が合法化される（`operationCounters.ts`）。

### 5.3 Pending と Event の関係

```
Action → Handler が Pending を開く
       → reaction_window_opened / choice_requested Event を enqueue
       → resolveUntilBlocked() が停止
       
応答 Action → Handler が Pending を閉じる
            → stack_frame_resolved Event
            → 必要なら continuation Event（例: command_payment_completed → rush_completed）
```

### 5.4 現行 Pending 構造の評価

**総合判定: 妥当（採用継続）。ただし部分改善が必要。**

#### 妥当な理由

| 観点 | 評価 |
|------|------|
| Wiki 整合 | 反応窓・支払い・選択の 10 種が `timing.md` と 1:1 対応（`state-gap-analysis.md` HIGH） |
| TCG 慣習 | 「スタック＋優先権」モデルと整合。MTG の Step/State より軽量で RS ルールに適合 |
| UI 連携 | 各 Pending がモーダル 1 つに対応（ReactionModal, DamagePaymentModal, EffectChoiceModal 等） |
| テスト | `effectStack.test.ts` で優先順位を検証済み |
| AI | `getLegalActions` が Pending トップで分岐 — 探索可能 |

#### 課題（改善推奨、構造自体の否定ではない）

| 課題 | 深刻度 | 推奨対応 |
|------|--------|----------|
| `pendingEffectChoice` God Object（14 kind） | HIGH | kind 別 discriminated union + ファイル分割（P2） |
| `deferredBattleEntry` が Stack 外 | MED | `deferred_battle_entry` frame 追加（P1） |
| hold-ready boolean と Pending 二重管理 | MED | `PaymentReady` オブジェクト統合（P1） |
| 型レベル相互排他なし | LOW | branded type / runtime assert（任意） |
| `pendingLeave` / `pendingRegister` メタ重複 | LOW | `PendingFieldExit` 統合（P2） |
| `pendingScry` deprecated 残存 | LOW | 削除（P1） |
| `simultaneousGroupId` 未使用 | MED | Event 導入時に書き込み（P1） |

#### 代替案との比較

| 案 | メリット | デメリット | 判定 |
|----|----------|----------|------|
| **現行: GameState optional pending\*** | シリアライズ容易、デバッグ可視性高 | フィールド数増加 | **採用** |
| 単一 `pending: Pending \| null` union | 相互排他を型で保証 | 巨大 union、マイグレーションコスト大 | 却下 |
| Stack のみ（payload 内包） | 単一ソース | ペイロード肥大、既存 UI 全面変更 | 却下 |
| 完全 Event Sourcing | 再生・監査 | RS 1v1 には過剰、既存資産破棄 | 却下 |

**結論:** Pending per timing の構造は **レンジャーズストライクの反応窓モデルに対して正しい抽象** である。問題は「構造の誤り」ではなく「横断関心（優先度・同時解決・中間支払い状態）の散在」であり、Event 層と EffectStack 統合で緩和する。

---

## 6. State 責務

### 6.1 GameState

| フィールド群 | 責務 | 更新者 |
|-------------|------|--------|
| `turn`, `activePlayer`, `firstPlayer`, `phase` | ゲーム進行の骨格 | PhaseResolver, StackResolver |
| `players` | 両プレイヤーの PlayerState | ZoneResolver, 全 Handler |
| `definitions` | 不変カード定義 | createGame のみ |
| `log` | 人間可読履歴 | 各 Handler（副作用） |
| `winner` | 終了判定 | DamageResolver, ZoneResolver |
| `pending*` | ブロック状態 | Pending 開閉 Handler |
| `effectStack?` | 導出ビュー | `withSyncedEffectStack` のみ |
| `deferredBattleEntry` | 進入遅延 | BattleEntryResolver |
| `pendingBattleToRushQueue` | スタート効果キュー | startPhase |

### 6.2 PlayerState

| フィールド群 | 責務 | ライフサイクル |
|-------------|------|---------------|
| ゾーン配列（7+2） | カードの所在 | ゲーム全体 |
| `damage` | 受けたダメージ合計 | 累積（`power.faceDown` と同期） |
| スタート行程フラグ | スタートフェイズ各1回制限 | スタートフェイズ内 |
| `hasChargedThisTurn` | チャージ1T1枚 | ターン終了クリア |
| hold-ready フラグ群 | 支払い完了〜続行の中間状態 | 続行 Action まで |
| `turnModifiers` | 「このターン」効果 | ターン終了クリア |
| `shironLightRushInstanceId` | RS-013 特例 | ラッシュフェイズ終了 |

**State が持たないもの:** 効果解決ロジック、合法 Action 判定、優先度計算。

### 6.3 CardInstance

| フィールド | 責務 | クリアタイミング |
|-----------|------|-----------------|
| `bpModifier`, `spModifier` | 一時ステータス | ターン終了 |
| `commandHeld`, `mothershipHold` | コマンド向き | リリース時 |
| `faceDown` | パワー裏向き＝ダメージ | ゲーム全体 |
| `battleActed` | 1T1回制限 | ターン終了 |
| `registerHeld` | レジスト留場 | 離場まで |
| `mountedOnInstanceId` | RC 乗車 | ライドオフ/離場 |
| `zordMaterialCardId` | ゾード素材記録 | カード依存 |
| `activatedNcEffects` | NC 再発動防止 | ターン終了 |

### 6.4 TurnModifiers

ターンスコープの **プレイヤー単位バフ・制限**。EffectStack と直交。カード追加時の肥大化は `Record<effectId, ModifierState>` への段階移行を推奨（`state-gap-analysis.md` P2）。

### 6.5 派生値（State に持たない）

| 派生関数 | 用途 |
|----------|------|
| `countAvailablePower(state, playerId)` | 自 power + 敵 command マルチ（**未実装 — P0**） |
| `effectiveBp(state, instanceId)` | BP 計算 |
| `buildEffectStack(state)` | スタック導出 |
| `getLegalActions(state)` | 合法 Action 列 |

---

## 7. Action 責務

### 7.1 Action の定義

**Action = プレイヤー（または AI）が明示的に選択できるゲーム上の意図**

- ネットワーク同期の単位
- UI ボタン・キーボードショートカットと 1:1
- Event ではない（Event はエンジン内部の事実）

### 7.2 分類

#### フェイズ行動（ターンプレイヤー、反応窓外）

| Action | フェイズ | 概要 |
|--------|---------|------|
| `draw`, `release_start_commands`, `return_all_battle_to_rush` | start | スタート行程 |
| `charge_power`, `charge_command` | charge | チャージ |
| `rush`, `play_operation`, `shiron_light`, `hidora_egg` | rush | ラッシュ・オペ |
| `move_to_battle`, `attack`, `strike`, `pass_battle_entry`, `battle_dance_retreat` | battle | バトル |
| `end_phase`, `bonus_draw`, `skip_bonus_draw` | 複数 | フェイズ終了・追加ドロー |

#### 支払い・セットアップ（Pending 連動）

| Action | 対応 Pending |
|--------|-------------|
| `initiate_command_payment`, `resolve_command_payment`, `cancel_command_payment` | pendingCommandPayment |
| `begin_zord_setup`, `resolve_zord_setup`, `cancel_zord_setup` | pendingZordSetup |
| `resolve_damage_payment` | pendingDamagePayment |

#### 反応・応答（応答プレイヤー、反応窓内）

| Action | 対応 Pending |
|--------|-------------|
| `pass_strike_reaction`, `five_tech_intercept`, `use_plasma_energy` | pendingStrike |
| `pass_battle_reaction` | pendingBattle |
| `pass_rush_reaction` | pendingRush |
| `pass_leave_reaction`, `use_super_shield` | pendingLeave |
| `use_register`, `pass_register` | pendingRegister |
| `play_counter` | 複数窓（スタックトップで制限） |

#### 効果選択（Pending 連動）

| Action | kind 例 |
|--------|---------|
| `resolve_effect_choice`, `skip_effect_choice`, `confirm_effect_choice` | select_*, scry_keep_one, end_turn_menu |
| `resolve_seabed_draw`, `resolve_ruin_survey` | seabed_draw, deck_top_or_bottom |
| `confirm_denji_reveal`, `confirm_shiron_reveal` | denji_machine, shiron_light |

### 7.3 Action 処理契約

```
applyAction(state, action):
  1. isLegalAction(state, action) — 違反時 error
  2. Action 種別ハンドラで State 変異
  3. 必要な Event をキュー投入
  4. resolveUntilBlocked()
  5. checkWinner()
  6. withSyncedEffectStack()
  7. ActionResult { state, error?, events? }
```

### 7.4 legalActions の責務分離

| 層 | 責務 |
|----|------|
| `hasOpenEffectStack` | フェイズ行動を抑制 |
| `peekEffectStackTop` | 応答 Action のみ生成 |
| `hasOpenReactionWindow` | 反応窓中はカウンター系を追加 |
| カード制限 | `restrictions.ts`, `turnModifiers` |
| コスト | `canAffordPower`（将来 `countAvailablePower`） |

### 7.5 Action と Event の対応（代表）

| Action | 発行 Event（処理後） |
|--------|---------------------|
| `rush` | rush_declared → rush_completed → [onRush effects] → rush_reaction? |
| `attack` | attack_declared → battle_reaction? → battle_resolved → leave_intent... |
| `strike` | strike_declared → strike_reaction? → damage_assigned → damage_payment? |
| `move_to_battle` | battle_entry_declared → command_payment? → battle_entered → nc_triggered → battle_entry_completed |
| `pass_rush_reaction` | reaction_passed → stack_frame_resolved |
| `end_phase` | phase_exited → phase_entered |

---

## 8. エンドツーエンド例

### 8.1 ラッシュ → カウンター（RS-026 順序）

```
[Action] rush
  → rush_declared
  → rush_completed
  → RushResolver: onRush 効果（誘発）を Event キューに展開
  → 誘発効果すべて解決
  → pendingRush オープン（疾風カウンター窓）
  → reaction_window_opened
  → STOP（応答待ち）

[Action] play_counter | pass_rush_reaction
  → stack_frame_resolved
  → フェイズ行動再開
```

### 8.2 アタック → 相討ち → 離場 → レジスト

```
[Action] attack
  → attack_declared
  → pendingBattle（守り側カウンター窓）
  → STOP

[Action] pass_battle_reaction
  → battle_resolved（同 BP）
  → leave_intent（守り側）
  → pendingLeave or 即 leave_completed
  → followUpAttackerLeave キュー
  → leave_intent（攻撃側）
  → pendingRegister?（レジスト対象なら）
  → STOP or 続行
```

### 8.3 バトル進入（支払い二段）

```
[Action] initiate_command_payment (battle_entry)
  → command_payment_started
  → pendingCommandPayment
  → STOP

[Action] resolve_command_payment
  → command_payment_completed
  → battleEntryHoldReady = true（中間状態）
  → pendingCommandPayment クリア

[Action] move_to_battle
  → battle_entered → nc_triggered → ...
  → pendingBattleEntry
  → STOP
```

---

## 9. 未解決・スコープ外

| 項目 | アーキテクチャ上の扱い |
|------|----------------------|
| 敵マルチ→パワー加算 | 派生関数。Event 不要（`countAvailablePower`） |
| ウイング・チェイス | 新 Pending + Resolver 追加。v1 スコープ判断待ち |
| タッグストライク | スコープ外。複数 `PendingStrike` は採用しない |
| エンドフェイズ詳細 | `phase_entered(end)` + `end_turn_menu` で暫定十分 |
| XG / コマンダー | framework ゾーンのみ。専用 Resolver は将来 |

---

## 10. 参照

| 文書 | 役割 |
|------|------|
| [state-gap-analysis.md](./state-gap-analysis.md) | State ギャップ・Pending 評価の詳細 |
| [spec-review.md](./spec-review.md) | Wiki 確定仕様 |
| [docs/wiki/timing.md](../wiki/timing.md) | 優先順位・同時解決 |
| [docs/wiki/state-mapping.md](../wiki/state-mapping.md) | ルール→エンジン対応表 |
| `packages/engine/src/types/game.ts` | GameState 定義 |
| `packages/engine/src/rules/effectStack.ts` | EffectStack 導出 |

---

## 結論

1. **エンジン構成:** 現行の State + Pending + 導出 EffectStack を維持し、**Event キュー + TimingResolver** を Orchestrator と State の間に挿入するハイブリッドが最終形。
2. **EffectStack:** 優先順位ビューに専念。`deferredBattleEntry` の統合が最優先の構造改善。
3. **Pending:** **構造は妥当**。God Object 化と Stack 外 Pending の整理が保守上の課題。
4. **State:** スナップショット + 修飾子。ロジックは持たない。
5. **Action:** プレイヤー意図の唯一の入口。legalActions は Pending トップとフェイズで分岐。

Legend 1–3 の実装を進めるにあたり、新規カード効果は **「EffectHandler 登録 → 対応 Event を発火 → 既存 Pending を再利用」** の順で追加する規約をチーム合意することを推奨する。
