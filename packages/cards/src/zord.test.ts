import { describe, expect, it } from "vitest";
import {
  getZordCondition,
  isValidZordFusionMaterial,
} from "./zord";
import { listZordFusionPartnerIds } from "./unitEffects";

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
