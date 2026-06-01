import type { CardDefinition } from "@rangers-strike/cards";
import { legend1Catalog, legend2Catalog } from "@rangers-strike/cards";
import type { NumberComboEffectId } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { applyAction } from "../core/applyAction";
import { TEST_DEFINITIONS } from "./fixtures";

export const legendDefinitions: Record<string, CardDefinition> = {
  ...TEST_DEFINITIONS,
  ...Object.fromEntries(legend1Catalog.cards.map((card) => [card.id, card])),
  ...Object.fromEntries(legend2Catalog.cards.map((card) => [card.id, card])),
};

export function battleFillers(count: number, prefix = "fill"): CardInstance[] {
  return Array.from({ length: count }, (_, index) => ({
    instanceId: `TST-UNIT-0:${prefix}${index}`,
    cardId: "TST-UNIT-0",
  }));
}

export function moveToBattle(
  state: GameState,
  instanceId: string,
  playerId: PlayerId = "player1",
): GameState {
  const result = applyAction(state, {
    type: "move_to_battle",
    playerId,
    instanceId,
  });
  if (!result.ok) {
    throw new Error(`move_to_battle failed: ${result.error ?? "unknown"}`);
  }
  return result.state;
}

/** Log detail suffix for each NC effect (see numberComboEffects ncLog). */
const NC_LOG_DETAIL: Partial<Record<NumberComboEffectId, string>> = {
  grant_sp1: "sp1",
};

export function hasNcLog(state: GameState, effectId: string): boolean {
  const detail = NC_LOG_DETAIL[effectId as NumberComboEffectId] ?? effectId;
  return state.log.some(
    (entry) => entry.includes("number_combo") && entry.includes(detail),
  );
}

export function battleUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): CardInstance | undefined {
  return state.players[playerId].battle.find((card) => card.instanceId === instanceId);
}
