import { describe, expect, it } from "vitest";
import { fullPlayableCatalog, legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { createTestState, heldEtCommand, heldMaCommand, heldWbCommand, inst } from "./testing/fixtures";
import { getComboNumberDelta } from "./rules/turnModifierBridge";

function def(id: string) {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

describe("play_operation", () => {
describe("dynamite power RS-007", () => {
  it("holds enemy unit in owner command zone", () => {
    const op = inst("RS-007", "op1");
    const target = inst("TST-UNIT-0", "u1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: Array.from({ length: 6 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
      },
      player2: {
        battle: [target],
      },
    });
    state.definitions["RS-007"] = def("RS-007");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === target.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player2.battle).toHaveLength(0);
    expect(
      result.state.players.player2.command.some(
        (c) => c.instanceId === target.instanceId && c.commandHeld,
      ),
    ).toBe(true);
    expect(result.state.players.player1.discard.some((c) => c.cardId === "RS-007")).toBe(true);
  });

  it("discards enemy unit when command zone is full", () => {
    const op = inst("RS-007", "op1");
    const target = inst("TST-UNIT-0", "u1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: Array.from({ length: 6 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
      },
      player2: {
        battle: [target],
        command: Array.from({ length: 5 }, (_, i) => inst("TST-OP", `cmd${i}`)),
      },
    });
    state.definitions["RS-007"] = def("RS-007");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === target.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player2.battle).toHaveLength(0);
    expect(result.state.players.player2.discard.some((c) => c.instanceId === target.instanceId)).toBe(
      true,
    );
    expect(result.state.players.player2.command).toHaveLength(5);
  });
});

  it("applies bp boost RS-025 to own unit", () => {
    const op = inst("RS-025", "op1");
    const unit = inst("TST-UNIT-0", "u1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2")],
        command: [heldWbCommand("c1")],
        rush: [unit],
      },
    });
    state.definitions["RS-025"] = def("RS-025");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === unit.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const boosted = result.state.players.player1.rush[0];
    expect(boosted?.bpModifier).toBe(4000);
  });

  it("RS-025 can pay category hold then boost via initiate_command_payment", () => {
    const op = inst("RS-025", "op1");
    const unit = inst("TST-UNIT-0", "u1");
    const releasedCmd = { ...inst("TST-OP", "c1"), commandHeld: false };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2")],
        command: [releasedCmd],
        rush: [unit],
      },
    });
    state.definitions["RS-025"] = def("RS-025");

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: op.instanceId,
      targetInstanceId: unit.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.state.pendingCommandPayment?.continuation.type).toBe("play_operation");

    const paid = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: [releasedCmd.instanceId],
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.state.players.player1.rush[0]?.bpModifier).toBe(4000);
  });

  it("places permanent operation RS-030", () => {
    const op = inst("RS-030", "op1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2"), inst("TST-OP", "p3")],
        command: [heldEtCommand("c1")],
      },
    });
    state.definitions["RS-030"] = def("RS-030");

    const action = getLegalActions(state).find((a) => a.type === "play_operation");
    expect(action).toBeDefined();
    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player1.operation).toHaveLength(1);
    expect(result.state.players.player1.operation[0]?.cardId).toBe("RS-030");
  });

  it("places DSL passive permanent operation RS-433 in operation zone", () => {
    const op = inst("RS-433", "op1");
    const card = fullPlayableCatalog.cards.find((c) => c.id === "RS-433");
    if (!card) throw new Error("missing RS-433");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        command: [heldMaCommand("c1")],
      },
    });
    state.definitions["RS-433"] = card;

    const action = getLegalActions(state).find(
      (a) => a.type === "play_operation" && a.instanceId === op.instanceId,
    );
    expect(action).toBeDefined();
    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player1.operation).toHaveLength(1);
    expect(result.state.players.player1.operation[0]?.cardId).toBe("RS-433");
    expect(result.state.players.player1.discard.some((c) => c.cardId === "RS-433")).toBe(false);
  });

  it("applies bird nick wave combo delta RS-015", () => {
    const op = inst("RS-015", "op1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2")],
        command: [heldEtCommand("c1")],
      },
    });
    state.definitions["RS-015"] = def("RS-015");

    const action = getLegalActions(state).find((a) => a.type === "play_operation");
    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getComboNumberDelta(result.state.players.player1)).toBe(1);
    expect(
      result.state.players.player1.modifiers?.some(
        (m) => m.kind === "rule" && m.ruleId === "combo_number_delta",
      ),
    ).toBe(true);
  });

  it("opens denji machine reveal when deck has 3+ cards", () => {
    const op = inst("RS-004", "op1");
    const sUnit = inst("TST-UNIT-0", "deck-s");
    const otCmd = { ...inst("RS-020", "c1"), commandHeld: true };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [otCmd],
        deck: [sUnit, inst("TST-OP", "d2"), inst("TST-OP", "d3"), inst("TST-OP", "d4")],
      },
    });
    state.definitions["RS-004"] = def("RS-004");
    state.definitions["RS-020"] = def("RS-020");

    const action = getLegalActions(state).find((a) => a.type === "play_operation");
    expect(action).toBeDefined();
    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.pendingEffectChoice?.effectId).toBe("denji_machine");
    expect(result.state.pendingEffectChoice?.denjiMachineMeta?.step).toBe("reveal");
    expect(result.state.players.player1.deck).toHaveLength(4);
  });

  it("returns fusion material to battle after destroying L with RS-009", () => {
    const bazooka = inst("RS-009", "op1");
    const zord = { ...inst("RS-050", "z1"), zordMaterialCardId: "RS-051" };
    const fusion = inst("RS-051", "f1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [bazooka],
        power: Array.from({ length: 8 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
      },
      player2: {
        battle: [zord],
        discard: [fusion],
        command: [heldWbCommand("c2"), { ...inst("RS-007", "c3"), commandHeld: false }],
      },
    });
    state.definitions["RS-009"] = def("RS-009");
    state.definitions["RS-050"] = def("RS-050");
    state.definitions["RS-051"] = def("RS-051");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === bazooka.instanceId &&
        a.targetInstanceId === zord.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player2.discard.some((c) => c.cardId === "RS-050")).toBe(true);
    expect(result.state.players.player2.battle.some((c) => c.instanceId === fusion.instanceId)).toBe(
      true,
    );
  });
});

describe("land balkan RS-005", () => {
  it("rushes released S commands from command zone", () => {
    const op = inst("RS-005", "op1");
    const sCmd = { ...inst("TST-UNIT-0", "cmd-s"), commandHeld: false };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [sCmd, heldEtCommand("held")],
      },
    });
    state.definitions["RS-005"] = def("RS-005");

    const action = getLegalActions(state).find((a) => a.type === "play_operation");
    expect(action).toBeDefined();
    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player1.rush.some((c) => c.instanceId === sCmd.instanceId)).toBe(
      true,
    );
  });
});

describe("cyber S rider RS-021", () => {
  it("holds hand cards in command zone", () => {
    const op = inst("RS-021", "op1");
    const handCard = inst("RS-007", "hand1");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op, handCard],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
      },
    });
    state.definitions["RS-021"] = def("RS-021");
    state.definitions["RS-007"] = def("RS-007");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === handCard.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.state.players.player1.command.some(
        (c) => c.instanceId === handCard.instanceId && c.commandHeld,
      ),
    ).toBe(true);
  });

  it("holds two non-adjacent hand cards in command zone", () => {
    const op = inst("RS-021", "op1");
    const handA = inst("RS-007", "handA");
    const handB = inst("RS-008", "handB");
    const handC = inst("RS-009", "handC");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op, handA, handB, handC],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [heldEtCommand("c1")],
      },
    });
    state.definitions["RS-021"] = def("RS-021");
    state.definitions["RS-007"] = def("RS-007");
    state.definitions["RS-008"] = def("RS-008");
    state.definitions["RS-009"] = def("RS-009");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === handA.instanceId &&
        a.extraInstanceId === handC.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const command = result.state.players.player1.command;
    expect(command.some((c) => c.instanceId === handA.instanceId && c.commandHeld)).toBe(true);
    expect(command.some((c) => c.instanceId === handC.instanceId && c.commandHeld)).toBe(true);
  });
});

describe("compression freeze RS-024", () => {
  it("sends target unit to power", () => {
    const op = inst("RS-024", "op1");
    const target = inst("TST-UNIT-0", "u1");
    const otCmd = { ...inst("RS-020", "c1"), commandHeld: true };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: Array.from({ length: 6 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [otCmd],
        rush: [target],
      },
    });
    state.definitions["RS-024"] = def("RS-024");
    state.definitions["RS-020"] = def("RS-020");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === target.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player1.rush).toHaveLength(0);
    expect(result.state.players.player1.power.some((c) => c.instanceId === target.instanceId)).toBe(
      true,
    );
  });
});

describe("place in power RS-020", () => {
  it("places the operation card in the power zone", () => {
    const op = inst("RS-020", "op1");
    const otCmd = { ...inst("RS-020", "c1"), commandHeld: true };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [],
        command: [otCmd],
      },
    });
    state.definitions["RS-020"] = def("RS-020");

    const action = getLegalActions(state).find(
      (a) => a.type === "play_operation" && a.instanceId === op.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player1.hand).toHaveLength(0);
    expect(result.state.players.player1.power.some((c) => c.instanceId === op.instanceId)).toBe(true);
    expect(result.state.players.player1.discard.some((c) => c.cardId === "RS-020")).toBe(false);
  });
});

describe("judgment RS-028", () => {
  it("destroys enemy unit when revealed card matches size", () => {
    const op = inst("RS-028", "op1");
    const target = inst("TST-UNIT-0", "u1");
    const deckTop = inst("TST-UNIT-0", "deck-s");
    const otCmd = { ...inst("RS-020", "c1"), commandHeld: true };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [otCmd],
        deck: [deckTop, inst("TST-OP", "d2")],
      },
      player2: {
        battle: [target],
      },
    });
    state.definitions["RS-028"] = def("RS-028");
    state.definitions["RS-020"] = def("RS-020");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === target.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player2.battle).toHaveLength(0);
    expect(result.state.players.player2.discard.some((c) => c.instanceId === target.instanceId)).toBe(
      true,
    );
    expect(result.state.players.player1.deck.at(-1)?.instanceId).toBe(deckTop.instanceId);
    expect(result.state.players.player1.discard.some((c) => c.cardId === "RS-028")).toBe(true);
  });

  it("misses when revealed card size differs", () => {
    const op = inst("RS-028", "op1");
    const target = inst("TST-UNIT-0", "u1");
    const deckTop = inst("TST-UNIT-2", "deck-m");
    const otCmd = { ...inst("RS-020", "c1"), commandHeld: true };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [otCmd],
        deck: [deckTop],
      },
      player2: {
        battle: [target],
      },
    });
    state.definitions["RS-028"] = def("RS-028");
    state.definitions["RS-020"] = def("RS-020");

    const action = getLegalActions(state).find(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === target.instanceId,
    );
    expect(action).toBeDefined();

    const result = applyAction(state, action!);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player2.battle).toHaveLength(1);
    expect(result.state.players.player1.deck.at(-1)?.instanceId).toBe(deckTop.instanceId);
  });
});

describe("adventure RS-030", () => {
  it("returns held command to hand at turn end", () => {
    const adventure = inst("RS-030", "adv");
    const cmd = { ...heldWbCommand("c1"), commandHeld: true };
    const state = createTestState({
      phase: "end",
      player1: {
        operation: [adventure],
        command: [cmd],
      },
    });
    state.definitions["RS-030"] = def("RS-030");

    const result = applyAction(state, { type: "end_phase", playerId: "player1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player1.command).toHaveLength(0);
    expect(result.state.players.player1.hand).toHaveLength(1);
  });
});

describe("super brain RS-008", () => {
  it("draws two and discards one when permanent is active", () => {
    const brain = inst("RS-008", "brain");
    const state = createTestState({
      phase: "start",
      player1: {
        operation: [brain],
        deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2"), inst("TST-OP", "d3")],
      },
    });
    state.definitions["RS-008"] = def("RS-008");

    const result = applyAction(state, { type: "draw", playerId: "player1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.players.player1.hand).toHaveLength(1);
    expect(result.state.players.player1.discard).toHaveLength(1);
    expect(result.state.players.player1.deck).toHaveLength(1);
  });
});
