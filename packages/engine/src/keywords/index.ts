import type { CardInstance, GameState, PendingChase, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { findInZone, opponent } from "../core/helpers";
import { cardHasKeyword, playerHasChaseUnitInField } from "./cardKeywords";
import { buildPendingChaseFromIntent } from "./chase";

export type { PendingChase, WingBattleRule, CommanderZoneRule } from "../types/keywords";
export {
  applyPassChase,
  applyResolveChase,
  buildPendingChaseFromIntent,
  buildPendingChaseOnVehicleDestroyed,
  listValidChaseVehicleIds,
} from "./chase";
export {
  applyRegisterHoldToCard,
  canRegisterUnit,
  cardHasRegisterKeyword,
  unitHasRegister,
} from "./registerReaction";
export {
  attachRideIfEligible,
  findRideVehicleForRider,
} from "./ride";
export {
  defenderCanMorphAgainstRush,
  featuresExactlyMatch,
  listMorphReplacementCandidates,
} from "./morph";
export {
  applyMorphSwap,
  listMorphReactors,
  openMorphReactionWindow,
  passMorphReaction,
  resolveMorphReplacementChoice,
} from "./morphReaction";
export {
  blastBypassesRushAdditionalCondition,
  breakerBlocksEffectTarget,
  breakerBlocksSameNameRush,
  canWingAttackFromRush,
  canHoldForWing,
  applyHoldForWing,
  wingTurnBlocksStrike,
  rideOffBlocksStrike,
  applyNoStrikeAfterRideOff,
  crossAdjustedBattlePosition,
  crossShiftLeftOf,
  crossValueForCard,
  isBloodVesselStrikeActive,
  parseTaxisCategory,
  scrumBlocksAttack,
  taxisSpFloor,
} from "./battleKeywords";

/** チェイス: ライド中ユニットが離場するとき乗り換え可能。 */
export function canInitiateChase(
  state: GameState,
  ownerPlayerId: PlayerId,
  leavingCard: CardInstance,
): boolean {
  if (!leavingCard.mountedOnInstanceId) return false;
  if (!cardHasKeyword(state.definitions, leavingCard.cardId, "chase")) return false;
  if (!playerHasChaseUnitInField(state, ownerPlayerId)) return false;

  const rider = findInZone(state.players[ownerPlayerId], "rush", leavingCard.instanceId)
    ?? findInZone(state.players[ownerPlayerId], "battle", leavingCard.instanceId);
  if (!rider) return false;

  const vehicle = findInZone(state.players[ownerPlayerId], "rush", leavingCard.mountedOnInstanceId);
  if (!vehicle) return false;

  const unmounted = state.players[ownerPlayerId].rush.filter(
    (c) =>
      getDefinition(state.definitions, c.cardId)?.type === "vehicle" &&
      c.instanceId !== leavingCard.mountedOnInstanceId,
  );
  return unmounted.length > 0;
}

/** @deprecated Use buildPendingChaseFromIntent */
export function buildPendingChase(
  state: GameState,
  ownerPlayerId: PlayerId,
  leavingCard: CardInstance,
  phasePlayerId: PlayerId,
): PendingChase | null {
  const fromZone =
    findInZone(state.players[ownerPlayerId], "rush", leavingCard.instanceId) ? "rush" : "battle";
  return buildPendingChaseFromIntent(state, {
    ownerPlayerId,
    instanceId: leavingCard.instanceId,
    fromZone,
    toZone: "discard",
    leavingCardId: leavingCard.cardId,
    phasePlayerId,
  });
}

/** ウイング: 自軍バトルが空でも、ウイング持ちユニットのみならストライク可能。 */
export function wingAllowsEmptyBattleStrike(
  state: GameState,
  playerId: PlayerId,
  striker: CardInstance,
): boolean {
  if (!cardHasKeyword(state.definitions, striker.cardId, "wing", { state, playerId })) {
    return false;
  }
  const battle = state.players[playerId].battle;
  if (battle.length === 0) return true;
  return battle.length === 1 && battle[0]?.instanceId === striker.instanceId;
}

/** ウイング: 敵ラッシュの S ユニットへアタック可能（RS-622 系）。 */
export function wingCanAttackEnemyRush(
  state: GameState,
  attackerPlayerId: PlayerId,
  attackerCardId: string,
): boolean {
  return cardHasKeyword(state.definitions, attackerCardId, "wing", {
    state,
    playerId: attackerPlayerId,
  });
}

/** コマンダーゾーンにカードがあるか。 */
export function hasActiveCommander(state: GameState, playerId: PlayerId): boolean {
  return (state.players[playerId].commander?.length ?? 0) > 0;
}

/** コマンダー破壊時の敗北判定（コマンダーゾーンが空になったとき）。 */
export function checkCommanderDefeat(
  state: GameState,
  ownerPlayerId: PlayerId,
  leavingCardId: string,
  fromZone: string,
): PlayerId | null {
  if (fromZone !== "commander") return null;
  const def = state.definitions[leavingCardId];
  if (def?.type !== "commander") return null;
  if ((state.players[ownerPlayerId].commander?.length ?? 0) > 0) return null;
  return opponent(ownerPlayerId);
}
