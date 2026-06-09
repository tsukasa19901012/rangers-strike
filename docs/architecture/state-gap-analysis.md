# State ギャップ分析

**対象:** `GameState` / `PlayerState` / `EffectStack` / Pending 系  
**参照:** `docs/wiki/core-rules.md`, `phases.md`, `battle.md`, `rush.md`, `damage.md`, `timing.md`, `state-mapping.md`, `engine-gaps.md`  
**実装:** `packages/engine/src/types/game.ts`, `packages/engine/src/rules/effectStack.ts`  
**日付:** 2026-06-09  
**コード変更:** なし（分析のみ）

---

## 概要

現行 State は Wiki コアルール（5フェイズ・7ゾーン・反応窓・ダメージ支払い）の **80%以上をカバー** している。フェイズ構造・Pending 反応窓・EffectStack 導出は Wiki `timing.md` と整合。最大の仕様ギャップは **パワー計算（敵マルチコマンド未加算）** と **同時効果のプレイヤー順序選択**。設計上の主課題は **PlayerState の boolean 乱立** と **Pending / EffectStack の二重表現**。

| 領域 | Wiki 整合 | 主な課題 |
|------|-----------|----------|
| GameState コア | HIGH | エンドフェイズ詳細手順なし |
| PlayerState ゾーン | HIGH | hold-ready フラグ群 |
| EffectStack | HIGH/MEDIUM | 未統合 Pending 3種 |
| Pending 系 | HIGH | 型の肥大化・重複 |
| TurnModifiers | MEDIUM | カード別フィールド増殖 |

---

# 問題なし

Wiki 仕様と現行実装が整合している箇所。

## GameState コア

| Wiki 要件 | 実装 | 出典 |
|-----------|------|------|
| 5フェイズ | `phase: start \| charge \| rush \| battle \| end` | core-rules, phases |
| ターン・手番 | `turn`, `activePlayer`, `firstPlayer` | core-rules |
| 先攻1T目スタート省略 | `createGame` → phase=charge | phases, glossary |
| 勝者 | `winner` + `WIN_DAMAGE=7` | damage, phases |
| カード定義 | `definitions` | — |
| ログ | `log[]` | — |
| コマンド上限5 | `COMMAND_ZONE_MAX = 5` | core-rules |

## PlayerState ゾーン

| Wiki 要件 | 実装 | 出典 |
|-----------|------|------|
| 7公式ゾーン | deck / hand / discard / power / command / rush / battle / operation | core-rules |
| パワー表裏 | `CardInstance.faceDown` + `PlayerState.damage` | damage, core-rules |
| コマンドホールド | `CardInstance.commandHeld` | core-rules |
| チャージ1T1枚 | `hasChargedThisTurn` | phases |
| スタート行程 | `hasDrawnThisStart`, `hasReleasedCommandsThisStart`, `hasReturnedBattleThisStart`, `hasPaidEarthForceUpkeep` | phases |
| フレームワーク拡張 | `exile?`, `commander?` | engine-gaps（意図的） |

## 反応窓・Pending 系（Wiki 主要フロー）

| Wiki タイミング | Pending | EffectStack kind | 出典 |
|-----------------|---------|------------------|------|
| 離場応答 | `pendingLeave` | leave_reaction (0) | battle, timing |
| レジスト | `pendingRegister` | register_choice (1) | battle |
| ストライク応答 | `pendingStrike` | strike_reaction (2) | damage |
| アタック応答 | `pendingBattle` | battle_reaction (3) | battle |
| ラッシュ応答 | `pendingRush` | rush_reaction (4) | rush |
| ダメージ支払い | `pendingDamagePayment` | damage_payment (5) | damage |
| 効果選択 | `pendingEffectChoice` | effect_choice (6) | timing |
| バトル進入後行動 | `pendingBattleEntry` | battle_entry (7) | battle |
| コマンド支払い | `pendingCommandPayment` | command_payment (8) | core-rules, rush |
| ゾード設定 | `pendingZordSetup` | zord_setup (9) | rush |

優先順位は `effectStack.ts` の `FRAME_PRIORITY` で Wiki `timing.md` と一致。`effectStack.test.ts` で leave → register → strike → battle → rush の順序を検証済み。

## CardInstance 永続修飾（フィールド単位）

| Wiki 要件 | 実装 |
|-----------|------|
| BP/SP 一時修正 | `bpModifier`, `spModifier`（ターン終了クリア） |
| バトル1T1回 | `battleActed` |
| ゾード素材記録 | `zordMaterialCardId` |
| 乗車 | `mountedOnInstanceId` |
| レジスト留場 | `registerHeld` |
| 母艦ホールド | `mothershipHold` |

## TurnModifiers（「このターン」効果）

Wiki `timing.md`「このターン」= 効果発動〜ターンプレイヤーのターンエンドまで。`turnModifiers.ts` + `modifiers.ts` の `clearTurnModifiers` でターン終了時クリア。`comboNumberDelta`, `battleBlockedInstanceIds`, `rushedThisTurnInstanceIds` 等は FAQ 準拠。

## 意図的スコープ外（Wiki 記載あり・実装不要）

| 項目 | 理由 | 出典 |
|------|------|------|
| タッグストライク | 4人モード、1v1 非対象 | engine-gaps, damage |
| XG 専用キーワード（ブラスト等） | エンジンスコープ外 | rush, engine-gaps |
| コマンダー公式運用 | framework のみ | core-rules |

---

# 不足

Wiki 仕様に対し State が未対応または部分対応の箇所。

## ルールギャップ（HIGH）

### 1. パワー計算 — 敵マルチコマンド未加算

**Wiki:** パワー = 自軍パワーゾーン枚数 + **敵軍コマンドゾーンのマルチカテゴリカード枚数**（表裏不問）。  
**実装:** `canAffordPower` / `payPowerCost` は `player.power.length` のみ（`helpers.ts`）。

```62:64:packages/engine/src/core/helpers.ts
export function canAffordPower(player: PlayerState, cost: number): boolean {
  return player.power.length >= cost;
}
```

**不足 State:** `countAvailablePower(state, playerId)` のような派生関数またはキャッシュフィールドがない。  
**影響:** マルチコマンド加速デッキとの対戦でパワー過小評価。ラッシュ・オペ使用可否が誤る。  
**参照:** `core-rules.md` パワー計算, `state-mapping.md`, atwiki 110

### 2. 同時効果のプレイヤー順序選択

**Wiki:** 同一タイミング複数効果はターンプレイヤーが順序決定（atwiki 1869, FAQ）。  
**実装:** `simultaneousGroupId` は型定義・取得 API のみ。**設定箇所なし**（常に undefined）。  
**不足:** 順序選択用 `PendingEffectChoice` 拡張または専用 Pending。  
**参照:** `timing.md`, `state-mapping.md`

## ルールギャップ（MEDIUM）

### 3. エンドフェイズ明示ステップ

**Wiki:** atwiki 155 —「ターンを終えるとき」効果、「自軍エンドフェイズ」タイミングの順序。  
**実装:** `phase === "end"` → `end_phase` → 修飾子クリア。フェイズ内サブステップ State なし。  
**不足:** `endPhaseStep?` や event 駆動の段階管理（現状 `endTurnEffects.ts` の effect_choice に依存）。  
**参照:** `phases.md`, `unresolved.md`

### 4. EffectStack 未登録の GameState フィールド

以下は Wiki 上「待機状態」だが `buildEffectStack` に含まれない:

| フィールド | Wiki 上の役割 | ギャップ |
|------------|---------------|----------|
| `deferredBattleEntry` | 選択先行のバトル進入（battle.md） | スタック外。`pendingEffectChoice` と競合時の優先が暗黙 |
| `pendingBattleToRushQueue` | スタート効果キュー（falcon_claw 等） | スタック外。`startPhase.ts` 専用 |
| `pendingScry` | @deprecated | `legalActions.ts` に残存参照 |

**影響:** `hasOpenEffectStack` / `peekEffectStackTop` がこれらを無視。UI・AI がスタックと実際のブロック状態を乖離して解釈するリスク。

### 5. キーワード未実装に伴う State 欠如

| キーワード | Wiki | 必要になりうる State |
|------------|------|---------------------|
| チェイス | atwiki 1292 | 追撃対象・連鎖カウンター Pending |
| ウイング | atwiki 1537 | 空バトルエリア例外フラグ |
| タッグストライク | 禁止カード一覧 | 複数 `PendingStrike` または合成型 |

**参照:** `engine-gaps.md`, `keywords.md`

## フレームワークのみ（LOW — Wiki XG/拡張）

| ゾーン/機能 | State | Wiki |
|-------------|-------|------|
| commander | `PlayerState.commander?` | XG コマンダー |
| exile | `PlayerState.exile?` | 除外効果 |
| bounce / reanimate | モジュールのみ | カード少数 |

---

# 重複

同一概念が複数フィールド・型に分散している箇所。

## 1. Pending* と EffectStack — 二重表現

**現状:** `pending*` が正（ソース・オブ・トゥルース）、`effectStack` は `buildEffectStack(state)` から導出。`applyAction` 後に `withSyncedEffectStack` で同期。

**重複の性質:** データではなく **ビューの二重化**。`effectStack` を直接 mutate すると pending と乖離する設計リスク。  
**許容理由:** 優先順位の単一ソース化（`timing.md` 準拠）。  
**問題点:** 未登録 Pending（上記 §不足 4）があるため「スタック = 全ブロック状態」ではない。

## 2. PlayerState hold-ready フラグ vs PendingCommandPayment

| フラグ | 役割 | PendingCommandPayment との関係 |
|--------|------|--------------------------------|
| `battleEntryHoldReady` | ※進入ホールド済 | `kind: battle_entry` 解決後〜`move_to_battle` まで |
| `rushCategoryHoldReady` | ラッシュカテゴリ支払い済 | `kind: category_use` → continuation rush |
| `counterCategoryHoldReady` | カウンター支払い済 | `kind: category_use` → continuation play_counter |
| `battleEntryRushDiscardReady` | RS-132 捨札支払い済 | pendingEffectChoice 解決後 |
| `battleEntryHandDiscardReady` | RS-165 手札捨札済 | pendingEffectChoice 解決後 |

**重複:** 支払いウィンドウは `PendingCommandPayment` / `PendingEffectChoice` で表現可能だが、**二段 initiate/resolve** の中間状態として Player 側 boolean が並行存在（`state-mapping.md` 設計メモと一致）。

## 3. RS-013 シロンライト — 三重トラッキング

| 場所 | フィールド |
|------|-----------|
| TurnModifiers | `shironLightUsed` |
| CardInstance | `shironLightUsedThisRush` |
| PlayerState | `shironLightRushInstanceId` |
| PendingEffectChoice | `kind: shiron_light`, `ShironLightMeta` |

同一カード効果が 4 層に分散。ラッシュフェイズリセットは `resetRushPhaseFlags` で部分同期。

## 4. pendingBattleEntry vs deferredBattleEntry

同一型 `PendingBattleEntry` を用途で二分割:

- `pendingBattleEntry` — 進入完了後、アタック/ストライク/パス待ち（EffectStack 登録）
- `deferredBattleEntry` — NC/効果選択が先に必要な場合（EffectStack **未**登録）

**重複:** 型は同一、GameState 上のスロットが2つ。相互排他は慣習依存（型で強制されない）。

## 5. pendingLeave vs pendingRegister

レジストフロー: 撃破 → `pendingRegister`（留場選択）→ 不採用時 `pendingLeave`。  
`PendingRegister` は `PendingLeave` の `followUpAttackerLeave`, `resumePendingStrike` を再借用。

**重複:** 離場メタデータの部分コピー。レジストは leave の特殊ケースとして統合可能。

## 6. pendingScry vs pendingEffectChoice

`PendingScry` は `@deprecated`。`kind: scry_keep_one` に統合済みだが `legalActions.ts` が `pendingScry` を参照。  
**重複:** レガシー alias が GameState に残存。

## 7. ダメージの二重カウント

- `PlayerState.damage` — 数値カウンタ
- `CardInstance.faceDown` — 裏向きパワー枚数

Wiki 上は等価（7ダメージ = 裏7枚相当）。`applyPlayerDamage` で同期するが、**二つのソース**を常に一致させる必要がある。

## 8. TurnModifiers vs CardInstance 修飾子

| 概念 | TurnModifiers | CardInstance |
|------|---------------|--------------|
| BP 上書き | `ghostAbsorptionBp?: Record<string, number>` | `bpModifier` |
| このターンラッシュ | `rushedThisTurnInstanceIds` | — |
| Sコンボフィニッシャー | `sComboFinisher` | — |

RS-094 等は TurnModifiers 側に instanceId キー。他カードは `bpModifier`。BP 修正の **二系統**。

---

# 技術的負債

将来保守コスト・バグ温床になりうる設計上の問題。

## 1. boolean 乱立（PlayerState）

スタート行程 + 支払い準備で **PlayerState に 9 個** の optional boolean / string フラグ:

```
hasChargedThisTurn
hasDrawnThisStart / hasReleasedCommandsThisStart / hasReturnedBattleThisStart / hasPaidEarthForceUpkeep
battleEntryHoldReady / rushCategoryHoldReady / counterCategoryHoldReady
battleEntryRushDiscardReady / battleEntryHandDiscardReady
```

**クリア漏れリスク:** `applyAction.ts`, `commandPayment.ts`, `restrictions.ts`, `pendingChoices.ts` に分散。ターン終了・フェイズ遷移時の一括リセット関数がない（個別クリア）。

**TurnModifiers boolean（6+）:** `shironLightUsed`, `hidoraEggUsed`, `infiniteChainActive`, `deaceSniperActive`, `zenibombActive`, `superDynamiteActive` — カード追加のたびにフィールド増加（`state-mapping.md`「新規 boolean 追加禁止方針」は TurnModifiers 向けだが PlayerState hold-ready は対象外）。

**CardInstance boolean（6）:** `commandHeld`, `mothershipHold`, `faceDown`, `battleActed`, `registerHeld`, `shironLightUsedThisRush`

**Pending 内 boolean:** `PendingStrike.damageCancelled/damageApplied`, `PendingBattle.battleCancelled`, `PendingLeave.skipRegister`

## 2. TurnModifiers のカード別フィールド肥大化

現時点で **15 フィールド**（うち 8 がカード固有 optional）。Legend 3/4 カード追加ごとに `TurnModifiers` 型拡張が発生。

```
comboNumberDelta, sComboFinisher, battleBlockedInstanceIds,
shironLightUsed, hidoraEggUsed, infiniteChainActive, deaceSniperActive,
zenibombActive, rushedThisTurnInstanceIds, ghostAbsorptionBp,
shiftUpSp1InstanceIds, auraPowerInstanceId, superDynamiteActive,
bakiBakiExtraAttackIds
```

**将来:** 50+ カード効果で型が読めなくなる。`Record<EffectId, unknown>` または event-sourced modifier への移行圧力。

## 3. PendingEffectChoice の God Object 化

- **14 EffectChoiceKind** + 3 メタ型（`SeabedDrawMeta`, `DenjiMachineMeta`, `ShironLightMeta`）
- 1 型に deck 操作・ユニット選択・コマンド選択・エンドターン UI を集約
- `pendingChoices.ts` が 1500 行超 — 新 kind 追加が全体に波及

## 4. GameState Pending フィールド数

GameState 直下に **12 optional フィールド**（deprecated 含む）。相互排他ルールが型レベルで表現されない（例: `pendingCommandPayment` と `pendingZordSetup` の同時存在はコンパイルエラーにならない）。

## 5. EffectStack の partial coverage

`hasOpenReactionWindow` は 5 kind のみ反応窓と定義。`damage_payment`, `effect_choice`, `battle_entry`, `command_payment`, `zord_setup` は「反応窓」ではないが **ゲーム進行をブロック**。用語の不一致が UI 分岐バグの原因になりうる。

## 6. simultaneousGroupId 未使用

インフラのみ実装、**書き込み箇所ゼロ**。同時解決の公式裁定に対し、将来実装時に既存 Pending 群との整合再設計が必要。

## 7. テスト State 構築の複雑さ

integration test が hold-ready フラグを手動セット（`legend3.integration.test.ts` 等）。正しい中間状態の再現コストが高く、Wiki 新カード追加時の回帰リスク増大。

## 8. 将来肥大化ホットスポット（優先度順）

| 箇所 | 肥大化要因 | 予想トリガー |
|------|-----------|-------------|
| `TurnModifiers` | カード固有 optional 追加 | Legend 4+ 効果 |
| `PendingEffectChoice` | kind / meta 追加 | 選択 UI 効果 |
| `PlayerState` hold-ready | 新支払い条件カード | RS-132/165 パターン増 |
| `CardInstance` | ターン/フェイズ修飾子 | NC・常駐効果 |
| `PendingCommandPayment.continuation` | union 拡張 | 新アクション種 |
| `EffectStackFrameKind` | 未統合 Pending 追加 | deferredBattleEntry 等 |

---

# 推奨改善

コード変更は本分析のスコープ外。優先度付き設計指針。

## P0 — Wiki 整合（仕様ギャップ）

1. **`countAvailablePower(state, playerId)`** を `helpers.ts` に追加  
   - `power.length` + 相手 command のマルチカテゴリ枚数  
   - State 追加不要（派生関数で十分）  
   - 参照: `core-rules.md`, atwiki 110

2. **同時効果順序** — `PendingEffectChoice` に `kind: simultaneous_order` を追加、または `simultaneousGroupId` を effect handler から設定  
   - 参照: `timing.md`

## P1 — 重複解消（低リスク）

3. **`pendingScry` 削除** — `legalActions.ts` を `pendingEffectChoice` のみに統一（deprecated 解消）

4. **hold-ready フラグ統合** — PlayerState の 5 フラグを単一オブジェクトに集約:

   ```typescript
   type PaymentReady = {
     battleEntry?: boolean;
     rushCategory?: boolean;
     counterCategory?: boolean;
     battleEntryRushDiscard?: boolean;
     battleEntryHandDiscard?: boolean;
     discardedCardId?: string; // RS-132
   };
   // PlayerState.paymentReady?: PaymentReady
   ```

   クリアは `clearPaymentReady(player)` 一関数化。

5. **`deferredBattleEntry` を EffectStack に統合** — `EffectStackFrameKind: "deferred_battle_entry"` を追加し `buildEffectStack` に登録。priority は `effect_choice` と同階層（6〜7）。

## P2 — 技術的負債（中リスク）

6. **TurnModifiers の汎用化** — カード固有 boolean を `{ activeEffects: Record<string, EffectModifierState> }` に段階移行。既存フィールドは adapter で読み替え。

7. **PendingEffectChoice 分割** — kind ごとに meta 型を discriminated union で分離（`DeckChoicePending`, `UnitChoicePending` 等）。`pendingChoices.ts` を feature 単位ファイル分割。

8. **pendingLeave / pendingRegister 統合** — `PendingFieldExit` 型に `phase: "register" | "leave" | "done"` を持たせ、followUp をネストで表現。

## P3 — EffectStack 統合候補

| 現状 | 統合案 | 理由 |
|------|--------|------|
| hold-ready booleans | `command_payment` フレームの `resolved: true` サブ状態 | Pending と二重管理解消 |
| `deferredBattleEntry` | stack frame kind 追加 | ブロック状態の単一ソース |
| `pendingBattleToRushQueue` | `effect_choice` の内部キュー or stack frame 列 | startPhase 専用 State 削減 |
| `pendingScry` | 削除（effect_choice へ） | レガシー解消 |

**統合しない方がよいもの:**

- `TurnModifiers` — ターンスコープが異なり、スタック解決モデルと直交
- `CardInstance` 修飾子 — カード所在ゾーンに紐づくため GameState Pending に昇格不要
- ゾーン配列自体 — 既に正しい粒度

## P4 — ドキュメント・検証

9. **`state-mapping.md` を本ファイルへリンク** — architecture 配下を Wiki 調査の公式ギャップ参照先に

10. **verify-wiki-effects 全弾突合** — State 不足は cards.json 効果追加時に検出（`engine-gaps.md` 推奨順 1）

---

## 参照ファイル

| 種別 | パス |
|------|------|
| 型定義 | `packages/engine/src/types/game.ts` |
| EffectStack | `packages/engine/src/rules/effectStack.ts` |
| コマンド支払い | `packages/engine/src/rules/commandPayment.ts` |
| ターン修飾 | `packages/engine/src/rules/turnModifiers.ts`, `core/modifiers.ts` |
| Wiki マッピング | `docs/wiki/state-mapping.md` |
| Wiki ギャップ | `docs/wiki/engine-gaps.md` |

---

## 結論

現行 State は **Legend 1–3 コアループ（フェイズ・反応窓・ダメージ・ゾード・NC）を Wiki HIGH confidence 領域でカバー** している。即座に対応すべきは **パワー計算（敵マルチ）** のみ。設計上は **PlayerState boolean 乱立** と **Pending/EffectStack の部分的不一致** が最大の保守リスク。新カード追加前に hold-ready 統合と `deferredBattleEntry` のスタック登録を検討することを推奨する。
