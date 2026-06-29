import { findNamedEffectByEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import {
  cardCategories,
  effectiveBp,
  getDefinition,
  isSmallUnit,
} from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { parsePowerCost } from "../core/power";

const BIG_BATON_FEATURES = ["レッド", "ブルー", "グリーン", "ピンク"] as const;

function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const next = [...deck];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function playerZones(player: GameState["players"][PlayerId]): CardInstance[] {
  const p = player;
  return [...p.rush, ...p.battle, ...p.command];
}

function opponentHasMaChikara(state: GameState, playerId: PlayerId): boolean {
  const enemyId = opponent(playerId);
  const enemy = state.players[enemyId];
  return [...enemy.rush, ...enemy.battle].some((c) =>
    findNamedEffectByEffectId(c.cardId, "ma_chikara"),
  );
}

function commandZoneFeatures(
  state: GameState,
  playerId: PlayerId,
): Set<string> {
  const features = new Set<string>();
  for (const card of state.players[playerId].command) {
    const def = getDefinition(state.definitions, card.cardId);
    for (const feature of def?.features ?? []) {
      features.add(feature);
    }
  }
  return features;
}

export function plasmaShockwaveActive(state: GameState): boolean {
  for (const playerId of ["player1", "player2"] as const) {
    const zones = state.players[playerId];
    if (
      zones.rush.some((c) => c.cardId === "SR-007") ||
      zones.battle.some((c) => c.cardId === "SR-007")
    ) {
      return true;
    }
  }
  return false;
}

/** SR-004 妖魔力: 相手の OT/ET コマンドをリリース直後にホールド。 */
export function applyOpponentHoldOtEtOnCommandRelease(
  state: GameState,
  playerId: PlayerId,
): GameState {
  if (!opponentHasMaChikara(state, playerId)) return state;

  const player = state.players[playerId];
  let changed = false;
  const command = player.command.map((card) => {
    if (card.commandHeld) return card;
    const def = getDefinition(state.definitions, card.cardId);
    const cats = cardCategories(def);
    if (!cats.includes("OT") && !cats.includes("ET")) return card;
    changed = true;
    return { ...card, commandHeld: true, mothershipHold: false };
  });

  if (!changed) return state;
  return { ...state, ...updatePlayer(state, playerId, { ...player, command }) };
}

/** SR-007: スタート終了時、大神龍以外がいなければ山札へ。 */
export function applyPlasmaShockwaveShuffleBack(
  state: GameState,
  playerId: PlayerId,
): GameState {
  if (!plasmaShockwaveActive(state)) return state;

  const player = state.players[playerId];
  const hasOtherUnits = player.battle.some((card) => {
    const name = getDefinition(state.definitions, card.cardId)?.name;
    return name !== "大神龍";
  });
  if (hasOtherUnits) return state;

  const toReturn = player.battle.filter((c) => c.cardId === "SR-007");
  if (toReturn.length === 0) return state;

  const remainingBattle = player.battle.filter((c) => c.cardId !== "SR-007");
  const deck = shuffleDeck([...player.deck, ...toReturn]);

  return {
    ...state,
    ...updatePlayer(state, playerId, {
      ...player,
      battle: remainingBattle,
      deck,
    }),
  };
}

/** SR-003 龍撃剣＆獣奏剣: 捨札の恐竜1枚につきBP+1000。 */
export function sr003DiscardDinoBpBonus(
  state: GameState,
  playerId: PlayerId,
): number {
  if (state.activePlayer !== playerId) return 0;
  const discard = state.players[playerId].discard;
  const count = discard.filter((c) =>
    getDefinition(state.definitions, c.cardId)?.features?.includes("恐竜"),
  ).length;
  return count * 1000;
}

/** SR-003: BP8000以上で SP1。 */
export function sr003SpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  if (instance.cardId !== "SR-003" || state.activePlayer !== playerId) return 0;
  const bp = effectiveBp(state, playerId, instance);
  return bp >= 8000 ? 1 : 0;
}

export function srBigBatonHasFeature(
  state: GameState,
  playerId: PlayerId,
  feature: (typeof BIG_BATON_FEATURES)[number],
): boolean {
  const onField = playerZones(state.players[playerId]).some((c) => c.cardId === "SR-008");
  if (!onField) return false;
  return commandZoneFeatures(state, playerId).has(feature);
}

export function srBigBatonRegisterActive(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): boolean {
  return cardId === "SR-008" && srBigBatonHasFeature(state, playerId, "レッド");
}

export function srBigBatonTaxisCategory(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
): "ET" | null {
  if (cardId !== "SR-008") return null;
  return srBigBatonHasFeature(state, playerId, "ブルー") ? "ET" : null;
}

export function srBigBatonBpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  if (instance.cardId !== "SR-008") return 0;
  return srBigBatonHasFeature(state, playerId, "グリーン") ? 7000 : 0;
}

export function srBigBatonSpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  if (instance.cardId !== "SR-008") return 0;
  return srBigBatonHasFeature(state, playerId, "ピンク") ? 1 : 0;
}

/** SR-005 バトライズファイヤードライブ: パワー捨て後に同必要パワーの敵Sを撃破。 */
export function findEnemySWithPowerCost(
  state: GameState,
  enemyId: PlayerId,
  powerCost: number,
): CardInstance[] {
  const matches: CardInstance[] = [];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of state.players[enemyId][zone]) {
      if (!isSmallUnit(state.definitions, card.cardId)) continue;
      const cost = parsePowerCost(getDefinition(state.definitions, card.cardId)?.powerCost ?? 99);
      if (cost === powerCost) matches.push(card);
    }
  }
  return matches;
}
