import { describe, expect, it } from "vitest";
import { getCardEffect } from "./effects";
import {
  findNamedEffectByEffectId,
  getUnitEffectBlock,
  hasUnnamedRule,
  listAltNcPartnerIds,
  listZordFusionPartnerIds,
  resetUnitEffectBlockCache,
} from "./unitEffects";

describe("unitEffects registry (U4)", () => {
  it("resolves core named effects from CardDocument", () => {
    resetUnitEffectBlockCache();
    const named = findNamedEffectByEffectId("RS-046", "armor_attack");
    expect(named?.name).toBeTruthy();
    expect(named?.trigger.type).toBe("on_rush");
  });

  it("resolves unnamed rules from CardDocument", () => {
    expect(hasUnnamedRule("RS-054", "destroy_self_damage")).toBe(true);
  });

  it("resolves zord fusion partners from CardDocument", () => {
    const partners = listZordFusionPartnerIds("RS-034");
    expect(partners.length).toBeGreaterThan(0);
  });

  it("getCardEffect reads operation meta from CardDocument", () => {
    const effect = getCardEffect("RS-001");
    expect(effect?.effectId).toBe("goren_storm");
    expect(effect?.kind).toBe("instant");
  });

  it("getUnitEffectBlock returns undefined for unknown ids", () => {
    expect(getUnitEffectBlock("UNKNOWN-999")).toBeUndefined();
  });

  it("infers nc_or_combo_from for RS-056 from every 「マジフェニックス」 (alias and real card)", () => {
    resetUnitEffectBlockCache();
    // マジレッド（RS-057 とその再録）は「マジフェニックス」としてつかえる。本来のマジフェニックスは RS-576。
    expect(listAltNcPartnerIds("RS-056")).toEqual(["RS-057", "RS-576", "RS-577", "XG7-014"]);
  });
});
