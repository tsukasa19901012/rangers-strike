import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import { emitUnitRushedAndFinalize } from "../events/emitUnitRushed";
import {
  applyMorphSwap,
  openMorphReactionWindow,
  passMorphReaction,
} from "./morphReaction";
import { createTestState, inst } from "../testing/fixtures";

const FEATURE = "テスト特徴";

function morphUnitDef(id: string, morph = false): CardDefinition {
  return {
    id,
    name: id,
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 1,
    bp: 2000,
    sp: 1,
    size: "S",
    features: [FEATURE],
    text: morph ? "【モーフ】" : undefined,
  };
}

describe("morph reaction window", () => {
  it("opens morph replacement choice before rush counter window", () => {
    const rusher = inst("ENEMY-RUSH", "enemy");
    const morphField = inst("MORPH-FIELD", "morph-field");
    const morphHand = inst("MORPH-HAND", "morph-hand");

    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: {
        rush: [morphField],
        hand: [morphHand],
      },
    });

    state.definitions["ENEMY-RUSH"] = morphUnitDef("ENEMY-RUSH");
    state.definitions["MORPH-FIELD"] = morphUnitDef("MORPH-FIELD", true);
    state.definitions["MORPH-HAND"] = morphUnitDef("MORPH-HAND");

    const result = emitUnitRushedAndFinalize(
      state,
      "player1",
      rusher.instanceId,
      "player1",
    );

    expect(result.counterPending).toBe(false);
    expect(result.state.pendingMorph?.defenderPlayerId).toBe("player2");
    expect(result.state.pendingEffectChoice?.effectId).toBe("morph_replacement");
    expect(result.state.pendingRush).toBeUndefined();
    expect(getLegalActions(result.state).some((a) => a.type === "skip_effect_choice")).toBe(
      true,
    );
  });

  it("offers morph unit selection when multiple morph units can react", () => {
    const rusher = inst("ENEMY-RUSH", "enemy");
    const morphField1 = inst("MORPH-FIELD-1", "morph-field-1");
    const morphField2 = inst("MORPH-FIELD-2", "morph-field-2");
    const morphHand1 = inst("MORPH-HAND-1", "morph-hand-1");
    const morphHand2 = inst("MORPH-HAND-2", "morph-hand-2");

    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: {
        rush: [morphField1, morphField2],
        hand: [morphHand1, morphHand2],
      },
    });

    state.definitions["ENEMY-RUSH"] = morphUnitDef("ENEMY-RUSH");
    state.definitions["MORPH-FIELD-1"] = morphUnitDef("MORPH-FIELD-1", true);
    state.definitions["MORPH-FIELD-2"] = morphUnitDef("MORPH-FIELD-2", true);
    state.definitions["MORPH-HAND-1"] = morphUnitDef("MORPH-HAND-1");
    state.definitions["MORPH-HAND-2"] = morphUnitDef("MORPH-HAND-2");

    const result = emitUnitRushedAndFinalize(
      state,
      "player1",
      rusher.instanceId,
      "player1",
    );

    expect(result.state.pendingMorph?.morphUnitInstanceIds).toHaveLength(2);
    expect(result.state.pendingEffectChoice).toBeUndefined();
    expect(
      getLegalActions(result.state).some((a) => a.type === "select_morph_unit"),
    ).toBe(true);
  });

  it("swaps morph field unit with matching hand card and inherits hold state", () => {
    const morphField = {
      ...inst("MORPH-FIELD", "morph-field"),
      commandHeld: true,
    };
    const morphHand = inst("MORPH-HAND", "morph-hand");

    let state = createTestState({
      player2: {
        rush: [morphField],
        hand: [morphHand],
      },
    });
    state.definitions["MORPH-FIELD"] = morphUnitDef("MORPH-FIELD", true);
    state.definitions["MORPH-HAND"] = morphUnitDef("MORPH-HAND");

    const swapped = applyMorphSwap(
      state,
      "player2",
      morphField.instanceId,
      morphHand.instanceId,
    );
    expect("error" in swapped).toBe(false);
    if ("error" in swapped) return;

    const p2 = swapped.state.players.player2;
    expect(p2.rush.some((c) => c.instanceId === morphHand.instanceId)).toBe(true);
    expect(p2.rush.find((c) => c.instanceId === morphHand.instanceId)?.commandHeld).toBe(
      true,
    );
    expect(p2.hand.some((c) => c.instanceId === morphField.instanceId)).toBe(true);
    expect(p2.hand.find((c) => c.instanceId === morphField.instanceId)?.commandHeld).toBe(
      undefined,
    );
  });

  it("passing morph reaction clears morph pending state", () => {
    const rusher = inst("ENEMY-RUSH", "enemy");
    const morphField = inst("MORPH-FIELD", "morph-field");
    const morphHand = inst("MORPH-HAND", "morph-hand");

    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: {
        rush: [morphField],
        hand: [morphHand],
      },
    });

    state.definitions["ENEMY-RUSH"] = morphUnitDef("ENEMY-RUSH");
    state.definitions["MORPH-FIELD"] = morphUnitDef("MORPH-FIELD", true);
    state.definitions["MORPH-HAND"] = morphUnitDef("MORPH-HAND");

    state = openMorphReactionWindow(state, "player1", rusher.instanceId, "player1");
    const passed = passMorphReaction(state, "player2");
    expect(passed?.pendingMorph).toBeUndefined();
    expect(passed?.pendingEffectChoice).toBeUndefined();
  });

  it("skipping morph replacement clears morph and continues flow", () => {
    const rusher = inst("ENEMY-RUSH", "enemy");
    const morphField = inst("MORPH-FIELD", "morph-field");
    const morphHand = inst("MORPH-HAND", "morph-hand");

    let state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: { rush: [rusher] },
      player2: {
        rush: [morphField],
        hand: [morphHand],
      },
    });

    state.definitions["ENEMY-RUSH"] = morphUnitDef("ENEMY-RUSH");
    state.definitions["MORPH-FIELD"] = morphUnitDef("MORPH-FIELD", true);
    state.definitions["MORPH-HAND"] = morphUnitDef("MORPH-HAND");

    state = openMorphReactionWindow(state, "player1", rusher.instanceId, "player1");
    const result = applyAction(state, { type: "skip_effect_choice", playerId: "player2" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingMorph).toBeUndefined();
    expect(result.state.pendingEffectChoice).toBeUndefined();
  });
});
