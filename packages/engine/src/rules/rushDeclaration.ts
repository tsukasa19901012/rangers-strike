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
import { darkDealRushPowerBudget } from "./legend3/restrictions";
import { requiresAllFusionPartners, hasAllRequiredFusionMaterials } from "./zord";

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
  const powerBudget = darkDealRushPowerBudget(state, playerId, player, definition);
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
