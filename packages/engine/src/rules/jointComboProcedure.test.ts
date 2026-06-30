import { describe, expect, it } from "vitest";
import { JOINT_L_EFFECTS, JOINT_R_EFFECTS } from "@rangers-strike/cards";
import { inst, createTestState } from "../testing/fixtures";
import {
  findJointComboTriggersOnEnter,
  isJointComboNumber,
  isJointLSizeAnchor,
  jointPartnerCategoriesMatch,
  resolveJointCombosOnEnter,
} from "./jointComboProcedure";

const defs = {
  "TST-L": {
    id: "TST-L",
    name: "Helper L",
    type: "unit" as const,
    category: "WB" as const,
    rarity: "N" as const,
    expansion: "test",
    powerCost: 2,
    bp: 2000,
    size: "M" as const,
    comboNumber: "L" as const,
  },
  "TST-ZORD": {
    id: "TST-ZORD",
    name: "Zord",
    type: "unit" as const,
    category: "WB" as const,
    rarity: "SR" as const,
    expansion: "test",
    powerCost: 7,
    bp: 12000,
    size: "L" as const,
    sp: 1,
  },
  "TST-R": {
    id: "TST-R",
    name: "Helper R",
    type: "unit" as const,
    category: "WB" as const,
    rarity: "N" as const,
    expansion: "test",
    powerCost: 3,
    bp: 4000,
    size: "M" as const,
    comboNumber: "R" as const,
  },
  "TST-EXTRA": {
    id: "TST-EXTRA",
    name: "Extra",
    type: "unit" as const,
    category: "WB" as const,
    rarity: "N" as const,
    expansion: "test",
    powerCost: 1,
    bp: 1000,
    size: "S" as const,
  },
};

describe("jointComboProcedure", () => {
  it("isJointComboNumber identifies L and R", () => {
    expect(isJointComboNumber("L")).toBe(true);
    expect(isJointComboNumber("R")).toBe(true);
    expect(isJointComboNumber(2)).toBe(false);
    expect(isJointComboNumber("RC")).toBe(false);
  });

  it("findJointComboTriggersOnEnter fires L when L-size enters to the right of L", () => {
    const battle = [inst("TST-L", "l1"), inst("TST-ZORD", "z1")];
    const triggers = findJointComboTriggersOnEnter(battle, defs, 1);
    expect(triggers).toEqual([{ kind: "joint_l", lIndex: 0, partnerIndex: 1 }]);
  });

  it("findJointComboTriggersOnEnter fires R when R enters right of L-size", () => {
    const battle = [inst("TST-ZORD", "z1"), inst("TST-R", "r1")];
    const triggers = findJointComboTriggersOnEnter(battle, defs, 1);
    expect(triggers).toEqual([{ kind: "joint_r", rIndex: 1, partnerIndex: 0 }]);
  });

  it("does not re-trigger existing JC when unrelated unit enters (RS-172)", () => {
    const battle = [
      inst("TST-L", "l1"),
      inst("TST-ZORD", "z1"),
      inst("TST-EXTRA", "e1"),
    ];
    const triggers = findJointComboTriggersOnEnter(battle, defs, 2);
    expect(triggers).toHaveLength(0);
  });

  it("jointPartnerCategoriesMatch requires full category set match", () => {
    const wb = inst("TST-ZORD", "z1");
    const ot = { ...inst("TST-R", "r1"), cardId: "TST-OT" };
    defs["TST-OT"] = { ...defs["TST-R"], id: "TST-OT", category: "OT" };
    expect(jointPartnerCategoriesMatch(defs, inst("TST-L", "l1"), wb)).toBe(true);
    expect(jointPartnerCategoriesMatch(defs, wb, ot)).toBe(false);
  });

  it("isJointLSizeAnchor is true only for L size", () => {
    expect(isJointLSizeAnchor(defs, inst("TST-ZORD", "z1"))).toBe(true);
    expect(isJointLSizeAnchor(defs, inst("TST-L", "l1"))).toBe(false);
  });

  it("resolveJointCombosOnEnter does not re-fire when unrelated unit enters", () => {
    JOINT_L_EFFECTS["TST-L"] = "grant_sp1_to_partner";

    const battle = [
      inst("TST-L", "l1"),
      inst("TST-ZORD", "z1"),
      inst("TST-EXTRA", "e1"),
    ];
    battle[1]!.spModifier = 1;

    const state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: { battle },
    });

    const result = resolveJointCombosOnEnter(state, "player1", battle[2]!.instanceId);
    expect(result.logs).toHaveLength(0);
    const zord = result.state.players.player1.battle.find((c) => c.cardId === "TST-ZORD");
    expect(zord?.spModifier).toBe(1);

    delete JOINT_L_EFFECTS["TST-L"];
  });

  it("findJointComboTriggersOnEnter fires L when SP1/4 S enters right of L anchor", () => {
    const rkDefs = {
      ...defs,
      "RK-147": {
        id: "RK-147",
        name: "Isurugi",
        type: "unit" as const,
        category: "OT" as const,
        rarity: "N" as const,
        expansion: "test",
        powerCost: "3+",
        bp: 5000,
        size: "M" as const,
        comboNumber: "L" as const,
        text: "このユニットからコンビネーションするSP1/4のSユニットは、次の能力を得る⇒自軍ターン中、「SP1」になる。",
        effects: [
          {
            id: "redomu",
            text: "このユニットからコンビネーションするSP1/4のSユニットは、次の能力を得る⇒自軍ターン中、「SP1」になる。",
            trigger: { type: "joint_combo_l" as const },
            effects: [],
          },
        ],
      },
      "RK-142": {
        id: "RK-142",
        name: "Momo",
        type: "unit" as const,
        category: "OT" as const,
        rarity: "N" as const,
        expansion: "test",
        powerCost: 1,
        bp: 3000,
        size: "S" as const,
        sp: "1/4" as const,
      },
    };
    const battle = [inst("RK-147", "l1"), inst("RK-142", "s1")];
    const triggers = findJointComboTriggersOnEnter(battle, rkDefs, 1);
    expect(triggers).toEqual([{ kind: "joint_l", lIndex: 0, partnerIndex: 1 }]);
  });

  it("integration: R JC on battle enter", () => {
    JOINT_R_EFFECTS["TST-R"] = "grant_sp1";
    const zord = inst("TST-ZORD", "z1");
    const rider = inst("TST-R", "r1");

    const state = createTestState({
      phase: "battle",
      definitions: defs,
      player1: { battle: [zord, rider] },
    });

    const result = resolveJointCombosOnEnter(state, "player1", rider.instanceId);
    const self = result.state.players.player1.battle.find((c) => c.cardId === "TST-R");
    expect(self?.spModifier).toBe(1);
    expect(result.logs.some((l) => l.includes("joint_combo_r"))).toBe(true);

    delete JOINT_R_EFFECTS["TST-R"];
  });
});
