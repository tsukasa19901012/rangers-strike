import { describe, expect, it } from "vitest";
import {
  buildRushAdditionalCondition,
  FUSION_UNIT_IDS,
  fusionPartnerReturnCount,
  getRushAdditionalCondition,
  getZordCondition,
  isFusionUnit,
  isValidZordFusionMaterial,
  listZordUpCardIds,
  requiresFusionPartnerReturn,
  resolveRushAdditionalCondition,
  rushAdditionalConditionText,
} from "./zord";
import { buildFusionPartnerIdSet, listZordFusionPartnerIds } from "./unitEffects";

describe("rush additional condition", () => {
  it("RS-046 matches atwiki 追加条件 wording", () => {
    expect(getZordCondition("RS-046")).toBe("send_s_unit_to_power");
    expect(rushAdditionalConditionText("send_s_unit_to_power")).toBe(
      "自軍Sユニットを1体パワーゾーンに送る",
    );
    expect(getRushAdditionalCondition("RS-046")).toEqual(
      buildRushAdditionalCondition("send_s_unit_to_power"),
    );
    expect(resolveRushAdditionalCondition("RS-046")?.text).toBe(
      "自軍Sユニットを1体パワーゾーンに送る",
    );
  });

  it("RS-096-098 discard S-unit to discard pile", () => {
    expect(getRushAdditionalCondition("RS-096")).toEqual({
      conditionId: "send_s_unit_to_discard",
      text: "自軍Sユニットを1体捨札にする",
      unitCount: 1,
    });
    expect(resolveRushAdditionalCondition("RS-098")?.text).toBe(
      "自軍Sユニットを1体捨札にする",
    );
  });

  it("RS-074/075 use command-or-discard S-unit condition", () => {
    const text = "自軍Sユニットを1体コマンドゾーンに送るか捨札にする";
    expect(getZordCondition("RS-074")).toBe("send_s_unit_to_command_or_discard");
    expect(getRushAdditionalCondition("RS-075")).toEqual({
      conditionId: "send_s_unit_to_command_or_discard",
      text,
      unitCount: 1,
    });
    expect(resolveRushAdditionalCondition("RS-118")?.text).toBe(text);
  });

  it("RS-172 resolves zord condition from legend3 unitEffects", () => {
    expect(getZordCondition("RS-172")).toBe("send_s_unit_to_command_or_discard");
    expect(resolveRushAdditionalCondition("RS-172")?.text).toBe(
      "自軍Sユニットを1体コマンドゾーンに送るか捨札にする",
    );
  });

  it("RS-070 uses discard fusion unit condition", () => {
    expect(getRushAdditionalCondition("RS-070")).toEqual({
      conditionId: "discard_fusion_unit",
      text: "自軍合体ユニットを捨札にする",
    });
  });
});

describe("legend2 zord fusion", () => {
  it("RS-073 accepts sun vulcan parts", () => {
    expect(getZordCondition("RS-073")).toBe("discard_fusion_unit");
    expect(listZordFusionPartnerIds("RS-073")).toEqual(["RS-074", "RS-075"]);
    expect(isValidZordFusionMaterial("RS-073", "RS-074")).toBe(true);
    expect(isValidZordFusionMaterial("RS-073", "RS-076")).toBe(false);
  });

  it("RS-117 accepts gogo vehicle parts", () => {
    expect(listZordFusionPartnerIds("RS-117")).toEqual([
      "RS-118",
      "RS-119",
      "RS-120",
      "RS-121",
      "RS-122",
    ]);
  });

  it("RS-111 accepts legend1 magiranger parts", () => {
    expect(listZordFusionPartnerIds("RS-111")).toEqual([
      "RS-057",
      "RS-058",
      "RS-059",
      "RS-060",
      "RS-061",
    ]);
  });

  it("RS-113 accepts magi phoenix and barikyon", () => {
    expect(listZordFusionPartnerIds("RS-113")).toEqual(["RS-057", "RS-114"]);
    expect(isValidZordFusionMaterial("RS-113", "RS-057")).toBe(true);
    expect(isValidZordFusionMaterial("RS-113", "RS-114")).toBe(true);
  });
});

describe("fusion partner registry", () => {
  it("FUSION_UNIT_IDS includes all 合体― partners from unitEffects", () => {
    const fromEffects = buildFusionPartnerIdSet();
    for (const id of fromEffects) {
      expect(FUSION_UNIT_IDS.has(id)).toBe(true);
      expect(isFusionUnit(id)).toBe(true);
    }
    expect(FUSION_UNIT_IDS.has("RS-062")).toBe(true);
  });

  it("listZordUpCardIds includes legend3 zord-up units", () => {
    const ids = listZordUpCardIds();
    expect(ids).toContain("RS-172");
    expect(ids).toContain("RS-176");
    expect(ids.length).toBeGreaterThan(30);
  });

  it("fusion return helpers match discard_fusion_unit zords", () => {
    expect(requiresFusionPartnerReturn("RS-050")).toBe(true);
    expect(fusionPartnerReturnCount("RS-050")).toBe(3);
    expect(requiresFusionPartnerReturn("RS-172")).toBe(false);
    expect(requiresFusionPartnerReturn("RS-176")).toBe(true);
    expect(fusionPartnerReturnCount("RS-117")).toBe(5);
  });
});
