# State マッピング（ルール → エンジン）

## GameState

| ルール | 現状対応 | 不足 | 推奨拡張 | リスク |
|--------|----------|------|----------|--------|
| ターン数 | `turn` | — | — | — |
| 先攻/手番 | `firstPlayer`, `activePlayer` | — | — | — |
| フェイズ | `phase: Phase` | エンドフェイズ詳細手順 | event: phase_entered | LOW |
| 勝者 | `winner` | — | — | — |
| カード定義 | `definitions` | — | — | — |
| ログ | `log` | — | — | — |
| **パワー閾値** | `payPowerCost` → `power.length` | 敵コマンド上マルチ加算（atwiki 110） | `countAvailablePower(state, playerId)` | HIGH |

---

## PlayerState

| ルール | 現状対応 | 不足 | 推奨拡張 | リスク |
|--------|----------|------|----------|--------|
| ゾーン7+2 | deck/hand/discard/power/command/rush/battle/operation + exile/commander | コマンダー公式運用 | commander zone actions | MED |
| ダメージ | `damage` + power.faceDown | — | — | — |
| チャージ済 | `hasChargedThisTurn` | — | turn_end event でクリア（現状OK） | — |
| スタート行程 | hasDrawn/Released/Returned/PaidEarthForce | — | — | — |
| 支払い準備 | battleEntry*Ready, rushCategory*, counter* | boolean 多数 | event: hold_paid で再構築検討 | MED |
| ターン修飾 | `turnModifiers?: TurnModifiers` | — | 既存再利用優先 | — |
| RS-013 | shironLightRushInstanceId | — | — | — |

**State設計メモ（battleEntryHoldReady 等）:**
* なぜ boolean: コマンド支払い完了〜続行アクションまでの短期ウィンドウ
* 代替案: PendingCommandPayment のみで完結可能だが、二段 initiate/resolve で中間状態が必要
* 影響: commandPayment.ts, legalActions.ts

---

## EffectStack

| ルール | 現状対応 | 不足 | 推奨拡張 | リスク |
|--------|----------|------|----------|--------|
| 反応優先度 | `buildEffectStack` + FRAME_PRIORITY | 公式全文との照合 | — | LOW |
| 同時グループ | `simultaneousGroupId` | プレイヤー順序選択 UI | effect_choice 拡張 | MED |
| アクター | `actorPlayerId` | — | — | — |

---

## Pending 系

| Pending | ルール | 現状 | 不足 |
|---------|--------|------|------|
| pendingStrike | ストライク応答 | OK | タッグストライク |
| pendingBattle | アタック応答 | OK | — |
| pendingRush | ラッシュ応答 | OK | — |
| pendingLeave | 離場/レジスト前 | OK | — |
| pendingRegister | レジスト | OK | — |
| pendingEffectChoice | 選択効果 | OK | 同時順序 |
| pendingBattleEntry | 進入後行動 | OK | — |
| pendingCommandPayment | ホールド支払い | OK | — |
| pendingZordSetup | ゾード | OK | — |
| pendingDamagePayment | ダメージ | OK | — |
| deferredBattleEntry | 選択先行的進入 | OK | — |
| pendingBattleToRushQueue | スタート効果 | OK | — |

---

## Action 系

| ルール | 主要 Action | ファイル |
|--------|-------------|----------|
| スタート | draw_start, return_all_battle_to_rush, release_all_commands | startPhase.ts |
| チャージ | charge | applyAction.ts |
| ラッシュ | rush, play_operation | applyAction.ts |
| バトル | move_to_battle, attack, strike, pass_battle_entry | applyAction.ts |
| 反応 | play_counter, pass_*_reaction, use_register | operationCounters.ts |
| フェイズ終了 | end_phase | applyAction.ts |
| コマンド支払い | initiate/resolve_command_payment | commandPayment.ts |

---

## Zone 系

| ルール | 実装 | 不足 |
|--------|------|------|
| 向き | faceDown, commandHeld | — |
| ホールド上限5 | COMMAND_ZONE_MAX | — |
| レジスト留場 | registerHeld | — |
| 乗車 | mountedOnInstanceId | RC |
| 除外 | exile zone | framework |
| バウンス/リアニメ | bounce/reanimate modules | framework only |

---

## TurnModifiers（event 再利用優先）

| 修飾 | 用途 | 代替案 |
|------|------|--------|
| comboNumberDelta | RS-015 | — |
| sComboFinisher | RS-001/002 | — |
| battleBlockedInstanceIds | RS-003 | — |
| infiniteChainActive | RS-072 | — |
| rushedThisTurnInstanceIds | RS-106/090 | on_rush event 集約可 |
| ghostAbsorptionBp | RS-094 | CardInstance.bpModifier に統合検討 |

**新規 boolean 追加禁止方針:** 上記は既存。新カードは `turnModifiers` または `CardInstance` 修飾子を優先。
