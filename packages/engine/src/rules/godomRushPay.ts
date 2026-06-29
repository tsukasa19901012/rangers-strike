import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { cardCategories, getDefinition, parsePowerCost } from "../core/catalog";
import { countAvailablePower, effectivePowerCost } from "../core/power";
import { getDslEffectById } from "../dsl/effectLookup";

function playerHasGodomInField(state: GameState, playerId: PlayerId): boolean {
  const player = state.players[playerId];
  for (const card of [...player.rush, ...player.battle]) {
    if (card.cardId === "RS-586") return true;
    const effect = getDslEffectById(card.cardId, "ma_shin_nisuru");
    if (effect) return true;
  }
  return false;
}

function countSenshoInDiscard(state: GameState, playerId: PlayerId): number {
  return state.players[playerId].discard.filter((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return def?.type === "unit" && (def.features ?? []).includes("戦闘員");
  }).length;
}

/** RS-586 魔神に不足する物: ラッシュ中は捨札の戦闘員を不足パワー分まで加算。 */
export function godomDiscardPowerBonus(
  state: GameState,
  playerId: PlayerId,
): number {
  if (state.phase !== "rush" || state.activePlayer !== playerId) return 0;
  if (!playerHasGodomInField(state, playerId)) return 0;
  return countSenshoInDiscard(state, playerId);
}

export function godomRushPowerBudget(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  unitDefinition: CardDefinition,
): number {
  let budget = countAvailablePower(state, playerId);
  const cost = effectivePowerCost(state, playerId, parsePowerCost(unitDefinition.powerCost));
  if (budget >= cost) return budget;
  if (!playerHasGodomInField(state, playerId)) return budget;
  if (!cardCategories(unitDefinition).includes("DA")) return budget;
  return budget + countSenshoInDiscard(state, playerId);
}

export function applyGodomSenshoDiscardPay(
  state: GameState,
  player: PlayerState,
  shortage: number,
): PlayerState | null {
  if (shortage <= 0) return player;
  let remaining = shortage;
  const discard: PlayerState["discard"] = [];
  for (const card of player.discard) {
    if (remaining <= 0) {
      discard.push(card);
      continue;
    }
    const def = getDefinition(state.definitions, card.cardId);
    if (def?.type === "unit" && (def.features ?? []).includes("戦闘員")) {
      remaining -= 1;
      continue;
    }
    discard.push(card);
  }
  if (remaining > 0) return null;
  return { ...player, discard };
}
