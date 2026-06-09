# ルールエンジン設計

**目的:** カード個別実装なしでゲーム進行（5フェイズ・ラッシュ・バトル・ダメージ・勝敗）が成立するエンジン骨格を定義する。  
**参照:** [spec-review.md](./spec-review.md), [event-architecture.md](./event-architecture.md), [timing.md](../wiki/timing.md), `packages/engine/src/types/*`  
**日付:** 2026-06-09

---

## 設計原則

| 原則 | 内容 |
|------|------|
| **コアループ優先** | フェイズ遷移・ゾーン移動・コスト支払い・反応窓・ダメージはカード非依存で完結 |
| **Pending が正** | ブロック状態（入力待ち）は `GameState.pending*` が唯一のソース |
| **Stack は二層** | 誘発効果キュー（LIFO）+ 反応窓フレーム（優先度順）を分離 |
| **Effect はデータ** | カード効果は `EffectDefinition` / JSON DSL で宣言。ハンドラは primitives の組み合わせ |
| **Action = 意図** | プレイヤー入力のみ。誘発・自動処理は Stack / Event で解決 |

```
Player Action → ルール適用 → Event 投入 → 誘発 Stack 解決 → 反応窓 → 入力待ち or 続行
```

型定義の完全版は [rules-engine-types.ts](./rules-engine-types.ts) を参照。

---

## 1. ゲーム状態設計

### 1.1 Phase（フェイズ）

公式 5 フェイズ。先攻 1 ターン目は `start` を省略し `charge` から開始。

```typescript
type Phase = "start" | "charge" | "rush" | "battle" | "end";

const PHASE_ORDER: Phase[] = ["start", "charge", "rush", "battle", "end"];
```

| Phase | コア進行（カード不要） |
|-------|------------------------|
| `start` | リリース / バトル→ラッシュ戻し / ドロー / 任意追加ドロー |
| `charge` | 手札 1 枚を power または command へ（任意・1T1回） |
| `rush` | ラッシュ / オペ / ゾード（パワー・コマンド支払い含む） |
| `battle` | 進入 / アタック / ストライク / パス |
| `end` | 修飾子クリア・手番交代 |

### 1.2 Zone（ゾーン）

カードの所在。`PlayerState` 上の配列で表現する。

```typescript
/** 公式 7 ゾーン + フレームワーク拡張 */
type ZoneName =
  | "deck"       // 山札（非公開）
  | "hand"       // 手札（上限なし）
  | "discard"    // 捨札（公開）
  | "power"      // パワー（表=チャージ、裏=ダメージ）
  | "command"    // コマンド（最大5枚ホールド）
  | "rush"       // ラッシュ
  | "battle"     // バトル（左詰め = comboNumber）
  | "operation"  // 常駐オペ
  | "exile"      // 除外（拡張）
  | "commander"; // コマンダー（拡張）
```

**ゾーン不変条件:**

- `command` ホールド上限 5。超過は捨札。
- `battle` は左から `comboNumber = 1, 2, 3...`（欠番時は右端が 1）。
- `power` 枚数無制限。`faceDown` と `PlayerState.damage` は同期。

### 1.3 CardInstance（カード実体）

デッキから生成されるゲーム内インスタンス。カード定義への参照 + 場上修飾子。

```typescript
type CardInstance = {
  instanceId: string;
  cardId: string;

  // --- 永続修飾（ゾーン横断） ---
  faceDown?: boolean;           // パワー裏向き = ダメージマーカー
  commandHeld?: boolean;        // コマンド横向きホールド
  mothershipHold?: boolean;     // 母艦ゾード支払いホールド

  // --- ターン/フェイズスコープ修飾 ---
  bpModifier?: number;
  spModifier?: number;
  battleActed?: boolean;        // 1ユニット1T1回（バトル行動）
  activatedNcEffects?: string[]; // NC 再発動防止
  registerHeld?: boolean;       // レジスト留場

  // --- 構造 ---
  mountedOnInstanceId?: string; // RC 乗車
  zordMaterialCardId?: string;  // ゾード素材記録
};
```

カード個別実装がなくても、上記フィールドは **ルールエンジン** が BP 比較・ダメージ支払い・コマンド支払いで使用する。

### 1.4 PlayerState（プレイヤー状態）

```typescript
type PlayerState = {
  id: PlayerId;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  power: CardInstance[];
  command: CardInstance[];
  rush: CardInstance[];
  battle: CardInstance[];
  operation: CardInstance[];
  exile?: CardInstance[];
  commander?: CardInstance[];

  damage: number;               // 受けたダメージ合計（7で勝利）

  // --- フェイズ行程フラグ（カード非依存） ---
  hasChargedThisTurn?: boolean;
  hasDrawnThisStart?: boolean;
  hasReleasedCommandsThisStart?: boolean;
  hasReturnedBattleThisStart?: boolean;

  // --- 支払い中間状態（コマンド二段支払い） ---
  paymentReady?: PaymentReady;

  // --- ターンスコープ修飾（カード効果が書き込む） ---
  turnModifiers?: TurnModifiers;
};
```

**派生値（State に持たない）:**

```typescript
countAvailablePower(state, playerId)
  = own.power.length + opponent.command.filter(isMultiCategory).length
```

### 1.5 GameState（ゲーム全体）

```typescript
type GameState = {
  // --- 骨格 ---
  turn: number;
  activePlayer: PlayerId;       // 現在の手番（Stack トップに従う）
  firstPlayer: PlayerId;
  phase: Phase;
  players: Record<PlayerId, PlayerState>;
  definitions: Record<string, CardDefinition>;
  winner: PlayerId | null;
  log: string[];

  // --- ブロック状態（正） ---
  pendingLeave?: PendingLeave;
  pendingRegister?: PendingRegister;
  pendingStrike?: PendingStrike;
  pendingBattle?: PendingBattle;
  pendingRush?: PendingRush;
  pendingDamagePayment?: PendingDamagePayment;
  pendingEffectChoice?: PendingEffectChoice;
  pendingBattleEntry?: PendingBattleEntry;
  pendingCommandPayment?: PendingCommandPayment;
  pendingZordSetup?: PendingZordSetup;
  deferredBattleEntry?: PendingBattleEntry;

  // --- 解決キュー ---
  triggeredStack: TriggeredStackItem[];  // 誘発効果（LIFO）
  effectStack?: EffectStack;             // pending* から導出（反応窓優先度）

  // --- スタート専用キュー ---
  pendingBattleToRushQueue?: string[];
};
```

### 1.6 Action（プレイヤー意図）

`GameAction` は discriminated union。詳細は §4。

**処理契約:**

```
applyAction(state, action):
  1. assertLegal(state, action)
  2. mutate zones / flags（即時ルール適用）
  3. enqueue GameEvents
  4. resolveTriggeredStack()   // 誘発効果
  5. openReactionWindows()     // カウンター窓
  6. syncEffectStack()
  7. if pending*: STOP else continue until queue empty
```

---

## 2. 優先権設計

レンジャーズストライクの優先権は **3 層** で整理する。

### 2.1 層の概要

```
┌─────────────────────────────────────────────────────────┐
│ Layer A: フェイズ行動権                                  │
│   反応窓・Pending が開いていないときのみターンプレイヤーが行動 │
├─────────────────────────────────────────────────────────┤
│ Layer B: 反応窓（割り込み）                               │
│   離場 → レジスト → ストライク → バトル → ラッシュ        │
│   非ターンプレイヤー（または所有者）が pass / counter     │
├─────────────────────────────────────────────────────────┤
│ Layer C: 誘発効果（同一タイミング内）                      │
│   ルール処理完了後に Stack へ。LIFO で1件ずつ解決          │
│   同順位はターンプレイヤーが順序決定（将来 UI）            │
└─────────────────────────────────────────────────────────┘
```

### 2.2 タイミング → 何が起きるか

| Wiki タイミング | 入口（ルール完了後） | Layer B 反応窓 | Layer C 誘発 |
|----------------|---------------------|----------------|--------------|
| ラッシュ完了 | `rush_completed` | `pendingRush`（疾風カウンター等） | `on_rush` |
| バトル進入 | `battle_entered` | — | `on_enter_battle`, NC |
| アタック宣言 | `attack_declared` | `pendingBattle` | `on_attack` |
| BP 比較・撃破 | `battle_resolved` | — | `on_destroy` |
| 離場意図 | `leave_intent` | `pendingLeave` | `on_leave` |
| 撃破後 | `register_offered` | `pendingRegister` | — |
| ストライク宣言 | `strike_declared` | `pendingStrike` | `on_strike` |
| ダメージ確定 | `damage_assigned` | — | `on_damage` |
| ダメージ支払い | `damage_payment_started` | —（選択窓） | — |
| ターン終了 | `turn_ended` | — | `on_turn_end` |

### 2.3 RS-026 特例（ラッシュ誘発 → カウンター）

```
rush_completed
  → [Layer C] ラッシュ誘発効果をすべて解決（Stack 空になるまで）
  → [Layer B] pendingRush オープン（疾風カウンター窓）
  → STOP
```

誘発効果がカウンター窓より **先**。公式エラッタ確定。

### 2.4 カウンター（`play_counter`）の発動条件

| 条件 | 内容 |
|------|------|
| タイミング | 相手ターン中の反応窓（rush / battle / strike / leave） |
| コスト | リリース状態コマンドをホールド + 相手にリリースコマンド必須 |
| 優先権 | 反応窓の応答プレイヤーのみ |
| 効果 | カード文面（代用・キャンセル等）。コアは `Pending` メタで表現 |

### 2.5 割り込み（反応窓）の優先順位

`effectStack` 導出順（小さいほど先に解決）:

| priority | kind | 応答者 | 典型 Action |
|----------|------|--------|-------------|
| 0 | `leave_reaction` | 離場ユニット所有者 | `pass_leave_reaction`, `play_counter`, `use_super_shield` |
| 1 | `register_choice` | 撃破ユニット所有者 | `use_register`, `pass_register` |
| 2 | `strike_reaction` | 守り側 | `pass_strike_reaction`, `five_tech_intercept`, `play_counter` |
| 3 | `battle_reaction` | 守り側 | `pass_battle_reaction`, `play_counter` |
| 4 | `rush_reaction` | 守り側 | `pass_rush_reaction`, `play_counter` |
| 5 | `damage_payment` | 支払い選択者 | `resolve_damage_payment` |
| 6 | `effect_choice` | 選択者 | `resolve_effect_choice` 等 |
| 7 | `battle_entry` | 進入プレイヤー | `attack`, `strike`, `pass_battle_entry` |
| 8 | `command_payment` | 支払い者 | `resolve_command_payment` |
| 9 | `zord_setup` | ゾード使用者 | `resolve_zord_setup` |

**反応窓中の制約:** `hasOpenReactionWindow` が true の間、フェイズ行動（rush / attack 等）は不可。

### 2.6 否定優先（全タイミング共通）

Resolver 内の最初のステップ:

1. 「～できない」修飾をチェック（`TurnModifiers`, 常駐効果）
2. 「可能なら～」は否定中は不発
3. 強制効果は対象があれば必ず選択

---

## 3. 解決スタック

Magic: The Gathering の Stack に近い **二層モデル** を採用する。

### 3.1 なぜ二層か

| MTG | レンジャーズストライク |
|-----|------------------------|
| 単一 Stack、LIFO | 反応窓は **優先度固定**（離場最優先） |
| インスタント / 速攻 | カウンターは **特定タイミングのみ** |
| 誘発能力は Stack へ | 誘発も Stack へだが、窓とは **別キュー** |

### 3.2 TriggeredStack（誘発効果 — LIFO）

```typescript
type TriggeredStackItem = {
  id: string;
  source: { cardId: string; instanceId: string; controllerId: PlayerId };
  trigger: EffectTrigger;
  effect: EffectDefinition;      // §5
  simultaneousGroupId?: string;  // 同グループは順序選択後に一括
};
```

**解決ループ:**

```
while triggeredStack.length > 0 && !hasBlockingPending(state):
  item = triggeredStack.pop()           // LIFO（後入れ先出し）
  if !checkCondition(item): continue
  if item.requiresChoice:
    open pendingEffectChoice; break
  executeEffectPrimitives(item.effect)
  enqueue new triggers from results
```

**カード未実装時:** `triggeredStack` は空のまま。コアループは影響を受けない。

### 3.3 EffectStack（反応窓 — 優先度順）

`pending*` から `buildEffectStack(state)` で導出。**直接 mutate 禁止。**

```typescript
type EffectStackFrame = {
  id: string;
  kind: EffectStackFrameKind;
  priority: number;
  actorPlayerId?: PlayerId;
  simultaneousGroupId?: string;
};

type EffectStack = { frames: EffectStackFrame[] };
// frames は priority 昇順でソート。トップ = frames[0]
```

**Magic との対応:**

| MTG 概念 | RS 実装 |
|----------|---------|
| Stack 上の Spell | なし（プレイヤー Action は Stack に積まない） |
| 誘発能力 | `TriggeredStack` |
| 優先権パス | `pass_*_reaction` |
| インスタント | `play_counter`（反応窓内のみ） |
| 状態ベースアクション | `pendingDamagePayment`, `pendingCommandPayment` |

### 3.4 1 Action 内の解決フロー（例: アタック）

```
[Action] battle (attack)
  │
  ├─ 即時: BP 比較用メタ設定
  ├─ Event: attack_declared
  │
  ├─ TriggeredStack: on_attack 効果を push（カードあれば）
  ├─ resolve TriggeredStack
  │
  ├─ open pendingBattle (Layer B)
  └─ STOP ───────────────────────────── 守り側の応答待ち

[Action] pass_battle_reaction
  │
  ├─ close pendingBattle
  ├─ Event: battle_resolved
  ├─ TriggeredStack: on_destroy 等
  ├─ leave_intent → pendingLeave → ...
  └─ sync effectStack
```

### 3.5 Stack 不変条件

```typescript
// 常に成立
effectStack === buildEffectStack(state)

// 禁止
state.effectStack.frames.push(...)  // 直接操作しない

// 停止条件（いずれか）
hasBlockingPending(state) || triggeredStack.length === 0 || state.winner !== null
```

---

## 4. Action 一覧

### 4.1 フェイズ行動（反応窓外・ターンプレイヤー）

| Action | フェイズ | 概要 |
|--------|---------|------|
| `draw` | start | 山札から 1 枚ドロー |
| `release_start_commands` | start | ホールド中コマンドをすべてリリース |
| `return_all_battle_to_rush` | start | バトルユニットをラッシュへ戻す |
| `bonus_draw` | start | 手札 < ダメージなら追加 1 枚（任意） |
| `skip_bonus_draw` | start | 追加ドローをスキップ |
| `charge_power` | charge | 手札 1 枚をパワーへ |
| `charge_command` | charge | 手札 1 枚をコマンドへ |
| `rush` | rush | ユニットをラッシュ（ゾード・支払い含む） |
| `play_operation` | rush | オペレーション使用 |
| `begin_zord_setup` | rush | ゾードセットアップ開始 |
| `move_to_battle` | battle | ラッシュからバトル進入 |
| `battle` | battle | アタック（BP 比較） |
| `strike` | battle | ストライク（SP 消費・ダメージ） |
| `pass_battle_entry` | battle | バトル進入後パス |
| `battle_dance_retreat` | battle | バトルダンス（後退） |
| `end_phase` | 全般 | 現フェイズ終了 → 次フェイズ |

### 4.2 支払い・セットアップ（Pending 連動）

| Action | 対応 Pending | 概要 |
|--------|-------------|------|
| `initiate_command_payment` | `pendingCommandPayment` | コマンドホールド支払い開始 |
| `resolve_command_payment` | 〃 | ホールド対象を選択して確定 |
| `cancel_command_payment` | 〃 | 支払いキャンセル |
| `resolve_zord_setup` | `pendingZordSetup` | ゾード素材・行き先選択 |
| `cancel_zord_setup` | 〃 | ゾードセットアップキャンセル |
| `resolve_damage_payment` | `pendingDamagePayment` | ダメージ支払い（パワー裏返し選択） |

### 4.3 反応・応答（反応窓内）

| Action | 対応 Pending | 概要 |
|--------|-------------|------|
| `pass_rush_reaction` | `pendingRush` | ラッシュへの応答パス |
| `pass_battle_reaction` | `pendingBattle` | アタックへの応答パス |
| `pass_strike_reaction` | `pendingStrike` | ストライクへの応答パス |
| `pass_leave_reaction` | `pendingLeave` | 離場への応答パス |
| `play_counter` | 複数窓 | カウンターオペ使用 |
| `five_tech_intercept` | `pendingStrike` | ファイブテック迎撃 |
| `use_plasma_energy` | `pendingStrike` | プラズマエナジー |
| `use_super_shield` | `pendingLeave` | スーパーシールド代用 |
| `use_register` | `pendingRegister` | レジスト留場 |
| `pass_register` | 〃 | レジスト不採用 |

### 4.4 効果選択（Pending 連動）

| Action | 概要 |
|--------|------|
| `resolve_effect_choice` | 対象カードを選択 |
| `skip_effect_choice` | 任意効果をスキップ |
| `confirm_effect_choice` | 複数ステップ選択の確定 |
| `resolve_seabed_draw` | 海底ドロー（山札上下） |
| `resolve_ruin_survey` | ルインサーベイ（山札上下） |
| `confirm_denji_reveal` | デンジマシン公開確認 |
| `confirm_shiron_reveal` | シロンライト公開確認 |

### 4.5 カード固有 Action（コアループ外・オプション）

| Action | 備考 |
|--------|------|
| `shiron_light` | RS-013 専用 |
| `hidora_egg` | RS-071 専用 |

コアループ成立には不要。`effectId` ハンドラまたは JSON DSL で段階的に置換可能。

### 4.6 Action 総数

| 分類 | 件数 |
|------|------|
| フェイズ行動 | 16 |
| 支払い・セットアップ | 6 |
| 反応・応答 | 10 |
| 効果選択 | 7 |
| カード固有 | 2 |
| **合計** | **41** |

---

## 5. Effect 定義

カードテキストを **Trigger → Condition → Primitives** に分解する。

### 5.1 構造

```typescript
type EffectDefinition = {
  id: string;                    // effectId（cards.json と一致）
  name?: string;                 // 【効果名】
  trigger: EffectTrigger;
  condition?: EffectCondition;
  optional?: boolean;            // 「好きなだけ」「任意」
  effects: EffectPrimitive[];    // 順次実行
  chain?: EffectDefinition[];    // 解決後に連鎖（誘発）
};
```

### 5.2 Trigger（発火タイミング）

```typescript
type EffectTrigger =
  | { type: "on_rush" }
  | { type: "on_enter_battle" }
  | { type: "on_attack"; comboPartnerCardIds?: string[] }
  | { type: "on_strike" }
  | { type: "on_destroy" }
  | { type: "on_leave" }
  | { type: "on_turn_end" }
  | { type: "on_damage" }
  | { type: "nc" }                          // comboNumber 一致
  | { type: "nc_or_combo_from"; partnerCardIds: string[] }
  | { type: "joint_combo_l" }
  | { type: "joint_combo_r" }
  | { type: "riding_combo" }
  | { type: "while_in_field" }              // 常駐オーラ
  | { type: "operation"; timing: OperationTiming };
```

### 5.3 Condition（発動条件）

```typescript
type EffectCondition =
  | { type: "always" }
  | { type: "has_target"; target: TargetSelector }
  | { type: "bp_compare"; op: "<" | "<=" | ">" | ">="; value: number }
  | { type: "zone_count"; zone: ZoneName; op: ">="; count: number }
  | { type: "controller_is_phase_player" }
  | { type: "and"; conditions: EffectCondition[] }
  | { type: "not"; condition: EffectCondition };
```

### 5.4 EffectPrimitive（実行単位）

コアループを構成する **組み込みプリミティブ**。カードはこれの組み合わせのみ。

```typescript
type EffectPrimitive =
  // --- ゾーン操作 ---
  | { type: "draw"; amount: number; player?: PlayerRef }
  | { type: "move"; target: TargetSelector; to: ZoneName; position?: "left" | "right" }
  | { type: "discard"; target: TargetSelector }
  | { type: "flip_power"; target: TargetSelector; faceDown: boolean }

  // --- ステータス ---
  | { type: "modify_bp"; target: TargetSelector; amount: number; duration: "turn" }
  | { type: "modify_sp"; target: TargetSelector; amount: number; duration: "turn" }
  | { type: "set_bp"; target: TargetSelector; value: number; duration: "turn" }

  // --- ダメージ ---
  | { type: "deal_damage"; amount: number; target: PlayerRef }
  | { type: "cancel_damage" }
  | { type: "prevent_battle" }              // バトルキャンセル

  // --- コマンド ---
  | { type: "hold_command"; target: TargetSelector }
  | { type: "release_command"; target: TargetSelector }

  // --- 制限 ---
  | { type: "block_battle_entry"; target: TargetSelector; duration: "turn" }
  | { type: "grant_keyword"; keyword: string; duration: "turn" }

  // --- 選択 UI ---
  | { type: "choose"; kind: EffectChoiceKind; valid: TargetSelector; count: number; then: EffectPrimitive[] }

  // --- スタック操作 ---
  | { type: "open_reaction"; window: "rush" | "battle" | "strike" | "leave" }
  | { type: "enqueue_trigger"; effect: EffectDefinition };
```

### 5.5 例: シンプルな on_rush ドロー

```json
{
  "id": "example_rush_draw",
  "trigger": { "type": "on_rush" },
  "condition": { "type": "always" },
  "effects": [
    { "type": "draw", "amount": 1, "player": "controller" }
  ]
}
```

### 5.6 例: 任意バトル進入時ドロー

```json
{
  "id": "example_enter_draw",
  "trigger": { "type": "on_enter_battle" },
  "optional": true,
  "effects": [
    {
      "type": "choose",
      "kind": "confirm",
      "valid": { "type": "self" },
      "count": 0,
      "then": [{ "type": "draw", "amount": 1 }]
    }
  ]
}
```

### 5.7 コアループとの関係

| コアループ処理 | 実装場所 | EffectPrimitive 不要 |
|---------------|----------|------------------------|
| フェイズ遷移 | `applyAction` / PhaseResolver | ✓ |
| ラッシュ手順 | `rush` handler | ✓ |
| BP 比較 | `battle` handler | ✓ |
| ダメージ支払い | `damagePayment` | ✓ |
| カウンター窓 | `operationCounters` | ✓ |
| カード誘発 | `TriggeredStack` | primitives で表現 |

---

## 6. JSON DSL

将来的にカードを **JSON のみ** で定義するためのスキーマ。

### 6.1 カードファイル構造

```json
{
  "$schema": "./card-effect.schema.json",
  "cardId": "RS-001",
  "unnamedRules": [
    { "rule": "battle_entry_hold", "holdCount": 1 }
  ],
  "effects": [
    {
      "id": "goren_storm",
      "name": "ゴーレンストーム",
      "trigger": { "type": "nc" },
      "effects": [
        {
          "type": "modify_bp",
          "target": { "type": "self" },
          "amount": 3000,
          "duration": "turn"
        }
      ]
    }
  ]
}
```

### 6.2 TargetSelector DSL

```json
{ "type": "self" }
{ "type": "controller" }
{ "type": "opponent" }
{ "type": "zone"; "zone": "battle"; "owner": "self"; "filter": { "size": "S" } }
{ "type": "instance"; "instanceId": "$trigger" }
{ "type": "card_id"; "cardId": "RS-042" }
```

### 6.3 段階的導入計画

| 段階 | 対象 | 方式 |
|------|------|------|
| Phase 0 | コアループ | TypeScript ハンドラのみ |
| Phase 1 | 単純効果（draw, modify_bp） | JSON + primitive interpreter |
| Phase 2 | 選択 UI 系 | JSON `choose` + `EffectChoiceKind` |
| Phase 3 | JC / RC / ウイング | 専用 trigger + 拡張 primitives |
| Phase 4 | 複合・代替テキスト | `effectId` フォールバック（TS ハンドラ） |

**フォールバック規約:**

```typescript
resolveEffect(effectId, state, ctx):
  if jsonEffects[effectId]: return interpretJson(jsonEffects[effectId])
  if tsHandlers[effectId]:  return tsHandlers[effectId](state, ctx)
  return state  // 未実装 = 不発（ゲームは続行）
```

### 6.4 JSON Schema ファイル名（提案）

```
packages/cards/
  schema/
    card-effect.schema.json
    effect-primitive.schema.json
  effects/
    legend1/
      RS-001.json
    legend2/
      ...
```

---

## 7. TypeScript 型定義

完全な型コードは **[rules-engine-types.ts](./rules-engine-types.ts)** に出力済み。

主要エクスポート:

| 型 | 役割 |
|----|------|
| `GameState` | ゲームスナップショット |
| `PlayerState` | プレイヤーゾーン・修飾子 |
| `CardInstance` | 場上カード実体 |
| `ZoneName` | ゾーン識別子 |
| `Phase` | フェイズ |
| `GameAction` | 全 41 Action の union |
| `EffectStack` / `TriggeredStackItem` | 二層 Stack |
| `EffectDefinition` / `EffectPrimitive` | カード効果 DSL |
| `CardEffectDocument` | JSON カードファイル型 |

---

## 参照

| 文書 | 役割 |
|------|------|
| [rules-engine-types.ts](./rules-engine-types.ts) | §7 型定義 |
| [event-architecture.md](./event-architecture.md) | Event / Resolver 詳細 |
| [state-gap-analysis.md](./state-gap-analysis.md) | 現行実装ギャップ |
| [timing.md](../wiki/timing.md) | 公式優先順位 |
| `packages/cards/src/effectTaxonomy.ts` | 既存効果分類 |
