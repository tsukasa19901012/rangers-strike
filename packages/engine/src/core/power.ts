import type { CardDefinition } from "@rangers-strike/cards";
import { cardCategories } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "./catalog";
import { opponent } from "./helpers";
import { godomDiscardPowerBonus } from "../rules/godomRushPay";
import { flowerBombPowerCostOverride } from "../rules/legend1/coreGapEffects";
import { hasTurnRuleModifier } from "./scopedModifiers";

/** コマンドゾーンのカードがマルチカテゴリ（2+）か。表裏・ホールド不問。 */
export function isMultiCategoryCommand(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const def = getDefinition(definitions, cardId);
  return cardCategories(def).length >= 2;
}

/** 相手コマンドゾーンのマルチカテゴリ枚数（公式パワー加算分）。 */
export function countOpponentMultiCategoryCommands(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
): number {
  const enemy = state.players[opponent(playerId)];
  let count = 0;
  for (const cmd of enemy.command) {
    if (isMultiCategoryCommand(state.definitions, cmd.cardId)) count += 1;
  }
  return count;
}

/** 利用可能パワー = 自軍パワーゾーン + 相手コマンドのマルチカテゴリ枚数。 */
export function countAvailablePower(
  state: Pick<GameState, "players" | "definitions" | "activePlayer"> & {
    phase?: GameState["phase"];
  },
  playerId: PlayerId,
): number {
  const base =
    state.players[playerId].power.length +
    countOpponentMultiCategoryCommands(state, playerId);
  if (!state.phase || !state.activePlayer) return base;
  return base + godomDiscardPowerBonus(state as GameState, playerId);
}

const ENEMY_POWER_COST_MINUS_RULE = "enemy_power_cost_minus";

/** 敵ターン中に相手が付与した必要パワー減少（XG5-003 等）。 */
export function enemyPowerCostReduction(
  state: Pick<GameState, "players" | "activePlayer">,
  rusherPlayerId: PlayerId,
): number {
  const activator = opponent(rusherPlayerId);
  if (state.activePlayer !== activator) return 0;
  if (!hasTurnRuleModifier(state.players[activator], ENEMY_POWER_COST_MINUS_RULE)) {
    return 0;
  }
  return 1;
}

/** ラッシュ/オペ判定用の実効必要パワー（0 未満にならない）。 */
export function effectivePowerCost(
  state: Pick<GameState, "players" | "definitions" | "activePlayer">,
  playerId: PlayerId,
  rawCost: number,
): number {
  const reduced = rawCost - enemyPowerCostReduction(state, playerId);
  return Math.max(0, reduced);
}

export function rushEffectivePowerCost(
  state: Pick<GameState, "players" | "definitions" | "activePlayer">,
  playerId: PlayerId,
  rawCost: number,
  cardId?: string,
): number {
  if (cardId) {
    const flowerBomb = flowerBombPowerCostOverride(state, playerId, cardId);
    if (flowerBomb !== null) return flowerBomb;
  }
  return effectivePowerCost(state, playerId, rawCost);
}

export function canAffordAvailablePower(
  state: Pick<GameState, "players" | "definitions" | "activePlayer">,
  playerId: PlayerId,
  cost: number,
): boolean {
  return countAvailablePower(state, playerId) >= effectivePowerCost(state, playerId, cost);
}

/** @deprecated countAvailablePower(state, playerId) を使用。 */
export function canAffordPower(player: PlayerState, cost: number): boolean {
  return player.power.length >= cost;
}

export function payPowerCost(
  state: Pick<GameState, "players" | "definitions" | "activePlayer">,
  playerId: PlayerId,
  cost: number,
): boolean {
  if (cost <= 0) return true;
  return canAffordAvailablePower(state, playerId, cost);
}

export { ENEMY_POWER_COST_MINUS_RULE };
