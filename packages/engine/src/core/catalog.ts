import type { CardDefinition, Category } from "@rangers-strike/cards";
import { getCardEffect } from "@rangers-strike/cards";
import type { SpValue } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { hasCommandForCardUse } from "../rules/restrictions";
import { passiveNamedFieldBpBonus } from "../rules/fieldAuras";
import { collectZordMaterials, hasAllRequiredFusionMaterials, needsZordMaterial, requiresAllFusionPartners } from "../rules/zord";
import { getTurnModifiers } from "../rules/turnModifiers";
import { opponentInfiniteChainBlocks } from "../rules/turnModifiers";
import { countHeldCommands } from "../rules/restrictions";

export function buildDefinitionMap(
  decks: CardDefinition[][],
): Record<string, CardDefinition> {
  const map: Record<string, CardDefinition> = {};
  for (const deck of decks) {
    for (const card of deck) {
      map[card.id] = card;
    }
  }
  return map;
}

export function parsePowerCost(cost: number | string): number {
  if (typeof cost === "number") return cost;
  const parsed = Number.parseInt(cost.replace("+", ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function strikeDamage(sp: SpValue | undefined): number {
  if (typeof sp === "number") return sp;
  return 1;
}

export function unitBp(definition: CardDefinition | undefined): number {
  return definition?.bp ?? 0;
}

export function instanceBp(
  definitions: Record<string, CardDefinition>,
  instance: CardInstance,
): number {
  return unitBp(getDefinition(definitions, instance.cardId)) + (instance.bpModifier ?? 0);
}

export function getDefinition(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): CardDefinition | undefined {
  return definitions[cardId];
}

export function isUnit(definition: CardDefinition | undefined): boolean {
  return definition?.type === "unit";
}

export function isOperation(definition: CardDefinition | undefined): boolean {
  return definition?.type === "operation";
}

export function isPermanentOperation(definition: CardDefinition | undefined): boolean {
  if (!isOperation(definition)) return false;
  const effect = getCardEffect(definition!.id);
  if (effect?.kind === "permanent") return true;
  return definition?.tags?.includes("常駐") ?? false;
}

export function isCounterOperation(definition: CardDefinition | undefined): boolean {
  if (!isOperation(definition)) return false;
  const effect = getCardEffect(definition!.id);
  if (effect?.kind === "counter") return true;
  return definition?.tags?.includes("カウンター") ?? false;
}

export function cardName(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): string {
  return getDefinition(definitions, cardId)?.name ?? cardId;
}

export function hasOperationEffect(
  player: PlayerState,
  effectId: string,
  definitions: Record<string, CardDefinition>,
  context?: { state: GameState; playerId: PlayerId },
): boolean {
  const active = player.operation.some(
    (card) => getCardEffect(card.cardId)?.effectId === effectId,
  );
  if (!active) return false;
  if (context && opponentInfiniteChainBlocks(context.state, context.playerId)) {
    return false;
  }
  return true;
}

export function isSmallUnit(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return getDefinition(definitions, cardId)?.size === "S";
}

export function isLargeUnit(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return getDefinition(definitions, cardId)?.size === "L";
}

/** RS-015: effective combo number for NC checks (min 2, only reduces if raw > 2). */
export function effectiveComboNumber(
  state: GameState,
  playerId: PlayerId,
  rawComboNumber: number,
): number {
  const delta = getTurnModifiers(state.players[playerId]).comboNumberDelta;
  if (rawComboNumber <= 2) return rawComboNumber;
  return Math.max(2, rawComboNumber - delta);
}

/** Passive BP bonus from permanent operations in play. */
export function passiveBpBonus(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const player = state.players[playerId];
  let bonus = 0;

  if (
    hasOperationEffect(player, "ki_power", state.definitions) &&
    state.activePlayer !== playerId &&
    isSmallUnit(state.definitions, instance.cardId)
  ) {
    const inField =
      player.rush.some((c) => c.instanceId === instance.instanceId) ||
      player.battle.some((c) => c.instanceId === instance.instanceId);
    if (inField) {
      const released = player.command.filter((c) => !c.commandHeld).length;
      bonus += released * 1000;
    }
  }

  const auraTarget = getTurnModifiers(player).auraPowerInstanceId;
  if (
    auraTarget === instance.instanceId &&
    isSmallUnit(state.definitions, instance.cardId)
  ) {
    bonus += player.damage * 2000;
  }

  return bonus;
}

/** RS-019: optional BP boost when S unit attacks. */
export function superPowerAttackBonus(
  state: GameState,
  playerId: PlayerId,
  attacker: CardInstance,
): number {
  const player = state.players[playerId];
  if (!hasOperationEffect(player, "super_power", state.definitions)) return 0;
  if (!isSmallUnit(state.definitions, attacker.cardId)) return 0;
  return countHeldCommands(player) * 1000;
}

export function effectiveBp(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  return (
    instanceBp(state.definitions, instance) +
    passiveBpBonus(state, playerId, instance) +
    passiveNamedFieldBpBonus(state, playerId, instance, "general")
  );
}

export function cardCategories(definition: CardDefinition | undefined): Category[] {
  if (!definition) return [];
  return Array.isArray(definition.category)
    ? definition.category
    : [definition.category];
}

export function hasHeldCommandForCategories(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  categories: Category[],
): boolean {
  if (categories.length === 0) return true;

  return player.command.some((cmd) => {
    if (!cmd.commandHeld) return false;
    const cmdCats = cardCategories(getDefinition(definitions, cmd.cardId));
    return categories.some((cat) => cmdCats.includes(cat));
  });
}

export function canRushUnit(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  unitDefinition: CardDefinition,
  rushingInstanceId: string,
  zordMaterialInstanceId?: string,
): boolean {
  const cost = parsePowerCost(unitDefinition.powerCost);
  if (player.power.length < cost) return false;

  const unitCats = cardCategories(unitDefinition);
  if (!hasCommandForCardUse(player, definitions, unitCats)) return false;

  if (!needsZordMaterial(definitions, unitDefinition.id)) return true;

  if (requiresAllFusionPartners(unitDefinition.id)) {
    return hasAllRequiredFusionMaterials(
      player,
      unitDefinition.id,
      rushingInstanceId,
    );
  }

  const materials = collectZordMaterials(
    player,
    definitions,
    unitDefinition.id,
    rushingInstanceId,
  );
  if (materials.length === 0) return false;
  if (!zordMaterialInstanceId) return true;
  return materials.some((m) => m.instanceId === zordMaterialInstanceId);
}

export function canPlayOperation(
  player: PlayerState,
  definitions: Record<string, CardDefinition>,
  definition: CardDefinition,
): boolean {
  const cost = parsePowerCost(definition.powerCost);
  if (player.power.length < cost) return false;

  const opCats = cardCategories(definition);
  return hasCommandForCardUse(player, definitions, opCats);
}

export { needsZordMaterial } from "../rules/zord";

export function canHoldCommandPhases(phase: GameState["phase"]): boolean {
  return phase === "rush" || phase === "battle";
}
