import type { GameState, PlayerId } from "../types/game";
import type { GrantKeywordContext } from "../dsl/grantKeyword";
import { addTurnRuleModifier } from "../core/scopedModifiers";
import { getDefinition, isSmallUnit, parsePowerCost } from "../core/catalog";
import { findInZone, opponent, updatePlayer } from "../core/helpers";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";
import { openEffectChoice, startSelectCommandChoice } from "./pendingChoices";

function parsePayload(keyword: string, prefix: string): string | null {
  const marker = `${prefix}::`;
  if (!keyword.startsWith(marker)) return null;
  return keyword.slice(marker.length);
}

function openChoice(
  state: GameState,
  ctx: GrantKeywordContext,
  choice: Omit<
    import("../types/game").PendingEffectChoice,
    "playerId" | "effectId" | "sourceCardId" | "phasePlayerId"
  > & { effectId?: string },
): GameState | null {
  if (choice.validInstanceIds.length === 0 && choice.optional !== false) return null;
  return openEffectChoice(state, {
    playerId: ctx.playerId,
    effectId: choice.effectId ?? ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    optional: ctx.optional ?? true,
    ...choice,
  });
}

function collectEnemyBattleHeldS(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => c.commandHeld && isSmallUnit(state.definitions, c.cardId))
    .filter((c) => isSelectableByOpponentEffect(state, playerId, c.instanceId))
    .map((c) => c.instanceId);
}

function collectEnemyBattleS(state: GameState, playerId: PlayerId): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .filter((c) => isSelectableByOpponentEffect(state, playerId, c.instanceId))
    .map((c) => c.instanceId);
}

function collectReleasedCommandFeatureS(
  state: GameState,
  playerId: PlayerId,
  feature: string,
): string[] {
  const player = state.players[playerId];
  return player.command
    .filter((c) => {
      if (c.commandHeld) return false;
      const def = getDefinition(state.definitions, c.cardId);
      return def?.type === "unit" && def.size === "S" && (def.features ?? []).includes(feature);
    })
    .map((c) => c.instanceId);
}

export function applyEnemyBattleHeldSToPower(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const valid = collectEnemyBattleHeldS(state, ctx.playerId);
  return openChoice(state, ctx, {
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "power",
  });
}

export function applyHoldSelfEnemyBattleSToPower(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const instanceId = ctx.triggerSourceInstanceId;
  if (!instanceId) return null;
  const player = state.players[ctx.playerId];
  const found = findInZone(player, "battle", instanceId);
  if (!found) return null;
  const battle = [...player.battle];
  battle[found.index] = { ...found.card, commandHeld: true };
  const heldState = {
    ...state,
    ...updatePlayer(state, ctx.playerId, { ...player, battle }),
  };
  const valid = collectEnemyBattleS(heldState, ctx.playerId);
  if (valid.length === 0) return null;
  return openChoice(heldState, ctx, {
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "power",
  });
}

export function applyReleaseCommandFeatureSToRush(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GameState | null {
  const feature = parsePayload(keyword, "release_command_feature_s_to_rush");
  if (!feature) return null;
  const valid = collectReleasedCommandFeatureS(state, ctx.playerId, feature);
  if (valid.length === 0) return null;
  return startSelectCommandChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    commandFilter: "released",
    commandAction: "rush",
    validInstanceIds: valid,
    optional: ctx.optional ?? true,
  });
}

export function applyRevealTop3AllFeatureToRush(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GameState | null {
  const feature = parsePayload(keyword, "reveal_top3_all_feature_to_rush");
  if (!feature) return null;
  const player = state.players[ctx.playerId];
  if (player.deck.length === 0) return null;
  const viewed = player.deck.slice(0, 3).map((c) => c.instanceId);
  const valid = player.deck
    .slice(0, 3)
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).includes(feature))
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "scry_keep_one",
    viewedInstanceIds: viewed,
    validInstanceIds: valid,
    selectCount: valid.length,
    unitDestination: "rush",
  });
}

export function applyMirrorRiderDestroyEnemyS(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const player = state.players[ctx.playerId];
  const ownValid = [...player.rush, ...player.battle]
    .filter((c) => (getDefinition(state.definitions, c.cardId)?.features ?? []).includes("ミラーライダー"))
    .map((c) => c.instanceId);
  if (ownValid.length === 0) return null;
  return openChoice(state, ctx, {
    effectId: "mirror_rider_destroy_enemy_s",
    kind: "select_unit_step",
    step: "own",
    validInstanceIds: ownValid,
    selectCount: 1,
    unitDestination: "discard",
    optional: ctx.optional ?? true,
  });
}

export function applyRushTurnEnemySBpMinus(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): GameState {
  const amount = Number(parsePayload(keyword, "rush_turn_enemy_s_bp_minus") ?? "500");
  const player = state.players[ctx.playerId];
  const nextPlayer = addTurnRuleModifier(player, `rush_turn_enemy_s_bp_minus_${amount}`, {
    sourceCardId: ctx.sourceCardId,
  });
  return { ...state, ...updatePlayer(state, ctx.playerId, nextPlayer) };
}

const RK_PASSIVE_PREFIXES = [
  "note_bp_per_held_enemy_command::",
  "note_bp_per_opponent_hand::",
  "note_attack_require_discard_feature::",
  "note_substitute_on_destroy_feature_s::",
  "while_feature_s_add_category::",
  "while_feature_bp_plus::",
  "while_hold_s_add_feature::",
  "combo_feature_bp_attack_rush::",
  "return_enemy_power_sum_shuffle::",
  "combo_named_discard_enemy_command::",
  "release_command_feature_s_to_rush::",
  "reveal_top3_all_feature_to_rush::",
  "rush_turn_enemy_s_bp_minus::",
] as const;

function isRkPassiveKeyword(keyword: string): boolean {
  if (keyword === "while_command_hold_immune") return true;
  return RK_PASSIVE_PREFIXES.some((prefix) => keyword.startsWith(prefix));
}

const RK_ACTIVE_KEYWORDS = new Set([
  "enemy_battle_held_s_to_power",
  "hold_self_enemy_battle_s_to_power",
  "mirror_rider_destroy_enemy_s_by_power",
  "return_enemy_power_sum_shuffle",
  "combo_named_discard_enemy_command",
  "ride_release_on_mount",
  "on_rush_enemy_s_ride_off",
  "enter_battle_destroy_enemy_unridden_s_vehicle",
  "destroy_enemy_cannot_enter_battle_text",
  "hold_on_enter_enemy_s_no_resist",
  "enemy_rush_s_count_power_match_to_power",
  "force_enemy_s_rush_to_battle_reorder",
  "counter_mirror_rider_cancel_battle",
]);

export function matchRkGrantKeyword(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): { state: GameState; detail?: string } | null {
  if (keyword === "enemy_battle_held_s_to_power") {
    const next = applyEnemyBattleHeldSToPower(state, ctx);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (keyword === "hold_self_enemy_battle_s_to_power") {
    const next = applyHoldSelfEnemyBattleSToPower(state, ctx);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (keyword.startsWith("release_command_feature_s_to_rush::")) {
    const next = applyReleaseCommandFeatureSToRush(state, ctx, keyword);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (keyword.startsWith("reveal_top3_all_feature_to_rush::")) {
    const next = applyRevealTop3AllFeatureToRush(state, ctx, keyword);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (keyword === "mirror_rider_destroy_enemy_s_by_power") {
    const next = applyMirrorRiderDestroyEnemyS(state, ctx);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (keyword.startsWith("rush_turn_enemy_s_bp_minus::")) {
    return { state: applyRushTurnEnemySBpMinus(state, ctx, keyword), detail: keyword };
  }
  if (isRkPassiveKeyword(keyword)) {
    return { state, detail: keyword };
  }
  if (RK_ACTIVE_KEYWORDS.has(keyword) || keyword.startsWith("return_enemy_power_sum_shuffle::")) {
    return { state, detail: keyword };
  }
  if (keyword.startsWith("combo_named_discard_enemy_command::")) {
    return { state, detail: keyword };
  }
  return null;
}
