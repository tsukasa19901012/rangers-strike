import { describe, expect, it } from "vitest";
import {
  mothershipHoldsRequiredForRush,
  mothershipKindForZordRush,
  MOTHERSHIP_CONFIG,
  zordSlotsFilledByMaterial,
} from "./mothership";

describe("mothership", () => {
  it("jaguar applies to send_s_unit_to_command_or_discard M zords", () => {
    expect(
      mothershipKindForZordRush("RS-075", [MOTHERSHIP_CONFIG.jaguar.cardId]),
    ).toBe("jaguar");
    expect(mothershipKindForZordRush("RS-096", [MOTHERSHIP_CONFIG.jaguar.cardId])).toBe(
      null,
    );
  });

  it("dekabase applies to send_s_unit_to_power M zords", () => {
    expect(
      mothershipKindForZordRush("RS-046", [MOTHERSHIP_CONFIG.dekabase.cardId]),
    ).toBe("dekabase");
  });

  it("partial mothership holds after S material (Q7)", () => {
    expect(zordSlotsFilledByMaterial("RS-075", true, "command")).toBe(1);
    expect(zordSlotsFilledByMaterial("RS-075", true, "discard")).toBe(1);
    expect(mothershipHoldsRequiredForRush("RS-075", 1)).toBe(0);
    expect(mothershipHoldsRequiredForRush("RS-075", 0)).toBe(1);
  });
});
