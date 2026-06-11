import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { buildDefinitionMap } from "../core/catalog";
import { createTestState, inst } from "../testing/fixtures";
import {
  applyKamenRideMorphSwap,
  beginKamenRideMorphChoice,
  listActiveMorphCandidatesByEffectName,
  resolveKamenRideMorphChoice,
} from "./activeMorph";
import { tryResolveDslNcEffects } from "../dsl/triggerResolver";

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

  it("opens kamen ride morph choice from DSL NC grant", () => {
    const decoy = inst("XG2-077", "decoy");
    const attackRide = inst("RIDE", "ride");

    const defs = buildDefinitionMap([
      [
        {
          id: "XG2-077",
          name: "Decade",
          type: "unit",
          category: "OT",
          rarity: "N",
          expansion: "test",
          powerCost: 2,
          bp: 2000,
          size: "S",
          text: "【カメンライド】",
          effects: [
            {
              id: "named_kamen",
              name: "カメンライド",
              trigger: { type: "nc" },
              optional: true,
              effects: [{ type: "grant_keyword", keyword: "attack_ride_replace", duration: "turn" }],
            },
          ],
        },
        unitDef("RIDE", `【${ATTACK_RIDE}】`),
      ],
    ]);
    let state = createTestState({
      phase: "battle",
      player1: {
        battle: [decoy],
        hand: [attackRide],
      },
    });
    state.definitions = defs;

    const nc = tryResolveDslNcEffects({
      state,
      cardId: "XG2-077",
      instanceId: decoy.instanceId,
      playerId: "player1",
      phasePlayerId: "player1",
    });
    expect(nc.handled).toBe(true);
    expect(state.pendingEffectChoice?.effectId).toBeUndefined();
    expect(nc.state.pendingEffectChoice?.effectId).toBe("kamen_ride_morph");

    const resolved = resolveKamenRideMorphChoice(
      nc.state,
      "player1",
      attackRide.instanceId,
    );
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(
      resolved.state.players.player1.battle.some((c) => c.instanceId === attackRide.instanceId),
    ).toBe(true);
  });

  it("beginKamenRideMorphChoice lists attack ride targets only", () => {
    const field = inst("FIELD", "field");
    const attackRide = inst("RIDE", "ride");
    const defs = buildDefinitionMap([
      [unitDef("FIELD"), unitDef("RIDE", `【${ATTACK_RIDE}】`)],
    ]);
    const state = createTestState({
      phase: "battle",
      player1: { battle: [field], hand: [attackRide] },
    });
    state.definitions = defs;

    const withChoice = beginKamenRideMorphChoice(
      state,
      "player1",
      field.instanceId,
      "XG2-077",
      "named_kamen",
      "player1",
      true,
    );
    expect(withChoice?.pendingEffectChoice?.validInstanceIds).toEqual([attackRide.instanceId]);
  });
});
