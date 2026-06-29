import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import { buildCatchallStructuredPrimitives } from "../../dsl/catchallTextPrimitives";
import type { DslCardContext } from "../../dsl/cardInterpreter";
import { buildRematchContext } from "../../dsl/hashGrantKeywordBridge";
import type { InterpretFn } from "../../dsl/interpretEffectRuntime";
import { getDslEffectById } from "../../dsl/effectLookup";
import { grantSp1ToBattleUnit } from "../namedUnitEffects";
import { addTurnRuleModifier } from "../../core/scopedModifiers";
import { opponent, updatePlayer } from "../../core/helpers";
import { effectiveBp } from "../../core/catalog";
import type { GameState, PlayerId } from "../../types/game";
import { applyPickEffectBranch } from "../bkOperationEffects";
import type { GrantKeywordContext } from "../../dsl/grantKeyword";
import { tryLeaveField } from "../operationCounters";
import {
  startEnterHoldEnemyPowerLeDamageChoice,
  startSelectHandChoice,
} from "../pendingChoices";
import {
  collectEnemyUnits,
  countFieldFeatureUnits,
  parseEnemyUnitFilter,
  parseFeatureThreshold,
  playerHasFieldCard,
  startGenericEnemyUnitChoice,
} from "./rsCatchallChoices";
import { RS_CATCHALL_SPECS } from "./rsCatchallSpecs.generated";

const PASSIVE_FIELD_PATTERNS = new Set([
  "while_in_field_body",
  "grant_ability_generic",
  "bp_modify",
  "cannot_restrict",
  "ignore_rule_text_override",
  "register_resist",
  "category_modify",
  "wb_category",
  "adjacent_units",
  "ride_s_grant_ability",
  "combo_l_grant_effect",
  "combo_l_attack_or_strike_grant",
  "battle_win",
  "optional_then",
  "ride_discard_trigger_effect",
  "ride_action",
]);

const PASSIVE_COMBO_PATTERNS = new Set([
  "combo_action",
  "combo_from_named_card",
  "combo_hold_on_s_combo",
  "number_combo",
]);

type PatternHandler = (
  state: GameState,
  ctx: DslCardContext,
  body: string,
  interpret: InterpretFn,
) => { state: GameState; detail?: string } | null;

function registerTurnKeyword(
  state: GameState,
  playerId: PlayerId,
  ruleId: string,
  sourceCardId: string,
  payload?: unknown,
): GameState {
  const player = addTurnRuleModifier(state.players[playerId], ruleId, {
    sourceCardId,
    payload,
  });
  return { ...state, ...updatePlayer(state, playerId, player) };
}

function destroyUnit(
  state: GameState,
  instanceId: string,
  ownerPlayerId: PlayerId,
  phasePlayerId: PlayerId,
): GameState | null {
  const player = state.players[ownerPlayerId];
  const zone =
    player.battle.find((c) => c.instanceId === instanceId) ? "battle" : "rush";
  const found = player[zone].find((c) => c.instanceId === instanceId);
  if (!found) return null;
  const leave = tryLeaveField(state, {
    ownerPlayerId,
    instanceId,
    fromZone: zone,
    toZone: "discard",
    leavingCardId: found.cardId,
    phasePlayerId,
  });
  if (leave.deferred) return leave.state;
  return leave.state;
}

const handleEnemyToPowerDamage: PatternHandler = (state, ctx, body) => {
  const filter = parseEnemyUnitFilter(body);
  const withChoice = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "power",
    optional: /してもよい|選んでもよい/.test(body),
  });
  if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: withChoice, detail: ctx.effectId };
};

const handleDestroyPatterns: PatternHandler = (state, ctx, body) => {
  const filter = parseEnemyUnitFilter(body);
  if (!filter.zone && /ラッシュ/.test(body)) filter.zone = "rush";
  const withChoice = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "discard",
    optional: /してもよい|選んでもよい/.test(body),
  });
  if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: withChoice, detail: ctx.effectId };
};

const handleFeatureMatch: PatternHandler = (state, ctx, body) => {
  const threshold = parseFeatureThreshold(body);
  if (!threshold) return { state, detail: ctx.effectId };
  const count = countFieldFeatureUnits(state, ctx.playerId, threshold.feature, "rush");
  if (count < threshold.count) return { state, detail: `${ctx.effectId}:unmet` };
  const instanceId = ctx.triggerSourceInstanceId;
  if (!instanceId) return { state, detail: ctx.effectId };
  return { state: grantSp1ToBattleUnit(state, ctx.playerId, instanceId), detail: ctx.effectId };
};

const handleDestroyRemaining: PatternHandler = (state, ctx, body) => {
  const bpMatch = body.match(/BP(\d+)以下/);
  const maxBp = bpMatch ? Number(bpMatch[1]) : 4000;
  const ruleId = `rs_destroy_on_enemy_rush_bp_le_${maxBp}::${ctx.sourceCardId}`;
  return {
    state: registerTurnKeyword(state, ctx.playerId, ruleId, ctx.sourceCardId, { maxBp }),
    detail: ctx.effectId,
  };
};

const handleOpponentMust: PatternHandler = (state, ctx, body) => {
  if (/コマンドゾーンからカードを1枚選び.*パワーゾーン/.test(body)) {
    const enemyId = opponent(ctx.playerId);
    const instanceId = ctx.triggerSourceInstanceId ?? `${ctx.sourceCardId}:field`;
    const withChoice = startSelectHandChoice(state, {
      playerId: enemyId,
      effectId: `${ctx.effectId}_opponent_discard_to_power`,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: instanceId,
      phasePlayerId: ctx.phasePlayerId,
      optional: false,
    });
    if (withChoice) return { state: withChoice, detail: ctx.effectId };
  }
  if (/ラッシュエリアからユニットを1体選ぶ/.test(body)) {
    const enemyId = opponent(ctx.playerId);
    const withChoice = startGenericEnemyUnitChoice(state, {
      playerId: enemyId,
      effectId: `${ctx.effectId}_opponent_pick_rush`,
      sourceCardId: ctx.sourceCardId,
      sourceInstanceId: ctx.triggerSourceInstanceId,
      phasePlayerId: ctx.phasePlayerId,
      filter: { zone: "rush" },
      destination: "rush",
      optional: false,
    });
    if (withChoice) return { state: withChoice, detail: ctx.effectId };
  }
  return { state, detail: ctx.effectId };
};

const handleDeployRush: PatternHandler = (state, ctx, body) => {
  const filter = parseEnemyUnitFilter(body);
  filter.zone = "both";
  if (!filter.size && /Sユニット/.test(body)) filter.size = "S";
  const withChoice = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "rush",
    optional: /してもよい/.test(body),
  });
  if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: withChoice, detail: ctx.effectId };
};

const handleHoldEnemyUnit: PatternHandler = (state, ctx, body) => {
  const withChoice = startEnterHoldEnemyPowerLeDamageChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
  });
  if (withChoice) return { state: withChoice, detail: ctx.effectId };
  const filter = parseEnemyUnitFilter(body);
  const choice = startGenericEnemyUnitChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
    filter,
    destination: "enemy_command",
    optional: true,
  });
  if (!choice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: choice, detail: ctx.effectId };
};

const handleDamageAction: PatternHandler = (state, ctx, body) => ({
  state: registerTurnKeyword(
    state,
    ctx.playerId,
    `rs_damage_action::${ctx.sourceCardId}::${ctx.effectId}`,
    ctx.sourceCardId,
    { body },
  ),
  detail: ctx.effectId,
});

const handleGrantEffectGeneric: PatternHandler = (state, ctx, body) => ({
  state: registerTurnKeyword(
    state,
    ctx.playerId,
    `rs_grant_effect::${ctx.sourceCardId}::${ctx.effectId}`,
    ctx.sourceCardId,
    { body },
  ),
  detail: ctx.effectId,
});

const handleCategoryModify: PatternHandler = (state, ctx, body) => {
  const category = body.match(/「([A-Z]{2,})」になる/)?.[1] ?? "OT";
  return {
    state: registerTurnKeyword(
      state,
      ctx.playerId,
      `rs_category_modify_all_held::${category}`,
      ctx.sourceCardId,
      { category },
    ),
    detail: ctx.effectId,
  };
};

const handleEnterHoldEnemy: PatternHandler = (state, ctx) => {
  const withChoice = startEnterHoldEnemyPowerLeDamageChoice(state, {
    playerId: ctx.playerId,
    effectId: ctx.effectId,
    sourceCardId: ctx.sourceCardId,
    sourceInstanceId: ctx.triggerSourceInstanceId,
    phasePlayerId: ctx.phasePlayerId,
  });
  if (!withChoice) return { state, detail: `${ctx.effectId}:no_targets` };
  return { state: withChoice, detail: ctx.effectId };
};

const handleChoiceBranch: PatternHandler = (state, ctx) => {
  const grantCtx: GrantKeywordContext = {
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
  const withChoice = applyPickEffectBranch(state, grantCtx);
  if (withChoice) return { state: withChoice, detail: "pick_effect_branch" };
  return { state, detail: ctx.effectId };
};

const PATTERN_HANDLERS: Record<string, PatternHandler> = {
  enemy_to_power_damage_generic: handleEnemyToPowerDamage,
  destroy_enter_battle: handleDestroyPatterns,
  destroy_on_rush: handleDestroyPatterns,
  destroy_choose_enemy: handleDestroyPatterns,
  destroy_all_enemy: handleDestroyPatterns,
  destroy_remaining: handleDestroyRemaining,
  feature_match: handleFeatureMatch,
  opponent_must: handleOpponentMust,
  deploy_rush_area: handleDeployRush,
  deploy_battle_area: handleDeployRush,
  hold_enemy_unit: handleHoldEnemyUnit,
  hold_on_enter_battle: handleHoldEnemyUnit,
  damage_action: handleDamageAction,
  grant_effect_generic: handleGrantEffectGeneric,
  category_modify: handleCategoryModify,
  enter_battle_hold_enemy_power_le_opponent_damage: handleEnterHoldEnemy,
  choice_one_of_effects: handleChoiceBranch,
};

function isRsCatchallCard(cardId: string): boolean {
  return RS_CATCHALL_SPECS.some((s) => s.cardId === cardId);
}

function buildExtendedPrimitives(body: string, pattern: string): EffectPrimitive[] | null {
  if (pattern.startsWith("deck_search") || pattern === "rush_discard_deck_search") {
    if (/ラッシュエリアに出/.test(body)) {
      return [
        {
          type: "choose",
          kind: "optional_deck_draw",
          valid: { type: "zone", zone: "deck", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "rush" }],
        },
      ];
    }
    if (/手札に加え/.test(body)) {
      return [
        {
          type: "choose",
          kind: "optional_deck_draw",
          valid: { type: "zone", zone: "deck", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "hand" }],
        },
      ];
    }
    if (/パワーゾーンに置/.test(body)) {
      return [
        {
          type: "choose",
          kind: "optional_deck_draw",
          valid: { type: "zone", zone: "deck", owner: "self" },
          count: 1,
          then: [{ type: "move", target: { type: "trigger_source" }, to: "power" }],
        },
      ];
    }
  }
  if (pattern === "return_to_zone" && /手札に戻/.test(body)) {
    return [
      {
        type: "choose",
        kind: "select_unit",
        valid: { type: "zone", zone: "battle", owner: "opponent" },
        count: /2体/.test(body) ? 2 : 1,
        then: [{ type: "move", target: { type: "trigger_source" }, to: "hand" }],
      },
    ];
  }
  if (pattern === "power_zone_action" && /パワーゾーン/.test(body)) {
    return [
      {
        type: "choose",
        kind: "select_unit",
        valid: { type: "zone", zone: "battle", owner: "self" },
        count: 1,
        then: [{ type: "move", target: { type: "trigger_source" }, to: "power" }],
      },
    ];
  }
  return null;
}

/** RS catchall 効果のパターン別ランタイム解決。 */
export function tryRsCatchallRuntime(
  state: GameState,
  ctx: DslCardContext,
  pattern: string,
  interpret: InterpretFn,
): { state: GameState; detail?: string } | null {
  if (!isRsCatchallCard(ctx.sourceCardId)) return null;

  const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
  const body = effect?.text ?? "";

  const structured = buildCatchallStructuredPrimitives(body, pattern);
  if (structured) {
    return interpret(state, buildRematchContext(effect!, ctx), structured);
  }

  const handler = PATTERN_HANDLERS[pattern];
  if (handler) {
    return handler(state, ctx, body, interpret);
  }

  const extended = buildExtendedPrimitives(body, pattern);
  if (extended) {
    return interpret(state, buildRematchContext(effect!, ctx), extended);
  }

  if (PASSIVE_FIELD_PATTERNS.has(pattern) || PASSIVE_COMBO_PATTERNS.has(pattern)) {
    return {
      state: registerTurnKeyword(
        state,
        ctx.playerId,
        `rs_field_passive::${ctx.sourceCardId}::${ctx.effectId}`,
        ctx.sourceCardId,
        { pattern, body },
      ),
      detail: ctx.effectId,
    };
  }

  return {
    state: registerTurnKeyword(
      state,
      ctx.playerId,
      `rs_catchall::${ctx.sourceCardId}::${ctx.effectId}`,
      ctx.sourceCardId,
      { pattern, body },
    ),
    detail: ctx.effectId,
  };
}

export function tryRsCatchallOnEnemyRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  const rusher = state.players[rusherPlayerId];
  const rushed = [...rusher.rush, ...rusher.battle].find(
    (c) => c.instanceId === rushedInstanceId,
  );
  if (!rushed) return { state, logs: [] };

  let next = state;
  const logs: string[] = [];

  for (const playerId of ["player1", "player2"] as const) {
    if (playerId === rusherPlayerId) continue;
    const player = next.players[playerId];
    for (const mod of player.modifiers ?? []) {
      if (mod.kind !== "rule" || !mod.ruleId.startsWith("rs_destroy_on_enemy_rush_bp_le_")) {
        continue;
      }
      const maxBp = (mod.payload as { maxBp?: number })?.maxBp ?? 4000;
      const bp = effectiveBp(next, rusherPlayerId, rushed);
      if (bp > maxBp) continue;
      const destroyed = destroyUnit(next, rushedInstanceId, rusherPlayerId, phasePlayerId);
      if (destroyed) {
        next = destroyed;
        logs.push(`rs_destroy_on_enemy_rush:${rushed.cardId}`);
      }
    }
  }

  return { state: next, logs };
}

export { playerHasFieldCard };
