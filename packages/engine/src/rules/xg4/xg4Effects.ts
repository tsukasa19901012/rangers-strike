/**
 * クロスギャザー ザ・ジェットアクセル XG4-001〜XG4-102 のカード固有の効果の入口（ほかのモジュールはここから呼ぶ）。
 *
 * - `tryXg4CardEffect`: DSL の grant_keyword（`xg4::cardId::name`。dsl/grantKeyword.ts）。
 * - `isXg4ChoiceEffect` / `tryResolveXg4Choice` / `trySkipXg4Choice` / `tryConfirmXg4Choice` / `canConfirmXg4Choice`: このシリーズの選択
 *   （rules/pendingChoices.ts・core/legalActions.ts）。
 * - `applyXg4AfterAction`: applyAction の後処理（core/applyAction.ts）。
 * - `xg4OnBattleDestroy`: バトルで敵軍ユニットを撃破したとき（rules/operationCounters.ts）。
 * - `isXg4BattleCounterCard` / `xg4BattleCounterConditionMet` / `applyXg4BattleCounter`: 「アタックされたとき」のカウンター
 *   （core/legalActions.ts・core/applyAction.ts・rules/operationCounters.ts）。
 * カードごとの中身は rules/xg4/xg4aEffects.ts（XG4-001〜021）ほか。継続効果は rules/xg4/xg4Fields.ts。
 */
import type { CardInstance, GameState, PendingBattle, PlayerId } from "../../types/game";
import { KARAKURI_MANTLE_CARD_ID, applyXg4aAfterAction, applyXg4aRideOff, applyXg4aBattleCounter, xg4aBattleCounterConditionMet, xg4aOnBattleDestroy } from "./xg4aEffects";
import {
  activateXg4bFieldAbility,
  applyXg4bAfterAction,
  applyXg4bRideOff,
  canActivateXg4bFieldAbility,
  collectXg4bTurnEndQueue,
  isXg4bFieldAbilityCard,
  openXg4bTurnEndEntry,
  xg4bOnBattleDestroy,
} from "./xg4bEffects";
import { applyXg4cAfterAction, applyXg4cRideOff, openXg4cBattlePhaseStart, resolveXg4cDiscardSelfAbility, xg4cOnAttackWin, xg4cOnBattleDestroy } from "./xg4cEffects";
import { isCard } from "./xg4Common";

export {
  canConfirmXg4Choice,
  isXg4ChoiceEffect,
  tryConfirmXg4Choice,
  tryResolveXg4Choice,
  trySkipXg4Choice,
  tryXg4CardEffect,
  XG4_KEYWORD_PREFIX,
} from "./xg4Common";
export { isXg4BeforeBattleChoice, openXg4BeforeBattle, resolveXg4BeforeBattle, skipXg4BeforeBattle } from "./xg4bEffects";

export function applyXg4AfterAction(before: GameState, after: GameState): GameState {
  return applyXg4cAfterAction(before, applyXg4bAfterAction(before, applyXg4aAfterAction(before, after)));
}

export function xg4OnBattleDestroy(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedInstanceId: string): GameState {
  const next = xg4aOnBattleDestroy(state, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
  const b = next.pendingEffectChoice ? next : xg4bOnBattleDestroy(next, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
  return xg4cOnBattleDestroy(b, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
}

export function isXg4BattleCounterCard(cardId: string): boolean {
  return isCard(cardId, KARAKURI_MANTLE_CARD_ID);
}

export function xg4BattleCounterConditionMet(
  state: GameState,
  defenderId: PlayerId,
  cardId: string,
  battle: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId" | "defenderPlayerId" | "defenderInstanceId"> & { effectBattle?: boolean; battleCancelled?: boolean },
): boolean {
  return xg4aBattleCounterConditionMet(state, defenderId, cardId, battle);
}

export function applyXg4BattleCounter(state: GameState, defenderId: PlayerId, _cardId: string, pending: PendingBattle): { state: GameState; pending: PendingBattle; detail: string } {
  return applyXg4aBattleCounter(state, defenderId, pending);
}

/** ライドオフしたとき（core/applyAction.ts resolve_ride_off_choice。rider はライドオフ後のユニット）。 */
export function applyXg4RideOff(state: GameState, playerId: PlayerId, rider: CardInstance): GameState {
  const next = applyXg4aRideOff(state, playerId, rider);
  const b = next.pendingEffectChoice ? next : applyXg4bRideOff(next, playerId, rider);
  return b.pendingEffectChoice ? b : applyXg4cRideOff(b, playerId, rider);
}

/** アタックしてバトルに勝ったとき（rules/operationCounters.ts）。defenderBp はバトルのときの BP。 */
export function xg4OnAttackWin(state: GameState, pending: Pick<PendingBattle, "attackerPlayerId" | "attackerInstanceId">, defenderBp: number): GameState {
  return xg4cOnAttackWin(state, pending, defenderBp);
}

/** バトルフェイズ開始時（core/applyAction.ts end_phase。activePlayerId はバトルフェイズを始めたプレイヤー）。 */
export function openXg4BattlePhaseStart(state: GameState, activePlayerId: PlayerId): GameState {
  return openXg4cBattlePhaseStart(state, activePlayerId);
}

/** このカードを捨札にして起動する効果のあと（rules/fieldActivatedAbilities.ts）。 */
export function resolveXg4DiscardSelfAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return resolveXg4cDiscardSelfAbility(state, playerId, card);
}

/** ターン終了時の処理の列（rules/turnEndingEffects.ts）。 */
export function collectXg4TurnEndQueue(state: GameState, endingPlayerId: PlayerId): string[] {
  return collectXg4bTurnEndQueue(state, endingPlayerId);
}

export function openXg4TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  return openXg4bTurnEndEntry(state, endingPlayerId, entry);
}

/** フィールドで起動する効果（rules/fieldActivatedAbilities.ts）。 */
export function isXg4FieldAbilityCard(cardId: string): boolean {
  return isXg4bFieldAbilityCard(cardId);
}

export function canActivateXg4FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  return canActivateXg4bFieldAbility(state, playerId, card);
}

export function activateXg4FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  return activateXg4bFieldAbility(state, playerId, card);
}
