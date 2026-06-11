import type { CardDefinition } from "@rangers-strike/cards";
import { hasResist } from "@rangers-strike/cards";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { cardHasRegisterKeyword } from "../keywords/registerReaction";
import type {
  GameState,
  PendingLeave,
  PendingRegister,
  PlayerId,
} from "../types/game";
import { findInZone, updatePlayer } from "../core/helpers";
import type { LeaveIntent } from "./operationCounters";
import { finalizeLeavePending } from "./operationCounters";

export function canOfferRegister(
  state: GameState,
  pending: Pick<
    PendingLeave,
    "toZone" | "fromZone" | "leavingCardId" | "skipRegister" | "registerEligible"
  >,
): boolean {
  if (pending.skipRegister) return false;
  if (pending.registerEligible !== true) return false;
  if (pending.toZone !== "discard" || pending.fromZone !== "battle") return false;
  return cardHasRegisterKeyword(state, pending.leavingCardId);
}

export function toPendingRegister(intent: LeaveIntent): PendingRegister {
  return {
    ownerPlayerId: intent.ownerPlayerId,
    instanceId: intent.instanceId,
    fromZone: "battle",
    leavingCardId: intent.leavingCardId,
    phasePlayerId: intent.phasePlayerId,
    followUpAttackerLeave: intent.followUpAttackerLeave,
    resumePendingStrike: intent.resumePendingStrike,
  };
}

/** レジストでホールド留場。 */
export function applyRegisterHold(
  state: GameState,
  pending: PendingRegister,
): GameState {
  const owner = state.players[pending.ownerPlayerId];
  const found = findInZone(owner, pending.fromZone, pending.instanceId);
  if (!found) {
    return { ...state, pendingRegister: undefined };
  }

  const zone = owner[pending.fromZone].map((c) =>
    c.instanceId === pending.instanceId
      ? { ...c, registerHeld: true, battleActed: true }
      : c,
  );

  let nextState: GameState = {
    ...state,
    pendingRegister: undefined,
    activePlayer: pending.phasePlayerId,
    ...updatePlayer(state, pending.ownerPlayerId, {
      ...owner,
      [pending.fromZone]: zone,
    }),
  };

  if (pending.resumePendingStrike && state.pendingStrike) {
    nextState = {
      ...nextState,
      pendingStrike: state.pendingStrike,
    };
  }

  return nextState;
}

/** レジストをスキップして通常の離場処理へ。 */
export function finalizeRegisterDiscard(
  state: GameState,
  pending: PendingRegister,
): GameState {
  const leaveIntent: LeaveIntent = {
    ownerPlayerId: pending.ownerPlayerId,
    instanceId: pending.instanceId,
    fromZone: pending.fromZone,
    toZone: "discard",
    leavingCardId: pending.leavingCardId,
    phasePlayerId: pending.phasePlayerId,
    followUpAttackerLeave: pending.followUpAttackerLeave,
    resumePendingStrike: pending.resumePendingStrike,
    skipRegister: true,
  };
  return {
    ...finalizeLeavePending(state, leaveIntent, false),
    pendingRegister: undefined,
  };
}

export function isRegisterHeldUnit(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  instance?: { registerHeld?: boolean },
): boolean {
  return !!instance?.registerHeld && (
    cardHasKeyword(definitions, cardId, "register") || hasResist(definitions, cardId)
  );
}

/** レジストホールド中はバトル／ストライク不可。 */
export function registerBlocksBattleAction(
  definitions: Record<string, CardDefinition>,
  cardId: string,
  instance?: { registerHeld?: boolean },
): boolean {
  return isRegisterHeldUnit(definitions, cardId, instance);
}

export function clearRegisterHeldOnRelease(
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState {
  const player = state.players[playerId];
  for (const zone of ["rush", "battle"] as const) {
    const idx = player[zone].findIndex((c) => c.instanceId === instanceId);
    if (idx < 0) continue;
    const nextZone = player[zone].map((c) =>
      c.instanceId === instanceId ? { ...c, registerHeld: false } : c,
    );
    return {
      ...state,
      ...updatePlayer(state, playerId, { ...player, [zone]: nextZone }),
    };
  }
  return state;
}
