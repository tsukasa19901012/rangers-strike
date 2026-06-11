import { describe, expect, it } from "vitest";
import { corePlayableCatalog } from "./catalog/unifiedCatalog";
import {
  findNcNamedEffect,
  getBattleEntryHoldCount,
  getUnitEffectBlock,
  hasBattleEntryHoldNote,
  hasDestroySelfDamageNote,
  hasUnnamedRule,
  listBattleEntryHoldCardIds,
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
    expect(block?.unnamedText.every((u) => u.rule !== undefined)).toBe(true);
    expect(hasDestroySelfDamageNote("RS-054")).toBe(true);
    expect(hasUnnamedRule("RS-054", "auto_battle_entry_each_turn")).toBe(true);
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

  it("detects battle entry hold via structured rule on RS-052", () => {
    const block = getUnitEffectBlock("RS-052");
    expect(block?.unnamedText[0]?.rule).toBe("battle_entry_hold");
    expect(block?.unnamedText[0]?.holdCount).toBe(1);
    expect(hasBattleEntryHoldNote("RS-052")).toBe(true);
    expect(getBattleEntryHoldCount("RS-052")).toBe(1);
  });

  it("lists battle entry hold cards from rules only", () => {
    expect(listBattleEntryHoldCardIds()).toEqual([
      "RS-035",
      "RS-036",
      "RS-037",
      "RS-038",
      "RS-039",
      "RS-051",
      "RS-052",
      "RS-053",
      "RS-152",
      "RS-153",
      "RS-154",
      "RS-155",
      "RS-156",
      "RS-157",
      "RS-158",
      "RS-159",
      "RS-167",
      "RS-168",
    ]);
  });
});

describe("unnamedText rule coverage", () => {
  it("assigns a rule id to every note line in core registry blocks", () => {
    const missing: string[] = [];
    for (const card of corePlayableCatalog.cards) {
      const block = getUnitEffectBlock(card.id);
      if (!block) continue;
      for (const entry of block.unnamedText) {
        if (entry.kind !== "note") continue;
        if (!entry.rule) {
          missing.push(`${card.id}: ${entry.text}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
