import type { EffectTrigger } from "@rangers-strike/cards/dsl/types";
import type { GameState, PlayerId } from "../types/game";
import { buildLogEntry } from "../log/formatLog";
import {
  evaluateDslCondition,
  isDslInterpretableEffect,
} from "./dslCatalog";
import { PASSIVE_GRANT_KEYWORDS } from "./grantKeyword";
import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import { listDslEffectsForTrigger } from "./effectLookup";
import {
  type DslCardContext,
  interpretEffectPrimitives,
} from "./cardInterpreter";

export type DslTriggerOutcome = {
  state: GameState;
  logs: string[];
  handled: boolean;
};

function isPassiveGrantOnlyEffect(primitives: EffectPrimitive[]): boolean {
  return (
    primitives.length > 0 &&
    primitives.every(
      (p) =>
        p.type === "grant_keyword" &&
        PASSIVE_GRANT_KEYWORDS.has(p.keyword),
    )
  );
}

function buildTriggerContext(args: {
  effectId: string;
  sourceCardId: string;
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  triggerSourceInstanceId: string;
  optional?: boolean;
}): DslCardContext {
  return {
    effectId: args.effectId,
    sourceCardId: args.sourceCardId,
    playerId: args.playerId,
    phasePlayerId: args.phasePlayerId,
    triggerSourceInstanceId: args.triggerSourceInstanceId,
    discardOperation: false,
    optional: args.optional,
  };
}

export function tryResolveDslTriggeredEffects(args: {
  state: GameState;
  cardId: string;
  instanceId: string;
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  triggerType: EffectTrigger["type"];
  logAction?: string;
}): DslTriggerOutcome {
  const effects = listDslEffectsForTrigger(args.cardId, args.triggerType);
  if (effects.length === 0) {
    return { state: args.state, logs: [], handled: false };
  }

  let current = args.state;
  const logs: string[] = [];
  let handled = false;

  for (const effect of effects) {
    if (!isDslInterpretableEffect(effect)) continue;
    if (!evaluateDslCondition(current, args.playerId, effect.condition, args.instanceId, effect.effects)) {
      continue;
    }

    const ctx = buildTriggerContext({
      effectId: effect.id,
      sourceCardId: args.cardId,
      playerId: args.playerId,
      phasePlayerId: args.phasePlayerId,
      triggerSourceInstanceId: args.instanceId,
      optional: effect.optional,
    });

    const outcome = interpretEffectPrimitives(current, ctx, effect.effects);
    current = outcome.state;
    if (
      current.pendingEffectChoice ||
      !isPassiveGrantOnlyEffect(effect.effects)
    ) {
      handled = true;
    }

    if (outcome.detail || args.logAction === "number_combo") {
      const logDetail = current.pendingEffectChoice
        ? `choice:${effect.id}`
        : args.logAction === "number_combo"
          ? effect.id
          : outcome.detail === "interpret_effect_unresolved"
            ? `interpret_effect_unresolved:${effect.id}`
            : (outcome.detail ?? effect.id);
      logs.push(
        buildLogEntry(
          args.playerId,
          args.logAction ?? "named_effect",
          args.cardId,
          args.state.definitions,
          logDetail,
        ),
      );
    }

    if (current.pendingEffectChoice) {
      break;
    }
  }

  return { state: current, logs, handled };
}

export function tryResolveDslNcEffects(args: {
  state: GameState;
  cardId: string;
  instanceId: string;
  playerId: PlayerId;
  phasePlayerId: PlayerId;
}): DslTriggerOutcome {
  return tryResolveDslTriggeredEffects({
    ...args,
    triggerType: "nc",
    logAction: "number_combo",
  });
}
