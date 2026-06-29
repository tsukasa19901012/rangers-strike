import { rematchExtractedEffect } from "@rangers-strike/cards/pipeline/extractEffects";
import { buildCatchallStructuredPrimitives } from "./catchallTextPrimitives";
import type { GameState } from "../types/game";
import { getDslEffectById } from "./effectLookup";
import type { DslCardContext } from "./cardInterpreter";
import { applyPickEffectBranch } from "../rules/bkOperationEffects";
import type { GrantKeywordContext } from "./grantKeyword";
import { buildRematchContext } from "./hashGrantKeywordBridge";
import type { InterpretFn } from "./interpretEffectRuntime";
import { tryRsCatchallRuntime } from "../rules/rs/rsCatchallRuntime";
import { tryRkBkCatchallRuntime, isRkBkCardId } from "../rules/rk/rkBkCatchallRuntime";

/** フィールド常駐・能力付与系 — detail マーカーで解決済み扱い。 */
const PASSIVE_CATCHALL_PATTERNS = new Set([
  "while_in_field_body",
  "grant_ability_generic",
  "bp_modify",
  "opponent_must",
  "cannot_restrict",
  "ignore_rule_text_override",
  "register_resist",
  "category_modify",
  "da_category",
  "wb_category",
  "ot_category",
  "ma_category",
  "kamen_rider",
  "auto_battle",
  "adjacent_units",
  "ride_s_grant_ability",
  "combo_l_grant_effect",
  "resident_zone",
  "number_combo",
  "combo_l_attack_or_strike_grant",
  "combo_hold_on_s_combo",
  "combo_from_named_card",
  "battle_win",
  "enemy_turn_action",
  "on_attack_action",
  "optional_then",
  "exclude_from_game_generic",
  "stack_cards",
  "vehicle_interaction",
  "hold_remaining",
  "catchall_interpret",
]);

function rematchWithCard(ctx: DslCardContext) {
  const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
  if (!effect?.text) return null;
  return (
    rematchExtractedEffect(effect.text, {
      name: effect.name,
      kind: effect.text.startsWith("※") ? "note" : effect.name ? "named" : "body",
      trigger: effect.trigger,
      cardId: ctx.sourceCardId,
    }) ??
    rematchExtractedEffect(effect.text, {
      name: effect.name,
      kind: effect.text.startsWith("※") ? "note" : effect.name ? "named" : "body",
      trigger: effect.trigger,
    })
  );
}

/** catchall grant_keyword を matchedPattern 単位で解釈する。 */
export function tryCatchallPatternRuntime(
  state: GameState,
  ctx: DslCardContext,
  interpret: InterpretFn,
): { state: GameState; detail?: string } | null {
  const effect = getDslEffectById(ctx.sourceCardId, ctx.effectId);
  if (!effect?.text) return null;

  const rematched = rematchWithCard(ctx);
  const pattern = rematched?.matchedPattern;
  if (!pattern) return null;

  const rsResolved = tryRsCatchallRuntime(state, ctx, pattern, interpret);
  if (rsResolved) return rsResolved;

  if (isRkBkCardId(ctx.sourceCardId)) {
    const keyword =
      rematched.effects.find((p) => p.type === "grant_keyword")?.keyword ?? pattern;
    const rkBkResolved = tryRkBkCatchallRuntime(state, ctx, pattern, keyword, interpret);
    if (rkBkResolved) return rkBkResolved;
  }

  if (pattern === "choice_one_of_effects") {
    const grantCtx: GrantKeywordContext = {
      playerId: ctx.playerId,
      phasePlayerId: ctx.phasePlayerId,
      sourceCardId: ctx.sourceCardId,
      effectId: ctx.effectId,
      triggerSourceInstanceId: ctx.triggerSourceInstanceId,
      operationInstanceId: ctx.operationInstanceId,
      extraInstanceIds: ctx.extraInstanceIds,
      leavingCardId: ctx.leavingCardId,
      optional: ctx.optional ?? effect.optional,
    };
    const withChoice = applyPickEffectBranch(state, grantCtx);
    if (withChoice) {
      return { state: withChoice, detail: "pick_effect_branch" };
    }
  }

  const structured = buildCatchallStructuredPrimitives(effect.text, pattern);
  if (structured) {
    return interpret(state, buildRematchContext(effect, ctx), structured);
  }

  if (PASSIVE_CATCHALL_PATTERNS.has(pattern)) {
    const keyword = rematched.effects.find((p) => p.type === "grant_keyword")?.keyword;
    return { state, detail: keyword ?? pattern };
  }

  if (
    pattern === "grant_effect_generic" &&
    (effect.trigger?.type === "while_in_field" || /にある間/.test(effect.text))
  ) {
    const keyword = rematched.effects.find((p) => p.type === "grant_keyword")?.keyword;
    return { state, detail: keyword ?? pattern };
  }

  const keyword = rematched.effects.find((p) => p.type === "grant_keyword")?.keyword;
  return { state, detail: keyword ?? pattern };
}
