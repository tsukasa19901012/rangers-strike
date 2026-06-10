import type { EffectContext, EffectOutcome } from "./resolveOperation";
import { type P0EffectId, p0EffectToPrimitives } from "./p0Patterns";
import { type DslCardContext, interpretEffectPrimitives } from "../dsl/cardInterpreter";

type P0Alias = {
  p0Id: P0EffectId;
  params?: { amount?: number; bpDelta?: number; spLevel?: 1 | 2 | 3 };
};

/** effect_catalog P0 パターンへの effectId エイリアス。 */
const P0_EFFECT_ALIASES: Record<string, P0Alias> = {
  deal_damage_1: { p0Id: "deal_damage", params: { amount: 1 } },
  deal_damage_2: { p0Id: "deal_damage", params: { amount: 2 } },
  deal_damage: { p0Id: "deal_damage", params: { amount: 1 } },
  bp_boost_1000: { p0Id: "bp_boost", params: { bpDelta: 1000 } },
  bp_boost_2000: { p0Id: "bp_boost", params: { bpDelta: 2000 } },
  bp_boost_3000: { p0Id: "bp_boost", params: { bpDelta: 3000 } },
  bp_boost_4000: { p0Id: "bp_boost", params: { bpDelta: 4000 } },
  bp_boost_6000: { p0Id: "bp_boost", params: { bpDelta: 6000 } },
  bp_boost_8000: { p0Id: "bp_boost", params: { bpDelta: 8000 } },
  bp_boost_5000: { p0Id: "bp_boost", params: { bpDelta: 5000 } },
  grant_sp1: { p0Id: "grant_sp", params: { spLevel: 1 } },
  grant_sp2: { p0Id: "grant_sp", params: { spLevel: 2 } },
  grant_sp3: { p0Id: "grant_sp", params: { spLevel: 3 } },
  require_command_hold_entry: { p0Id: "require_command_hold_entry" },
  alias_fusion_material: { p0Id: "alias_fusion_material" },
  move_enemy_to_command_hold: { p0Id: "move_enemy_to_command_hold", params: { bpDelta: 3000 } },
};

export function resolveP0Alias(effectId: string): P0Alias | undefined {
  return P0_EFFECT_ALIASES[effectId];
}

/** P0 共通 Effect を cardInterpreter 経由で解決。未対応 effectId は null。 */
export function tryResolveP0OperationEffect(
  ctx: EffectContext,
  effectId: string,
): EffectOutcome | null {
  const resolved = resolveP0Alias(effectId);
  if (!resolved) return null;

  const primitives = p0EffectToPrimitives(resolved.p0Id, resolved.params);
  if (primitives.length === 0) return null;

  const needsTarget = resolved.p0Id === "bp_boost" || resolved.p0Id === "grant_sp";
  if (needsTarget && !ctx.targetInstanceId) {
    return { state: ctx.state, detail: "target_required", discardOperation: true };
  }

  const dslCtx: DslCardContext = {
    effectId,
    sourceCardId: ctx.operationCardId,
    playerId: ctx.playerId,
    phasePlayerId: ctx.playerId,
    triggerSourceInstanceId: ctx.targetInstanceId,
    discardOperation: true,
  };

  const outcome = interpretEffectPrimitives(ctx.state, dslCtx, primitives);
  return {
    state: outcome.state,
    detail: outcome.detail ?? effectId,
    discardOperation: outcome.discardOperation ?? true,
  };
}
