import { describe, expect, it } from "vitest";
import {
  collectCallLeadFieldUnits,
  holdPaymentSource,
  paymentSourceMatchesCategories,
  unitHasCallLeadKeyword,
} from "./callLead";
import { getCategoryPaymentOptions, applyPaymentHolds } from "./commandPayment";
import { createTestState, inst } from "../testing/fixtures";

describe("callLead", () => {
  it("detects call_ET on field units for rush payment", () => {
    const callUnit = inst("XG7-016", "call-1");
    expect(unitHasCallLeadKeyword("XG7-016", "call", "WB")).toBe(true);

    const player = {
      ...createTestState().players.player1,
      command: [{ ...inst("TST-OP", "cmd-wb"), commandHeld: false }],
      rush: [callUnit],
    };
    const base = createTestState();
    const state = {
      ...base,
      players: { ...base.players, player1: player },
    };

    const options = getCategoryPaymentOptions(state, "player1", ["WB"], {
      perRushPayment: true,
      callLeadKind: "call",
    });
    expect(options).not.toBeNull();
    expect(options?.selectCount).toBe(1);

    const held = applyPaymentHolds(state, "player1", [callUnit.instanceId]);
    expect(held.players.player1.rush[0]?.commandHeld).toBe(true);
  });

  it("matches payment source categories for call units", () => {
    const base = createTestState();
    const player = base.players.player1;
    const callUnit = { ...inst("XG7-016", "call-1") };
    const withRush = { ...player, rush: [callUnit] };
    expect(
      paymentSourceMatchesCategories(
        withRush,
        base.definitions,
        callUnit.instanceId,
        ["WB"],
        "call",
      ),
    ).toBe(true);
    expect(collectCallLeadFieldUnits(withRush, base.definitions, "call", ["WB"]).length).toBe(
      1,
    );
    const held = holdPaymentSource(withRush, callUnit.instanceId);
    expect(held.rush[0]?.commandHeld).toBe(true);
  });
});
