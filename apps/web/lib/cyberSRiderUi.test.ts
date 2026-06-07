import { describe, expect, it } from "vitest";
import { allCardsCatalog, type CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "@rangers-strike/engine";
import { applyAction } from "@rangers-strike/engine";
import {
  canSelectCyberSRiderHand,
  listCyberSRiderHandCandidates,
} from "./cyberSRiderUi";

const ALL_DEFINITIONS: Record<string, CardDefinition> = Object.fromEntries(
  allCardsCatalog.cards.map((card) => [card.id, card]),
);

function inst(cardId: string, suffix: string): CardInstance {
  return { instanceId: `${cardId}:${suffix}`, cardId };
}

function emptyPlayer(id: PlayerId): PlayerState {
  return {
    id,
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    damage: 0,
  };
}

function makeState(options: {
  phase?: GameState["phase"];
  player1?: Partial<PlayerState>;
}): GameState {
  return {
    turn: 1,
    activePlayer: "player1",
    firstPlayer: "player1",
    phase: options.phase ?? "rush",
    players: {
      player1: { ...emptyPlayer("player1"), ...options.player1 },
      player2: emptyPlayer("player2"),
    },
    definitions: ALL_DEFINITIONS,
    log: [],
    winner: null,
  };
}

describe("cyberSRiderUi", () => {
  it("lists hand cards except the operation itself", () => {
    const op = inst("RS-021", "op1");
    const handA = inst("RS-007", "handA");
    const handB = inst("RS-008", "handB");
    const state = makeState({
      player1: { hand: [op, handA, handB] },
    });

    expect(listCyberSRiderHandCandidates(state, "player1", op.instanceId)).toEqual([
      handA.instanceId,
      handB.instanceId,
    ]);
  });

  it("accepts 1–2 selected hand cards within command zone capacity", () => {
    const op = inst("RS-021", "op1");
    const handA = inst("RS-007", "handA");
    const handB = inst("RS-008", "handB");
    const state = makeState({
      player1: {
        hand: [op, handA, handB],
        command: Array.from({ length: 3 }, (_, i) => inst("RS-010", `c${i}`)),
      },
    });

    expect(
      canSelectCyberSRiderHand(state, "player1", op.instanceId, [handA.instanceId]),
    ).toBe(true);
    expect(
      canSelectCyberSRiderHand(state, "player1", op.instanceId, [
        handA.instanceId,
        handB.instanceId,
      ]),
    ).toBe(true);
    expect(
      canSelectCyberSRiderHand(state, "player1", op.instanceId, [
        handA.instanceId,
        handB.instanceId,
        inst("RS-009", "handC").instanceId,
      ]),
    ).toBe(false);
  });
});

describe("Web UI integration — RS-021 cyber S rider command payment", () => {
  it("plays after ET category payment with selected hand targets", () => {
    const op = inst("RS-021", "op1");
    const handCard = inst("RS-008", "hand1");
    const etCmd = inst("RS-007", "c1");
    const state = makeState({
      phase: "rush",
      player1: {
        hand: [op, handCard],
        power: Array.from({ length: 4 }, (_, i) => inst("RS-011", `p${i}`)),
        command: [{ ...etCmd, commandHeld: false }],
      },
    });

    const initiate = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: op.instanceId,
      targetInstanceId: handCard.instanceId,
    });
    expect(initiate.ok).toBe(true);
    if (!initiate.ok) return;

    const pending = initiate.state.pendingCommandPayment;
    expect(pending?.continuation.type).toBe("play_operation");
    if (pending?.continuation.type !== "play_operation") return;
    expect(pending.continuation.targetInstanceId).toBe(handCard.instanceId);

    const paid = applyAction(initiate.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: [etCmd.instanceId],
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;

    expect(
      paid.state.players.player1.command.some(
        (c) => c.instanceId === handCard.instanceId && c.commandHeld,
      ),
    ).toBe(true);
  });
});
