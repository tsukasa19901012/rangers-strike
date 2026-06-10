import type { GameState, PlayerId } from "../../types/game";
import { getDefinition, isMediumUnit, isUnit } from "../../core/catalog";
import { opponent, updatePlayer } from "../../core/helpers";
import { addTurnRuleModifier, hasTurnRuleModifier } from "../../core/scopedModifiers";
import { TURN_RULE_IDS } from "../../types/scopedModifiers";
import {
  collectFieldUnitIds,
  startAnimalHeartChoice,
} from "../pendingChoices";

export type OperationOutcome = {
  state: GameState;
  detail: string;
};

/** RS-123: 自軍Sユニットがこのターン印刷ディフェンダーBPでバトル。 */
export function resolveSuperDynamite(
  state: GameState,
  playerId: PlayerId,
): OperationOutcome {
  const player = addTurnRuleModifier(state.players[playerId], TURN_RULE_IDS.SUPER_DYNAMITE, {
    sourceCardId: "RS-123",
  });
  return {
    state: { ...state, ...updatePlayer(state, playerId, player) },
    detail: "super_dynamite",
  };
}

/** RS-125: 印刷BP合計 ≤ 12000 の敵ユニットを撃破、枚数 ≤ 自軍WB Mユニット数。 */
export function resolveAnimalHeart(
  state: GameState,
  playerId: PlayerId,
): OperationOutcome {
  const enemyId = opponent(playerId);
  const maxCount = state.players[playerId].battle.filter((c) => {
    const def = getDefinition(state.definitions, c.cardId);
    return def?.category === "WB" && isMediumUnit(state.definitions, c.cardId);
  }).length;

  if (maxCount === 0) {
    return { state, detail: "animal_heart:no_wb_m" };
  }

  const targets = collectFieldUnitIds(state, enemyId, Number.MAX_SAFE_INTEGER, [
    "battle",
    "rush",
  ]).filter((id) => {
    const located =
      state.players[enemyId].battle.find((c) => c.instanceId === id) ??
      state.players[enemyId].rush.find((c) => c.instanceId === id);
    return located && isUnit(getDefinition(state.definitions, located.cardId));
  });

  if (targets.length === 0) {
    return { state, detail: "animal_heart:no_targets" };
  }

  const withChoice = startAnimalHeartChoice(state, {
    playerId,
    effectId: "animal_heart",
    sourceCardId: "RS-125",
    phasePlayerId: playerId,
    validInstanceIds: targets,
    bpBudget: 12000,
    selectCount: maxCount,
    optional: true,
  });

  return {
    state: withChoice ?? state,
    detail: withChoice ? "animal_heart:choice" : "animal_heart:none",
  };
}

export function isSuperDynamiteActive(state: GameState, playerId: PlayerId): boolean {
  return hasTurnRuleModifier(state.players[playerId], TURN_RULE_IDS.SUPER_DYNAMITE);
}
