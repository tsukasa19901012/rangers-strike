import { describe, expect, it } from "vitest";
import { applyAction } from "./core/applyAction";
import { legendDefinitions } from "./testing/battleEntry";
import { createTestState, inst } from "./testing/fixtures";
import {
  buildBattleEntryPayment,
  buildPaymentFromInitiateAction,
  getBattleEntryPaymentNeeds,
} from "./rules/commandPayment";
describe("command payment", () => {
  it("starts battle entry payment when holds are short", () => {
    const unit = inst("RS-053", "ptera");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [unit],
        command: [inst("RS-007", "cmd")],
      },
    });

    expect(getBattleEntryPaymentNeeds(state, "player1", unit)).toEqual({
      eligibleNeeded: 1,
      totalNeeded: 1,
    });

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "battle_entry",
      sourceInstanceId: unit.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.state.pendingCommandPayment?.totalNeeded).toBe(1);

    const resolved = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: [state.players.player1.command[0]!.instanceId],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players.player1.battle.some((c) => c.instanceId === unit.instanceId)).toBe(
      true,
    );
    expect(resolved.state.pendingCommandPayment).toBeUndefined();
  });

  it("rejects mothership-only hold for RS-053 battle entry payment", () => {
    const unit = inst("RS-053", "ptera");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [unit],
        command: [
          {
            ...inst("RS-007", "cmd"),
            commandHeld: true,
            mothershipHold: true,
          },
        ],
      },
    });

    expect(buildBattleEntryPayment(state, "player1", unit)).toBeNull();
    expect(
      buildPaymentFromInitiateAction(state, {
        type: "initiate_command_payment",
        playerId: "player1",
        kind: "battle_entry",
        sourceInstanceId: unit.instanceId,
      }),
    ).toBeNull();
  });

  it("pays category hold then rushes", () => {
    const unit = inst("TST-UNIT-0", "unit");
    const cmd = inst("TST-OP", "cmd");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        command: [cmd],
      },
    });

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: unit.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const resolved = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: [cmd.instanceId],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players.player1.rush.some((c) => c.instanceId === unit.instanceId)).toBe(
      true,
    );
  });
});
