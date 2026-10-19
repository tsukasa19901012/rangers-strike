import type { EffectChoiceKind, TargetSelector } from "@rangers-strike/cards/dsl/types";
import { resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../types/game";
import { cardCategories, effectiveBp, getDefinition, isSmallUnit, parsePowerCost, unitSizeOf } from "../core/catalog";
import { opponent } from "../core/helpers";
import { findOwnUnit } from "../core/modifiers";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";
import { zubaanIsLarge } from "../rules/legend1/set6NamedEffectsB";

type FieldZone = keyof Pick<PlayerState, "hand" | "discard" | "power" | "command" | "rush" | "battle">;

function cardsInZone(state: GameState, playerId: PlayerId, zone: FieldZone): CardInstance[] {
  return state.players[playerId][zone] ?? [];
}

function currentSize(state: GameState, card: CardInstance): string | undefined {
  // RS-255 巨大化爆弾・RK-013 Jパワーを重ねたユニットは「Lユニット」（core/catalog.ts unitSizeOf。atwiki/page-211）。
  const size = unitSizeOf(state.definitions, card);
  if (size && size !== "L" && zubaanIsLarge(state, card)) return "L";
  return size;
}

function matchesFilter(
  state: GameState,
  card: CardInstance,
  filter?: {
    size?: string;
    cardType?: "unit" | "operation" | "any";
    category?: string;
    categoryExcept?: string;
    maxBp?: number;
    minBp?: number;
    maxPowerCost?: number;
    commandHeld?: boolean;
    faceDown?: boolean;
    noRushAdditionalCondition?: boolean;
    requireFeature?: string;
    excludeFeature?: string;
    bpLastThreeDigits?: number;
    notRiding?: boolean;
  },
  ownerId?: PlayerId,
): boolean {
  if (!filter) return true;
  if (filter.notRiding && card.mountedOnInstanceId) return false;
  const def = getDefinition(state.definitions, card.cardId);
  const features = def?.features ?? [];
  if (filter.requireFeature && !features.includes(filter.requireFeature)) return false;
  if (filter.excludeFeature && features.includes(filter.excludeFeature)) return false;
  if (filter.bpLastThreeDigits !== undefined) {
    const bp = ownerId ? effectiveBp(state, ownerId, card) : (def?.bp ?? 0);
    if (bp % 1000 !== filter.bpLastThreeDigits) return false;
  }
  if (filter.cardType && filter.cardType !== "any" && def?.type !== filter.cardType) return false;
  // 効果でサイズが変わったユニット（RS-255 巨大化爆弾を重ねたユニットは「Lユニット」、「自分か相手のLユニットがあれば、
  // これはLユニットになり」RS-420・RS-672 等）は変わったサイズで判定する。
  if (filter.size && currentSize(state, card) !== filter.size) return false;
  if (filter.maxPowerCost !== undefined && parsePowerCost(def?.powerCost ?? 99) > filter.maxPowerCost) {
    return false;
  }
  if (filter.maxBp !== undefined && (def?.bp ?? 0) > filter.maxBp) return false;
  if (filter.minBp !== undefined && (def?.bp ?? 0) < filter.minBp) return false;
  if (filter.bpLastThreeDigits !== undefined && (def?.bp ?? 0) % 1000 !== filter.bpLastThreeDigits) return false;
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
  // cardType: "any" は「カードを1枚」（種類を問わない）の明示。暗黙のユニット絞り込みをしない。
  if (filter?.cardType === "any") return filter;
  return { ...filter, cardType: "unit" };
}

/** select_unit 等の choose kind に応じて valid セレクタへ暗黙フィルタを付与する。 */
export function augmentChooseValidSelector(
  valid: TargetSelector,
  kind: EffectChoiceKind,
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
  /** 効果の発生源カード（ブレイカーの選択保護の判定に使う。ルール: R-KW-BREAKER-03） */
  sourceCardId?: string,
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
              .filter((c) => matchesFilter(state, c, selector.filter, ownerId))
              .filter((c) => {
                if (ownerId === playerId) return true;
                return isSelectableByOpponentEffect(state, playerId, c.instanceId, sourceCardId);
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
            sourceCardId,
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
  return found !== null && isSmallUnit(state.definitions, found.card);
}
