import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
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

  it("holds call unit through full rush category payment flow", () => {
    const callUnit = inst("XG7-016", "call-1");
    const rushHand = inst("TST-UNIT-2", "rush-hand");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [rushHand],
        rush: [callUnit],
        command: [{ ...inst("TST-OP", "cmd-wb"), commandHeld: false }],
        power: Array.from({ length: 5 }, (_, i) => inst("RS-011", `p${i}`)),
      },
    });

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: rushHand.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const paid = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: [callUnit.instanceId],
    });
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;

    expect(
      paid.state.players.player1.rush.find((c) => c.instanceId === callUnit.instanceId)
        ?.commandHeld,
    ).toBe(true);
    expect(
      paid.state.players.player1.rush.some((c) => c.instanceId === rushHand.instanceId),
    ).toBe(true);
  });

  it("keeps call/lead field holds through start phase command release", () => {
    const callUnit = { ...inst("XG7-016", "call-1"), commandHeld: true };
    const cmd = { ...inst("TST-OP", "c1"), commandHeld: true };
    let state = createTestState({
      phase: "start",
      player1: {
        command: [cmd],
        rush: [callUnit],
        deck: [inst("TST-OP", "d1")],
        hand: [],
        hasReturnedBattleThisStart: true,
      },
    });

    state = unwrap(
      applyAction(state, { type: "draw", playerId: "player1" }),
    );
    state = unwrap(
      applyAction(state, { type: "release_start_commands", playerId: "player1" }),
    );

    expect(state.players.player1.command[0]?.commandHeld).toBe(false);
    expect(state.players.player1.rush[0]?.commandHeld).toBe(true);
  });
});

function unwrap<T extends { ok: boolean }>(
  result: T,
): T extends { ok: true; state: infer S } ? S : never {
  if (!result.ok) throw new Error("expected ok");
  return (result as { ok: true; state: unknown }).state as never;
}
