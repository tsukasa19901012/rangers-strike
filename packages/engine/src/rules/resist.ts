import type { CardDefinition } from "@rangers-strike/cards";
import { hasResist } from "@rangers-strike/cards";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { cardHasRegisterKeyword } from "../keywords/registerReaction";
import type {
  CardInstance,
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
  > &
    Partial<Pick<PendingLeave, "ownerPlayerId" | "instanceId">>,
): boolean {
  if (pending.skipRegister) return false;
  if (pending.registerEligible !== true) return false;
  if (pending.toZone !== "discard" || pending.fromZone !== "battle") return false;
  // ルール: R-KW-RESIST-04 — リリース状態でなければ使えない（レジストでホールド中のユニットは再レジスト不可）。
  if (pending.ownerPlayerId && pending.instanceId) {
    const card = state.players[pending.ownerPlayerId].battle.find(
      (c) => c.instanceId === pending.instanceId,
    );
    if (card?.commandHeld) return false;
  }
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
      ? { ...c, registerHeld: true, commandHeld: true, battleActed: true }
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

/**
 * レジストホールド中のアタック／ストライク可否。
 * ルール: R-HOLD-03 — ホールド中のアタック・ストライクの可否は [未確定]。従来どおり不可のまま。
 */
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
      c.instanceId === instanceId
        ? { ...c, registerHeld: false, commandHeld: false }
        : c,
    );
    return {
      ...state,
      ...updatePlayer(state, playerId, { ...player, [zone]: nextZone }),
    };
  }
  return state;
}

/**
 * スタートフェイズでレジストホールド中のバトルユニットがラッシュに戻るときの状態。
 * ルール: R-HOLD-02, R-KW-RESIST-04, R-START-01 — スタートフェイズでリリースされるのはコマンドだけ。
 * ユニットのホールド（registerHeld / commandHeld）はリリース効果がない限り続く。
 * ルール: R-START-02 — バトルエリア⇔ラッシュエリアの移動ではホールド状態は消えない。
 */
export function prepareRegisterUnitReturnedToRush(card: CardInstance): CardInstance {
  if (!card.registerHeld) return card;
  const next = { ...card };
  delete next.battleActed;
  return next;
}

const NON_UNIT_ZONES = ["deck", "hand", "discard", "power", "command", "operation"] as const;

/**
 * ルール: R-HOLD-02 — ユニットでなくなれば（捨札・コマンド・パワー・手札等）ユニットのホールドは解除される。
 * レジストのホールドがスタートフェイズに解除されなくなったため、場を離れたカードに残った
 * registerHeld / commandHeld をここで消す。
 */
export function clearRegisterHoldOffField(state: GameState): GameState {
  let next = state;
  for (const pid of ["player1", "player2"] as const) {
    const player = next.players[pid];
    let patch: Partial<typeof player> | undefined;
    for (const zone of NON_UNIT_ZONES) {
      const cards = player[zone];
      if (!cards.some((c) => c.registerHeld)) continue;
      patch = {
        ...patch,
        [zone]: cards.map((c) => {
          if (!c.registerHeld) return c;
          const cleared = { ...c };
          delete cleared.registerHeld;
          delete cleared.commandHeld;
          return cleared;
        }),
      };
    }
    if (patch) next = { ...next, ...updatePlayer(next, pid, { ...player, ...patch }) };
  }
  return next;
}
