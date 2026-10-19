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

export function applyXg4AfterAction(before: GameState, after: GameState): GameState {
  return applyXg4aAfterAction(before, after);
}

export function xg4OnBattleDestroy(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedInstanceId: string): GameState {
  return xg4aOnBattleDestroy(state, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
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
  return applyXg4aRideOff(state, playerId, rider);
}
