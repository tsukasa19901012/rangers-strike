import type { Category } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import {
  cardCategories,
  effectiveBp,
  getDefinition,
  isSmallUnit,
  isMediumUnit,
  isLargeUnit,
} from "../../core/catalog";
import { opponent } from "../../core/helpers";
import { isSelectableByOpponentEffect } from "../../keywords/effectTargetability";
import type { GameState, PlayerId } from "../../types/game";
import { openEffectChoice } from "../pendingChoices";

type BaseChoiceParams = {
  playerId: PlayerId;
  effectId: string;
  sourceCardId: string;
  sourceInstanceId?: string;
  phasePlayerId: PlayerId;
  optional?: boolean;
};

export type EnemyUnitFilter = {
  zone?: "battle" | "rush" | "both";
  maxBp?: number;
  minBp?: number;
  size?: CardDefinition["size"];
  requireFeature?: string;
  excludeFeature?: string;
  category?: Category;
  printedBpMax?: number;
};

function unitMatchesFilter(
  state: GameState,
  ownerId: PlayerId,
  cardId: string,
  filter: EnemyUnitFilter,
): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (def?.type !== "unit") return false;
  if (filter.size && def.size !== filter.size) return false;
  if (filter.category && !cardCategories(def).includes(filter.category)) return false;
  if (filter.requireFeature && !(def.features ?? []).includes(filter.requireFeature)) {
    return false;
  }
  if (filter.excludeFeature && (def.features ?? []).includes(filter.excludeFeature)) {
    return false;
  }
  const owner = state.players[ownerId];
  const instance = [...owner.battle, ...owner.rush].find((c) => c.cardId === cardId);
  if (!instance) return false;
  const bp = effectiveBp(state, ownerId, instance);
  if (filter.maxBp !== undefined && bp > filter.maxBp) return false;
  if (filter.minBp !== undefined && bp < filter.minBp) return false;
  if (filter.printedBpMax !== undefined) {
    const printed = def.bp ?? 0;
    if (printed > filter.printedBpMax) return false;
  }
  return true;
}

export function collectEnemyUnits(
  state: GameState,
  actorId: PlayerId,
  filter: EnemyUnitFilter = {},
): string[] {
  const enemyId = opponent(actorId);
  const enemy = state.players[enemyId];
  const zones =
    filter.zone === "battle"
      ? (["battle"] as const)
      : filter.zone === "rush"
        ? (["rush"] as const)
        : (["battle", "rush"] as const);
  const ids: string[] = [];
  for (const zone of zones) {
    for (const card of enemy[zone]) {
      if (!isSelectableByOpponentEffect(state, actorId, card.instanceId)) continue;
      if (!unitMatchesFilter(state, enemyId, card.cardId, filter)) continue;
      ids.push(card.instanceId);
    }
  }
  return ids;
}

export function parseEnemyUnitFilter(body: string): EnemyUnitFilter {
  const filter: EnemyUnitFilter = { zone: "battle" };
  if (/ラッシュエリア/.test(body)) filter.zone = "rush";
  if (/バトルエリア/.test(body) && /ラッシュエリア/.test(body)) filter.zone = "both";
  const bpLe = body.match(/BP(\d+)以下/);
  if (bpLe) filter.maxBp = Number(bpLe[1]);
  const bpGe = body.match(/BP(\d+)以上/);
  if (bpGe) filter.minBp = Number(bpGe[1]);
  const printedBp = body.match(/本来のBPが(\d+)以下/);
  if (printedBp) filter.printedBpMax = Number(printedBp[1]);
  if (/Sユニット/.test(body)) filter.size = "S";
  if (/Mユニット/.test(body)) filter.size = "M";
  if (/Lユニット/.test(body)) filter.size = "L";
  const feature = body.match(/特徴「([^」]+)」を持つ/);
  if (feature) filter.requireFeature = feature[1];
  const exclude = body.match(/特徴「([^」]+)」を持たない/);
  if (exclude) filter.excludeFeature = exclude[1];
  const category = body.match(/カテゴリ.*?「([A-Z]{2,})」/);
  if (category) filter.category = category[1] as Category;
  const catShort = body.match(/([A-Z]{2})の.*?ユニット/);
  if (!filter.category && catShort) filter.category = catShort[1] as Category;
  return filter;
}

export function startGenericEnemyUnitChoice(
  state: GameState,
  params: BaseChoiceParams & {
    filter?: EnemyUnitFilter;
    destination: "power" | "discard" | "hand" | "rush";
    selectCount?: number;
  },
): GameState | null {
  const valid = collectEnemyUnits(state, params.playerId, params.filter);
  if (valid.length === 0) return null;
  return openEffectChoice(state, {
    ...params,
    kind: "select_unit",
    validInstanceIds: valid,
    unitDestination: params.destination,
    selectCount: params.selectCount ?? 1,
    optional: params.optional ?? /してもよい|選んでもよい/.test(params.effectId),
  });
}

export function countFieldFeatureUnits(
  state: GameState,
  playerId: PlayerId,
  feature: string,
  zone: "rush" | "battle" | "both" = "rush",
): number {
  const player = state.players[playerId];
  const zones = zone === "both" ? (["rush", "battle"] as const) : ([zone] as const);
  let count = 0;
  for (const z of zones) {
    for (const card of player[z]) {
      const def = getDefinition(state.definitions, card.cardId);
      if (def?.type === "unit" && (def.features ?? []).includes(feature)) {
        count += 1;
      }
    }
  }
  return count;
}

export function playerHasFieldCard(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  zones: ("rush" | "battle" | "operation")[] = ["rush", "battle"],
): boolean {
  const player = state.players[playerId];
  return zones.some((z) => player[z].some((c) => c.cardId === cardId));
}

export function anyPlayerHasFieldCard(
  state: GameState,
  cardId: string,
  zones: ("rush" | "battle" | "operation")[] = ["rush", "battle"],
): { playerId: PlayerId } | null {
  for (const playerId of ["player1", "player2"] as const) {
    if (playerHasFieldCard(state, playerId, cardId, zones)) {
      return { playerId };
    }
  }
  return null;
}

export function parseFeatureThreshold(body: string): { feature: string; count: number } | null {
  const m = body.match(/特徴「([^」]+)」を持つユニットが(\d+)体以上/);
  if (!m) return null;
  return { feature: m[1]!, count: Number(m[2]) };
}

export function parseBpThreshold(body: string): number | null {
  const m = body.match(/BP(\d+)以上/);
  return m ? Number(m[1]) : null;
}

export function parseSizeFromBody(body: string): CardDefinition["size"] | undefined {
  if (/Sユニット/.test(body)) return "S";
  if (/Mユニット/.test(body)) return "M";
  if (/Lユニット/.test(body)) return "L";
  if (/XLユニット/.test(body)) return "XL";
  return undefined;
}

export function isNamedSizeUnit(
  state: GameState,
  cardId: string,
  size: CardDefinition["size"],
): boolean {
  const def = getDefinition(state.definitions, cardId);
  if (!def || def.type !== "unit") return false;
  if (size === "S") return isSmallUnit(state.definitions, cardId);
  if (size === "M") return isMediumUnit(state.definitions, cardId);
  if (size === "L") return isLargeUnit(state.definitions, cardId);
  return def.size === size;
}
