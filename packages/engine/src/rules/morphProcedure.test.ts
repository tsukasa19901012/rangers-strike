import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "../index";
import { emitUnitRushedAndFinalize } from "../events/emitUnitRushed";
import { featuresExactlyMatch } from "../keywords/morph";
import {
  getMorphReactionActorId,
  morphOrderChooserPlayerId,
  morphUnitCanReact,
  rushedCardBlocksMorphReaction,
  shouldMorphOrderChooserAct,
} from "./morphProcedure";
import { applyMorphSwap, passMorphReaction } from "../keywords/morphReaction";
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

describe("morphProcedure", () => {
  it("matches features in order", () => {
    expect(featuresExactlyMatch(["A", "B"], ["A", "B"])).toBe(true);
    expect(featuresExactlyMatch(["A", "B"], ["B", "A"])).toBe(false);
    expect(featuresExactlyMatch(["A"], ["A", "B"])).toBe(false);
  });

  it("blocks morph reaction against morph-keyword rushes", () => {
    const defs = { M: morphUnitDef("M", true) };
    expect(rushedCardBlocksMorphReaction(defs, "M")).toBe(true);
    expect(rushedCardBlocksMorphReaction(defs, "ENEMY")).toBe(false);
  });

  it("assigns turn player as order chooser when multiple morph units react", () => {
    const rusher = inst("ENEMY-RUSH", "enemy");
    const morphField1 = inst("MORPH-FIELD-1", "morph-field-1");
    const morphField2 = inst("MORPH-FIELD-2", "morph-field-2");
    const morphHand1 = inst("MORPH-HAND-1", "morph-hand-1");
    const morphHand2 = inst("MORPH-HAND-2", "morph-hand-2");

    const state = createTestState({
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
    const pending = result.state.pendingMorph;
    expect(pending).toBeDefined();
    if (!pending) return;

    expect(shouldMorphOrderChooserAct(pending)).toBe(true);
    expect(morphOrderChooserPlayerId(pending)).toBe("player1");
    expect(getMorphReactionActorId(result.state, pending)).toBe("player1");
    expect(
      morphUnitCanReact(result.state, "player2", morphField1, "ENEMY-RUSH"),
    ).toBe(true);
  });

  it("lets defender pass morph while turn player chooses order", () => {
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

    state = emitUnitRushedAndFinalize(state, "player1", rusher.instanceId, "player1").state;
    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "pass_morph_reaction" && a.playerId === "player2")).toBe(
      true,
    );

    const passed = applyAction(state, { type: "pass_morph_reaction", playerId: "player2" });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    expect(passed.state.pendingMorph).toBeUndefined();
  });

  it("inherits hold state and does not treat morph swap as a normal rush payment", () => {
    const morphField = {
      ...inst("MORPH-FIELD", "morph-field"),
      commandHeld: true,
    };
    const morphHand = inst("MORPH-HAND", "morph-hand");

    let state = createTestState({
      player2: {
        rush: [morphField],
        hand: [morphHand],
        power: [],
        command: [],
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
    expect(p2.rush.find((c) => c.instanceId === morphHand.instanceId)?.commandHeld).toBe(true);
    expect(p2.hand.find((c) => c.instanceId === morphField.instanceId)?.commandHeld).toBeUndefined();
    expect(passMorphReaction(swapped.state, "player2")).toBeNull();
  });
});
