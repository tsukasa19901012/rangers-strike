import { describe, expect, it } from "vitest";
import type { CardDefinition } from "./schema";
import {
  getJointLPartnerSpec,
  matchesJointLPartnerById,
  matchesJointLPartnerSpec,
  matchesJointRPartnerSpec,
} from "./jointComboPartner";

const rk147: CardDefinition = {
  id: "RK-147",
  name: "デンライナーイスルギ",
  type: "unit",
  category: "OT",
  rarity: "N",
  expansion: "legend2",
  powerCost: "3+",
  bp: 5000,
  size: "M",
  comboNumber: "L",
  text: "【レドーム分離】このユニットからコンビネーションするSP1/4のSユニットは、次の能力を得る⇒自軍ターン中、「SP1」になる。",
  effects: [
    {
      id: "redomu",
      name: "レドーム分離",
      text: "このユニットからコンビネーションするSP1/4のSユニットは、次の能力を得る⇒自軍ターン中、「SP1」になる。",
      trigger: { type: "joint_combo_l" },
      effects: [],
    },
  ],
};

const momotaros: CardDefinition = {
  id: "RK-142",
  name: "モモタロス",
  type: "unit",
  category: "OT",
  rarity: "N",
  expansion: "legend2",
  powerCost: 1,
  bp: 3000,
  size: "S",
  sp: "1/4",
};

const zord: CardDefinition = {
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

describe("jointComboPartner", () => {
  it("RK-147 requires SP1/4 S partner, not L-size zord", () => {
    expect(getJointLPartnerSpec("RK-147")).toEqual({
      kind: "s_sp_fraction",
      fraction: "1/4",
    });
    expect(matchesJointLPartnerById("RK-147", rk147, momotaros)).toBe(true);
    expect(matchesJointLPartnerById("RK-147", rk147, zord)).toBe(false);
  });

  it("defaults to L-size same category when no custom text", () => {
    const helper: CardDefinition = {
      ...rk147,
      id: "TST-L",
      text: "",
      effects: [],
    };
    expect(getJointLPartnerSpec("TST-L")).toEqual({ kind: "l_size_same_category" });
    expect(
      matchesJointLPartnerSpec(
        { kind: "l_size_same_category" },
        { ...helper, category: "WB" },
        zord,
      ),
    ).toBe(true);
    expect(
      matchesJointLPartnerSpec(
        { kind: "l_size_same_category" },
        { ...helper, category: "WB" },
        momotaros,
      ),
    ).toBe(false);
  });

  it("parses R partner from S unit with dual features", () => {
    const spec = matchesJointRPartnerSpec(
      { kind: "s_features", features: ["メカ", "警察"], requireAll: true },
      {
        id: "RM-046",
        name: "ジックキャノン",
        type: "unit",
        category: "DA",
        rarity: "N",
        expansion: "test",
        powerCost: 3,
        bp: 4000,
        size: "M",
        comboNumber: "R",
      },
      {
        id: "TST-PAT",
        name: "Pat",
        type: "unit",
        category: "DA",
        rarity: "N",
        expansion: "test",
        powerCost: 2,
        bp: 3000,
        size: "S",
        features: ["メカ", "警察"],
      },
    );
    expect(spec).toBe(true);
  });
});
