import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { tryResolveDslTriggeredEffects } from "../dsl/triggerResolver";
import { createTestState, inst } from "../testing/fixtures";
import { powerCards } from "../testing/gameplayFlow";
import {
  applyCastoffDeckRush,
  castoffTargetNameForCard,
  continueCastoffAfterHold,
} from "./castoff";

const defs = Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c]));
const testDefs = { ...createTestState().definitions, ...defs };

describe("castoff on rush (XG2-064)", () => {
  it("resolves castoff target name from DSL", () => {
    expect(castoffTargetNameForCard("XG2-064")).toBe("仮面ライダーカブトRF");
  });

  it("opens OT command hold after MF rushes", () => {
    const mf = inst("XG2-064", "mf");
    const otCmd = inst("TST-OP-OT", "ot-cmd");
    const state = createTestState({
      phase: "rush",
      definitions: testDefs,
      player1: {
        rush: [mf],
        command: [otCmd],
        power: powerCards(5),
      },
    });

    const triggered = tryResolveDslTriggeredEffects({
      state,
      cardId: "XG2-064",
      instanceId: mf.instanceId,
      playerId: "player1",
      phasePlayerId: "player1",
      triggerType: "on_rush",
    });

    expect(triggered.handled).toBe(true);
    expect(triggered.state.pendingEffectChoice?.effectId).toBe("castoff_hold_command");
    expect(triggered.state.pendingEffectChoice?.validInstanceIds).toContain(otCmd.instanceId);
  });

  it("rushes RF from deck using MF as send_s_unit_to_power material", () => {
    const mf = inst("XG2-064", "mf");
    const rf = inst("RK-065", "rf");
    const otCmd = inst("TST-OP-OT", "ot-cmd");
    const state = createTestState({
      phase: "rush",
      definitions: testDefs,
      player1: {
        rush: [mf],
        command: [{ ...otCmd, commandHeld: true }],
        deck: [rf],
        power: powerCards(5),
      },
    });

    const afterHold = continueCastoffAfterHold(state, {
      playerId: "player1",
      effectId: "castoff_hold_command",
      sourceCardId: "XG2-064",
      sourceInstanceId: mf.instanceId,
      phasePlayerId: "player1",
      kind: "select_command",
      validInstanceIds: [otCmd.instanceId],
      selectCount: 1,
      optional: true,
      commandAction: "hold",
      castoffTargetName: "仮面ライダーカブトRF",
      castoffMfInstanceId: mf.instanceId,
      selectedInstanceIds: [otCmd.instanceId],
    });
    expect(afterHold?.pendingEffectChoice?.effectId).toBe("castoff_deck_rush");
    expect(afterHold?.pendingEffectChoice?.validInstanceIds).toContain(rf.instanceId);

    const rushed = applyCastoffDeckRush(
      afterHold!,
      "player1",
      rf.instanceId,
      mf.instanceId,
      "player1",
    );
    expect(rushed).not.toBeNull();
    const player = rushed!.state.players.player1;
    expect(player.rush.some((c) => c.instanceId === rf.instanceId)).toBe(true);
    expect(player.rush.some((c) => c.instanceId === mf.instanceId)).toBe(false);
    expect(player.power.some((c) => c.instanceId === mf.instanceId)).toBe(true);
    expect(player.deck).toHaveLength(0);
  });
});

describe("castoff on rush (XG3-065 → XG3-066, 7- zord down)", () => {
  it("resolves castoff target name from DSL", () => {
    expect(castoffTargetNameForCard("XG3-065")).toBe("仮面ライダーサソードRF");
  });

  it("rushes RF from deck at 0 power using MF as zord_down_send_to_power material", () => {
    const mf = inst("XG3-065", "mf");
    const rf = inst("XG3-066", "rf");
    const otCmd = inst("TST-OP-OT", "ot-cmd");
    const state = createTestState({
      phase: "rush",
      definitions: testDefs,
      player1: {
        rush: [mf],
        command: [{ ...otCmd, commandHeld: true }],
        deck: [rf],
        power: powerCards(2),
      },
    });

    const afterHold = continueCastoffAfterHold(state, {
      playerId: "player1",
      effectId: "castoff_hold_command",
      sourceCardId: "XG3-065",
      sourceInstanceId: mf.instanceId,
      phasePlayerId: "player1",
      kind: "select_command",
      validInstanceIds: [otCmd.instanceId],
      selectCount: 1,
      optional: true,
      commandAction: "hold",
      castoffTargetName: "仮面ライダーサソードRF",
      castoffMfInstanceId: mf.instanceId,
      selectedInstanceIds: [otCmd.instanceId],
    });
    expect(afterHold?.pendingEffectChoice?.effectId).toBe("castoff_deck_rush");
    expect(afterHold?.pendingEffectChoice?.validInstanceIds).toContain(rf.instanceId);

    const rushed = applyCastoffDeckRush(
      afterHold!,
      "player1",
      rf.instanceId,
      mf.instanceId,
      "player1",
    );
    expect(rushed).not.toBeNull();
    const player = rushed!.state.players.player1;
    expect(player.rush.some((c) => c.cardId === "XG3-066")).toBe(true);
    expect(player.power.some((c) => c.cardId === "XG3-065")).toBe(true);
    expect(player.power.filter((c) => c.cardId === "TST-P")).toHaveLength(2);
    expect(player.deck).toHaveLength(0);
  });
});
