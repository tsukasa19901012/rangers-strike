import { describe, expect, it } from "vitest";
import { buildAbarenohDeck } from "@rangers-strike/cards";
import {
  INITIAL_HAND_SIZE,
  WIN_DAMAGE,
  advancePhase,
  applyAction,
  applyActions,
  checkWinner,
  createGame,
  getLegalActions,
  isLegalAction,
  nextPhase,
  parsePowerCost,
  strikeDamage,
} from "./index";
import type { GameState } from "./index";
import { createTestState, heldWbCommand, inst } from "./testing/fixtures";
import { rushWithCategoryHold } from "./testing/rushPayment";

function unwrap(result: ReturnType<typeof applyAction>): GameState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("phase helpers", () => {
  it("cycles through phases", () => {
    expect(nextPhase("start")).toBe("charge");
    expect(nextPhase("end")).toBe("start");
  });

  it("parses zord-up power costs", () => {
    expect(parsePowerCost("7+")).toBe(7);
    expect(parsePowerCost(4)).toBe(4);
  });

  it("maps special SP to 1 strike damage", () => {
    expect(strikeDamage("special")).toBe(1);
    expect(strikeDamage(2)).toBe(2);
  });
});

describe("createGame", () => {
  const deck = buildAbarenohDeck();

  it("creates a two-player game with 7-card hands", () => {
    const state = createGame({ player1Deck: deck, player2Deck: deck, rng: () => 0.5 });
    expect(state.players.player1.hand).toHaveLength(INITIAL_HAND_SIZE);
    expect(state.definitions["RS-050"]).toBeDefined();
  });

  it("starts in charge phase for first player on turn 1", () => {
    const state = createGame({
      player1Deck: deck,
      player2Deck: deck,
      firstPlayer: "player1",
      rng: () => 0.5,
    });
    expect(state.phase).toBe("charge");
    expect(state.firstPlayer).toBe("player1");
  });
});

describe("charge phase", () => {
  it("moves a card from hand to power", () => {
    const card = inst("TST-OP", "h1");
    const state = createTestState({
      phase: "charge",
      player1: { hand: [card] },
    });

    const next = unwrap(
      applyAction(state, {
        type: "charge_power",
        playerId: "player1",
        instanceId: card.instanceId,
      }),
    );

    expect(next.players.player1.hand).toHaveLength(0);
    expect(next.players.player1.power).toHaveLength(1);
    expect(next.phase).toBe("rush");
  });

  it("lists charge actions for each hand card", () => {
    const state = createTestState({
      phase: "charge",
      player1: {
        hand: [inst("TST-OP", "h1"), inst("TST-UNIT-0", "h2")],
      },
    });

    const actions = getLegalActions(state).filter((a) => a.type === "charge_power");
    expect(actions).toHaveLength(2);
  });

  it("allows only one charge per charge phase", () => {
    const cards = [inst("TST-OP", "h1"), inst("TST-UNIT-0", "h2")];
    let state = createTestState({
      phase: "charge",
      player1: { hand: cards },
    });

    state = unwrap(
      applyAction(state, {
        type: "charge_power",
        playerId: "player1",
        instanceId: cards[0]!.instanceId,
      }),
    );

    expect(state.players.player1.hasChargedThisTurn).toBe(true);
    expect(state.phase).toBe("rush");

    const chargeActions = getLegalActions(state).filter(
      (a) => a.type === "charge_power" || a.type === "charge_command",
    );
    expect(chargeActions).toHaveLength(0);

    const second = applyAction(state, {
      type: "charge_command",
      playerId: "player1",
      instanceId: cards[1]!.instanceId,
    });
    expect(second.ok).toBe(false);
  });
});

describe("rush phase", () => {
  it("requires held command to rush", () => {
    const unit = inst("TST-UNIT-0", "h1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        power: [inst("TST-OP", "p1")],
        command: [],
      },
    });

    expect(
      isLegalAction(state, {
        type: "rush",
        playerId: "player1",
        instanceId: unit.instanceId,
      }),
    ).toBe(false);
  });

  it("requires sufficient power to rush", () => {
    const unit = inst("TST-UNIT-2", "h1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        power: [inst("TST-OP", "p1")],
        command: [heldWbCommand("c1")],
      },
    });

    expect(
      isLegalAction(state, {
        type: "rush",
        playerId: "player1",
        instanceId: unit.instanceId,
      }),
    ).toBe(false);
  });

  it("pays power cost and places unit in rush", () => {
    const unit = inst("TST-UNIT-2", "h1");
    const cmd = inst("TST-OP", "c1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        power: [
          inst("TST-OP", "p1"),
          inst("TST-OP", "p2"),
          inst("TST-OP", "p3"),
        ],
        command: [cmd],
      },
    });

    const next = unwrap(
      rushWithCategoryHold(state, "player1", unit.instanceId, cmd.instanceId),
    );

    expect(next.players.player1.power).toHaveLength(3);
    expect(next.players.player1.rush).toHaveLength(1);
    expect(next.players.player1.hand).toHaveLength(0);
  });
});

describe("battle phase", () => {
  it("strikes when opponent battle zone is empty", () => {
    const attacker = inst("TST-UNIT-2", "b1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { battle: [] },
    });

    const next = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: attacker.instanceId,
      }),
    );

    expect(next.players.player2.damage).toBe(2);
    expect(next.players.player2.power.some((c) => c.faceDown)).toBe(true);
  });

  it("allows strike while opponent has blockers when SP is sufficient", () => {
    const attacker = inst("TST-UNIT-0", "b1");
    const blocker = inst("TST-UNIT-0", "b2");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { battle: [blocker] },
    });

    const strikes = getLegalActions(state).filter((a) => a.type === "strike");
    expect(strikes).toHaveLength(1);
  });

  it("moves a unit from rush to battle", () => {
    const unit = inst("TST-UNIT-0", "r1");
    const state = createTestState({
      phase: "battle",
      player1: { rush: [unit] },
    });

    const next = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: unit.instanceId,
      }),
    );

    expect(next.players.player1.rush).toHaveLength(0);
    expect(next.players.player1.battle).toHaveLength(1);
  });
});

describe("win conditions via strike", () => {
  it("declares winner at 7 damage", () => {
    const attacker = inst("TST-UNIT-2", "b1");
    const state = createTestState({
      phase: "battle",
      player1: { battle: [attacker] },
      player2: { damage: WIN_DAMAGE - 2 },
    });

    const next = unwrap(
      applyAction(state, {
        type: "strike",
        playerId: "player1",
        instanceId: attacker.instanceId,
      }),
    );

    expect(next.players.player2.damage).toBe(WIN_DAMAGE);
    expect(next.winner).toBe("player1");
  });
});

describe("phase flow", () => {
  it("runs charge → rush → battle → end", () => {
    const op = inst("TST-OP", "h1");
    const unit = inst("TST-UNIT-0", "h2");
    let state = createTestState({
      phase: "charge",
      player1: { hand: [op, unit] },
    });

    state = unwrap(
      applyAction(state, {
        type: "charge_command",
        playerId: "player1",
        instanceId: op.instanceId,
      }),
    );
    expect(state.phase).toBe("rush");

    const cmdId = state.players.player1.command[0]!.instanceId;
    state = unwrap(
      applyAction(state, {
        type: "initiate_command_payment",
        playerId: "player1",
        kind: "category_use",
        sourceInstanceId: unit.instanceId,
      }),
    );
    state = unwrap(
      applyAction(state, {
        type: "resolve_command_payment",
        playerId: "player1",
        commandInstanceIds: [cmdId],
      }),
    );

    state = unwrap(applyAction(state, { type: "end_phase", playerId: "player1" }));
    expect(state.phase).toBe("battle");
  });

  it("draws at start then resets zones before charge", () => {
    const cmd = { ...inst("TST-OP", "c1"), commandHeld: true };
    const unit = inst("TST-UNIT-0", "b1");
    const state = createTestState({
      phase: "start",
      activePlayer: "player2",
      turn: 2,
      player2: {
        deck: [inst("TST-OP", "d1")],
        hand: [],
        command: [cmd],
        battle: [unit],
      },
    });

    const afterRelease = unwrap(
      applyAction(state, { type: "release_start_commands", playerId: "player2" }),
    );
    expect(afterRelease.players.player2.command[0]?.commandHeld).toBe(false);

    const afterReturn = unwrap(
      applyAction(afterRelease, {
        type: "return_all_battle_to_rush",
        playerId: "player2",
      }),
    );
    expect(afterReturn.players.player2.battle).toHaveLength(0);
    expect(afterReturn.players.player2.rush).toHaveLength(1);

    const afterDraw = unwrap(
      applyAction(afterReturn, { type: "draw", playerId: "player2" }),
    );
    expect(afterDraw.phase).toBe("charge");
    expect(afterDraw.players.player2.hand).toHaveLength(1);
    expect(afterDraw.players.player2.command[0]?.commandHeld).toBe(false);
    expect(afterDraw.players.player2.battle).toHaveLength(0);
    expect(afterDraw.players.player2.rush).toHaveLength(1);
  });

  it("does not draw on end phase", () => {
    const state = createTestState({
      phase: "end",
      player1: { deck: [inst("TST-OP", "d1")], hand: [] },
    });
    const handBefore = state.players.player1.hand.length;

    const after = unwrap(applyAction(state, { type: "end_phase", playerId: "player1" }));
    expect(after.players.player1.hand).toHaveLength(handBefore);
    expect(after.phase).toBe("start");
  });
});

describe("applyActions", () => {
  it("rejects illegal sequences", () => {
    const state = createTestState({ phase: "charge" });
    const result = applyActions(state, [
      { type: "strike", playerId: "player1", instanceId: "missing" },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("checkWinner", () => {
  it("detects damage win at 7", () => {
    const deck = buildAbarenohDeck();
    const state = createGame({ player1Deck: deck, player2Deck: deck, rng: () => 0.5 });
    state.players.player1.damage = WIN_DAMAGE;
    expect(checkWinner(state)).toBe("player2");
  });

  it("does not deck-out a player who still has cards in hand", () => {
    const state = createTestState({
      player2: { deck: [], hand: [inst("TST-OP", "h1")] },
    });
    expect(checkWinner(state)).toBeNull();
  });

  it("declares deck-out when mandatory draw fails", () => {
    const state = createTestState({
      phase: "start",
      player1: { deck: [], hand: [] },
    });

    const result = applyAction(state, { type: "draw", playerId: "player1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe("player2");
  });
});

describe("advancePhase", () => {
  it("switches active player after end phase", () => {
    const deck = buildAbarenohDeck();
    let state = createGame({ player1Deck: deck, player2Deck: deck, rng: () => 0.5 });
    state = { ...state, phase: "end" };
    state = advancePhase(state);
    expect(state.activePlayer).toBe("player2");
    expect(state.turn).toBe(2);
  });
});
