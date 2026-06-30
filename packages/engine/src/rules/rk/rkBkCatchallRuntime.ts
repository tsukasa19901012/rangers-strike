import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import { rematchExtractedEffect } from "@rangers-strike/cards/pipeline/extractEffects";
import { buildCatchallStructuredPrimitives } from "../../dsl/catchallTextPrimitives";
import type { DslCardContext } from "../../dsl/cardInterpreter";
import { buildRematchContext } from "../../dsl/hashGrantKeywordBridge";
import type { InterpretFn } from "../../dsl/interpretEffectRuntime";
import { getDslEffectById } from "../../dsl/effectLookup";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { grantSp1ToBattleUnit, markBattleNcEffect } from "../namedUnitEffects";
import { addTurnRuleModifier } from "../../core/scopedModifiers";
import { opponent, updatePlayer } from "../../core/helpers";
import type { GameState, PlayerId } from "../../types/game";
import {
  applyDeckOrResidentFeatureToRush,
  applyHandOrResidentFeatureToRush,
  applyPickEffectBranch,
} from "../bkOperationEffects";
import {
  startEnterHoldEnemyPowerLeDamageChoice,
} from "../pendingChoices";
import {
  collectEnemyUnits,
  countFieldFeatureUnits,
  parseEnemyUnitFilter,
  parseFeatureThreshold,
  startGenericEnemyUnitChoice,
} from "../rs/rsCatchallChoices";
import { buildRkBkStructuredPrimitives } from "./rkBkTextPrimitives";
import { RK_BK_CATCHALL_PATTERNS } from "./rkBkCatchallSpecs.generated";
import { interpretEffectPrimitives } from "../../dsl/cardInterpreter";

const PASSIVE_PATTERNS: ReadonlySet<string> = new Set(
  RK_BK_CATCHALL_PATTERNS.filter(
    (p) =>
      p.endsWith("_note") ||
      p === "alias_keyword" ||
      p === "morph_note" ||
      p === "resist_note" ||
      p === "deck_unlimited_note" ||
      p === "call_category_note" ||
      p === "tag_note" ||
      p === "require_command_hold_entry" ||
      p === "no_battle_rush_turn_note" ||
      p === "destroy_on_enter_note" ||
      p === "enter_without_ride_note" ||
      p === "not_selectable_except_attack_note" ||
      p === "no_strike_after_rideoff_note" ||
      p === "scrum_note" ||
      p === "register_if_discard_has_feature_note" ||
      /^(cannot_attack|no_attack|no_strike|no_battle|no_enter|not_selectable|while_|per_ally|per_enemy|bp_plus|bp_debuff|enemy_all_s|enemy_cannot|strike_destroy|destroy_on_win|win_but)/.test(
        p,
      ),
  ),
);

const COUNTER_PATTERNS: ReadonlySet<string> = new Set(
  RK_BK_CATCHALL_PATTERNS.filter((p) => p.startsWith("counter_")),
);

type PatternHandler = (
  state: GameState,
  ctx: DslCardContext,
  body: string,
  keyword: string,
  interpret: InterpretFn,
) => { state: GameState; detail?: string } | null;

function registerFieldPassive(
  state: GameState,
  playerId: PlayerId,
  ruleId: string,
  sourceCardId: string,
  payload: unknown,
): GameState {
  const player = addTurnRuleModifier(state.players[playerId], ruleId, {
    sourceCardId,
    payload,
  });
  return { ...state, ...updatePlayer(state, playerId, player) };
}

function toGrantCtx(ctx: DslCardContext): GrantKeywordContext {
  return {
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    sourceCardId: ctx.sourceCardId,
    effectId: ctx.effectId,
    triggerSourceInstanceId: ctx.triggerSourceInstanceId,
    operationInstanceId: ctx.operationInstanceId,
    extraInstanceIds: ctx.extraInstanceIds,
    leavingCardId: ctx.leavingCardId,
    optional: ctx.optional,
  };
}

const handleHandResidentRush: PatternHandler = (state, ctx, _body, keyword) => {
  const next = applyHandOrResidentFeatureToRush(state, toGrantCtx(ctx), keyword);
  return next
    ? { state: next, detail: keyword }
    : { state, detail: `${keyword}:no_targets` };
};

const handleRecruitDeckResident: PatternHandler = (state, ctx, _body, keyword) => {
  const next = applyDeckOrResidentFeatureToRush(state, toGrantCtx(ctx), keyword);
  return next
    ? { state: next, detail: keyword }
    : { state, detail: `${keyword}:no_targets` };
};

const handleDestroyEnemy: PatternHandler = (state, ctx, body) => {
  const filter = parseEnemyUnitFilter(body);
  if (!filter.zone && /ラッシュ/.test(body)) filter.zone = "rush";
  const next = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "discard",
    optional: /してもよい|選んでもよい/.test(body),
  });
  return next
    ? { state: next, detail: ctx.effectId }
    : { state, detail: `${ctx.effectId}:no_targets` };
};

const handleEnemyToPower: PatternHandler = (state, ctx, body) => {
  const filter = parseEnemyUnitFilter(body);
  const next = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "power",
    optional: /してもよい/.test(body),
  });
  return next
    ? { state: next, detail: ctx.effectId }
    : { state, detail: `${ctx.effectId}:no_targets` };
};

const handleFeatureThresholdSp: PatternHandler = (state, ctx, body) => {
  const threshold = parseFeatureThreshold(body);
  if (!threshold) return { state, detail: ctx.effectId };
  const count = countFieldFeatureUnits(state, ctx.playerId, threshold.feature, "rush");
  if (count < threshold.count) return { state, detail: `${ctx.effectId}:unmet` };
  const instanceId = ctx.triggerSourceInstanceId;
  if (!instanceId) return { state, detail: ctx.effectId };
  return {
    state: grantSp1ToBattleUnit(state, ctx.playerId, instanceId),
    detail: ctx.effectId,
  };
};

const handleCounterDefenderBp: PatternHandler = (state, ctx, body, keyword) => {
  const amount = Number(body.match(/BP\+(\d+)/)?.[1] ?? keyword.match(/(\d+)$/)?.[1] ?? 2000);
  const instanceId = ctx.triggerSourceInstanceId;
  if (!instanceId) return { state, detail: keyword };
  const player = state.players[ctx.playerId];
  const battle = player.battle.map((c) =>
    c.instanceId === instanceId
      ? { ...c, bpModifier: (c.bpModifier ?? 0) + amount }
      : c,
  );
  const rush = player.rush.map((c) =>
    c.instanceId === instanceId
      ? { ...c, bpModifier: (c.bpModifier ?? 0) + amount }
      : c,
  );
  return {
    state: {
      ...state,
      ...updatePlayer(state, ctx.playerId, { ...player, battle, rush }),
    },
    detail: keyword,
  };
};

const handleCounterBattleSkip: PatternHandler = (state, ctx, body, keyword) => {
  return {
    state: registerFieldPassive(
      state,
      ctx.playerId,
      `rk_counter_skip_battle::${ctx.sourceCardId}`,
      ctx.sourceCardId,
      { body },
    ),
    detail: keyword,
  };
};

const handleImposeDestroyRule: PatternHandler = (state, ctx, body, keyword) => {
  const enemyId = opponent(ctx.playerId);
  const valid = collectEnemyUnits(state, ctx.playerId, parseEnemyUnitFilter(body));
  if (valid.length === 0) return { state, detail: `${keyword}:no_targets` };
  return {
    state: registerFieldPassive(
      state,
      ctx.playerId,
      `rk_impose_destroy_rule::${ctx.sourceCardId}::${ctx.effectId}`,
      ctx.sourceCardId,
      { body, validEnemyIds: valid },
    ),
    detail: keyword,
  };
};

const handleChoiceBranch: PatternHandler = (state, ctx) => {
  const next = applyPickEffectBranch(state, toGrantCtx(ctx));
  return next
    ? { state: next, detail: "pick_effect_branch" }
    : { state, detail: ctx.effectId };
};

const PATTERN_HANDLERS: Record<string, PatternHandler> = {
  hand_or_resident_rush_feature: handleHandResidentRush,
  recruit_feature_deck_or_resident: handleRecruitDeckResident,
  destroy_enter_battle: handleDestroyEnemy,
  destroy_on_rush: handleDestroyEnemy,
  destroy_choose_enemy: handleDestroyEnemy,
  destroy_hold_commands_then: handleDestroyEnemy,
  destroy_advent_power_sum: handleDestroyEnemy,
  destroy_adjacent_s_bp_sum: handleDestroyEnemy,
  enemy_to_power_damage_generic: handleEnemyToPower,
  enter_battle_hold_enemy_power_le_opponent_damage: (state, ctx) => {
    const next = startEnterHoldEnemyPowerLeDamageChoice(state, {
      playerId: ctx.playerId,
      effectId: ctx.effectId,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      phasePlayerId: ctx.phasePlayerId,
    });
    return next
      ? { state: next, detail: ctx.effectId }
      : { state, detail: `${ctx.effectId}:no_targets` };
  },
  feature_match: handleFeatureThresholdSp,
  feature_combo_grant_sp: handleFeatureThresholdSp,
  choice_one_of_effects: handleChoiceBranch,
  pick_effect_branch: handleChoiceBranch,
  counter_defender_bp_boost: handleCounterDefenderBp,
  counter_skip_battle_phase: handleCounterBattleSkip,
  impose_destroy_rule_on_enemy: handleImposeDestroyRule,
};

function rematchEffect(ctx: DslCardContext) {
  const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
  if (!effect?.text) return null;
  return rematchExtractedEffect(effect.text, {
    name: effect.name,
    kind: effect.text.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
    cardId: ctx.sourceCardId,
  });
}

function buildExtendedPrimitives(body: string, pattern: string): EffectPrimitive[] | null {
  return buildRkBkStructuredPrimitives(body, pattern) ?? buildCatchallStructuredPrimitives(body, pattern);
}

export function isRkBkCardId(cardId: string): boolean {
  return cardId.startsWith("RK-") || cardId.startsWith("BK-");
}

export function isPromotedCatchallCardId(cardId: string): boolean {
  return isRkBkCardId(cardId) || cardId.startsWith("RM-") || cardId.startsWith("PR-");
}

/** RK/BK grant_keyword のパターン別ランタイム解決。 */
export function tryRkBkCatchallRuntime(
  state: GameState,
  ctx: DslCardContext,
  pattern: string,
  keyword: string,
  interpret: InterpretFn,
): { state: GameState; detail?: string } | null {
  if (!isRkBkCardId(ctx.sourceCardId)) return null;

  const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
  const body = effect?.text ?? "";

  const structured = buildExtendedPrimitives(body, pattern);
  if (structured) {
    return interpret(state, buildRematchContext(effect!, ctx), structured);
  }

  const handler = PATTERN_HANDLERS[pattern];
  if (handler) {
    return handler(state, ctx, body, keyword, interpret);
  }

  if (COUNTER_PATTERNS.has(pattern)) {
    if (/BP\+/.test(body)) return handleCounterDefenderBp(state, ctx, body, keyword, interpret);
    return {
      state: registerFieldPassive(
        state,
        ctx.playerId,
        `rk_counter::${ctx.sourceCardId}::${ctx.effectId}`,
        ctx.sourceCardId,
        { pattern, body },
      ),
      detail: keyword,
    };
  }

  if (PASSIVE_PATTERNS.has(pattern) || /にある間/.test(body)) {
    return {
      state: registerFieldPassive(
        state,
        ctx.playerId,
        `rk_field_passive::${ctx.sourceCardId}::${ctx.effectId}`,
        ctx.sourceCardId,
        { pattern, body, keyword },
      ),
      detail: keyword,
    };
  }

  if (keyword === "SP1" || keyword === "SP2" || keyword === "SP3") {
    const instanceId = ctx.triggerSourceInstanceId;
    if (!instanceId) return { state, detail: keyword };
    const level = keyword === "SP3" ? 3 : keyword === "SP2" ? 2 : 1;
    let next = state;
    for (let i = 0; i < level; i += 1) {
      next = grantSp1ToBattleUnit(next, ctx.playerId, instanceId);
    }
    return { state: next, detail: keyword.toLowerCase() };
  }

  if (/^counter_/.test(keyword)) {
    return {
      state: registerFieldPassive(
        state,
        ctx.playerId,
        `rk_counter_kw::${keyword}::${ctx.sourceCardId}`,
        ctx.sourceCardId,
        { body },
      ),
      detail: keyword,
    };
  }

  const instanceId = ctx.triggerSourceInstanceId;
  if (instanceId && /アタック|バトル|ストライク/.test(body)) {
    return {
      state: markBattleNcEffect(state, ctx.playerId, instanceId, ctx.effectId),
      detail: keyword,
    };
  }

  return {
    state: registerFieldPassive(
      state,
      ctx.playerId,
      `rk_fx_runtime::${ctx.sourceCardId}::${ctx.effectId}`,
      ctx.sourceCardId,
      { pattern, body, keyword },
    ),
    detail: keyword,
  };
}

export function tryRkBkGrantKeywordFromEffect(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
): { state: GameState; detail?: string } | null {
  return tryRkBkGrantKeywordFromEffectWithInterpret(
    state,
    ctx,
    keyword,
    interpretEffectPrimitives,
  );
}

function tryRkBkGrantKeywordFromEffectWithInterpret(
  state: GameState,
  ctx: GrantKeywordContext,
  keyword: string,
  interpret: InterpretFn,
): { state: GameState; detail?: string } | null {
  if (!isRkBkCardId(ctx.sourceCardId)) return null;
  const dslCtx: DslCardContext = {
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    playerId: ctx.playerId,
    phasePlayerId: ctx.phasePlayerId,
    operationInstanceId: ctx.operationInstanceId,
    triggerSourceInstanceId: ctx.triggerSourceInstanceId,
    extraInstanceIds: ctx.extraInstanceIds,
    leavingCardId: ctx.leavingCardId,
    discardOperation: false,
    optional: ctx.optional,
  };
  const rematched = rematchEffect(dslCtx);
  const pattern = rematched?.matchedPattern ?? "unknown";
  return tryRkBkCatchallRuntime(state, dslCtx, pattern, keyword, interpret);
}
