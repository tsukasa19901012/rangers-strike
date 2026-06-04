import type {
  CardInstance,
  DenjiMachineMeta,
  GameState,
  PendingEffectChoice,
  PlayerId,
  PlayerState,
} from "../types/game";
import { isSmallUnit } from "../core/catalog";
import { opponent, removeAt, updatePlayer } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { promoteDeferredBattleEntry } from "./battleEntry";

export type ChoiceOutcome =
  | { state: GameState; log?: string; logs?: string[] }
  | { error: string };

function openEffectChoice(
  state: GameState,
  choice: PendingEffectChoice,
): GameState {
  return {
    ...state,
    pendingEffectChoice: {
      ...choice,
      selectedInstanceIds: choice.selectedInstanceIds ?? [],
    },
    activePlayer: choice.playerId,
  };
}

export function isDenjiRevealAudience(
  pending: PendingEffectChoice,
  viewerId: PlayerId,
): boolean {
  if (pending.effectId !== "denji_machine" || pending.kind !== "denji_machine") {
    return false;
  }
  const meta = pending.denjiMachineMeta;
  return meta?.step === "reveal" && meta.audiencePlayerIds.includes(viewerId);
}

export function canActOnDenjiChoice(
  pending: PendingEffectChoice,
  playerId: PlayerId,
): boolean {
  return pending.playerId === playerId;
}

function finishDenji(
  state: GameState,
  pending: PendingEffectChoice,
  detail: string,
): ChoiceOutcome {
  const log = buildLogEntry(
    pending.playerId,
    "resolve_effect_choice",
    pending.sourceCardId,
    state.definitions,
    `denji_machine:${detail}`,
  );
  return {
    state: promoteDeferredBattleEntry({
      ...state,
      pendingEffectChoice: undefined,
      activePlayer: pending.phasePlayerId,
    }),
    log,
  };
}

function extractRevealedFromDeck(
  player: PlayerState,
  revealedIds: string[],
): { restDeck: CardInstance[]; revealed: CardInstance[] } | null {
  const top = player.deck.slice(0, revealedIds.length);
  if (top.length !== revealedIds.length) return null;
  for (let i = 0; i < revealedIds.length; i += 1) {
    if (top[i]!.instanceId !== revealedIds[i]) return null;
  }
  return {
    restDeck: player.deck.slice(revealedIds.length),
    revealed: top,
  };
}

export function startDenjiMachineChoice(
  state: GameState,
  playerId: PlayerId,
  phasePlayerId: PlayerId,
  operationCardId: string,
): GameState | null {
  const player = state.players[playerId];
  if (player.deck.length < 3) return null;

  const revealed = player.deck.slice(0, 3);
  const revealedInstanceIds = revealed.map((c) => c.instanceId);
  const toHandInstanceIds: string[] = [];
  const toBottomInstanceIds: string[] = [];

  for (const card of revealed) {
    if (isSmallUnit(state.definitions, card.cardId)) {
      toHandInstanceIds.push(card.instanceId);
    } else {
      toBottomInstanceIds.push(card.instanceId);
    }
  }

  const enemyId = opponent(playerId);

  return openEffectChoice(state, {
    playerId,
    effectId: "denji_machine",
    sourceCardId: operationCardId,
    kind: "denji_machine",
    phasePlayerId,
    validInstanceIds: [],
    viewedInstanceIds: revealedInstanceIds,
    denjiMachineMeta: {
      step: "reveal",
      audiencePlayerIds: [playerId, enemyId],
      revealedInstanceIds,
      toHandInstanceIds,
      toBottomInstanceIds,
    },
  });
}

export function applyConfirmDenjiReveal(
  state: GameState,
  playerId: PlayerId,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "denji_machine") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  const meta = pending.denjiMachineMeta;
  if (!meta || meta.step !== "reveal") return { error: "invalid_step" };

  const player = state.players[playerId];
  const extracted = extractRevealedFromDeck(player, meta.revealedInstanceIds);
  if (!extracted) return { error: "invalid_reveal" };

  const toHandSet = new Set(meta.toHandInstanceIds);
  const handAdds = extracted.revealed.filter((c) => toHandSet.has(c.instanceId));
  const limboBottom = extracted.revealed.filter((c) => !toHandSet.has(c.instanceId));

  let nextPlayer: PlayerState = {
    ...player,
    deck: extracted.restDeck,
    hand: [...player.hand, ...handAdds],
  };

  let nextState = { ...state, ...updatePlayer(state, playerId, nextPlayer) };

  if (limboBottom.length === 0) {
    return finishDenji(nextState, pending, `hand:${handAdds.length}`);
  }

  if (limboBottom.length === 1) {
    nextPlayer = nextState.players[playerId];
    nextState = {
      ...nextState,
      ...updatePlayer(nextState, playerId, {
        ...nextPlayer,
        deck: [...nextPlayer.deck, limboBottom[0]!],
      }),
    };
    return finishDenji(nextState, pending, `hand:${handAdds.length},bottom:1`);
  }

  const bottomIds = limboBottom.map((c) => c.instanceId);
  nextState = {
    ...nextState,
    pendingEffectChoice: {
      ...pending,
      validInstanceIds: bottomIds,
      selectedInstanceIds: [],
      denjiMachineMeta: {
        ...meta,
        step: "order_bottom",
        limboBottomCards: limboBottom,
        orderedBottomIds: [],
      },
    },
    activePlayer: playerId,
  };

  return {
    state: nextState,
    log: buildLogEntry(
      playerId,
      "denji_machine",
      pending.sourceCardId,
      state.definitions,
      `reveal:hand:${handAdds.length}`,
    ),
  };
}

export function applyDenjiBottomOrderSelect(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): ChoiceOutcome {
  const pending = state.pendingEffectChoice;
  if (!pending || pending.kind !== "denji_machine") {
    return { error: "no_pending_choice" };
  }
  if (pending.playerId !== playerId) return { error: "wrong_player" };
  const meta = pending.denjiMachineMeta;
  if (!meta || meta.step !== "order_bottom") return { error: "invalid_step" };
  if (!meta.limboBottomCards) return { error: "invalid_reveal" };
  if (!pending.validInstanceIds.includes(instanceId)) {
    return { error: "invalid_target" };
  }

  const ordered = [...(meta.orderedBottomIds ?? []), instanceId];
  const remaining = pending.validInstanceIds.filter((id) => id !== instanceId);

  if (remaining.length > 0) {
    return {
      state: {
        ...state,
        pendingEffectChoice: {
          ...pending,
          validInstanceIds: remaining,
          selectedInstanceIds: ordered,
          denjiMachineMeta: {
            ...meta,
            orderedBottomIds: ordered,
          },
        },
        activePlayer: playerId,
      },
    };
  }

  const player = state.players[playerId];
  const limboById = new Map(meta.limboBottomCards!.map((c) => [c.instanceId, c]));
  const bottomStack = ordered
    .map((id) => limboById.get(id))
    .filter((c): c is CardInstance => !!c);

  const nextPlayer = {
    ...player,
    deck: [...player.deck, ...bottomStack],
  };

  return finishDenji(
    { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    pending,
    `hand:${meta.toHandInstanceIds.length},bottom:${bottomStack.length}`,
  );
}
