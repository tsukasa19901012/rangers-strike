import type { EffectDefinition, EffectPrimitive } from "@rangers-strike/cards/dsl/types";
import type { CardInstance, DslChoiceResume, GameState, PlayerId } from "../types/game";
import { cardName, getDefinition, isSmallUnit } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { findOwnUnit } from "../core/modifiers";
import { applyDamageToPlayer } from "../rules/damagePayment";
import { requestDrawFromDeck } from "../rules/drawFromDeck";
import { openEffectChoice } from "../rules/pendingChoices";
import { findCardInField } from "../rules/fieldLookup";
import { applyGrantKeyword } from "./grantKeyword";
import {
  applyRuntimeGrantKeyword,
} from "./runtimeEffectDispatch";
import {
  dslOperationOpensChoose,
  evaluateDslCondition,
  getDslOperationEffect,
  isDslInterpretableEffect,
} from "./dslCatalog";
import {
  collectTargetInstanceIds,
  isValidOwnSmallUnitTarget,
  resolveTargetInstanceId,
} from "./targetSelectors";
import { tryInterpretEffectDefinition } from "./interpretEffectRuntime";

export type DslCardContext = {
  effectId: string;
  sourceCardId: string;
  playerId: PlayerId;
  phasePlayerId: PlayerId;
  operationInstanceId?: string;
  operationCard?: CardInstance;
  triggerSourceInstanceId?: string;
  /** cyber_s_rider 等の追加手札 instanceId。 */
  extraInstanceIds?: string[];
  leavingCardId?: string;
  discardOperation: boolean;
  optional?: boolean;
};

export type DslOperationOutcome = {
  state: GameState;
  detail?: string;
  discardOperation?: boolean;
  useLegacy?: boolean;
};

type ZoneKey = "hand" | "discard" | "power" | "command" | "rush" | "battle";

function findCardInPlayerZones(
  player: GameState["players"][PlayerId],
  instanceId: string,
): { zone: ZoneKey; index: number; card: CardInstance } | null {
  for (const zone of ["hand", "discard", "power", "command", "rush", "battle"] as const) {
    const index = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (index >= 0) return { zone, index, card: player[zone][index]! };
  }
  return null;
}

function moveCardToZone(
  state: GameState,
  instanceId: string,
  toZone: ZoneKey | "deck",
  cardPatch?: Partial<CardInstance>,
  position?: "left" | "right",
): GameState | null {
  const located = findCardInField(state, instanceId);
  if (!located) return null;
  const owner = state.players[located.playerId];
  const found = {
    zone: located.zone as ZoneKey,
    index: located.index,
    card: located.card,
  };

  const [, fromCards] = removeAt(owner[found.zone], found.index);
  const card = { ...found.card, ...cardPatch };
  let nextOwner = { ...owner, [found.zone]: fromCards };

  if (toZone === "power") {
    nextOwner = {
      ...nextOwner,
      power: [...nextOwner.power, { ...card, faceDown: cardPatch?.faceDown ?? false }],
    };
  } else if (toZone === "hand") {
    nextOwner = { ...nextOwner, hand: [...nextOwner.hand, card] };
  } else if (toZone === "discard") {
    nextOwner = { ...nextOwner, discard: [...nextOwner.discard, card] };
  } else if (toZone === "command") {
    nextOwner = {
      ...nextOwner,
      command: [...nextOwner.command, { ...card, commandHeld: cardPatch?.commandHeld ?? true }],
    };
  } else if (toZone === "deck") {
    const deck = nextOwner.deck;
    nextOwner = {
      ...nextOwner,
      deck: position === "left" ? [card, ...deck] : [...deck, card],
    };
  } else {
    nextOwner = { ...nextOwner, [toZone]: [...nextOwner[toZone], card] };
  }

  return { ...state, ...updatePlayer(state, located.playerId, nextOwner) };
}

function applyModifyBp(
  state: GameState,
  ownerId: PlayerId,
  instanceId: string,
  amount: number,
): GameState | null {
  const owner = state.players[ownerId];
  const found = findOwnUnit(owner, instanceId);
  if (!found) return null;
  const updated = { ...found.card, bpModifier: (found.card.bpModifier ?? 0) + amount };
  const zoneCards = [...owner[found.zone]];
  zoneCards[found.index] = updated;
  return {
    ...state,
    ...updatePlayer(state, ownerId, { ...owner, [found.zone]: zoneCards }),
  };
}

function applyPrimitive(
  state: GameState,
  ctx: DslCardContext,
  primitive: EffectPrimitive,
): { state: GameState; detail?: string; pending?: boolean } {
  switch (primitive.type) {
    case "draw": {
      const result = requestDrawFromDeck(state, ctx.playerId, ctx.phasePlayerId, {
        count: primitive.amount,
        sourceCardId: ctx.sourceCardId,
      });
      return { state: result.state, detail: "draw" };
    }
    case "deal_damage": {
      const targetId = primitive.target === "controller" ? opponent(ctx.playerId) : ctx.playerId;
      const next = applyDamageToPlayer(state, targetId, primitive.amount, {
        kind: "none",
        activePlayer: ctx.phasePlayerId,
      });
      return { state: next, detail: `damage:${primitive.amount}` };
    }
    case "move": {
      const instanceId = resolveTargetInstanceId(
        state,
        ctx.playerId,
        primitive.target,
        ctx.operationInstanceId,
        ctx.triggerSourceInstanceId,
      );
      const patch =
        primitive.to === "power"
          ? { faceDown: false as const }
          : primitive.to === "command"
            ? { commandHeld: true as const }
            : undefined;
      if (
        primitive.target.type === "self" &&
        ctx.operationCard &&
        instanceId === ctx.operationInstanceId
      ) {
        const owner = state.players[ctx.playerId];
        const card = { ...ctx.operationCard, ...patch };
        const nextOwner =
          primitive.to === "power"
            ? { ...owner, power: [...owner.power, card] }
            : primitive.to === "hand"
              ? { ...owner, hand: [...owner.hand, card] }
              : primitive.to === "discard"
                ? { ...owner, discard: [...owner.discard, card] }
                : { ...owner, [primitive.to as ZoneKey]: [...owner[primitive.to as ZoneKey], card] };
        return {
          state: { ...state, ...updatePlayer(state, ctx.playerId, nextOwner) },
          detail: primitive.to === "power" ? "place_in_power" : `move:${ctx.sourceCardId}`,
        };
      }
      if (!instanceId) return { state };
      const toZone = primitive.to as ZoneKey | "deck";
      const next = moveCardToZone(state, instanceId, toZone, patch, primitive.position);
      if (!next) return { state };
      return { state: next, detail: primitive.to === "power" ? "place_in_power" : "move" };
    }
    case "modify_bp": {
      const instanceId = resolveTargetInstanceId(
        state,
        ctx.playerId,
        primitive.target,
        ctx.operationInstanceId,
        ctx.triggerSourceInstanceId,
      );
      if (!instanceId) return { state };
      const next = applyModifyBp(state, ctx.playerId, instanceId, primitive.amount);
      if (!next) return { state };
      const found = findOwnUnit(state.players[ctx.playerId], instanceId);
      const name = found ? cardName(state.definitions, found.card.cardId) : instanceId;
      return { state: next, detail: `bp+${primitive.amount}:${name}` };
    }
    case "modify_sp": {
      const instanceId = resolveTargetInstanceId(
        state,
        ctx.playerId,
        primitive.target,
        ctx.operationInstanceId,
        ctx.triggerSourceInstanceId,
      );
      if (!instanceId) return { state };
      const owner = state.players[ctx.playerId];
      const found = findOwnUnit(owner, instanceId);
      if (!found) return { state };
      const updated = { ...found.card, spModifier: (found.card.spModifier ?? 0) + primitive.amount };
      const zoneCards = [...owner[found.zone]];
      zoneCards[found.index] = updated;
      return {
        state: {
          ...state,
          ...updatePlayer(state, ctx.playerId, { ...owner, [found.zone]: zoneCards }),
        },
        detail: `sp+${primitive.amount}`,
      };
    }
    case "discard": {
      const instanceId = resolveTargetInstanceId(
        state,
        ctx.playerId,
        primitive.target,
        ctx.operationInstanceId,
        ctx.triggerSourceInstanceId,
      );
      if (!instanceId) return { state };
      const next = moveCardToZone(state, instanceId, "discard");
      return next ? { state: next, detail: "discard" } : { state };
    }
    case "hold_command": {
      const instanceId = resolveTargetInstanceId(
        state,
        ctx.playerId,
        primitive.target,
        ctx.operationInstanceId,
        ctx.triggerSourceInstanceId,
      );
      if (!instanceId) return { state };
      const next = moveCardToZone(state, instanceId, "command", {
        commandHeld: true,
      });
      return next ? { state: next, detail: "hold_command" } : { state };
    }
    case "cancel_damage":
      return { state, detail: "cancel_damage" };
    case "grant_keyword": {
      const result = applyGrantKeyword(state, {
        playerId: ctx.playerId,
        phasePlayerId: ctx.phasePlayerId,
        sourceCardId: ctx.sourceCardId,
        effectId: ctx.effectId,
        triggerSourceInstanceId: ctx.triggerSourceInstanceId ?? ctx.operationInstanceId,
        operationInstanceId: ctx.operationInstanceId,
        extraInstanceIds: ctx.extraInstanceIds,
        leavingCardId: ctx.leavingCardId,
      }, primitive.keyword);
      return { state: result.state, detail: result.detail };
    }
    case "interpret_effect": {
      const runtimeCtx = {
        playerId: ctx.playerId,
        phasePlayerId: ctx.phasePlayerId,
        sourceCardId: ctx.sourceCardId,
        effectId: ctx.effectId,
        triggerSourceInstanceId: ctx.triggerSourceInstanceId ?? ctx.operationInstanceId,
        operationInstanceId: ctx.operationInstanceId,
        extraInstanceIds: ctx.extraInstanceIds,
        leavingCardId: ctx.leavingCardId,
      };
      const runtimeResult = applyRuntimeGrantKeyword(state, runtimeCtx, ctx.effectId);
      if (runtimeResult.detail && !runtimeResult.detail.startsWith("runtime:")) {
        return { state: runtimeResult.state, detail: runtimeResult.detail };
      }
      const outcome = tryInterpretEffectDefinition(state, ctx, interpretEffectPrimitives);
      if (!outcome) return { state };
      if (outcome.detail === "interpret_effect_unresolved") {
        return { state: runtimeResult.state, detail: runtimeResult.detail };
      }
      return { state: outcome.state, detail: outcome.detail };
    }
    case "enqueue_trigger": {
      const result = applyRuntimeGrantKeyword(state, {
        playerId: ctx.playerId,
        phasePlayerId: ctx.phasePlayerId,
        sourceCardId: ctx.sourceCardId,
        effectId: primitive.effectId,
        triggerSourceInstanceId: ctx.triggerSourceInstanceId ?? ctx.operationInstanceId,
        operationInstanceId: ctx.operationInstanceId,
        extraInstanceIds: ctx.extraInstanceIds,
        leavingCardId: ctx.leavingCardId,
      }, primitive.effectId);
      return { state: result.state, detail: result.detail ?? primitive.effectId };
    }
    case "choose": {
      let validInstanceIds = collectTargetInstanceIds(
        state,
        ctx.playerId,
        primitive.valid,
        ctx.operationInstanceId,
      );
      let viewedInstanceIds: string[] | undefined;
      if (
        primitive.kind === "scry_keep_one" &&
        primitive.valid.type === "zone" &&
        primitive.valid.zone === "deck"
      ) {
        const player = state.players[ctx.playerId];
        const count = Math.min(primitive.count, player.deck.length);
        viewedInstanceIds = player.deck.slice(0, count).map((c) => c.instanceId);
        validInstanceIds = viewedInstanceIds;
      }
      if (validInstanceIds.length === 0 && primitive.kind !== "scry_keep_one") {
        return { state };
      }
      let unitDestination: "deck_top" | undefined;
      if (primitive.kind === "select_unit") {
        const moveToDeckTop = primitive.then.some(
          (step) => step.type === "move" && step.to === "deck" && step.position === "left",
        );
        if (moveToDeckTop) unitDestination = "deck_top";
      }
      const resume: DslChoiceResume = {
        remaining: primitive.then,
        context: {
          effectId: ctx.effectId,
          sourceCardId: ctx.sourceCardId,
          playerId: ctx.playerId,
          phasePlayerId: ctx.phasePlayerId,
          operationInstanceId: ctx.operationInstanceId,
          discardOperation: ctx.discardOperation,
        },
      };
      return {
        state: openEffectChoice(state, {
          playerId: ctx.playerId,
          effectId: ctx.effectId,
          sourceCardId: ctx.sourceCardId,
          sourceInstanceId: ctx.triggerSourceInstanceId ?? ctx.operationInstanceId,
          kind: primitive.kind,
          phasePlayerId: ctx.phasePlayerId,
          validInstanceIds,
          viewedInstanceIds,
          selectCount: primitive.count,
          unitDestination,
          optional: ctx.optional,
          dslResume: resume,
        }),
        pending: true,
      };
    }
    default:
      return { state };
  }
}

export function interpretEffectPrimitives(
  state: GameState,
  ctx: DslCardContext,
  primitives: EffectPrimitive[],
): DslOperationOutcome {
  let current = state;
  let detail: string | undefined;
  for (const primitive of primitives) {
    const result = applyPrimitive(current, ctx, primitive);
    current = result.state;
    if (result.detail) detail = result.detail;
    if (result.pending || current.pendingEffectChoice) {
      return { state: current, detail, discardOperation: false };
    }
  }
  return {
    state: { ...current, activePlayer: ctx.phasePlayerId },
    detail: detail ?? ctx.effectId,
    discardOperation: ctx.discardOperation,
  };
}

export function tryResolveDslOperation(args: {
  state: GameState;
  playerId: PlayerId;
  operationCard: CardInstance;
  targetInstanceId?: string;
  extraInstanceId?: string;
}): DslOperationOutcome | null {
  const effect = getDslOperationEffect(args.operationCard.cardId, "rush");
  if (!effect || !isDslInterpretableEffect(effect)) return null;

  const extraInstanceIds = [
    ...(args.targetInstanceId ? [args.targetInstanceId] : []),
    ...(args.extraInstanceId ? [args.extraInstanceId] : []),
  ];

  const ctx: DslCardContext = {
    effectId: effect.id,
    sourceCardId: args.operationCard.cardId,
    playerId: args.playerId,
    phasePlayerId: args.playerId,
    operationInstanceId: args.operationCard.instanceId,
    operationCard: args.operationCard,
    triggerSourceInstanceId: args.targetInstanceId,
    extraInstanceIds: extraInstanceIds.length > 0 ? extraInstanceIds : undefined,
    discardOperation: true,
  };

  if (!evaluateDslCondition(args.state, args.playerId, effect.condition, ctx.operationInstanceId)) {
    return {
      state: args.state,
      detail: "no_valid_target",
      discardOperation: true,
    };
  }

  const moveToPowerOnly =
    effect.effects.length === 1 &&
    effect.effects[0]?.type === "move" &&
    effect.effects[0].to === "power";
  if (moveToPowerOnly) {
    ctx.discardOperation = false;
  }

  const first = effect.effects[0];
  if (
    args.targetInstanceId &&
    first?.type === "choose" &&
    collectTargetInstanceIds(
      args.state,
      args.playerId,
      first.valid,
      ctx.operationInstanceId,
    ).includes(args.targetInstanceId)
  ) {
    return interpretEffectPrimitives(args.state, ctx, first.then);
  }

  return interpretEffectPrimitives(args.state, ctx, effect.effects);
}

export function tryResolveDslLeaveCounter(args: {
  state: GameState;
  playerId: PlayerId;
  counterInstanceId: string;
  leavingCardId: string;
  sourceCardId: string;
}): { state: GameState; detail: string; prevented: boolean } | null {
  const effect = getDslOperationEffect(args.sourceCardId, "counter");
  if (!effect || !isDslInterpretableEffect(effect)) return null;

  const player = args.state.players[args.playerId];
  const found = findInZone(player, "hand", args.counterInstanceId);
  if (!found) return null;

  const [, hand] = removeAt(player.hand, found.index);
  let current: GameState = {
    ...args.state,
    ...updatePlayer(args.state, args.playerId, {
      ...player,
      hand,
      discard: [...player.discard, found.card],
    }),
  };

  const ctx: DslCardContext = {
    effectId: effect.id,
    sourceCardId: args.sourceCardId,
    playerId: args.playerId,
    phasePlayerId: args.playerId,
    operationInstanceId: args.counterInstanceId,
    leavingCardId: args.leavingCardId,
    discardOperation: true,
  };

  const outcome = interpretEffectPrimitives(current, ctx, effect.effects);
  const prevented = effect.effects.some((p) => p.type === "cancel_damage");
  return {
    state: outcome.state,
    detail: outcome.detail ?? effect.id,
    prevented,
  };
}

export function continueDslAfterChoice(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  pending: NonNullable<GameState["pendingEffectChoice"]>,
): { state: GameState; log?: string; error?: string } {
  const resume = pending.dslResume;
  if (!resume) return { state, error: "no_dsl_resume" };
  if (pending.playerId !== playerId) return { state, error: "wrong_player" };
  if (!pending.validInstanceIds.includes(instanceId)) return { state, error: "invalid_target" };

  if (pending.effectId === "aura_power" && !isValidOwnSmallUnitTarget(state, playerId, instanceId)) {
    return { state, error: "invalid_target" };
  }

  const ctx: DslCardContext = {
    ...resume.context,
    triggerSourceInstanceId: instanceId,
  };

  const withoutPending: GameState = {
    ...state,
    pendingEffectChoice: undefined,
  };

  const outcome = interpretEffectPrimitives(withoutPending, ctx, resume.remaining);
  let nextState = outcome.state;

  if (resume.operationCard && outcome.discardOperation !== false && !nextState.pendingEffectChoice) {
    const player = nextState.players[playerId];
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, playerId, {
        ...player,
        discard: [...player.discard, resume.operationCard],
      }),
    };
  }

  const detail = outcome.detail ?? pending.effectId;
  return {
    state: nextState,
    log: `${playerId}|resolve_effect_choice|${pending.sourceCardId}|${pending.effectId}:${detail}`,
  };
}

export function attachOperationCardToDslResume(
  state: GameState,
  operationCard: CardInstance,
): GameState {
  const pending = state.pendingEffectChoice;
  if (!pending?.dslResume) return state;
  return {
    ...state,
    pendingEffectChoice: {
      ...pending,
      dslResume: { ...pending.dslResume, operationCard },
    },
  };
}

export { dslOperationOpensChoose, getDslOperationEffect, isDslInterpretableEffect };

import { wireEffectDelegateResolver } from "./effectDelegateRuntime";

wireEffectDelegateResolver(interpretEffectPrimitives);
