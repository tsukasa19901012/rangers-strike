import type { EffectPrimitive, TargetSelector } from "@rangers-strike/cards/dsl/types";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { cardCategories, getDefinition, isSmallUnit, parsePowerCost } from "../core/catalog";
import { opponent } from "../core/helpers";
import { findOwnUnit } from "../core/modifiers";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";

type FieldZone = keyof Pick<PlayerState, "hand" | "discard" | "power" | "command" | "rush" | "battle">;

function cardsInZone(state: GameState, playerId: PlayerId, zone: FieldZone): CardInstance[] {
  return state.players[playerId][zone] ?? [];
}

function matchesFilter(
  state: GameState,
  card: CardInstance,
  filter?: {
    size?: string;
    cardType?: "unit" | "operation";
    category?: string;
    categoryExcept?: string;
    maxBp?: number;
    minBp?: number;
    maxPowerCost?: number;
    commandHeld?: boolean;
    faceDown?: boolean;
    noRushAdditionalCondition?: boolean;
  },
): boolean {
  if (!filter) return true;
  const def = getDefinition(state.definitions, card.cardId);
  if (filter.cardType && def?.type !== filter.cardType) return false;
  if (filter.size && def?.size !== filter.size) return false;
  if (filter.maxPowerCost !== undefined && parsePowerCost(def?.powerCost ?? 99) > filter.maxPowerCost) {
    return false;
  }
  if (filter.maxBp !== undefined && (def?.bp ?? 0) > filter.maxBp) return false;
  if (filter.minBp !== undefined && (def?.bp ?? 0) < filter.minBp) return false;
  if (filter.commandHeld !== undefined && !!card.commandHeld !== filter.commandHeld) return false;
  if (filter.faceDown !== undefined && !!card.faceDown !== filter.faceDown) return false;
  if (filter.noRushAdditionalCondition && resolveRushAdditionalCondition(card.cardId, def)) {
    return false;
  }
  const cats = cardCategories(def);
  if (filter.categoryExcept && cats.includes(filter.categoryExcept as never)) return false;
  if (filter.category && !cats.includes(filter.category as never)) return false;
  return true;
}

function withUnitTypeFilter(
  filter?: NonNullable<Extract<TargetSelector, { type: "zone" }>["filter"]>,
): NonNullable<Extract<TargetSelector, { type: "zone" }>["filter"]> {
  return { ...filter, cardType: "unit" };
}

/** select_unit 等の choose kind に応じて valid セレクタへ暗黙フィルタを付与する。 */
export function augmentChooseValidSelector(
  valid: TargetSelector,
  kind: EffectPrimitive extends { type: "choose" } ? EffectPrimitive["kind"] : never,
): TargetSelector {
  if (kind !== "select_unit") return valid;
  if (valid.type !== "zone") return valid;
  return { ...valid, filter: withUnitTypeFilter(valid.filter) };
}

export function collectTargetInstanceIds(
  state: GameState,
  playerId: PlayerId,
  selector: TargetSelector,
  operationInstanceId?: string,
): string[] {
  const enemyId = opponent(playerId);

  switch (selector.type) {
    case "self":
      return operationInstanceId ? [operationInstanceId] : [];
    case "trigger_source":
      return [];
    case "instance":
      return [selector.instanceId];
    case "zone": {
      const ownerIds: PlayerId[] =
        selector.owner === "self"
          ? [playerId]
          : selector.owner === "opponent"
            ? [enemyId]
            : [playerId, enemyId];
      const zone = selector.zone;
      if (
        zone === "hand" ||
        zone === "discard" ||
        zone === "power" ||
        zone === "command" ||
        zone === "rush" ||
        zone === "battle"
      ) {
        const ids: string[] = [];
        for (const ownerId of ownerIds) {
          ids.push(
            ...cardsInZone(state, ownerId, zone as FieldZone)
              .filter((c) => matchesFilter(state, c, selector.filter))
              .filter((c) => {
                if (ownerId === playerId) return true;
                return isSelectableByOpponentEffect(state, playerId, c.instanceId);
              })
              .map((c) => c.instanceId),
          );
        }
        return ids;
      }
      return [];
    }
    case "zones": {
      const ids: string[] = [];
      for (const part of selector.zones) {
        ids.push(
          ...collectTargetInstanceIds(
            state,
            playerId,
            { type: "zone", zone: part.zone, owner: part.owner, filter: part.filter },
            operationInstanceId,
          ),
        );
      }
      return ids;
    }
    default:
      return [];
  }
}

export function resolveTargetInstanceId(
  state: GameState,
  playerId: PlayerId,
  selector: TargetSelector,
  operationInstanceId?: string,
  triggerSourceInstanceId?: string,
): string | undefined {
  switch (selector.type) {
    case "self":
      return operationInstanceId;
    case "trigger_source":
      return triggerSourceInstanceId;
    case "instance":
      return selector.instanceId;
    case "zone": {
      const ids = collectTargetInstanceIds(state, playerId, selector, operationInstanceId);
      return ids[0];
    }
    case "zones": {
      const ids = collectTargetInstanceIds(state, playerId, selector, operationInstanceId);
      return ids[0];
    }
    default:
      return undefined;
  }
}

export function isValidOwnSmallUnitTarget(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean {
  const found = findOwnUnit(state.players[playerId], instanceId);
  return found !== null && isSmallUnit(state.definitions, found.card.cardId);
}
