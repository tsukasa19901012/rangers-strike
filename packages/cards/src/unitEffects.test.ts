import { describe, expect, it } from "vitest";
import {
  findNcNamedEffect,
  getUnitEffectBlock,
  listNcNamedEffects,
  listZordFusionPartnerIds,
} from "./unitEffects";
import { getNumberComboEffect } from "./comboEffects";

describe("effect taxonomy (Legend1 units)", () => {
  it("parses RS-066 as named effect 遺跡調査 with NC trigger", () => {
    const block = getUnitEffectBlock("RS-066");
    expect(block?.namedEffects).toHaveLength(1);
    expect(block?.namedEffects[0]?.name).toBe("遺跡調査");
    expect(block?.namedEffects[0]?.trigger.type).toBe("nc");
    expect(block?.unnamedText).toHaveLength(0);
  });

  it("separates unnamed ※ text from named 【】 effects on RS-054", () => {
    const block = getUnitEffectBlock("RS-054");
    expect(block?.unnamedText.length).toBeGreaterThanOrEqual(2);
    expect(block?.unnamedText.every((u) => u.kind === "note")).toBe(true);
    expect(block?.namedEffects[0]?.name).toBe("ティラノロッド");
  });

  it("findNcNamedEffect fires RS-031 from combo partners without NC position", () => {
    const named = findNcNamedEffect(
      "RS-031",
      2,
      5,
      [{ instanceId: "s1", cardId: "RS-032" }],
      "e1",
    );
    expect(named?.name).toBe("イーグルダイビング");
    expect(named?.effectId).toBe("eagle_diving");
  });

  it("findNcNamedEffect fires RS-066 at CN position 2", () => {
    const named = findNcNamedEffect("RS-066", 2, 2, [], "p1");
    expect(named?.name).toBe("遺跡調査");
  });

  it("lists implemented NC cards including RS-059 future_sight", () => {
    const ids = listNcNamedEffects().map((e) => e.cardId);
    expect(ids).toContain("RS-059");
    expect(getNumberComboEffect("RS-059")).toBe("future_sight");
  });

  it("lists AbarenOh zord fusion partners", () => {
    expect(listZordFusionPartnerIds("RS-050")).toEqual([
      "RS-051",
      "RS-052",
      "RS-053",
    ]);
  });

  it("lists all multi-partner zord fusion sets", () => {
    expect(listZordFusionPartnerIds("RS-034")).toEqual([
      "RS-035",
      "RS-036",
      "RS-037",
      "RS-038",
      "RS-039",
    ]);
    expect(listZordFusionPartnerIds("RS-042")).toEqual([
      "RS-043",
      "RS-044",
      "RS-045",
      "RS-046",
      "RS-047",
    ]);
    expect(listZordFusionPartnerIds("RS-056")).toEqual([
      "RS-058",
      "RS-059",
      "RS-060",
      "RS-061",
    ]);
    expect(listZordFusionPartnerIds("RS-070")).toEqual([
      "RS-057",
      "RS-058",
      "RS-059",
      "RS-060",
      "RS-061",
    ]);
    expect(listZordFusionPartnerIds("RS-073")).toEqual(["RS-074", "RS-075"]);
    expect(listZordFusionPartnerIds("RS-095")).toEqual([
      "RS-096",
      "RS-097",
      "RS-098",
    ]);
    expect(listZordFusionPartnerIds("RS-112")).toEqual(["RS-115", "RS-114"]);
    expect(listZordFusionPartnerIds("RS-113")).toEqual(["RS-057", "RS-114"]);
  });
});
