import type { GameState, PlayerId } from "../types/game";
import type { GrantKeywordContext } from "../dsl/grantKeyword";
import { canonicalCardName } from "@rangers-strike/cards";
import { getDslEffectById } from "../dsl/effectLookup";
import {
  cardName,
  getDefinition,
  isSmallUnit,
  parsePowerCost,
} from "../core/catalog";
import { findInZone, opponent, updatePlayer } from "../core/helpers";
import { isSelectableByOpponentEffect } from "../keywords/effectTargetability";
import { addTurnRuleModifier } from "../core/scopedModifiers";
import {
  applyEnemyBattleHeldSToPower,
  applyHoldSelfEnemyBattleSToPower,
  applyMirrorRiderDestroyEnemyS,
  applyReleaseCommandFeatureSToRush,
  applyRevealTop3AllFeatureToRush,
} from "./rkEffects";
import {
  collectCommandIds,
  openEffectChoice,
  startSelectCommandChoice,
} from "./pendingChoices";
import { classifyRkEffectText, type RkFamily } from "@rangers-strike/cards/pipeline/rkClassify";
import { tryRkBkGrantKeywordFromEffect } from "./rk/rkBkCatchallRuntime";

function parsePromotedFxKeyword(keyword: string): { cardId: string; effectId: string } | null {
  const m = keyword.match(/^(?:rk|rm|pr)_fx::((?:RK|RM|PR)-\d+)::(.+)$/);
  if (!m) return null;
  return { cardId: m[1]!, effectId: m[2]! };
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

function collectEnemyBattleUnits(
  state: GameState,
  playerId: PlayerId,
  filter?: (cardId: string) => boolean,
): string[] {
  const enemyId = opponent(playerId);
  return state.players[enemyId].battle
    .filter((c) => !filter || filter(c.cardId))
    .filter((c) => isSelectableByOpponentEffect(state, playerId, c.instanceId))
    .map((c) => c.instanceId);
}

function collectEnemyBattleS(
  state: GameState,
  playerId: PlayerId,
  maxPower?: number,
): string[] {
  return collectEnemyBattleUnits(state, playerId, (cardId) => {
    if (!isSmallUnit(state.definitions, cardId)) return false;
    if (maxPower === undefined) return true;
    return parsePowerCost(getDefinition(state.definitions, cardId)?.powerCost ?? 99) <= maxPower;
  });
}

function holdSelf(state: GameState, ctx: GrantKeywordContext): GameState | null {
  const instanceId = ctx.triggerSourceInstanceId;
  if (!instanceId) return null;
  const player = state.players[ctx.playerId];
  const found = findInZone(player, "battle", instanceId);
  if (!found) return null;
  const battle = [...player.battle];
  battle[found.index] = { ...found.card, commandHeld: true };
  return { ...state, ...updatePlayer(state, ctx.playerId, { ...player, battle }) };
}

function applyHoldSelfEnemyPowerLeHand(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const held = holdSelf(state, ctx);
  if (!held) return null;
  const enemyId = opponent(ctx.playerId);
  const maxPower = held.players[enemyId].hand.length;
  const valid = collectEnemyBattleS(held, ctx.playerId, maxPower);
  if (valid.length === 0) return null;
  return openChoice(held, ctx, {
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "power",
  });
}

function applyEnterBattleDestroyEnemyS(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const valid = collectEnemyBattleS(state, ctx.playerId);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "discard",
  });
}

function applyDestroyChooseEnemyS(
  state: GameState,
  ctx: GrantKeywordContext,
  maxBp?: number,
): GameState | null {
  const enemyId = opponent(ctx.playerId);
  const valid = state.players[enemyId].battle
    .concat(state.players[enemyId].rush)
    .filter((c) => isSmallUnit(state.definitions, c.cardId))
    .filter((c) => isSelectableByOpponentEffect(state, ctx.playerId, c.instanceId))
    .filter((c) => {
      if (maxBp === undefined) return true;
      const def = getDefinition(state.definitions, c.cardId);
      return (def?.bp ?? 0) <= maxBp;
    })
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "discard",
  });
}

function applyPowerZoneFaceupCountToPower(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const player = state.players[ctx.playerId];
  const maxPower = player.power.filter((c) => !c.faceDown).length;
  const valid = collectEnemyBattleUnits(state, ctx.playerId).filter((id) => {
    const owner = opponent(ctx.playerId);
    const card = state.players[owner].battle.find((c) => c.instanceId === id);
    if (!card) return false;
    const def = getDefinition(state.definitions, card.cardId);
    return parsePowerCost(def?.powerCost ?? 99) <= maxPower;
  });
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_unit",
    validInstanceIds: valid,
    selectCount: 1,
    unitDestination: "power",
  });
}

function applyComboNamedDiscardEnemyCommand(
  state: GameState,
  ctx: GrantKeywordContext,
  text: string,
): GameState | null {
  const name = text.match(/「([^」]+)」からコンビネーション/)?.[1];
  if (!name) return null;
  const enemyId = opponent(ctx.playerId);
  const valid = state.players[enemyId].command
    .filter((c) => getDefinition(state.definitions, c.cardId)?.type === "unit")
    .map((c) => c.instanceId);
  if (valid.length === 0) return null;
  return openChoice(state, ctx, {
    kind: "select_command",
    validInstanceIds: valid,
    selectCount: 1,
    commandAction: "discard",
    unitDestination: "enemy_command",
  });
}

function applyReleaseCommands(
  state: GameState,
  ctx: GrantKeywordContext,
  maxCount: number,
): GameState | null {
  const valid = collectCommandIds(state, ctx.playerId, "held");
  if (valid.length === 0) return null;
  return startSelectCommandChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    commandFilter: "held",
    commandAction: "release",
    validInstanceIds: valid.slice(0, maxCount),
    optional: ctx.optional ?? true,
  });
}

function applyOnDestroyHoldSelfToCommand(
  state: GameState,
  ctx: GrantKeywordContext,
): GameState | null {
  const instanceId = ctx.triggerSourceInstanceId;
  if (!instanceId) return null;
  const player = state.players[ctx.playerId];
  if (player.command.length >= 5) return null;
  const found = player.discard.find((c) => c.instanceId === instanceId);
  if (!found) return null;
  const discard = player.discard.filter((c) => c.instanceId !== instanceId);
  return {
    ...state,
    ...updatePlayer(state, ctx.playerId, {
      ...player,
      discard,
      command: [...player.command, { ...found, commandHeld: true }],
    }),
  };
}

function applyPassiveWhileField(
  state: GameState,
  ctx: GrantKeywordContext,
  text: string,
): GameState {
  const player = state.players[ctx.playerId];
  const ruleId = `rk_passive:${ctx.sourceCardId}:${ctx.effectId}`;
  const nextPlayer = addTurnRuleModifier(player, ruleId, {
    sourceCardId: ctx.sourceCardId,
    payload: { text },
  });
  return { ...state, ...updatePlayer(state, ctx.playerId, nextPlayer) };
}

function applyByFamily(
  state: GameState,
  ctx: GrantKeywordContext,
  family: RkFamily,
  text: string,
): { state: GameState; detail?: string } | null {
  switch (family) {
    case "passive_while_field":
    case "passive_note":
    case "ignore_rule_grant":
    case "bp_modify_attack":
    case "opponent_must":
    case "ride_grant_ability":
    case "release_command_bp":
    case "hold_remaining":
    case "deploy_battle":
      return { state: applyPassiveWhileField(state, ctx, text), detail: `rk_passive:${family}` };

    case "opponent_deploy_battle":
    case "hold_enemy_multi":
    case "combo_bp_suffix_destroy":
    case "ride_attack_bp_printed":
    case "attack_hold_commands":
    case "rush_battle_entry":
      return { state: applyPassiveWhileField(state, ctx, text), detail: `rk_passive:${family}` };

    case "hold_self_enemy_power": {
      if (/相手の手札の枚数以下/.test(text)) {
        const next = applyHoldSelfEnemyPowerLeHand(state, ctx);
        return next
          ? { state: next, detail: "hold_self_enemy_power_le_hand" }
          : { state, detail: "hold_self_enemy_power_le_hand:no_targets" };
      }
      const next = applyHoldSelfEnemyBattleSToPower(state, ctx);
      return next
        ? { state: next, detail: "hold_self_enemy_power" }
        : { state, detail: "hold_self_enemy_power:no_targets" };
    }

    case "enemy_to_power": {
      const next = applyEnemyBattleHeldSToPower(state, ctx);
      return next
        ? { state: next, detail: "enemy_to_power" }
        : { state, detail: "enemy_to_power:no_targets" };
    }

    case "enter_battle_destroy": {
      const next = applyEnterBattleDestroyEnemyS(state, ctx);
      return next
        ? { state: next, detail: "enter_battle_destroy" }
        : { state, detail: "enter_battle_destroy:no_targets" };
    }

    case "destroy_choose_enemy": {
      const maxBp = text.match(/BP(\d+)以下/)?.[1];
      const next = applyDestroyChooseEnemyS(state, ctx, maxBp ? Number(maxBp) : undefined);
      return next
        ? { state: next, detail: "destroy_choose_enemy" }
        : { state, detail: "destroy_choose_enemy:no_targets" };
    }

    case "power_zone_action": {
      const next = applyPowerZoneFaceupCountToPower(state, ctx);
      return next
        ? { state: next, detail: "power_zone_action" }
        : { state, detail: "power_zone_action:no_targets" };
    }

    case "combo_named": {
      const next = applyComboNamedDiscardEnemyCommand(state, ctx, text);
      return next
        ? { state: next, detail: "combo_named" }
        : { state, detail: "combo_named:no_targets" };
    }

    case "combo_destroy_hold_all":
      return { state, detail: "combo_destroy_hold_all" };

    case "on_destroy_hold_command": {
      const next = applyOnDestroyHoldSelfToCommand(state, ctx);
      return next
        ? { state: next, detail: "on_destroy_hold_command" }
        : { state, detail: "on_destroy_hold_command:failed" };
    }

    case "enter_battle_hold": {
      if (/リリースしてもよい/.test(text)) {
        const max = text.match(/(\d+)つまで/)?.[1] ?? "2";
        const next = applyReleaseCommands(state, ctx, Number(max));
        return next
          ? { state: next, detail: "enter_battle_release_commands" }
          : { state, detail: "enter_battle_release_commands:no_targets" };
      }
      const held = holdSelf(state, ctx);
      return held ? { state: held, detail: "enter_battle_hold_self" } : { state, detail: "enter_battle_hold_self:failed" };
    }

    case "register_resist_battle":
      return { state, detail: "register_resist_battle" };

    case "hand_reveal_then":
    case "reveal_scry":
    case "opponent_self_order":
    case "rush_discard_search":
    case "ride_action":
    case "damage_power_zone":
    case "deploy_rush":
    case "pick_remaining":
    case "pick_discard":
    case "return_zone":
    case "stack_cards":
    case "destroy_on_rush":
    case "destroy_all_on_battle_win":
    case "optional_hold_sp":
    case "cannot_restrict":
    case "resident_hand":
    case "grant_effect_nc":
    case "on_destroy_grant":
    case "unknown":
    default: {
      const delegated = tryRkBkGrantKeywordFromEffect(
        state,
        ctx,
        `rk_fx::${ctx.sourceCardId}::${ctx.effectId}`,
      );
      if (delegated) return delegated;
      return { state, detail: `rk_fx:${family}` };
    }
  }
}

export function applyRkCardEffect(
  state: GameState,
  ctx: GrantKeywordContext,
): { state: GameState; detail?: string } {
  const keyword = `rk_fx::${ctx.sourceCardId}::${ctx.effectId}`;
  return applyRkFxKeyword(state, ctx, keyword) ?? { state, detail: keyword };
}

export function applyRkFxKeyword(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): { state: GameState; detail?: string } | null {
  const parsed = parsePromotedFxKeyword(keyword);
  if (!parsed) return null;
  const effect = getDslEffectById(parsed.cardId, parsed.effectId);
  const text = effect?.text ?? "";
  if (!text) return { state, detail: keyword };

  if (/敵軍バトルエリアから、ホールド状態のSユニットを1体選び、持ち主のパワーゾーン/.test(text)) {
    const next = applyEnemyBattleHeldSToPower(state, ctx);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (/特徴「ミラーライダー」を持つ自軍ユニットを1体選び、必要パワー/.test(text)) {
    const next = applyMirrorRiderDestroyEnemyS(state, ctx);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (/自軍山札の上から3枚をオモテにする。その中から特徴/.test(text)) {
    const feature = text.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
    const next = applyRevealTop3AllFeatureToRush(state, ctx, `reveal_top3_all_feature_to_rush::${feature}`);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (/リリース状態のカードから、特徴/.test(text)) {
    const feature = text.match(/特徴「([^」]+)」/)?.[1] ?? "feature";
    const next = applyReleaseCommandFeatureSToRush(state, ctx, `release_command_feature_s_to_rush::${feature}`);
    return next ? { state: next, detail: keyword } : { state, detail: `${keyword}:no_targets` };
  }
  if (/「([^」]+)」からコンビネーションしたとき発動できる⇒敵軍コマンドゾーンから、ユニットカードを1枚選び捨札/.test(text)) {
    const name = text.match(/「([^」]+)」/)?.[1] ?? "";
    const next = applyComboNamedDiscardEnemyCommand(state, ctx, text);
    return next ? { state: next, detail: `combo_named_discard_enemy_command::${canonicalCardName(name)}` } : { state, detail: `${keyword}:no_targets` };
  }

  const family = classifyRkEffectText(text);
  const result = applyByFamily(state, ctx, family, text);
  return result ? { ...result, detail: result.detail ?? keyword } : { state, detail: keyword };
}

export function isPromotedFxCardId(cardId: string): boolean {
  return cardId.startsWith("RK-") || cardId.startsWith("RM-") || cardId.startsWith("PR-");
}

export function isRkCardId(cardId: string): boolean {
  return cardId.startsWith("RK-");
}
