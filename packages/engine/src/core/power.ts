import type { CardDefinition } from "@rangers-strike/cards";
import { cardCategories } from "@rangers-strike/cards";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { getDefinition } from "./catalog";
import { opponent } from "./helpers";
import { godomDiscardPowerBonus } from "../rules/godomRushPay";
import { flowerBombPowerCostOverride } from "../rules/legend1/coreGapEffects";
import { cityGuardRushPowerSurcharge } from "../rules/batch06FieldEffects";
import { hasTurnRuleModifier } from "./scopedModifiers";
import { xg6CommandPowerBonus } from "../rules/xg6/xg6Fields";
import { isRideShooterRushTarget } from "../rules/fieldActivatedAbilities";
import {
  countMirrorMonstersOnField,
  hasMirrorRiderPowerMinusRule,
} from "../rules/bkOperationTurnRules";

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
    // XG6-013【未来の戦士達へ】: カテゴリが追加されてマルチカテゴリになり、敵軍パワーは追加で2増える（rules/xg6/xg6Fields.ts）。
    const xg6 = xg6CommandPowerBonus(cmd.cardId);
    if (xg6 > 0) count += xg6;
    else if (isMultiCategoryCommand(state.definitions, cmd.cardId)) count += 1;
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

const RESIDENT_STACK_COST_RE = /自軍ラッシュフェイズ中、自分のユニットカードの必要パワーの数字は、これに重ねたカード1枚につき1少なくなる/;

/**
 * RS-435 アレ（※常駐）「自軍ラッシュフェイズ中、自分のユニットカードの必要パワーの数字は、これに重ねたカード1枚につき1少なくなる。」
 * （atwiki/page-753。「必要パワーを満たしているかの確認」→「追加条件を実行」の順なので、追加条件で重ねたカードを捨札にしても
 * 確認の時点の軽減で判定する。page-1254 Q1）。文言で判定する。
 */
export function residentStackPowerCostReduction(
  state: Pick<GameState, "players" | "definitions" | "activePlayer">,
  ownerId: PlayerId,
  cardId: string,
): number {
  const phase = (state as { phase?: GameState["phase"] }).phase;
  if (phase !== "rush" || state.activePlayer !== ownerId) return 0;
  if (getDefinition(state.definitions, cardId)?.type !== "unit") return 0;
  let reduction = 0;
  for (const op of state.players[ownerId].operation) {
    const stacked = op.stackedCards?.length ?? 0;
    if (stacked === 0) continue;
    const text = (getDefinition(state.definitions, op.cardId)?.text ?? "").normalize("NFKC").replace(/\s+/g, "");
    if (RESIDENT_STACK_COST_RE.test(text)) reduction += stacked;
  }
  return reduction;
}

/**
 * RS-375 レッドレーサー（2nd）の※「これが自軍エリアにある間、自分のユニットカードの必要パワーの数字は1増える。」（atwiki/page-552）
 * 対象はユニット「カード」（手札・山札・パワーゾーン・コマンドゾーン等）で、場のユニットには及ばない（faq-card-6 RS-375 Q2/Q4/Q5）。
 * 複数あれば重複する（R-CONT-01）。
 */
export function redRacerPowerCostBonus(
  state: Pick<GameState, "players" | "definitions">,
  ownerId: PlayerId,
  cardId: string,
): number {
  if (getDefinition(state.definitions, cardId)?.type !== "unit") return 0;
  const owner = state.players[ownerId];
  return [...owner.battle, ...owner.rush].filter((c) => c.cardId === "RS-375").length;
}

export function rushEffectivePowerCost(
  state: Pick<GameState, "players" | "definitions" | "activePlayer">,
  playerId: PlayerId,
  rawCost: number,
  cardId?: string,
): number {
  if (cardId) {
    const def = getDefinition(state.definitions, cardId);
    rawCost += redRacerPowerCostBonus(state, playerId, cardId);
    rawCost = Math.max(0, rawCost - residentStackPowerCostReduction(state, playerId, cardId));
    // ルール: R-ERR-RK043 — 【突入】の後、次にラッシュするミラーライダーの必要パワーは3少なくなる。
    if (isRideShooterRushTarget(state, playerId, cardId)) {
      rawCost = Math.max(0, rawCost - 3);
    }
    if (
      (def?.features ?? []).includes("ミラーライダー") &&
      hasMirrorRiderPowerMinusRule(state.players[playerId])
    ) {
      const reduction = countMirrorMonstersOnField(state as GameState, state.players[playerId], playerId);
      return Math.max(0, effectivePowerCost(state, playerId, rawCost) - reduction);
    }
    const flowerBomb = flowerBombPowerCostOverride(state, playerId, cardId);
    if (flowerBomb !== null) return flowerBomb;
    const surcharge = cityGuardRushPowerSurcharge(state, playerId, cardId);
    if (surcharge > 0) {
      return effectivePowerCost(state, playerId, rawCost + surcharge);
    }
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
