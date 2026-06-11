import type { Category } from "@rangers-strike/cards";
import { cardCategories } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { cardHasKeyword } from "./cardKeywords";
import { getDefinition, isLargeUnit } from "../core/catalog";
import { cardHasGrantKeyword, listCardGrantKeywords } from "../dsl/promotedKeywordBridge";
import { battlePositionOneBased } from "../rules/fractionalSp";

const TAXIS_POSITION: Record<Category, number> = {
  WB: 1,
  MA: 2,
  OT: 3,
  ET: 4,
  DA: 5,
};

export function crossValueForCard(cardId: string): number {
  let total = 0;
  for (const keyword of listCardGrantKeywords(cardId)) {
    const match = keyword.match(/^cross(\d+)$/);
    if (match) total += Number(match[1]);
  }
  return total;
}

export function cardHasBattleKeyword(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  keyword: "cross1" | "blast" | "breaker" | "scrum" | "taxis",
  context?: { state: GameState; playerId: PlayerId },
): boolean {
  if (keyword === "cross1") {
    return crossValueForCard(cardId) > 0 || cardHasGrantKeyword(cardId, "cross1");
  }
  if (cardHasGrantKeyword(cardId, keyword)) return true;
  const labels: Record<string, string[]> = {
    blast: ["blast", "ブラスト"],
    breaker: ["breaker", "ブレイカー"],
    scrum: ["scrum", "スクラム"],
    taxis: ["taxis", "タクス"],
  };
  const def = definitions[cardId];
  if (!def?.text) return false;
  return labels[keyword]?.some((label) => def.text!.includes(label)) ?? false;
}

/** 左側ユニットのクロス合計（以降ユニットの CN / 分数 SP 繰り上げ）。 */
export function crossShiftLeftOf(
  battle: CardInstance[],
  index: number,
): number {
  let shift = 0;
  for (let i = 0; i < index; i += 1) {
    shift += crossValueForCard(battle[i]!.cardId);
  }
  return shift;
}

export function crossAdjustedBattlePosition(
  battle: CardInstance[],
  instanceId: string,
): number | null {
  const index = battle.findIndex((c) => c.instanceId === instanceId);
  if (index < 0) return null;
  const raw = index + 1;
  const shift = crossShiftLeftOf(battle, index);
  return Math.max(1, raw - shift);
}

export function parseTaxisCategory(cardId: string): Category | null {
  for (const keyword of listCardGrantKeywords(cardId)) {
    const match = keyword.match(/^taxis_(MA|ET|OT|WB|DA)$/);
    if (match) return match[1] as Category;
  }
  return null;
}

/** タクス: 隣接左ユニットが指定位置にいれば SP1（クロス非影響の絶対位置）。 */
export function taxisSpFloor(
  state: GameState,
  playerId: PlayerId,
  instance: CardInstance,
): number {
  const player = state.players[playerId];
  const index = player.battle.findIndex((c) => c.instanceId === instance.instanceId);
  if (index <= 0) return 0;

  const left = player.battle[index - 1]!;
  const taxisCategory = parseTaxisCategory(left.cardId);
  if (!taxisCategory) return 0;

  const holderPosition = index;
  if (holderPosition !== TAXIS_POSITION[taxisCategory]) return 0;

  const def = getDefinition(state.definitions, instance.cardId);
  if (!def || def.type !== "unit") return 0;
  if (!cardCategories(def).includes(taxisCategory)) return 0;
  return 1;
}

function numericComboNumbers(
  battle: CardInstance[],
  definitions: Record<string, CardDefinition>,
): number[] {
  const numbers: number[] = [];
  for (const card of battle) {
    const def = getDefinition(definitions, card.cardId);
    if (typeof def?.comboNumber === "number") {
      numbers.push(def.comboNumber);
    }
  }
  return numbers;
}

/** スクラム: バトル CN が左から昇順ならアタック不可。 */
export function scrumBlocksAttack(
  state: GameState,
  defenderPlayerId: PlayerId,
  defenderInstanceId: string,
): boolean {
  const player = state.players[defenderPlayerId];
  const defender = player.battle.find((c) => c.instanceId === defenderInstanceId);
  if (!defender) return false;
  if (!cardHasBattleKeyword(state.definitions, defender.cardId, "scrum")) {
    return false;
  }

  const numbers = numericComboNumbers(player.battle, state.definitions);
  if (numbers.length < 2) return false;
  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i]! <= numbers[i - 1]!) return false;
  }
  return true;
}

/** ブレイカー: 敵ユニット/ビークル効果の対象にならない（ブレイカー同士は可）。 */
export function breakerBlocksEffectTarget(
  definitions: Record<string, CardDefinition>,
  targetCardId: string,
  sourceCardId?: string,
): boolean {
  if (!cardHasBattleKeyword(definitions, targetCardId, "breaker")) return false;
  if (sourceCardId && cardHasBattleKeyword(definitions, sourceCardId, "breaker")) {
    return false;
  }
  return true;
}

export function cardHasNotSelectableExceptAttack(cardId: string): boolean {
  return cardHasGrantKeyword(cardId, "not_selectable_except_attack");
}

/** ブレイカー同名制限: ブレイカー持ち同名が場にいるとラッシュ不可。 */
export function breakerBlocksSameNameRush(
  player: { rush: CardInstance[]; battle: CardInstance[] },
  definitions: Record<string, CardDefinition>,
  rushingCardId: string,
): boolean {
  if (!cardHasBattleKeyword(definitions, rushingCardId, "breaker")) return false;
  const rushingName = getDefinition(definitions, rushingCardId)?.name;
  if (!rushingName) return false;

  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      const def = getDefinition(definitions, card.cardId);
      if (def?.name !== rushingName) continue;
      if (cardHasBattleKeyword(definitions, card.cardId, "breaker")) {
        return true;
      }
    }
  }
  return false;
}

/** ブラスト: パワー残り1枚で追加条件を無視してラッシュ可能。 */
export function blastBypassesRushAdditionalCondition(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  rushingCardId: string,
): boolean {
  if (!cardHasBattleKeyword(state.definitions, rushingCardId, "blast")) return false;
  const faceUp = state.players[playerId].power.filter((c) => !c.faceDown).length;
  return faceUp <= 1;
}

export function playerHasAllyLargeUnit(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    if (player[zone].some((c) => isLargeUnit(state.definitions, c.cardId))) {
      return true;
    }
  }
  return false;
}

export function cardHasMorphKeyword(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  return cardHasKeyword(definitions, cardId, "morph");
}

export function powerZoneHasMorphUnitCard(
  state: GameState,
  playerId: PlayerId,
): boolean {
  return state.players[playerId].power.some((card) => {
    if (card.faceDown) return false;
    const def = getDefinition(state.definitions, card.cardId);
    return def?.type === "unit" && cardHasMorphKeyword(state.definitions, card.cardId);
  });
}

export function isBloodVesselStrikeActive(
  state: GameState,
  strikerOwnerId: PlayerId,
): boolean {
  const player = state.players[strikerOwnerId];
  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      if (cardHasGrantKeyword(card.cardId, "blood_vessel_on_strike")) {
        return true;
      }
    }
  }
  return false;
}

export function canWingAttackFromRush(
  state: GameState,
  playerId: PlayerId,
  unit: CardInstance,
): boolean {
  if (!cardHasKeyword(state.definitions, unit.cardId, "wing", { state, playerId })) {
    return false;
  }
  if (unit.battleActed) return false;
  const inRush = state.players[playerId].rush.some((c) => c.instanceId === unit.instanceId);
  return inRush;
}

export function battlePositionForInstance(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): number | null {
  return battlePositionOneBased(state.players[playerId].battle, instanceId);
}
