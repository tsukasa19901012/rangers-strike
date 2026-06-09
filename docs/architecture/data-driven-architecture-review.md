# データ駆動アーキテクチャレビュー

**目的:** カード固有処理の増殖を止め、完全データ駆動へ寄せるための現行設計レビュー  
**対象:** [rules-engine-design.md](./rules-engine-design.md), [event-architecture.md](./event-architecture.md), `packages/engine`, `packages/cards`  
**日付:** 2026-06-09

---

## 現状サマリ

| 指標 | 現状 | 理想 |
|------|------|------|
| `applyAction.ts` | **1,722 行**、41 case 分岐 | Orchestrator のみ（<300 行） |
| `pendingChoices.ts` | **1,580 行**、effectId 分岐 15+ | kind 別モジュール + DSL interpreter |
| `namedUnitEffects.ts` | **723 行**、legend2/3 委譲 | trigger ルータ + JSON 解決 |
| `resolveOperation.ts` | **817 行**、effectId switch 40+ | primitive interpreter |
| `TurnModifiers` | カード固有フィールド **8/15** | `Record<instanceId, ModifierBag>` |
| カードデータ | `unitEffects.json` に trigger あり | **実行も JSON**（現状は effectId → TS のみ） |
| Event 層 | 設計のみ | 未実装（applyAction 直結） |
| `triggeredStack` | 設計のみ | 未実装 |

**結論:** データは `unitEffects.json` / `effectTaxonomy.ts` に集約し始めているが、**実行経路は TypeScript の effectId 分岐が正**であり、カード追加 = コード変更が既定になっている。

---

## 問題点

### P1. 実行経路が「effectId → TS 関数」一択

`unitEffects.json` は trigger・effectId・partnerCardIds を持つが、エンジンは次のように解決する。

```
effectId === "ghost_absorption"  → pendingChoices.ts 内 if 分岐
effectId === "dump_punch"        → legend2/battleEffects.ts
effectId === "denji_machine"     → denjiMachine.ts 専用モジュール
cardId === "RS-047"              → restrictions.ts 直書き
```

データと実行が **二重管理**。JSON を更新しても TS 未実装なら不発、TS だけあれば JSON 不要 — 整合が崩れる。

### P2. God Object 3 つが全カード効果のハブ

| ファイル | 問題 |
|----------|------|
| `applyAction.ts` | フェイズ行動・Pending 応答・effectId 特例・ログが混在 |
| `pendingChoices.ts` | 14 `EffectChoiceKind` + effectId 別 resolve ロジック |
| `namedUnitEffects.ts` | on_rush / on_attack / on_destroy の legend2/3 振り分け |

新カード 1 枚で最大 3 ファイルに触れる構造。

### P3. legend2 / legend3 フォルダ分割

`rules/legend2/*` と `rules/legend3/*` が rushEffects / battleEffects / ncEffects / destroyEffects を **ほぼ鏡像** で保持。Legend 4 追加時に `legend4/` が増えるパターン。拡張番号はデータの属性であり、コードの境界であるべきではない。

### P4. State がカード固有フィールドを吸収

```typescript
// game.ts — カード追加のたびに型拡張
TurnModifiers: shironLightUsed, hidoraEggUsed, infiniteChainActive, ...
PlayerState: battleEntryHoldReady × 5, shironLightRushInstanceId
CardInstance: shironLightUsedThisRush
PendingEffectChoice: DenjiMachineMeta, ShironLightMeta, SeabedDrawMeta
```

RS-013 シロンライトだけで **4 層** に状態が分散（state-gap-analysis 既出）。

### P5. カード固有 GameAction

| Action | 本来の表現 |
|--------|-----------|
| `shiron_light` | `play_operation` + effectId `shiron_light` |
| `hidora_egg` | `play_operation` + effectId `hidora_egg` |
| `battle_dance_retreat` | `play_operation` + 支払いメタ |
| `confirm_denji_reveal` | `confirm_effect_choice` + kind |

Action 数がカードとともに増える。合法 Action 生成・AI・UI すべてに波及。

### P6. 設計と実装のギャップ

[rules-engine-design.md](./rules-engine-design.md) は `triggeredStack`・`paymentReady`・JSON DSL を提案するが、実装は Phase 0 のまま。設計を追うと「書いただけの層」が増え、実装は旧経路が肥大化する **最悪の両立** になりうる。

### P7. 制限ルールの cardId 直書き

`restrictions.ts` に `RS-047`（Pat Signer）、`RS-022`（Earth Force）等。`UnnamedUnitRule`（effectTaxonomy）が既にあるのに、エンジン側で cardId 照合が残存。

---

## 将来破綻する箇所

| 箇所 | 破綻トリガー | 症状 |
|------|-------------|------|
| `pendingChoices.ts` | Legend 4+ の選択 UI 効果 | 2,000 行超、merge conflict 常態化 |
| `TurnModifiers` 型 | カード 50+ | 型が読めない、クリア漏れ |
| `applyAction` effectId if 連鎖 | Tier 4 全 effectId | 単体テスト不能、回帰爆発 |
| `restrictions.ts` | 常駐・フィールド効果増 | cardId / effectId の散在チェック |
| hold-ready boolean 群 | 支払い条件カード増 | 中間状態バグ（クリア漏れ） |
| integration test | 正しい中間状態の手動構築 | 新カードごとに fixture 複雑化 |
| `legalActions.ts` | effectId 特例（cyber_s_rider 等） | 合法手と実効のズレ |
| Web UI | `webUiEffectCoverage` gap | エンジン・UI 二重実装 |
| JC / RC / ウイング / チェイス | Tier 3 キーワード | 現パターンのままなら +4 モジュール群 |
| `simultaneousGroupId` | 同時効果 UI 実装 | 既存 Pending 群との再設計 |

**破綻の共通式:** `if (effectId === "xxx")` の本数がカード数に比例する限り、O(cards) のコード量は避けられない。

---

## DSL化できる箇所

`unitEffects.json` + `effectTaxonomy.ts` を **実行可能 DSL** に拡張する候補。

### 即 DSL 化可能（HIGH — 既存 JSON に足すだけ）

| カテゴリ | 現状 | DSL 案 | 該当例 |
|----------|------|--------|--------|
| 無名ルール ※ | `UnnamedUnitRule` id のみ | `{ rule, params }` 実行 | `battle_entry_hold`, `no_battle_entry_turn_rushed` |
| Rush 追加条件 | 構造化済み | そのまま `zord.ts` が解釈 | `send_s_unit_to_power` |
| on_rush ドロー | TS `drawEffects` | `{ type: "draw", amount: 1 }` | 単純誘発 |
| BP 修正 NC | TS `bpModifier` | `{ type: "modify_bp", amount: 2000, duration: "turn" }` | eagle_diving 系 |
| while_in_field オーラ | TS fieldAuras | `{ type: "aura_bp", filter, amount, when }` | signal_cannon 系 |
| ゾーン移動 | TS 各所 | `{ type: "move", target, to, filter }` | armor_attack |
| ダメージ | TS damagePayment | `{ type: "deal_damage", amount, target }` | オペ系 |
| opponent_may_draw | TS 専用関数 | `{ type: "optional_draw", target: "opponent", amount: 1 }` | RS-115 |
| デッキ上下 | seabed / ruin | `{ type: "deck_place", count, placement }` | seabed_survey |
| 捨札回収 | TS fusionReturn | `{ type: "return_from_discard", filter }` | ゾード素材 |

### 中期 DSL 化（MEDIUM — choose primitive 必要）

| カテゴリ | DSL 拡張 |
|----------|----------|
| 対象選択 | `{ type: "choose", selector, count, then: [...] }` |
| BP 予算選択 | `{ type: "choose_bp_budget", maxBp, then }` |
| 複数コマンド選択 | `{ type: "choose_commands", count, filter }` |
| 任意効果 | `{ optional: true, effects: [...] }` |
| 条件分岐 | `{ type: "if", condition, then, else }` |
| コンボパートナー | trigger に既存 `partnerCardIds` — 実行側が参照するだけ |

### 長期 DSL 化（LOW — 専用 primitive or フォールバック）

| カテゴリ | 理由 |
|----------|------|
| デンジマシン多段 | ステップウィザード → `EffectChoiceKind` の state machine 化後 |
| シロンライト公開 | 多段 reveal → 汎用 `reveal_and_confirm` primitive |
| JC / RC | 配置ルールが構造的 — `joint_combo_l/r` trigger + 専用 3 primitive |
| カウンター代用・キャンセル | `counter_effect: { mode: "substitute" \| "cancel" }` |
| ウイング / チェイス | キーワード primitive 追加後 |

### DSL ファイル配置（提案）

```
packages/cards/effects/
  primitives.schema.json      # EffectPrimitive 検証
  RS-046.json                 # namedEffects[].effects: Primitive[]
  operations/
    OP-xxx.json
```

`unitEffects.json` の `namedEffects` に `effects: EffectPrimitive[]` を追加し、**effectId は primitive 束の alias** に格下げする。

---

## 共通 Effect 化できる箇所

カード固有 TS を **primitive 組み合わせ** に置き換え可能なパターン。

### Tier A — 既に resolveOperation でパターン化済み（共通化のみ）

| primitive 名 | 既存 effectId 例 | 実装箇所 |
|-------------|-----------------|----------|
| `Draw` | draw_1 | resolveOperation |
| `DealDamage` | deal_damage_1/2 | resolveOperation |
| `BpBoost` | bp_boost_4000 | resolveOperation |
| `AuraPower` | aura_power | resolveOperation + TurnModifiers |
| `DiscardToHand` | discard_to_hand | resolveOperation |
| `SComboFinisher` | goren_storm, jacker_hurricane | resolveOperation |

→ `resolveOperation` の case を **1 つの `interpretPrimitive()`** に統合。

### Tier B — namedUnitEffects / pendingChoices に散在

| 共通 Effect | 現状の重複 | 統合先 |
|------------|-----------|--------|
| `ModifyBp` | legend2/3 battleEffects, ncEffects | `primitives/modifyBp.ts` |
| `UsePrintedBp` | shark_jaws, super_dynamite | `{ type: "battle_rule", rule: "use_printed_defender_bp" }` |
| `BlockCounter` | ptera_dagger 等 | `{ type: "battle_rule", rule: "block_counter" }` |
| `SelectUnitMove` | armor_attack, ghost_absorption | `choose` + `move` |
| `ReturnToHand` | RS-112 | `{ type: "move", to: "hand", condition: "on_damage_threshold" }` |
| `SeabedDraw` | seabed_survey, ruin_survey | `DeckPlace` primitive |
| `OpponentDraw` | opponent_may_draw_on_enter | `OptionalDraw` primitive |
| `EnterBattleDiscard` | battle_entry_discard 系 | `UnnamedUnitRule` + 支払い state machine |

### Tier C — 制限・常駐（restrictions / fieldEffects）

| 共通 Effect | DSL 表現 |
|------------|----------|
| バトル進入ブロック | `{ type: "restriction", rule: "block_battle_entry", filter }` |
| サイズ制限アタック | `{ type: "restriction", rule: "attack_target_zone", zone: "rush" }` |
| 常駐 BP オーラ | `{ trigger: "while_in_field", effects: [{ type: "aura_bp", ... }] }` |
| ターン中ラッシュ不可 | `UnnamedUnitRule: no_battle_entry_turn_rushed`（実装済 taxonomy） |

### 共通 Effect レジストリ（目標）

```typescript
const PRIMITIVES: Record<PrimitiveType, PrimitiveHandler> = {
  draw: interpretDraw,
  move: interpretMove,
  modify_bp: interpretModifyBp,
  deal_damage: interpretDealDamage,
  choose: interpretChoose,
  // ... 20〜30 種で 80% カバー
};

// カード固有は最後の手段
const FALLBACK_HANDLERS: Record<string, EffectHandler> = {
  denji_machine: handleDenjiMachine,  // 段階的に DSL へ
};
```

**目標カバー率:** Legend 1–3 の effectId **~70%** を 25 primitive 以内、残り 30% はフォールバック → 段階的に primitive 追加。

---

## Event 化できる箇所

現状は `applyAction` 内で直列呼び出し。 [event-architecture.md](./event-architecture.md) の Event を **差し込みポイント** として具体化。

### 即 Event 化（コアループ — カード不要）

| Event | 現状の呼び出し元 | Event 化の効果 |
|-------|----------------|----------------|
| `phase_entered` / `phase_exited` | `advancePhase` | フェイズフックの単一購読 |
| `card_drawn` | draw / startPhase | デッキアウト・誘発の統一入口 |
| `rush_completed` | `finalizeRushAction` | on_rush の唯一の入口（RS-026 順序保証） |
| `attack_declared` | applyAction battle | on_attack 誘発の分離 |
| `battle_resolved` | applyAction battle | on_destroy / register の分離 |
| `leave_intent` | `tryLeaveField` | 離場窓の単一入口 |
| `strike_declared` | applyAction strike | on_strike / pendingStrike |
| `damage_assigned` | strikeReactions | ダメージ支払い連鎖 |
| `command_payment_completed` | commandPayment | continuation の明示 |
| `stack_frame_resolved` | 各 pass_* | Stack 同期の単一ポイント |

### 中期 Event 化（カード効果の購読）

| Event | 購読者 |
|-------|--------|
| `nc_triggered` | NC primitive interpreter |
| `turn_ended` | on_turn_end effects |
| `operation_played` | オペ誘発 |
| `counter_played` | カウンター効果 |
| `player_damaged` | 閾値効果（RS-112 等） |

### Event 化してはいけないもの

| 対象 | 理由 |
|------|------|
| プレイヤー Action そのもの | Action = 意図、Event = 事実 |
| BP 比較の内部計算 | 純関数のまま |
| `getLegalActions` | 読み取り専用 |

### Event 導入後の解決ループ

```
applyAction → events[] enqueue
→ while queue not empty && !pending:
    event = dequeue()
    primitives = lookupSubscriptions(event.type)  // JSON + registry
    for each: runPrimitive or push triggeredStack
    openReactionWindows()
```

**効果:** カード追加 = `subscriptions.json` に `{ event, effectId }` を足すだけでよい経路ができる。

---

## StateMachine 化できる箇所

手続き型 if 連鎖を **明示的 FSM** に置き換える候補。カード非依存の骨格が対象。

### SM-1. スタートフェイズ行程

```
States: [Release, ReturnBattle, Draw, BonusDraw?, Done]
Transitions: 任意順・各1回（FAQ）
Flags: hasReleasedCommandsThisStart, ...
```

→ `StartPhaseMachine` が合法 Action を生成。`applyAction` から行程ロジックを除去。

### SM-2. ラッシュ手順

```
States: [CheckPower, CheckAdditional, HoldCommand, PlaceRush, OnRushEffects, CounterWindow]
```

パワー不足で停止、追加条件（JSON `rushAdditionalCondition`）で分岐。カード固有なし。

### SM-3. コマンド支払い（二段）

```
States: [SelectCommands, HoldConfirmed, AwaitContinuation]
Continuation: move_to_battle | rush | play_counter | effect_choice
```

`paymentReady` を SM の内部状態に吸収。boolean 5 個を廃止。

### SM-4. ゾードセットアップ

```
States: [Material, Destination, Mothership?, CommandPayment]
```

既存 `PendingZordSetup.step` を FSM として正式化。

### SM-5. バトル進入

```
States: [PreCheck, CommandPayment?, DeferredChoice?, Move, NcResolve, BattleEntryChoice]
```

`deferredBattleEntry` → `pendingBattleEntry` の昇格を遷移表で明示。

### SM-6. ダメージ支払い

```
States: [AssignDamage, SelectFlips, DeckFlip, ResumeStrike?]
```

`remainingFlips` / `deckDraws` が SM 状態。

### SM-7. 離場 → レジスト連鎖

```
States: [LeaveIntent, LeaveReaction?, RegisterChoice?, LeaveComplete, FollowUpLeave?]
```

`followUpAttackerLeave` をキューではなく FSM の parallel region またはサブマシンで表現。

### SM-8. エンドフェイズ

```
States: [EndTurnEffects, SelfEndPhase, ClearModifiers, PassTurn]
```

`end_turn_menu` choice を SM の分岐に。

### StateMachine 実装方針

```typescript
type PhaseMachine<S extends string> = {
  state: S;
  transition(action: GameAction, ctx: GameState): { next: S; effects: GameEvent[] } | "illegal";
  legalActions(ctx: GameState): GameAction[];
};
```

カード効果は SM の **遷移ガード** や **onEnter フック** として注入（JSON `hooks: { onEnter_battle: [...] }`）、SM 本体は不変。

---

## 最終アーキテクチャ

### 目標形（完全データ駆動への寄せ）

```
┌─────────────────────────────────────────────────────────────────┐
│ Presentation (Web / AI)                                            │
│   getLegalActions(state) ← 各 StateMachine.legalActions の合成    │
└────────────────────────────┬────────────────────────────────────┘
                             │ GameAction
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Orchestrator (applyAction — 薄い)                                │
│   ① route to active StateMachine                                 │
│   ② enqueue GameEvents                                           │
│   ③ EventDispatcher.resolveUntilBlocked()                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐
│ PhaseMachines   │ │ EventDispatcher │ │ EffectInterpreter    │
│ start/rush/     │ │ FIFO + 優先挿入│ │ JSON primitives      │
│ battle/payment  │ │                 │ │ + fallback handlers  │
└─────────────────┘ └────────┬────────┘ └──────────┬───────────┘
                             │                      │
                             ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ GameState                                                        │
│   zones / modifiers / winner                                     │
│   pending*（ブロック正）← StateMachine が開閉                      │
│   triggeredStack（誘発 LIFO）                                    │
│   effectStack（pending* 導出ビュー）                             │
└─────────────────────────────────────────────────────────────────┘
                             ▲
                             │ 読み取りのみ
┌─────────────────────────────────────────────────────────────────┐
│ Card Data (packages/cards)                                       │
│   cards.json — ステータス・テキスト                               │
│   effects/*.json — EffectDefinition (trigger + primitives)       │
│   unnamedRules — ※ 制限（effectTaxonomy）                        │
│   subscriptions.json — event → effect マップ（任意）              │
└─────────────────────────────────────────────────────────────────┘
```

### レイヤ責務

| レイヤ | 責務 | カード固有コード |
|--------|------|-----------------|
| **PhaseMachines** | 手順・支払い・行程の遷移 | **なし** |
| **EventDispatcher** | タイミング通知・誘発キュー | **なし** |
| **EffectInterpreter** | primitive 実行 | **なし**（fallback のみ） |
| **Pending*** | 入力ブロック状態 | **なし** |
| **Card JSON** | 効果宣言 | **データのみ** |
| **Fallback handlers** | DSL 未表現の複合効果 | **最小限・減衰前提** |

### データフロー（カード追加時）

```
1. effects/RS-xxx.json に trigger + primitives を記述
2. verify-effect-schema CI
3. 実行時: Event → Interpreter → primitives
4. 未カバー primitive → CI が警告 → primitive 追加 or fallback 登録
```

**コード変更なしでカード追加できる条件:** 既存 primitive の組み合わせのみで表現できる効果に限る。新パターンは primitive 追加（横展開）で吸収。

### 型の最終形

| 型 | 変更 |
|----|------|
| `TurnModifiers` | `activeEffects: Record<string, ModifierState>` に一本化 |
| `PlayerState` | `paymentReady` オブジェクト、カード固有フラグ削除 |
| `PendingEffectChoice` | `kind` + 汎用 `meta: JsonValue`、`DenjiMachineMeta` 等廃止 |
| `GameAction` | カード固有 3 種削除 → 汎用 `resolve_effect_choice` に統合 |
| `CardEffectDocument` | [rules-engine-types.ts](./rules-engine-types.ts) を packages/cards へ移動 |

### 移行ロードマップ（データ駆動化）

| 段階 | 内容 | カード固有 TS 削減目標 |
|------|------|----------------------|
| **D0** | `countAvailablePower` + primitive 基盤 5 種（draw/move/modify_bp/deal_damage/choose） | 0%（基盤） |
| **D1** | Start/Rush/Battle Entry の StateMachine 抽出 | applyAction -40% |
| **D2** | EventDispatcher + rush/leave/strike 3 経路 | legend2/3 rushEffects 統合 |
| **D3** | resolveOperation → interpreter 置換 | resolveOperation case -60% |
| **D4** | pendingChoices effectId 分岐 → interpreter | pendingChoices -50% |
| **D5** | UnnamedUnitRule 全件 DSL 化 | restrictions cardId 直書き 0 |
| **D6** | fallback リスト < 10 effectId | Legend 1–3 の 90% JSON のみ |

### 採用しないもの

| 案 | 理由 |
|----|------|
| 完全 Event Sourcing | 1v1 シミュレーターに過剰 |
| 単一 Pending union | マイグレーションコスト大、UI 破壊 |
| legend4/5 フォルダ | 拡張番号でコード分割しない |
| 全カード 100% JSON | 複合効果は fallback 許容、段階的に primitive 拡張 |

### 成功判定

| 指標 | 目標 |
|------|------|
| 新カード追加の TS 変更 | primitive 組み合わせなら **0 file** |
| `applyAction.ts` 行数 | **< 400** |
| `pendingChoices.ts` 行数 | **< 600**（kind 別分割後） |
| effectId 直書き if | **< 15**（fallback のみ） |
| TurnModifiers 固定フィールド | **0**（Record のみ） |
| CI | `verify-effect-schema` + `primitive-coverage` |

---

## まとめ

| 観点 | 現状 | あるべき姿 |
|------|------|-----------|
| カードデータ | JSON に trigger あり | JSON に **primitives** まで含め実行 |
| 実行 | effectId → TS 関数 | **Interpreter → primitives**、fallback 最小 |
| 手順 | applyAction 内 if | **Phase StateMachines** |
| タイミング | 直列関数呼び出し | **EventDispatcher** |
| 状態 | カード固有フィールド増殖 | **汎用 ModifierBag + Pending** |
| フォルダ | legend2/3 分割 | **拡張非依存の engine/** |

現行 [rules-engine-design.md](./rules-engine-design.md) の方向性は正しい。不足しているのは **「設計を書く」ではなく「実行経路を interpreter に切り替える」移行順序** である。最優先は **D0（primitive 基盤）+ D1（StateMachine 抽出）** — これによりカード未実装でもゲーム進行が保たれたまま、カード追加がデータ作業に変わる。

---

## 参照

| 文書 | 役割 |
|------|------|
| [rules-engine-design.md](./rules-engine-design.md) | 現行設計案 |
| [rules-engine-types.ts](./rules-engine-types.ts) | 提案型 |
| [event-architecture.md](./event-architecture.md) | Event 一覧 |
| [state-gap-analysis.md](./state-gap-analysis.md) | 技術的負債 |
| [final-architecture-review.md](./final-architecture-review.md) | GO_WITH_REFACTOR 判定 |
| `packages/cards/src/effectTaxonomy.ts` | 既存効果分類 |
| `packages/cards/src/legend*/unitEffects.json` | カード効果データ |
