import { hasPowerCostMinusSuffix } from "@rangers-strike/cards";
import type { UnitSize } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import {
  cardName,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  isUnit,
} from "../core/catalog";
import { opponent } from "../core/helpers";
import { startSelectUnitChoice } from "./pendingChoices";

function matchesPowerCostMinus(
  definitions: GameState["definitions"],
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  return hasPowerCostMinusSuffix(def?.powerCost);
}

export function collectPowerCostMinusUnitIds(
  state: GameState,
  targetPlayerId: PlayerId,
  options: {
    size?: UnitSize;
    zones?: Array<"rush" | "battle">;
    maxBp?: number;
  } = {},
): string[] {
  const zones = options.zones ?? ["battle", "rush"];
  const maxBp = options.maxBp ?? Number.MAX_SAFE_INTEGER;
  const player = state.players[targetPlayerId];
  const ids: string[] = [];

  for (const zone of zones) {
    for (const card of player[zone]) {
      const def = getDefinition(state.definitions, card.cardId);
      if (!def || !isUnit(def)) continue;
      if (!matchesPowerCostMinus(state.definitions, card.cardId)) continue;
      if (options.size && def.size !== options.size) continue;
      if (effectiveBp(state, targetPlayerId, card) > maxBp) continue;
      ids.push(card.instanceId);
    }
  }

  return ids;
}

export function tryStartDestroyPowerCostMinusChoice(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
  phasePlayerId: PlayerId,
  options: {
    effectId: string;
    enemyOnly?: boolean;
    size?: UnitSize;
    optional?: boolean;
  },
): GameState | null {
  const targetPlayerId = options.enemyOnly === false ? playerId : opponent(playerId);
  const targets = collectPowerCostMinusUnitIds(state, targetPlayerId, {
    size: options.size,
  });
  if (targets.length === 0) return null;

  return startSelectUnitChoice(state, {
    playerId,
    effectId: options.effectId,
    sourceCardId,
    phasePlayerId,
    validInstanceIds: targets,
    unitDestination: "discard",
    optional: options.optional,
  });
}

export function describePowerCostMinusTarget(
  definitions: GameState["definitions"],
  cardId: string,
): string {
  return cardName(definitions, cardId);
}

export function isEnemySmallPowerCostMinus(
  state: GameState,
  enemyPlayerId: PlayerId,
  instanceId: string,
): boolean {
  const enemy = state.players[enemyPlayerId];
  for (const zone of ["battle", "rush"] as const) {
    const card = enemy[zone].find((c) => c.instanceId === instanceId);
    if (!card) continue;
    const def = getDefinition(state.definitions, card.cardId);
    return (
      !!def &&
      isUnit(def) &&
      isSmallUnit(state.definitions, card.cardId) &&
      matchesPowerCostMinus(state.definitions, card.cardId)
    );
  }
  return false;
}
