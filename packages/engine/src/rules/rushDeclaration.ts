import type { CardDefinition } from "@rangers-strike/cards";
import { isZordUpCost } from "@rangers-strike/cards";
import { isCostWindowSatisfied } from "../core/costWindow";
import {
  canRushUnitExceptCommandHold,
  cardCategories,
  getDefinition,
  isRushable,
  needsZordMaterial,
} from "../core/catalog";
import type { GameState, PlayerId, PlayerState } from "../types/game";
import { validateZordAdditionalPayment } from "./mothership";
import { isShironLightRushTarget } from "./shironLight";
import { isRideShooterRushTarget } from "./fieldActivatedAbilities";
import { darkDealRushPowerBudget } from "./legend3/restrictions";
import { godomRushPowerBudget } from "./godomRushPay";
import { requiresAllFusionPartners, hasAllRequiredFusionMaterials } from "./zord";
import { rushAdditionalConditionApplies } from "./bkOperationTurnRules";

/**
 * 手札からのラッシュで必要パワーの判定に使える量（アブレラ【闇の取引】・ゴードム等の補填を含む）。
 * ルール: R-RUSH-11 — 必要パワーは追加条件を実行する前の状態で確認する。
 */
export function rushPowerBudget(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  definition: CardDefinition,
): number {
  return Math.max(
    darkDealRushPowerBudget(state, playerId, player, definition),
    godomRushPowerBudget(state, playerId, player, definition),
  );
}

/** カテゴリ支払い済み、またはカテゴリ不要なユニットのみ直接 rush 可能。 */
export function canDeclareRush(
  state: GameState,
  playerId: PlayerId,
  player: PlayerState,
  definitions: GameState["definitions"],
  definition: CardDefinition,
  instanceId: string,
  zord?: {
    zordMaterialInstanceId?: string;
    zordMaterialInstanceIds?: string[];
    zordMothershipHoldInstanceIds?: string[];
    zordExtraCommandHoldInstanceIds?: string[];
    zordMaterialDestination?: import("../types/actions").ZordMaterialDestination;
  },
): boolean {
  const powerBudget = Math.max(
    darkDealRushPowerBudget(state, playerId, player, definition),
    godomRushPowerBudget(state, playerId, player, definition),
  );
  if (
    !canRushUnitExceptCommandHold(
      player,
      definitions,
      definition,
      instanceId,
      zord?.zordMaterialInstanceId,
      zord?.zordMothershipHoldInstanceIds,
      zord?.zordMaterialDestination,
      powerBudget,
      { ...state, playerId },
      zord?.zordMaterialInstanceIds,
      zord?.zordExtraCommandHoldInstanceIds,
    )
  ) {
    return false;
  }
  const categories = cardCategories(definition);
  if (categories.length === 0) return true;
  if (isShironLightRushTarget(player, instanceId)) return true;
  // ルール: R-ERR-RK043 — 【突入】の後、次にラッシュするミラーライダーはコマンドをホールドせずにラッシュできる。
  if (isRideShooterRushTarget(state, playerId, definition.id)) return true;
  if (isCostWindowSatisfied(player, "rush_category")) return true;
  return false;
}

type RushPaymentZord = {
  zordMaterialInstanceId?: string;
  zordMaterialInstanceIds?: string[];
  zordMothershipHoldInstanceIds?: string[];
  zordExtraCommandHoldInstanceIds?: string[];
  zordMaterialDestination?: import("../types/actions").ZordMaterialDestination;
};

/** コマンド支払い解決後に rush 継続が applyAction まで成功するか。 */
export function canCompleteRushAfterCommandPayment(
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  zord?: RushPaymentZord,
): boolean {
  const player = state.players[playerId];
  const handCard = player.hand.find((c) => c.instanceId === sourceInstanceId);
  const definition = handCard ? getDefinition(state.definitions, handCard.cardId) : undefined;
  if (!handCard || !definition || !isRushable(definition)) return false;
  if (
    !canDeclareRush(state, playerId, player, state.definitions, definition, sourceInstanceId, zord)
  ) {
    return false;
  }

  // 追加条件が免除されている（ブラスト等）なら素材は要らない。ルール: R-KW-BLAST-01
  if (isZordUpCost(definition.powerCost) && !rushAdditionalConditionApplies(state, playerId, handCard.cardId)) {
    return true;
  }

  if (isZordUpCost(definition.powerCost) && requiresAllFusionPartners(handCard.cardId)) {
    return hasAllRequiredFusionMaterials(
      player,
      state.definitions,
      handCard.cardId,
      sourceInstanceId,
    );
  }

  if (!needsZordMaterial(state.definitions, handCard.cardId)) {
    return true;
  }

  const fieldIds =
    zord?.zordMaterialInstanceIds ??
    (zord?.zordMaterialInstanceId ? [zord.zordMaterialInstanceId] : []);
  const mothershipHolds = zord?.zordMothershipHoldInstanceIds ?? [];
  if (fieldIds.length === 0 && mothershipHolds.length === 0) {
    return false;
  }

  if (fieldIds.length === 0) {
    return validateZordAdditionalPayment(
      player,
      state.definitions,
      handCard.cardId,
      sourceInstanceId,
      undefined,
      zord?.zordMaterialDestination,
      mothershipHolds,
    );
  }

  return validateZordAdditionalPayment(
    player,
    state.definitions,
    handCard.cardId,
    sourceInstanceId,
    fieldIds[0],
    zord?.zordMaterialDestination,
    mothershipHolds,
    fieldIds,
  );
}
