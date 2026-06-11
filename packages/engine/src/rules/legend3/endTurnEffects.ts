import { findNamedEffectByEffectId } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../../types/game";
import { findInZone } from "../../core/helpers";
import { openEffectChoice, startSelectUnitChoice } from "../pendingChoices";

const END_TURN_EFFECT_IDS = ["jet_skateboard", "end_turn_battle_to_rush"] as const;

function hasEndTurnBattleEffect(card: { cardId: string; activatedNcEffects?: string[] }, effectId: string): boolean {
  if (findNamedEffectByEffectId(card.cardId, effectId)) return true;
  return card.activatedNcEffects?.includes(effectId) ?? false;
}

export function collectEndTurnEffectInstanceIds(
  state: GameState,
  playerId: PlayerId,
): string[] {
  return state.players[playerId].battle
    .filter((c) =>
      END_TURN_EFFECT_IDS.some((effectId) => hasEndTurnBattleEffect(c, effectId)),
    )
    .map((c) => c.instanceId);
}

export function hasEndPhaseBlockingPending(state: GameState): boolean {
  return !!(
    state.pendingEffectChoice ||
    state.pendingBattleEntry ||
    state.pendingCommandPayment ||
    state.pendingDamagePayment ||
    state.pendingStrike ||
    state.pendingBattle ||
    state.pendingRush ||
    state.pendingMorph ||
    state.pendingLeave ||
    state.pendingScry ||
    state.pendingZordSetup
  );
}

/** エンドフェイズで未処理の選択がなく、ターン終了してよい状態。 */
export function shouldAutoFinalizeEndPhase(state: GameState): boolean {
  if (state.phase !== "end") return false;
  if (state.winner) return false;
  return !hasEndPhaseBlockingPending(state);
}

export function tryOpenEndTurnEffectsMenu(
  state: GameState,
  playerId: PlayerId,
): GameState | null {
  if (state.phase !== "end") return null;
  if (state.pendingEffectChoice) return null;
  const instanceIds = collectEndTurnEffectInstanceIds(state, playerId);
  if (instanceIds.length === 0) return null;

  const first = findInZone(state.players[playerId], "battle", instanceIds[0]!);
  return openEffectChoice(state, {
    playerId,
    effectId: "end_turn_effects",
    sourceCardId: first?.card.cardId ?? instanceIds[0]!,
    kind: "end_turn_menu",
    phasePlayerId: playerId,
    validInstanceIds: instanceIds,
    optional: true,
  });
}

export function startJetSkateboardChoiceForUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  const player = state.players[playerId];
  const found = findInZone(player, "battle", instanceId);
  if (!found || !hasEndTurnBattleEffect(found.card, "jet_skateboard")) {
    return null;
  }

  return startSelectUnitChoice(state, {
    playerId,
    effectId: "jet_skateboard",
    sourceCardId: found.card.cardId,
    sourceInstanceId: instanceId,
    phasePlayerId: playerId,
    validInstanceIds: [instanceId],
    unitDestination: "rush",
    optional: true,
  });
}

export function startEndTurnBattleToRushChoiceForUnit(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState | null {
  const player = state.players[playerId];
  const found = findInZone(player, "battle", instanceId);
  if (!found || !hasEndTurnBattleEffect(found.card, "end_turn_battle_to_rush")) {
    return null;
  }

  return startSelectUnitChoice(state, {
    playerId,
    effectId: "end_turn_battle_to_rush",
    sourceCardId: found.card.cardId,
    sourceInstanceId: instanceId,
    phasePlayerId: playerId,
    validInstanceIds: [instanceId],
    unitDestination: "rush",
    optional: true,
  });
}
