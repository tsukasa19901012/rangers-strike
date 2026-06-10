import { describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import {
  createTestState,
  heldMaCommand,
  heldOtCommand,
  heldWbCommand,
  inst,
} from "../testing/fixtures";

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

describe("dsl card interpreter — L1 rush operations", () => {
  it("RS-011 aura_power opens choose then sets aura on selected S unit", () => {
    const op = inst("RS-011", "op");
    const target = inst("RS-054", "s-unit");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        rush: [target],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2")],
        command: [heldMaCommand("c1")],
      },
    });
    state.definitions["RS-011"] = def("RS-011");
    state.definitions["RS-054"] = def("RS-054");

    const pending = unwrap(
      applyAction(state, {
        type: "play_operation",
        playerId: "player1",
        instanceId: op.instanceId,
      }),
    );
    expect(pending.pendingEffectChoice?.effectId).toBe("aura_power");
    expect(pending.pendingEffectChoice?.validInstanceIds).toContain(target.instanceId);

    const resolved = unwrap(
      applyAction(pending, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: target.instanceId,
      }),
    );
    expect(resolved.pendingEffectChoice).toBeUndefined();
    expect(
      resolved.players.player1.modifiers?.some(
        (m) => m.kind === "rule" && m.ruleId === "aura_power",
      ),
    ).toBe(true);
    expect(resolved.players.player1.discard.some((c) => c.cardId === "RS-011")).toBe(true);
  });

  it("RS-020 place_in_power via DSL move to power", () => {
    const op = inst("RS-020", "op");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: [],
        command: [{ ...inst("RS-020", "c1"), commandHeld: true }],
      },
    });
    state.definitions["RS-020"] = def("RS-020");

    const action = getLegalActions(state).find(
      (a) => a.type === "play_operation" && a.instanceId === op.instanceId,
    );
    expect(action).toBeDefined();

    const next = unwrap(applyAction(state, action!));
    expect(next.players.player1.power.some((c) => c.cardId === "RS-020")).toBe(true);
    expect(next.players.player1.discard.some((c) => c.cardId === "RS-020")).toBe(false);
  });

  it("RS-025 bp_boost_4000 via choose + modify_bp", () => {
    const op = inst("RS-025", "op");
    const unit = inst("RS-046", "unit");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        rush: [unit],
        power: [inst("TST-OP", "p1"), inst("TST-OP", "p2")],
        command: [heldWbCommand("c1")],
      },
    });
    state.definitions["RS-025"] = def("RS-025");
    state.definitions["RS-046"] = def("RS-046");

    const pending = unwrap(
      applyAction(state, {
        type: "play_operation",
        playerId: "player1",
        instanceId: op.instanceId,
      }),
    );
    const resolved = unwrap(
      applyAction(pending, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: unit.instanceId,
      }),
    );
    const boosted = resolved.players.player1.rush.find((c) => c.instanceId === unit.instanceId);
    expect(boosted?.bpModifier).toBe(4000);
  });

  it("RS-028 judgment via DSL grant_keyword", () => {
    const op = inst("RS-028", "op");
    const target = inst("TST-UNIT-0", "u1");
    const deckTop = inst("TST-UNIT-0", "deck-s");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [op],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-OP", `p${i}`)),
        command: [{ ...inst("RS-020", "c1"), commandHeld: true }],
        deck: [deckTop, inst("TST-OP", "d2")],
      },
      player2: {
        battle: [target],
      },
    });
    state.definitions["RS-028"] = def("RS-028");
    state.definitions["RS-020"] = def("RS-020");
    state.definitions["TST-UNIT-0"] = {
      id: "TST-UNIT-0",
      name: "Test S",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 0,
      bp: 1000,
      size: "S",
    };

    const actions = getLegalActions(state).filter(
      (a) =>
        a.type === "play_operation" &&
        a.instanceId === op.instanceId &&
        a.targetInstanceId === target.instanceId,
    );
    expect(actions.length).toBeGreaterThan(0);
    const next = unwrap(applyAction(state, actions[0]!));
    expect(next.players.player2.battle).toHaveLength(0);
    expect(next.players.player1.discard.some((c) => c.cardId === "RS-028")).toBe(true);
  });
});
