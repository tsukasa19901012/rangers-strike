import { addComboNumberDelta, setAuraPowerInstanceId } from "../rules/turnModifierBridge";
import { addTurnRuleModifier } from "../core/scopedModifiers";
import type { GameState } from "../types/game";
import type { EventListenerResult } from "../events/types";
import { requestDrawFromDeck } from "../rules/drawFromDeck";
import { applyDamageToPlayer } from "../rules/damagePayment";
import { opponent, updatePlayer } from "../core/helpers";
import { findOwnUnit } from "../core/modifiers";
import type { DslEffectDefinition, DslExecutionContext, DslPrimitive } from "./types";

function applyPrimitive(
  state: GameState,
  ctx: DslExecutionContext,
  primitive: DslPrimitive,
  phasePlayerId: import("../types/game").PlayerId,
): GameState {
  switch (primitive.op) {
    case "draw": {
      const result = requestDrawFromDeck(state, ctx.playerId, phasePlayerId, {
        count: primitive.count,
        sourceCardId: ctx.sourceCardId,
      });
      return result.state;
    }
    case "damage": {
      const targetId = primitive.target === "opponent" ? opponent(ctx.playerId) : ctx.playerId;
      return applyDamageToPlayer(state, targetId, primitive.amount, {
        kind: "none",
        activePlayer: phasePlayerId,
      });
    }
    case "add_turn_rule": {
      const player = state.players[ctx.playerId];
      const nextPlayer = addTurnRuleModifier(player, primitive.ruleId, {
        sourceCardId: ctx.sourceCardId,
      });
      return { ...state, players: { ...state.players, [ctx.playerId]: nextPlayer } };
    }
    case "add_combo_number_delta": {
      const player = state.players[ctx.playerId];
      const nextPlayer = addComboNumberDelta(player, primitive.delta);
      return { ...state, players: { ...state.players, [ctx.playerId]: nextPlayer } };
    }
    case "set_aura_power": {
      if (primitive.targetInstanceId === "trigger_source") return state;
      const player = state.players[ctx.playerId];
      const nextPlayer = setAuraPowerInstanceId(
        player,
        primitive.targetInstanceId,
        ctx.sourceCardId,
      );
      return { ...state, players: { ...state.players, [ctx.playerId]: nextPlayer } };
    }
    case "modify_bp": {
      const player = state.players[ctx.playerId];
      const instanceId = primitive.targetInstanceId;
      if (instanceId === "trigger_source" || !instanceId) return state;
      const found = findOwnUnit(player, instanceId);
      if (!found) return state;
      const updated = { ...found.card, bpModifier: (found.card.bpModifier ?? 0) + primitive.delta };
      const zoneCards = [...player[found.zone]];
      zoneCards[found.index] = updated;
      return {
        ...state,
        ...updatePlayer(state, ctx.playerId, { ...player, [found.zone]: zoneCards }),
      };
    }
    default:
      return state;
  }
}

/** DSL primitive 列を順に解釈し State を更新する。 */
export function interpretDslEffect(
  state: GameState,
  definition: DslEffectDefinition,
  ctx: DslExecutionContext,
  phasePlayerId: import("../types/game").PlayerId,
): EventListenerResult {
  let current = state;
  for (const primitive of definition.primitives) {
    current = applyPrimitive(current, ctx, primitive, phasePlayerId);
    if (current.pendingDamagePayment || current.pendingEffectChoice) {
      return { state: current, stopResolution: true };
    }
  }
  return { state: current };
}
