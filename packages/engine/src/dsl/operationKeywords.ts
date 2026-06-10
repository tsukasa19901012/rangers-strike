import { getCardEffect } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { listDslEffectsForTrigger } from "./effectLookup";

function operationCardHasResidentKeyword(cardId: string, keyword: string): boolean {
  const effects = listDslEffectsForTrigger(cardId, "operation");
  return effects.some(
    (effect) =>
      effect.trigger.type === "operation" &&
      effect.trigger.timing === "resident" &&
      effect.effects.some(
        (primitive) =>
          primitive.type === "grant_keyword" && primitive.keyword === keyword,
      ),
  );
}

/** 常駐 OP の DSL grant_keyword（strike_intercept / plasma 等）。 */
export function playerHasOperationGrantKeyword(
  state: GameState,
  playerId: PlayerId,
  keyword: string,
): boolean {
  const player = state.players[playerId];
  for (const card of player.operation) {
    if (operationCardHasResidentKeyword(card.cardId, keyword)) return true;
    const legacy = getCardEffect(card.cardId);
    if (!legacy) continue;
    const legacyKeyword = LEGACY_EFFECT_TO_KEYWORD[legacy.effectId];
    if (legacyKeyword === keyword) return true;
  }
  return false;
}

const LEGACY_EFFECT_TO_KEYWORD: Record<string, string> = {
  five_tech: "strike_intercept_with_s_unit",
  plasma_energy: "destroy_striker_on_strike_self_discard",
};
