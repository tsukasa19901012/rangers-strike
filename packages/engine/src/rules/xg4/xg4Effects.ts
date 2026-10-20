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
import type { CardInstance, GameState, PendingBattle, PendingStrike, PlayerId } from "../../types/game";
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
import {
  applyXg4dAfterUnitLeft,
  collectXg4dTurnEndQueue,
  confirmXg4dBeforeBattle,
  isXg4dBeforeBattleChoice,
  openXg4dBeforeBattle,
  openXg4dOnStrike,
  openXg4dTurnEndEntry,
  resolveXg4dBeforeBattle,
  skipXg4dBeforeBattle,
  xg4dOnBattleDestroy,
} from "./xg4dEffects";
import {
  activateXg4eFieldAbility,
  applyXg4eAfterAction,
  canActivateXg4eFieldAbility,
  collectXg4eTurnEndQueue,
  isXg4eFieldAbilityCard,
  openXg4eEndPhaseChoice,
  openXg4eTurnEndEntry,
  xg4eOnBattleDestroy,
} from "./xg4eEffects";
import { isXg4BeforeBattleChoice as isXg4bBeforeBattleChoice, openXg4BeforeBattle as openXg4bBeforeBattle, resolveXg4BeforeBattle as resolveXg4bBeforeBattle, skipXg4BeforeBattle as skipXg4bBeforeBattle } from "./xg4bEffects";
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
export { xg4DestroyedToDeckInstead, xg4ShuffleInto } from "./xg4dEffects";

type BeforeBattleResult = { state: GameState; battle: PendingBattle; wingAttackFromRush: boolean };

/** アタックするとき、バトルの前の選択（core/applyAction.ts continueAttackAfterDeclaration）。開かなければ null。 */
export function openXg4BeforeBattle(state: GameState, battle: PendingBattle, wingAttackFromRush: boolean): GameState | null {
  return openXg4bBeforeBattle(state, battle, wingAttackFromRush) ?? openXg4dBeforeBattle(state, battle, wingAttackFromRush);
}

export function isXg4BeforeBattleChoice(pending: GameState["pendingEffectChoice"]): boolean {
  return isXg4bBeforeBattleChoice(pending) || isXg4dBeforeBattleChoice(pending);
}

/** 選んだ。partial は選択が続く（XG4-073 の1つ目）。 */
export function resolveXg4BeforeBattle(state: GameState, playerId: PlayerId, instanceId: string): BeforeBattleResult | { partial: GameState } | { error: string } {
  if (isXg4dBeforeBattleChoice(state.pendingEffectChoice)) return resolveXg4dBeforeBattle(state, playerId, instanceId);
  return resolveXg4bBeforeBattle(state, playerId, instanceId);
}

export function skipXg4BeforeBattle(state: GameState, playerId: PlayerId): BeforeBattleResult | null {
  if (isXg4dBeforeBattleChoice(state.pendingEffectChoice)) return skipXg4dBeforeBattle(state, playerId);
  return skipXg4bBeforeBattle(state, playerId);
}

/** 確認（XG4-074）。 */
export function confirmXg4BeforeBattle(state: GameState, playerId: PlayerId): BeforeBattleResult | null {
  return confirmXg4dBeforeBattle(state, playerId);
}

/** ストライクしたとき（core/applyAction.ts strike。「ストライクしたとき」の選択と同じ所）。 */
export function openXg4OnStrike(state: GameState, pending: PendingStrike): GameState {
  return openXg4dOnStrike(state, pending);
}

/** 場のユニットが離れたあと（rules/operationCounters.ts finalizeLeavePending）。before は離れる前の盤面。 */
export function applyXg4AfterUnitLeft(before: GameState, state: GameState, ctx: { ownerPlayerId: PlayerId; card: CardInstance; destroyed: boolean }): GameState {
  return applyXg4dAfterUnitLeft(before, state, ctx);
}

export function applyXg4AfterAction(before: GameState, after: GameState): GameState {
  return applyXg4eAfterAction(before, applyXg4cAfterAction(before, applyXg4bAfterAction(before, applyXg4aAfterAction(before, after))));
}

export function xg4OnBattleDestroy(state: GameState, winnerId: PlayerId, winnerInstanceId: string, defeatedOwnerId: PlayerId, defeatedInstanceId: string, defeatedBp?: number): GameState {
  const next = xg4aOnBattleDestroy(state, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
  const b = next.pendingEffectChoice ? next : xg4bOnBattleDestroy(next, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
  const c = xg4cOnBattleDestroy(b, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
  const d = xg4dOnBattleDestroy(c, winnerId, winnerInstanceId, defeatedOwnerId, defeatedBp);
  return xg4eOnBattleDestroy(d, winnerId, winnerInstanceId, defeatedOwnerId, defeatedInstanceId);
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
  return [...collectXg4bTurnEndQueue(state, endingPlayerId), ...collectXg4dTurnEndQueue(state, endingPlayerId), ...collectXg4eTurnEndQueue(state, endingPlayerId)];
}

export function openXg4TurnEndEntry(state: GameState, endingPlayerId: PlayerId, entry: string): GameState {
  if (entry.startsWith("apollo:")) return openXg4dTurnEndEntry(state, endingPlayerId, entry);
  if (entry.startsWith("spielban:")) return openXg4eTurnEndEntry(state, endingPlayerId, entry);
  return openXg4bTurnEndEntry(state, endingPlayerId, entry);
}

/** フィールドで起動する効果（rules/fieldActivatedAbilities.ts）。 */
export function isXg4FieldAbilityCard(cardId: string): boolean {
  return isXg4bFieldAbilityCard(cardId) || isXg4eFieldAbilityCard(cardId);
}

export function canActivateXg4FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): boolean {
  if (isXg4eFieldAbilityCard(card.cardId)) return canActivateXg4eFieldAbility(state, playerId, card);
  return canActivateXg4bFieldAbility(state, playerId, card);
}

export function activateXg4FieldAbility(state: GameState, playerId: PlayerId, card: CardInstance): GameState {
  if (isXg4eFieldAbilityCard(card.cardId)) return activateXg4eFieldAbility(state, playerId, card);
  return activateXg4bFieldAbility(state, playerId, card);
}

/** 自軍エンドフェイズ中に発動できる効果（rules/legend3/endTurnEffects.ts。ほかの効果の一覧がないとき）。開かなければ null。 */
export function openXg4EndPhaseChoice(state: GameState, playerId: PlayerId): GameState | null {
  return openXg4eEndPhaseChoice(state, playerId);
}
