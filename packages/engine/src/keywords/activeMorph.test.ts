import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { buildDefinitionMap } from "../core/catalog";
import { createTestState, inst } from "../testing/fixtures";
import {
  applyKamenRideMorphSwap,
  listActiveMorphCandidatesByEffectName,
} from "./activeMorph";

const ATTACK_RIDE = "アタックライド";

function unitDef(id: string, text?: string): CardDefinition {
  return {
    id,
    name: id,
    type: "unit",
    category: "ET",
    rarity: "N",
    expansion: "test",
    powerCost: 2,
    bp: 3000,
    size: "S",
    text,
  };
}

describe("active morph primitives", () => {
  it("lists kamen ride candidates by effect name", () => {
    const field = inst("FIELD", "field");
    const attackRide = inst("RIDE", "ride");
    const other = inst("OTHER", "other");

    const defs = buildDefinitionMap([
      [unitDef("FIELD"), unitDef("RIDE", `【${ATTACK_RIDE}】`), unitDef("OTHER")],
    ]);
    const state = createTestState({
      player1: {
        battle: [field],
        hand: [attackRide, other],
      },
    });
    state.definitions = defs;

    const candidates = listActiveMorphCandidatesByEffectName(
      state.players.player1,
      defs,
      ATTACK_RIDE,
      field.instanceId,
    );
    expect(candidates.map((c) => c.instanceId)).toEqual([attackRide.instanceId]);
  });

  it("swaps field unit with attack ride card and inherits hold", () => {
    const field = { ...inst("FIELD", "field"), commandHeld: true };
    const attackRide = inst("RIDE", "ride");

    const defs = buildDefinitionMap([
      [unitDef("FIELD"), unitDef("RIDE", `【${ATTACK_RIDE}】`)],
    ]);
    let state = createTestState({
      player1: {
        battle: [field],
        hand: [attackRide],
      },
    });
    state.definitions = defs;

    const swapped = applyKamenRideMorphSwap(
      state,
      "player1",
      field.instanceId,
      attackRide.instanceId,
    );
    expect("error" in swapped).toBe(false);
    if ("error" in swapped) return;

    const p1 = swapped.state.players.player1;
    expect(p1.battle.find((c) => c.instanceId === attackRide.instanceId)?.commandHeld).toBe(true);
    expect(p1.hand.some((c) => c.instanceId === field.instanceId)).toBe(true);
  });
});
