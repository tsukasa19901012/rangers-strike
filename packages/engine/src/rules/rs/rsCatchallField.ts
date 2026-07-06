import type { GameState, PlayerId } from "../../types/game";
import {
  effectiveBp,
  getDefinition,
  isSmallUnit,
  isMediumUnit,
} from "../../core/catalog";
import { playerHasFieldCard } from "./rsCatchallChoices";
import { sameCardName } from "../../core/cardNames";

/** RS-210: ナンバーSユニットのBP加算を減算に反転。 */
export function rs210BpInvertDelta(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  delta: number,
): number {
  if (delta <= 0) return delta;
  if (!playerHasFieldCard(state, playerId, "RS-210")) return delta;
  const player = state.players[playerId];
  const card = [...player.rush, ...player.battle].find((c) => c.instanceId === instanceId);
  if (!card || !isSmallUnit(state.definitions, card.cardId)) return delta;
  const def = getDefinition(state.definitions, card.cardId);
  if (def?.comboNumber == null) return delta;
  return -delta;
}

/** RS-482: 航空機特徴なしMはアタック/ストライク不可。 */
export function rs482BlocksAttackStrike(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  if (!playerHasFieldCard(state, playerId, "RS-482")) return false;
  if (!isMediumUnit(state.definitions, cardId)) return false;
  const def = getDefinition(state.definitions, cardId);
  return !(def?.features ?? []).includes("航空機");
}

/** RS-579: BP8000以下はラッシュターンにアタック/ストライク不可。 */
export function rs579BlocksAttackStrikeOnRushTurn(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  if (!playerHasFieldCard(state, playerId, "RS-579")) return false;
  const player = state.players[playerId];
  const card = [...player.rush, ...player.battle].find((c) => c.instanceId === instanceId);
  if (!card) return false;
  const bp = effectiveBp(state, playerId, card);
  if (bp > 8000) return false;
  return player.rush.some((c) => c.instanceId === instanceId);
}

/** RS-627: ラッシュBP1000以下は相手に選ばれない。 */
export function rs627NotSelectable(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
): boolean {
  const owner = state.players[ownerId];
  if (!playerHasFieldCard(state, ownerId, "RS-627", ["rush"])) return false;
  const card = owner.rush.find((c) => c.instanceId === instanceId);
  if (!card) return false;
  return effectiveBp(state, ownerId, card) <= 1000;
}

/** RS-603: 車両特徴ユニットはアタック/ストライク不可・効果無効。 */
export function rs603BlocksVehicle(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  if (!playerHasFieldCard(state, playerId, "RS-603")) return false;
  const def = getDefinition(state.definitions, cardId);
  return (def?.features ?? []).includes("車両");
}

/** RS-339: 男特徴ユニットにDAカテゴリ追加（フィールド常駐）。 */
export function rs339AddsDaCategory(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  if (!playerHasFieldCard(state, playerId, "RS-339")) return false;
  const def = getDefinition(state.definitions, cardId);
  return (def?.features ?? []).includes("男");
}

/** RS-560: 捨札に同名があれば獣MにBP+1000。 */
export function rs560BeastMBpBonus(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): number {
  if (!playerHasFieldCard(state, playerId, "RS-560")) return 0;
  const def = getDefinition(state.definitions, cardId);
  if (!isMediumUnit(state.definitions, cardId)) return 0;
  if (!def || !(def.features ?? []).includes("獣")) return 0;
  const name = def.name;
  const hasCopy = state.players[playerId].discard.some(
    (c) => sameCardName(getDefinition(state.definitions, c.cardId)?.name, name),
  );
  return hasCopy ? 1000 : 0;
}

/** RS-619: ウイングユニットは航空機以外からアタックされない。 */
export function rs619WingProtectedFromNonAircraft(
  state: GameState,
  defenderId: PlayerId,
  defenderCardId: string,
  attackerCardId: string,
): boolean {
  if (!playerHasFieldCard(state, defenderId, "RS-619")) return false;
  const def = getDefinition(state.definitions, defenderCardId);
  if (!(def?.features ?? []).includes("ウイング")) return false;
  const attackerDef = getDefinition(state.definitions, attackerCardId);
  return !(attackerDef?.features ?? []).includes("航空機");
}

export function anyRsCatchallFieldCard(
  state: GameState,
  cardId: string,
): PlayerId | null {
  for (const playerId of ["player1", "player2"] as const) {
    if (playerHasFieldCard(state, playerId, cardId)) return playerId;
  }
  return null;
}
