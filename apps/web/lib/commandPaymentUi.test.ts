import { describe, expect, it } from "vitest";
import {
  canConfirmCommandPayment,
  commandPaymentHint,
  commandPaymentZoneHint,
  toggleCommandPaymentSelection,
} from "./commandPaymentUi";

const basePending = {
  playerId: "player1" as const,
  kind: "effect_hold" as const,
  sourceCardId: "RS-127",
  sourceInstanceId: "RS-127:unit",
  totalNeeded: 2,
  eligibleNeeded: 2,
  validInstanceIds: ["cmd-1", "cmd-2", "cmd-3"],
  continuation: { type: "effect_choice" as const },
};

const baseView = {
  kind: "effect_hold" as const,
  sourceCardId: "RS-127",
  sourceCardName: "バイオ粒子斬り",
  selectCount: 2,
  eligibleSelectMin: 2,
  categories: [] as string[],
  prismSubstitute: false,
  prismAvailable: false,
  validInstanceIds: ["cmd-1", "cmd-2", "cmd-3"],
  consumeOnConfirm: false,
  allowRushZoneCommands: false,
};

describe("commandPaymentUi", () => {
  it("builds effect hold hint with selection count", () => {
    expect(commandPaymentHint(basePending, baseView, 1)).toContain("バイオ粒子斬り");
    expect(commandPaymentHint(basePending, baseView, 1)).toContain("1/2");
  });

  it("describes rush zone selection for mothership hold", () => {
    expect(
      commandPaymentZoneHint({ ...baseView, kind: "mothership_hold", allowRushZoneCommands: true }),
    ).toContain("ラッシュ");
    expect(commandPaymentZoneHint(baseView)).toContain("コマンドゾーン");
  });

  it("toggles command selection up to required count", () => {
    expect(toggleCommandPaymentSelection([], "cmd-1", 2)).toEqual(["cmd-1"]);
    expect(toggleCommandPaymentSelection(["cmd-1"], "cmd-2", 2)).toEqual(["cmd-1", "cmd-2"]);
    expect(toggleCommandPaymentSelection(["cmd-1", "cmd-2"], "cmd-3", 2)).toEqual([
      "cmd-1",
      "cmd-2",
    ]);
    expect(toggleCommandPaymentSelection(["cmd-1", "cmd-2"], "cmd-1", 2)).toEqual(["cmd-2"]);
  });

  it("confirms only when required count is met", () => {
    expect(canConfirmCommandPayment(["cmd-1"], 2)).toBe(false);
    expect(canConfirmCommandPayment(["cmd-1", "cmd-2"], 2)).toBe(true);
  });
});
