import { describe, expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { strikeDamageFor } from "./combo";
import { applyPromotedNcEffect } from "./promotedNcEffects";
import { recordSUnitRecoveredFromDiscardToHand } from "./turnRecoveryTracking";
import { createTestState, inst } from "../testing/fixtures";

const RS382: CardDefinition = {
  id: "RS-382",
  name: "ビクトリーロボ",
  type: "unit",
  category: "ET",
  rarity: "N",
  expansion: "legend1",
  powerCost: "7+",
  bp: 12000,
  sp: 1,
  size: "L",
};

const RS079: CardDefinition = {
  id: "RS-079",
  name: "バイオハンター・シルバ",
  type: "unit",
  category: "DA",
  rarity: "R",
  expansion: "legend2",
  powerCost: 2,
  bp: 3000,
  size: "S",
};

describe("promoted NC effects (P1 catchall)", () => {
  it("RS-382 adds SP on strike based on S units recovered from discard this turn", () => {
    const robo = inst("RS-382", "robo");
    let state = createTestState({
      definitions: { "RS-382": RS382 },
      phase: "battle",
      activePlayer: "player1",
      player1: {
        battle: [robo],
        sUnitsRecoveredFromDiscardThisTurn: 2,
      },
    });
    const nc = applyPromotedNcEffect(state, "player1", robo);
    state = nc.state;
    const battleUnit = state.players.player1.battle[0]!;
    expect(strikeDamageFor(state.definitions, battleUnit, state, "player1")).toBe(3);
  });

  it("records S unit recovery from discard for RS-382 counter", () => {
    const sUnit = inst("RS-079", "s1");
    let state = createTestState({
      definitions: { "RS-079": RS079 },
      player1: { discard: [sUnit] },
    });
    state = recordSUnitRecoveredFromDiscardToHand(state, "player1", "RS-079");
    expect(state.players.player1.sUnitsRecoveredFromDiscardThisTurn).toBe(1);
  });
});
