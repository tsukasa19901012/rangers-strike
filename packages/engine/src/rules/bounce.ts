import type { BounceSourceZone, CardDefinition } from "@rangers-strike/cards";
import { BOUNCE_SOURCE_ZONES } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { findInZone, removeAt, updatePlayer } from "../core/helpers";

export type BounceRequest = {
  /** 手札に戻す持ち主。 */
  playerId: PlayerId;
  instanceId: string;
  fromZone: BounceSourceZone;
  /** パワーゾーン: オモテ向きのみ（バルカッター等）。 */
  faceUpPowerOnly?: boolean;
};

export type BounceOutcome = {
  state: GameState;
  bounced: CardInstance | null;
};

function sanitizeBouncedCard(
  card: CardInstance,
  fromZone: BounceSourceZone,
): CardInstance {
  const next: CardInstance = { ...card };
  if (fromZone === "command") {
    next.commandHeld = false;
    next.mothershipHold = false;
  }
  if (fromZone === "rush" || fromZone === "battle") {
    delete next.registerHeld;
    delete next.battleActed;
    delete next.mountedOnInstanceId;
    delete next.activatedNcEffects;
  }
  if (fromZone === "power") {
    next.faceDown = false;
  }
  return next;
}

export function findBounceableCard(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  allowedZones: BounceSourceZone[] = BOUNCE_SOURCE_ZONES,
): { zone: BounceSourceZone; card: CardInstance } | null {
  const player = state.players[playerId];
  for (const zone of allowedZones) {
    const found = findInZone(player, zone, instanceId);
    if (found) return { zone, card: found.card };
  }
  return null;
}

export function canBounceToHand(
  state: GameState,
  request: BounceRequest,
): boolean {
  const player = state.players[request.playerId];
  const found = findInZone(player, request.fromZone, request.instanceId);
  if (!found) return false;
  if (
    request.fromZone === "power" &&
    request.faceUpPowerOnly &&
    found.card.faceDown
  ) {
    return false;
  }
  return true;
}

/** 1枚を持ち主の手札へバウンス（撃破トリガーなし）。 */
export function bounceToHand(
  state: GameState,
  request: BounceRequest,
): BounceOutcome {
  if (!canBounceToHand(state, request)) {
    return { state, bounced: null };
  }

  const player = state.players[request.playerId];
  const found = findInZone(player, request.fromZone, request.instanceId)!;
  const [, rest] = removeAt(player[request.fromZone], found.index);
  const card = sanitizeBouncedCard(found.card, request.fromZone);

  return {
    state: {
      ...state,
      ...updatePlayer(state, request.playerId, {
        ...player,
        [request.fromZone]: rest,
        hand: [...player.hand, card],
      }),
    },
    bounced: card,
  };
}

/** ゾーン内の条件一致カードをすべて手札へバウンス。 */
export function bounceAllFromZone(
  state: GameState,
  playerId: PlayerId,
  fromZone: BounceSourceZone,
  predicate: (
    card: CardInstance,
    definition: CardDefinition | undefined,
  ) => boolean,
  options?: { faceUpPowerOnly?: boolean },
): BounceOutcome {
  const player = state.players[playerId];
  const toBounce = player[fromZone].filter((card) => {
    if (
      fromZone === "power" &&
      options?.faceUpPowerOnly &&
      card.faceDown
    ) {
      return false;
    }
    return predicate(card, getDefinition(state.definitions, card.cardId));
  });

  if (toBounce.length === 0) {
    return { state, bounced: null };
  }

  const bounceIds = new Set(toBounce.map((c) => c.instanceId));
  const remaining = player[fromZone].filter((c) => !bounceIds.has(c.instanceId));
  const bouncedCards = toBounce.map((c) => sanitizeBouncedCard(c, fromZone));

  return {
    state: {
      ...state,
      ...updatePlayer(state, playerId, {
        ...player,
        [fromZone]: remaining,
        hand: [...player.hand, ...bouncedCards],
      }),
    },
    bounced: bouncedCards[0] ?? null,
  };
}

/** 所有者・ゾーンを自動検出して手札へバウンス。 */
export function bounceToHandAuto(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  allowedZones?: BounceSourceZone[],
): BounceOutcome {
  const located = findBounceableCard(state, playerId, instanceId, allowedZones);
  if (!located) return { state, bounced: null };
  return bounceToHand(state, {
    playerId,
    instanceId,
    fromZone: located.zone,
  });
}
