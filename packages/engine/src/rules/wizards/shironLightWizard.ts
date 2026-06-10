import type { GameState, PlayerId } from "../../types/game";
import { addRushPhaseRuleModifier } from "../../core/scopedModifiers";
import { RUSH_PHASE_RULE_IDS } from "../../types/scopedModifiers";

/**
 * RS-013 シロンライト: 4 層トラッキングを 1 モジュールに集約。
 * - rush_phase modifier (shiron_light)
 * - shironLightRushInstanceId (PlayerState)
 * - shironLightUsedThisRush (CardInstance)
 * - PendingEffectChoice + ShironLightMeta (pendingChoices)
 */
export function markShironLightUsedThisRush(
  state: GameState,
  playerId: PlayerId,
  operationInstanceId: string,
): GameState {
  const player = state.players[playerId];
  const operation = player.operation.map((card) =>
    card.instanceId === operationInstanceId
      ? { ...card, shironLightUsedThisRush: true }
      : card,
  );
  const withModifier = addRushPhaseRuleModifier(player, RUSH_PHASE_RULE_IDS.SHIRON_LIGHT, {
    sourceCardId: "RS-013",
  });
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...withModifier, operation },
    },
  };
}

export function isShironLightActive(player: import("../../types/game").PlayerState): boolean {
  return (
    player.operation.some((c) => c.shironLightUsedThisRush) ||
    !!player.shironLightRushInstanceId
  );
}
