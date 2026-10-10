import type { GameState, PlayerId } from "../../types/game";
import {
  bpPlusInvertedFor,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  isMediumUnit,
} from "../../core/catalog";
import { playerHasFieldCard } from "./rsCatchallChoices";
import { cardHasKeyword } from "../../keywords/cardKeywords";
import { sameCardName } from "../../core/cardNames";

/**
 * RS-210: ナンバーSユニットのBP加算を減算に反転。
 * 判定は core/catalog の bpPlusInvertedFor（本文の文言で判定し、effectiveBp に組み込み済み）。
 */
export function rs210BpInvertDelta(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  delta: number,
): number {
  if (delta <= 0) return delta;
  const player = state.players[playerId];
  const card = [...player.rush, ...player.battle].find((c) => c.instanceId === instanceId);
  if (!card || !bpPlusInvertedFor(state, card)) return delta;
  return -delta;
}

/**
 * RS-482【カラクリ忍法・天空裂破】: 航空機特徴なしMはアタック/ストライク不可。
 * 「特徴「航空機」を持たないMユニットは」に自軍・敵軍の指定がないので、どちらのエリアにあっても両軍の M ユニットが対象（R-TGT-04）。
 */
export function rs482BlocksAttackStrike(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  const enemyId: PlayerId = playerId === "player1" ? "player2" : "player1";
  if (!playerHasFieldCard(state, playerId, "RS-482") && !playerHasFieldCard(state, enemyId, "RS-482")) return false;
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
  // ルール: R-ERR-RS603 — 対象は「本来の特徴に「車両」を持つユニット」で、自軍・敵軍を問わない。
  const enemyId: PlayerId = playerId === "player1" ? "player2" : "player1";
  if (
    !playerHasFieldCard(state, playerId, "RS-603") &&
    !playerHasFieldCard(state, enemyId, "RS-603")
  ) {
    return false;
  }
  const def = getDefinition(state.definitions, cardId);
  return (def?.features ?? []).includes("車両");
}

/** RS-339: 男特徴ユニットにDAカテゴリ追加（フィールド常駐）。 */
export function rs339AddsDaCategory(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  // 「特徴「男」を持つすべてのユニット」— 敵軍のユニットにも追加される（atwiki・grnrngr/faq-card-4 RS-205 Q3）。
  if (
    !playerHasFieldCard(state, playerId, "RS-339") &&
    !playerHasFieldCard(state, playerId === "player1" ? "player2" : "player1", "RS-339")
  ) {
    return false;
  }
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
  // ルール: R-KW-00 — ウイングはキーワード（特徴ではない）。
  if (!def || !cardHasKeyword(state.definitions, defenderCardId, "wing", { state, playerId: defenderId })) {
    return false;
  }
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
