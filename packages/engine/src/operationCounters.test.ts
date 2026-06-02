import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { battleFillers, moveToBattle } from "./testing/battleEntry";
import { createTestState, heldEtCommand, heldWbCommand, inst } from "./testing/fixtures";

function def(id: string) {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

function unwrap(result: ReturnType<typeof applyAction>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("operation counters", () => {
  it("RS-006 cancels battle and returns S unit to rush", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-0", "d1");
    const counter = inst("RS-006", "c1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        hand: [counter],
        command: [heldEtCommand("cmd")],
        power: [inst("TST-OP", "p1")],
      },
    });
    state.definitions["RS-006"] = def("RS-006");

    state = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
      }),
    );
    expect(state.pendingBattle).toBeDefined();
    expect(state.activePlayer).toBe("player2");

    state = unwrap(
      applyAction(state, {
        type: "play_counter",
        playerId: "player2",
        instanceId: counter.instanceId,
      }),
    );

    expect(state.players.player2.rush.some((c) => c.instanceId === defender.instanceId)).toBe(true);
    expect(state.players.player2.battle).toHaveLength(0);
    expect(state.players.player1.battle[0]?.battleActed).toBe(true);
  });

  it("RS-026 returns rushed unit to top of deck", () => {
    const unit = inst("TST-UNIT-0", "u1");
    const counter = inst("RS-026", "c1");
    const maCmd = { ...inst("RS-057", "cmd"), commandHeld: true };
    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [unit],
        power: [inst("TST-OP", "p1")],
        command: [heldWbCommand("cmd")],
        deck: [inst("TST-OP", "d1")],
      },
      player2: {
        hand: [counter],
        command: [maCmd],
        power: [inst("TST-OP", "p2"), inst("TST-OP", "p3"), inst("TST-OP", "p4")],
      },
    });
    state.definitions["RS-026"] = def("RS-026");
    state.definitions["RS-057"] = def("RS-057");

    state = unwrap(
      applyAction(state, {
        type: "rush",
        playerId: "player1",
        instanceId: unit.instanceId,
      }),
    );
    expect(state.pendingRush).toBeDefined();

    state = unwrap(
      applyAction(state, {
        type: "play_counter",
        playerId: "player2",
        instanceId: counter.instanceId,
      }),
    );

    expect(state.players.player1.rush).toHaveLength(0);
    expect(state.players.player1.deck[0]?.instanceId).toBe(unit.instanceId);
    expect(state.players.player1.deck[0]?.faceDown).toBe(true);
  });

  it("RS-016 prevents unit from leaving battle when same name in discard", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-0", "d1");
    const twin = inst("TST-UNIT-0", "d2");
    const counter = inst("RS-016", "c1");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        discard: [twin],
        hand: [counter],
        command: [heldWbCommand("cmd")],
        power: [
          inst("TST-OP", "p1"),
          inst("TST-OP", "p2"),
          inst("TST-OP", "p3"),
          inst("TST-OP", "p4"),
        ],
      },
    });
    state.definitions["RS-016"] = def("RS-016");

    state = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
      }),
    );

    expect(state.pendingLeave).toBeDefined();
    expect(state.activePlayer).toBe("player2");

    state = unwrap(
      applyAction(state, {
        type: "play_counter",
        playerId: "player2",
        instanceId: counter.instanceId,
      }),
    );

    expect(state.players.player2.battle.some((c) => c.instanceId === defender.instanceId)).toBe(true);
    expect(state.players.player2.discard.some((c) => c.instanceId === defender.instanceId)).toBe(false);
  });

  it("RS-027 keeps unit on field and pays deck cost equal to power cost", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-2", "d1");
    const counter = inst("RS-027", "dg");
    const deckTop = inst("TST-OP", "deck1");
    const deckSecond = inst("TST-OP", "deck2");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        hand: [counter],
        command: [heldWbCommand("cmd")],
        deck: [deckTop, deckSecond, inst("TST-OP", "deck3")],
        power: [
          inst("TST-OP", "p1"),
          inst("TST-OP", "p2"),
          inst("TST-OP", "p3"),
          inst("TST-OP", "p4"),
        ],
      },
    });
    state.definitions["RS-027"] = def("RS-027");

    state = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
      }),
    );

    expect(state.pendingLeave).toBeDefined();

    state = unwrap(
      applyAction(state, {
        type: "play_counter",
        playerId: "player2",
        instanceId: counter.instanceId,
      }),
    );

    expect(state.players.player2.battle.some((c) => c.instanceId === defender.instanceId)).toBe(true);
    expect(state.players.player2.discard.some((c) => c.cardId === "RS-027")).toBe(true);
    expect(state.players.player2.discard.some((c) => c.instanceId === deckTop.instanceId)).toBe(true);
    expect(state.players.player2.discard.some((c) => c.instanceId === deckSecond.instanceId)).toBe(true);
    expect(state.players.player2.deck).toHaveLength(1);
  });
});

describe("unit features in catalog", () => {
  it("includes mecha feature for pat striker", () => {
    const card = legend1Catalog.cards.find((c) => c.id === "RS-043");
    expect(card?.features).toContain("メカ");
  });
});

describe("RS-018 hidden ninja substitute", () => {
  it("redirects battle to a substitute unit", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-0", "d1");
    const substitute = inst("TST-UNIT-7", "sub1");
    const counter = inst("RS-018", "c1");
    const maCmd = { ...inst("RS-057", "cmd"), commandHeld: true };
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        rush: [substitute],
        hand: [counter],
        command: [maCmd],
        power: [
          inst("TST-OP", "p1"),
          inst("TST-OP", "p2"),
          inst("TST-OP", "p3"),
          inst("TST-OP", "p4"),
        ],
      },
    });
    state.definitions["RS-018"] = def("RS-018");
    state.definitions["RS-057"] = def("RS-057");

    state = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
      }),
    );

    state = unwrap(
      applyAction(state, {
        type: "play_counter",
        playerId: "player2",
        instanceId: counter.instanceId,
        substituteInstanceId: substitute.instanceId,
      }),
    );

    expect(state.players.player2.battle.some((c) => c.instanceId === defender.instanceId)).toBe(true);
    expect(state.players.player2.rush.some((c) => c.instanceId === substitute.instanceId)).toBe(true);
  });

  it("cannot substitute the attacking unit (errata)", () => {
    const attacker = inst("TST-UNIT-2", "a1");
    const defender = inst("TST-UNIT-0", "d1");
    const counter = inst("RS-018", "c1");
    const maCmd = { ...inst("RS-057", "cmd"), commandHeld: true };
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      player1: { battle: [attacker] },
      player2: {
        battle: [defender],
        hand: [counter],
        command: [maCmd],
        power: [
          inst("TST-OP", "p1"),
          inst("TST-OP", "p2"),
          inst("TST-OP", "p3"),
          inst("TST-OP", "p4"),
        ],
      },
    });
    state.definitions["RS-018"] = def("RS-018");
    state.definitions["RS-057"] = def("RS-057");

    state = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: attacker.instanceId,
        defenderInstanceId: defender.instanceId,
      }),
    );

    const subs = getLegalActions(state)
      .filter(
        (a): a is Extract<typeof a, { type: "play_counter" }> =>
          a.type === "play_counter" && a.instanceId === counter.instanceId,
      )
      .map((a) => a.substituteInstanceId);
    expect(subs).not.toContain(attacker.instanceId);
  });

  it("RS-058 yellow thunder resolves battle against defender in rush", () => {
    const yellow = inst("RS-058", "yellow");
    const rushDefender = inst("TST-UNIT-0", "d-rush");
    let state = createTestState({
      phase: "battle",
      activePlayer: "player1",
      definitions: Object.fromEntries(legend1Catalog.cards.map((c) => [c.id, c])),
      player1: {
        rush: [yellow],
        battle: battleFillers(2),
      },
      player2: { rush: [rushDefender], battle: [] },
    });

    state = moveToBattle(state, yellow.instanceId);
    state = unwrap(
      applyAction(state, {
        type: "battle",
        playerId: "player1",
        attackerInstanceId: yellow.instanceId,
        defenderInstanceId: rushDefender.instanceId,
      }),
    );

    expect(state.log.some((e) => e.endsWith("|failed"))).toBe(false);
    expect(state.players.player2.rush).toHaveLength(0);
    expect(state.players.player1.battle.find((c) => c.instanceId === yellow.instanceId)?.battleActed).toBe(
      true,
    );
    expect(state.pendingBattle).toBeUndefined();
  });
});
