import type { EffectTrigger } from "@rangers-strike/cards/dsl/types";
import type { GameState, PlayerId } from "../types/game";
import { buildLogEntry } from "../log/formatLog";
import {
  evaluateDslCondition,
  shouldUseDslTriggeredEffect,
} from "./dslCatalog";
import { PASSIVE_GRANT_KEYWORDS } from "./grantKeyword";
import type { EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import { listDslEffectsForTrigger } from "./effectLookup";
import {
  DSL_OPTIONAL_EFFECT_HANDLER,
  openOptionalEffectConfirm,
  registerOptionalEffect,
} from "../rules/optionalEffects";
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

/**
 * DSL の任意効果（optional）で、効果全体が「～してもよい」の効果か。
 * 最初の文が「…てもよい」で終わるもの（「…してもよい。そうしたとき、…」を含む）だけを対象にし、
 * 途中の一部だけが任意の効果や、相手が選ぶ「相手は…してもよい」は対象にしない（例: RK-259）。
 */
function isOptionalWording(effect: { optional?: boolean; text?: string }): boolean {
  if (!effect.optional) return false;
  const text = (effect.text ?? "").replace(/^【[^】]*】/, "").replace(/^「SP\d+」/, "");
  const first = text.split("。")[0] ?? "";
  return /てもよい$/.test(first) && !/相手(は|も)/.test(first);
}

const SP_GRANT_RE = /^SP\d+$/;

/** 「「SP1」…してもよい」の「SP1」部分（任意でない）と任意部分に分ける。 */
function splitOptionalPrimitives(primitives: EffectPrimitive[]): {
  mandatory: EffectPrimitive[];
  optionalPart: EffectPrimitive[];
} {
  const mandatory = primitives.filter(
    (p) => p.type === "grant_keyword" && SP_GRANT_RE.test(p.keyword),
  );
  return { mandatory, optionalPart: primitives.filter((p) => !mandatory.includes(p)) };
}

/** 効果の解決で両プレイヤーの場・手札等が変わったか。 */
function fieldChanged(before: GameState, after: GameState): boolean {
  return JSON.stringify(before.players) !== JSON.stringify(after.players);
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
    if (!shouldUseDslTriggeredEffect(args.cardId, effect, args.triggerType)) continue;
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

    // 「～してもよい」の任意効果が選択なしにそのまま解決されるなら、行うかどうかの確認を先に開く。
    // 先頭の「SPn」（NC 等で常に得る能力）は任意部分ではないので先に適用する。
    const { mandatory, optionalPart } = splitOptionalPrimitives(effect.effects);
    const beforeOptional =
      isOptionalWording(effect) && mandatory.length > 0
        ? interpretEffectPrimitives(current, ctx, mandatory).state
        : current;
    const optionalTrial =
      isOptionalWording(effect) && mandatory.length > 0
        ? interpretEffectPrimitives(beforeOptional, ctx, optionalPart).state
        : outcome.state;
    if (
      isOptionalWording(effect) &&
      optionalPart.length > 0 &&
      !optionalTrial.pendingEffectChoice &&
      !isPassiveGrantOnlyEffect(optionalPart) &&
      fieldChanged(beforeOptional, optionalTrial)
    ) {
      current = openOptionalEffectConfirm(beforeOptional, {
        playerId: args.playerId,
        effectId: effect.id,
        sourceCardId: args.cardId,
        sourceInstanceId: args.instanceId,
        phasePlayerId: args.phasePlayerId,
        optionalDslMeta: { effectId: effect.id, triggerType: args.triggerType },
      });
      handled = true;
      logs.push(
        buildLogEntry(
          args.playerId,
          args.logAction ?? "named_effect",
          args.cardId,
          args.state.definitions,
          `choice:${effect.id}`,
        ),
      );
      break;
    }

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

registerOptionalEffect(DSL_OPTIONAL_EFFECT_HANDLER, {
  apply: (state, pending) => {
    const meta = pending.optionalDslMeta;
    if (!meta) return state;
    const effect = listDslEffectsForTrigger(
      pending.sourceCardId,
      meta.triggerType as EffectTrigger["type"],
    ).find((e) => e.id === meta.effectId);
    if (!effect) return state;
    const ctx = buildTriggerContext({
      effectId: effect.id,
      sourceCardId: pending.sourceCardId,
      playerId: pending.playerId,
      phasePlayerId: pending.phasePlayerId,
      triggerSourceInstanceId: pending.sourceInstanceId ?? "",
      optional: effect.optional,
    });
    const outcome = interpretEffectPrimitives(
      state,
      ctx,
      splitOptionalPrimitives(effect.effects).optionalPart,
    );
    return {
      ...outcome.state,
      log: [
        ...outcome.state.log,
        buildLogEntry(
          pending.playerId,
          "named_effect",
          pending.sourceCardId,
          state.definitions,
          outcome.detail ?? effect.id,
        ),
      ],
    };
  },
});
