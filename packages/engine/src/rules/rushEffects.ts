import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PendingRush, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../core/helpers";
import { requestDrawFromDeck } from "./drawFromDeck";
import { buildLogEntry } from "../log/formatLog";
import { hasRushCounterReactions } from "./operationCounters";
import { resolveNamedOnRushEffects } from "./namedUnitEffects";

export type RushEffectOutcome = {
  state: GameState;
  logs: string[];
};

/** Unit effects that fire when this card is rushed (Q10: before shippu counter). */
export const ON_RUSH_EFFECTS: Partial<Record<string, "draw_1">> = {};

/** Permanent effects that fire when any unit is rushed during enemy turn. */
export const ON_ENEMY_RUSH_PERMANENTS: Partial<
  Record<string, "power_to_hand">
> = {
  /** RS-124 超電子レーダー (Q6 reference; not in Legend1). */
  "RS-124": "power_to_hand",
};

function applyDrawOnRush(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  phasePlayerId: PlayerId,
): RushEffectOutcome {
  const result = requestDrawFromDeck(state, playerId, phasePlayerId, {
    count: 1,
    sourceCardId: cardId,
  });
  if (!result.pending && !result.drawn) {
    return { state: result.state, logs: [] };
  }
  return {
    state: result.state,
    logs: [
      buildLogEntry(playerId, "rush_effect", cardId, state.definitions, "draw_1"),
    ],
  };
}

function applyPowerToHandOnEnemyRush(
  state: GameState,
  ownerId: PlayerId,
  permanentCardId: string,
): RushEffectOutcome {
  const player = state.players[ownerId];
  const faceUpIndex = player.power.findIndex((c) => !c.faceDown);
  if (faceUpIndex < 0) return { state, logs: [] };

  const [card, restPower] = removeAt(player.power, faceUpIndex);
  const nextPlayer = {
    ...player,
    power: restPower,
    hand: [...player.hand, card],
  };
  return {
    state: { ...state, ...updatePlayer(state, ownerId, nextPlayer) },
    logs: [
      buildLogEntry(
        ownerId,
        "rush_effect",
        permanentCardId,
        state.definitions,
        "power_to_hand",
      ),
    ],
  };
}

/**
 * Resolve all rush-triggered effects before opening RS-026 counter window.
 * @see RS-026 Q6/Q10 — rush effects first, then counter.
 */
export function resolveRushTriggeredEffects(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
): RushEffectOutcome {
  const rusher = state.players[rusherPlayerId];
  const found = findInZone(rusher, "rush", rushedInstanceId);
  if (!found) return { state, logs: [] };

  let nextState = state;
  const logs: string[] = [];

  const onRush = ON_RUSH_EFFECTS[found.card.cardId];
  if (onRush === "draw_1") {
    const result = applyDrawOnRush(
      nextState,
      rusherPlayerId,
      found.card.cardId,
      state.activePlayer,
    );
    nextState = result.state;
    logs.push(...result.logs);
  }

  const namedRush = resolveNamedOnRushEffects(
    nextState,
    rusherPlayerId,
    rushedInstanceId,
    state.activePlayer,
  );
  nextState = namedRush.state;
  logs.push(...namedRush.logs);

  const defenderId = opponent(rusherPlayerId);
  for (const pid of [rusherPlayerId, defenderId] as const) {
    const player = nextState.players[pid];
    for (const permanent of player.operation) {
      const effect = ON_ENEMY_RUSH_PERMANENTS[permanent.cardId];
      if (effect !== "power_to_hand") continue;
      if (pid === rusherPlayerId) continue;
      const result = applyPowerToHandOnEnemyRush(
        nextState,
        pid,
        permanent.cardId,
      );
      nextState = result.state;
      logs.push(...result.logs);
    }
  }

  return { state: nextState, logs };
}

export function openRushCounterWindow(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const defenderId = opponent(rusherPlayerId);
  if (
    !hasRushCounterReactions(
      state,
      defenderId,
      rushedInstanceId,
      rusherPlayerId,
    )
  ) {
    return state;
  }

  return {
    ...state,
    pendingRush: {
      rusherPlayerId,
      rushedInstanceId,
      phasePlayerId,
    },
    activePlayer: defenderId,
  };
}

export function finalizeRushAction(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): RushEffectOutcome & { counterPending: boolean } {
  const triggered = resolveRushTriggeredEffects(
    state,
    rusherPlayerId,
    rushedInstanceId,
  );
  const beforePending = triggered.state.pendingRush;
  const withCounter = openRushCounterWindow(
    triggered.state,
    rusherPlayerId,
    rushedInstanceId,
    phasePlayerId,
  );

  return {
    state: withCounter,
    logs: triggered.logs,
    counterPending: !beforePending && !!withCounter.pendingRush,
  };
}

export function categoriesOverlap(
  a: CardDefinition["category"],
  b: CardDefinition["category"],
): boolean {
  const catsA = Array.isArray(a) ? a : [a];
  const catsB = Array.isArray(b) ? b : [b];
  return catsA.some((c) => catsB.includes(c));
}
