import {
  getCardEffect,
  getEnterBattleNamedEffect,
  getOnRushNamedEffect,
} from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import { findInZone } from "../core/helpers";
import { resolveOperationEffect } from "../effects/resolveOperation";
import { resolveLegend2EnterBattle } from "../rules/legend2/battleEffects";
import {
  isLegend3EnterBattleEffect,
  resolveLegend3EnterBattle,
} from "../rules/legend3/battleEffects";
import { applyLegacyNumberComboEffect } from "../rules/numberComboEffects";
import { resolveNamedOnRushEffects, applyShirubaOnRush } from "../rules/namedUnitEffects";
import { listDslEffectsForTrigger } from "./effectLookup";
import type { GrantKeywordContext, GrantKeywordResult } from "./grantKeyword";

const LEGEND2_ENTER_BATTLE = new Set([
  "mane_hurricane",
  "ruin_excavation",
  "phantom_illusion",
  "sky_magic_slash",
]);

/** runtime_{effectId} — レガシーハンドラへ委譲（interpreter 登録用）。 */
export function applyRuntimeGrantKeyword(
  state: GameState,
  ctx: GrantKeywordContext,
  effectId: string,
): GrantKeywordResult {
  const instanceId = ctx.triggerSourceInstanceId;
  const opMeta = getCardEffect(ctx.sourceCardId);
  if (opMeta?.effectId === effectId && ctx.operationInstanceId) {
    const outcome = resolveOperationEffect({
      state,
      playerId: ctx.playerId,
      operationCardId: ctx.sourceCardId,
      targetInstanceId: ctx.triggerSourceInstanceId,
      extraInstanceIds: ctx.extraInstanceIds,
    });
    return { state: outcome.state, detail: outcome.detail };
  }

  const ncEffects = listDslEffectsForTrigger(ctx.sourceCardId, "nc");
  if (ncEffects.some((effect) => effect.id === effectId) && instanceId) {
    const found = findInZone(state.players[ctx.playerId], "battle", instanceId);
    if (found) {
      const result = applyLegacyNumberComboEffect(
        state,
        ctx.playerId,
        found.card,
        effectId as Parameters<typeof applyLegacyNumberComboEffect>[3],
      );
      return { state: result.state, detail: effectId };
    }
  }

  if (!instanceId) return { state };

  const enterNamed = getEnterBattleNamedEffect(ctx.sourceCardId);
  if (enterNamed?.effectId === effectId) {
    if (LEGEND2_ENTER_BATTLE.has(effectId)) {
      const result = resolveLegend2EnterBattle(state, ctx.playerId, ctx.sourceCardId, effectId);
      return { state: result.state, detail: effectId };
    }
    if (isLegend3EnterBattleEffect(effectId)) {
      const result = resolveLegend3EnterBattle(state, ctx.playerId, ctx.sourceCardId, effectId);
      return { state: result.state, detail: effectId };
    }
  }

  const rushNamed = getOnRushNamedEffect(ctx.sourceCardId);
  if (rushNamed?.effectId === effectId) {
    const result = resolveNamedOnRushEffects(
      state,
      ctx.playerId,
      instanceId,
      ctx.phasePlayerId,
    );
    return { state: result.state, detail: effectId };
  }

  if (effectId === "shiruba" && instanceId) {
    const result = applyShirubaOnRush(state, ctx.playerId, instanceId);
    return { state: result.state, detail: "shiruba" };
  }

  return { state, detail: `runtime:${effectId}` };
}

export function isRuntimeGrantKeyword(keyword: string): boolean {
  return keyword.startsWith("runtime_");
}

export function runtimeEffectIdFromKeyword(keyword: string): string {
  return keyword.slice("runtime_".length);
}
