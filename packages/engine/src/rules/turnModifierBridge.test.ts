import { describe, expect, it } from "vitest";
import {
  addComboNumberDelta,
  getComboNumberDelta,
  setSComboFinisher,
  getSComboFinisher,
} from "../rules/turnModifierBridge";

describe("turnModifierBridge", () => {
  const basePlayer = {
    id: "player1" as const,
    deck: [],
    hand: [],
    discard: [],
    power: [],
    command: [],
    rush: [],
    battle: [],
    operation: [],
    exile: [],
    commander: [],
    damage: 0,
  };

  it("tracks combo number delta via modifiers", () => {
    const player = addComboNumberDelta(basePlayer, 2);
    expect(getComboNumberDelta(player)).toBe(2);
  });

  it("tracks s combo finisher via modifiers", () => {
    const player = setSComboFinisher(basePlayer, "goren_storm", "RS-001");
    expect(getSComboFinisher(player)).toBe("goren_storm");
  });
});
