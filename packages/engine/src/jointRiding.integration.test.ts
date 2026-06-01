import { describe, expect, it } from "vitest";
import {
  JOINT_L_EFFECTS,
  JOINT_R_EFFECTS,
  RIDING_COMBO_EFFECTS,
} from "@rangers-strike/cards";
import { applyAction } from "./index";
import { formatGameLog } from "./log/formatLog";
import { createTestState, inst } from "./testing/fixtures";

function unwrap(result: ReturnType<typeof applyAction>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("joint and riding combo integration", () => {
  it("joint combo L grants SP to partner L unit to the right", () => {
    const helper = inst("TST-JOINT-L", "h1");
    const zord = inst("TST-ZORD", "z1");

    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [zord],
        battle: [helper],
      },
    });

    state.definitions["TST-JOINT-L"] = {
      id: "TST-JOINT-L",
      name: "Helper",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 2,
      bp: 2000,
      size: "M",
      comboNumber: "L",
    };
    state.definitions["TST-ZORD"] = {
      id: "TST-ZORD",
      name: "Zord",
      type: "unit",
      category: "WB",
      rarity: "SR",
      expansion: "test",
      powerCost: 7,
      bp: 12000,
      size: "L",
      sp: 1,
    };

    JOINT_L_EFFECTS["TST-JOINT-L"] = "grant_sp1_to_partner";

    const next = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: zord.instanceId,
      }),
    );

    const partner = next.players.player1.battle.find((c) => c.cardId === "TST-ZORD");
    expect(partner?.spModifier).toBe(1);
    expect(
      next.log.some((entry) => entry.includes("joint_combo_l") && entry.includes("TST-JOINT-L")),
    ).toBe(true);
    const jointLog = next.log.find((entry) => entry.includes("joint_combo_l"));
    expect(jointLog).toBeDefined();
    expect(formatGameLog(jointLog!, next.definitions)).toContain("ジョイントLコンボ");

    delete JOINT_L_EFFECTS["TST-JOINT-L"];
  });

  it("joint combo R grants SP to the R unit when left of same-category L", () => {
    const zord = inst("TST-ZORD", "z1");
    const rider = inst("TST-JOINT-R", "r1");

    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [rider],
        battle: [zord],
      },
    });

    state.definitions["TST-ZORD"] = {
      id: "TST-ZORD",
      name: "Zord",
      type: "unit",
      category: "OT",
      rarity: "SR",
      expansion: "test",
      powerCost: 8,
      bp: 15000,
      size: "L",
      sp: 1,
    };
    state.definitions["TST-JOINT-R"] = {
      id: "TST-JOINT-R",
      name: "Pat Helper",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 3,
      bp: 4000,
      size: "M",
      comboNumber: "R",
    };

    JOINT_R_EFFECTS["TST-JOINT-R"] = "grant_sp1";

    const next = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: rider.instanceId,
      }),
    );

    const self = next.players.player1.battle.find((c) => c.cardId === "TST-JOINT-R");
    expect(self?.spModifier).toBe(1);
    expect(next.log.some((entry) => entry.includes("joint_combo_r"))).toBe(true);

    delete JOINT_R_EFFECTS["TST-JOINT-R"];
  });

  it("riding combo RC grants SP on ride-off battle entry", () => {
    const vehicle = inst("TST-VEHICLE", "v1");
    const rider = inst("TST-RC-RIDER", "r1");
    rider.mountedOnInstanceId = vehicle.instanceId;

    const state = createTestState({
      phase: "battle",
      player1: {
        rush: [vehicle, rider],
        battle: [],
      },
    });

    state.definitions["TST-VEHICLE"] = {
      id: "TST-VEHICLE",
      name: "Pat Trailer",
      type: "vehicle",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 4,
      bp: 5000,
      size: "M",
    };
    state.definitions["TST-RC-RIDER"] = {
      id: "TST-RC-RIDER",
      name: "Pat Rider",
      type: "unit",
      category: "OT",
      rarity: "N",
      expansion: "test",
      powerCost: 2,
      bp: 2000,
      size: "S",
      sp: "special",
      comboNumber: "RC",
    };

    RIDING_COMBO_EFFECTS["TST-RC-RIDER"] = "grant_sp1";

    const next = unwrap(
      applyAction(state, {
        type: "move_to_battle",
        playerId: "player1",
        instanceId: rider.instanceId,
        rideOff: true,
      }),
    );

    const self = next.players.player1.battle.find((c) => c.cardId === "TST-RC-RIDER");
    expect(self?.spModifier).toBe(1);
    expect(self?.mountedOnInstanceId).toBeUndefined();
    expect(next.log.some((entry) => entry.includes("riding_combo"))).toBe(true);
    const ridingLog = next.log.find((entry) => entry.includes("riding_combo"));
    expect(ridingLog).toBeDefined();
    expect(formatGameLog(ridingLog!, next.definitions)).toContain("ライディングコンボ");

    delete RIDING_COMBO_EFFECTS["TST-RC-RIDER"];
  });
});
