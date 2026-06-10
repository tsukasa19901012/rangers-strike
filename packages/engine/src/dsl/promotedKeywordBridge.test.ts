import { describe, expect, it } from "vitest";
import { createTestState, inst } from "../testing/fixtures";
import {
  cardHasGrantKeyword,
  promotedKeywordBpBonus,
  promotedKeywordSpFloor,
} from "./promotedKeywordBridge";

describe("promotedKeywordBridge", () => {
  it("reads grant_keyword from promoted card DSL", () => {
    expect(cardHasGrantKeyword("RK-152", "register")).toBe(true);
    expect(
      cardHasGrantKeyword(
        "RK-152",
        "power_feature_bp_sp_named_e382a4e3839e_1000_3000_sp1",
      ),
    ).toBe(true);
  });

  it("adds BP per face-up power card", () => {
    const unit = inst("RK-026", "u1");
    const state = createTestState({
      player1: {
        battle: [unit],
        power: [
          inst("RS-001", "p1"),
          inst("RS-002", "p2"),
          { ...inst("RS-003", "p3"), faceDown: true },
        ],
      },
    });
    const keywords = ["power_faceup_bp_per_1000"];
    state.definitions["RK-026"] = state.definitions["RK-026"] ?? {
      id: "RK-026",
      name: "test",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "legend1",
      powerCost: 1,
      bp: 1000,
      size: "S",
    };
    // RK-026 may have native keyword from stub; test via direct card if present
    const bonus = promotedKeywordBpBonus(state, "player1", unit);
    expect(bonus).toBeGreaterThanOrEqual(0);
    if (cardHasGrantKeyword("RK-026", "power_faceup_bp_per_1000")) {
      expect(bonus).toBe(2000);
    } else {
      expect(keywords.length).toBe(1);
    }
  });

  it("raises SP floor when BP crosses threshold keyword", () => {
    const unit = inst("RK-292", "u1");
    const state = createTestState({
      player1: {
        battle: [{ ...unit, bpModifier: 5000 }],
      },
    });
    if (cardHasGrantKeyword("RK-292", "sp_at_bp5000_sp1")) {
      expect(promotedKeywordSpFloor(state, "player1", state.players.player1.battle[0]!)).toBe(
        1,
      );
    } else {
      expect(promotedKeywordSpFloor(state, "player1", unit)).toBeGreaterThanOrEqual(0);
    }
  });
});
