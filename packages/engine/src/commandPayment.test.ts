import { describe, expect, it } from "vitest";
import type { GameState } from "./types/game";
import { applyAction } from "./core/applyAction";
import { legendDefinitions } from "./testing/battleEntry";
import { getLegalActions } from "./core/legalActions";
import { createTestState, inst, TEST_DEFINITIONS } from "./testing/fixtures";
import {
  buildBattleEntryPayment,
  buildEffectHoldPayment,
  buildMothershipHoldPayment,
  buildPaymentFromInitiateAction,
  explainCannotRush,
  getBattleEntryPaymentNeeds,
} from "./rules/commandPayment";
import { advanceZordSetup } from "./rules/zordSetup";
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
    expect(resolved.state.players.player1.command[0]?.commandHeld).toBe(true);
    expect(resolved.state.pendingCommandPayment).toBeUndefined();
  });

  it("requires 2 holds for RS-053 battle entry when one RS-069 is active", () => {
    const unit = inst("RS-053", "ptera");
    const gravity = inst("RS-069", "lg");
    const state = createTestState({
      definitions: legendDefinitions,
      phase: "battle",
      player1: {
        rush: [unit],
        operation: [gravity],
        command: [inst("RS-007", "c1"), inst("RS-008", "c2")],
      },
    });

    expect(getBattleEntryPaymentNeeds(state, "player1", unit)).toEqual({
      eligibleNeeded: 1,
      totalNeeded: 2,
    });
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

  it("requires a new category hold for each rush", () => {
    const unit1 = inst("TST-UNIT-0", "u1");
    const unit2 = inst("TST-UNIT-0", "u2");
    const cmd = inst("TST-OP", "cmd");
    let state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit1, unit2],
        command: [cmd],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3")],
      },
    });

    const first = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: unit1.instanceId,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const resolved1 = applyAction(first.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: [cmd.instanceId],
    });
    expect(resolved1.ok).toBe(true);
    if (!resolved1.ok) return;
    state = resolved1.state;
    expect(state.players.player1.command[0]?.commandHeld).toBe(true);

    const secondPay = buildPaymentFromInitiateAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: unit2.instanceId,
    });
    expect(secondPay).toBeNull();
  });

  it("blocks multi-category rush when not all categories exist in command zone", () => {
    const unit = inst("TST-UNIT-WB-ET", "unit");
    const wbOnly = inst("TST-OP", "wb");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        command: [wbOnly],
      },
    });

    expect(
      getLegalActions(state).some(
        (a) =>
          a.type === "initiate_command_payment" &&
          a.kind === "category_use" &&
          a.sourceInstanceId === unit.instanceId,
      ),
    ).toBe(false);
    expect(explainCannotRush(state, "player1", unit.instanceId)).toMatch(/WB・ET/);
  });

  it("allows multi-category rush with one hold when all categories are present", () => {
    const unit = inst("TST-UNIT-WB-ET", "unit");
    const wb = inst("TST-OP", "wb");
    const et = inst("TST-OP-ET", "et");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        command: [wb, et],
      },
    });

    const payment = buildPaymentFromInitiateAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: unit.instanceId,
    });
    expect(payment?.totalNeeded).toBe(1);

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
      commandInstanceIds: [wb.instanceId],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players.player1.rush.some((c) => c.instanceId === unit.instanceId)).toBe(
      true,
    );
  });

  it("blocks prism substitute rush when multi-category command zone is incomplete", () => {
    const unit = inst("TST-UNIT-WB-ET", "unit");
    const wb1 = inst("TST-OP", "wb1");
    const wb2 = inst("TST-OP", "wb2");
    const prism = inst("RS-010", "prism");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        command: [wb1, wb2],
        operation: [prism],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3")],
      },
    });
    state.definitions["RS-010"] = {
      id: "RS-010",
      name: "Prism",
      type: "operation",
      category: "OT",
      rarity: "R",
      expansion: "test",
      powerCost: 2,
      tags: ["常駐"],
    };

    expect(
      buildPaymentFromInitiateAction(state, {
        type: "initiate_command_payment",
        playerId: "player1",
        kind: "category_use",
        sourceInstanceId: unit.instanceId,
        prismSubstitute: true,
      }),
    ).toBeNull();
  });

  it("allows multi-category rush when a single multi-category command covers all categories", () => {
    const unit = inst("TST-UNIT-WB-ET", "unit");
    const multiCmd = inst("TST-OP-WB-ET", "mc");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        command: [multiCmd],
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
      commandInstanceIds: [multiCmd.instanceId],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players.player1.rush.some((c) => c.instanceId === unit.instanceId)).toBe(
      true,
    );
  });

  it("does not blame missing OT when RS-045 can pay category and needs zord material", () => {
    const zord = inst("RS-045", "zord");
    const sUnit = inst("RS-080", "s1");
    const otCmd = inst("TST-OP-OT", "ot");
    const state = createTestState({
      phase: "rush",
      definitions: {
        ...TEST_DEFINITIONS,
        "RS-045": {
          id: "RS-045",
          name: "パトレーラー",
          type: "unit",
          category: "OT",
          rarity: "N",
          expansion: "legend1",
          powerCost: "4+",
          bp: 5000,
          size: "M",
        },
        "RS-080": {
          id: "RS-080",
          name: "S",
          type: "unit",
          category: "OT",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
        },
      },
      player1: {
        hand: [zord],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [otCmd],
      },
    });

    const reason = explainCannotRush(state, "player1", zord.instanceId);
    expect(reason).toBeNull();
  });

  it("requires zord setup before category payment for RS-045", () => {
    const zord = inst("RS-045", "zord");
    const sUnit = inst("RS-080", "s1");
    const otCmd = inst("TST-OP-OT", "ot");
    const state = createTestState({
      phase: "rush",
      definitions: {
        ...TEST_DEFINITIONS,
        "RS-045": {
          id: "RS-045",
          name: "パトレーラー",
          type: "unit",
          category: "OT",
          rarity: "N",
          expansion: "legend1",
          powerCost: "4+",
          bp: 5000,
          size: "M",
        },
        "RS-080": {
          id: "RS-080",
          name: "S",
          type: "unit",
          category: "OT",
          rarity: "N",
          expansion: "test",
          powerCost: 1,
          bp: 1000,
          size: "S",
        },
      },
      player1: {
        hand: [zord],
        rush: [sUnit],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [otCmd],
      },
    });

    const actions = getLegalActions(state);
    expect(actions.some((a) => a.type === "begin_zord_setup")).toBe(true);
    expect(
      actions.some(
        (a) =>
          a.type === "initiate_command_payment" &&
          a.kind === "category_use" &&
          a.sourceInstanceId === zord.instanceId,
      ),
    ).toBe(false);
  });

  it("explains missing category hold for rush", () => {
    const unit = inst("TST-UNIT-0", "unit");
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [unit],
        command: [],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3")],
      },
    });

    const reason = explainCannotRush(state, "player1", unit.instanceId);
    expect(reason).toContain("リリース");
    expect(reason).toContain("ラッシュ");
  });

  it("completes effect_hold payment for moss breaker style choice", () => {
    const enemyCmd = { ...inst("RS-007", "ec"), commandHeld: false };
    const state: GameState = {
      ...createTestState({
        phase: "battle",
        activePlayer: "player2",
        player1: { battle: [inst("TST-UNIT-0", "att")] },
        player2: { command: [enemyCmd] },
      }),
      pendingEffectChoice: {
        playerId: "player2",
        effectId: "moss_breaker",
        sourceCardId: "RS-040",
        kind: "select_command",
        phasePlayerId: "player1",
        validInstanceIds: [enemyCmd.instanceId],
        commandAction: "hold",
      },
    };

    expect(buildEffectHoldPayment(state)).not.toBeNull();

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player2",
      kind: "effect_hold",
      sourceInstanceId: enemyCmd.instanceId,
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const resolved = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: "player2",
      commandInstanceIds: [enemyCmd.instanceId],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.pendingEffectChoice).toBeUndefined();
    expect(resolved.state.players.player2.command[0]?.commandHeld).toBe(true);
  });

  it("zord setup advances to mothership_hold payment", () => {
    const zord = inst("RS-075", "zord");
    const mothership = inst("RS-076", "ms");
    const etCmd = { ...inst("TST-OP-ET", "et"), commandHeld: false };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [mothership],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [etCmd],
      },
    });
    state.definitions["RS-075"] = {
      id: "RS-075",
      name: "ブルバルカン",
      type: "unit",
      category: "ET",
      rarity: "N",
      expansion: "legend2",
      powerCost: "5+",
      bp: 5000,
      size: "M",
    };

    const payment = buildMothershipHoldPayment(state, "player1", {
      zordInstanceId: zord.instanceId,
      zordCardId: "RS-075",
    });
    expect(payment?.kind).toBe("mothership_hold");
    expect(payment?.validInstanceIds).toContain(etCmd.instanceId);

    const advanced = advanceZordSetup(state, {
      playerId: "player1",
      zordInstanceId: zord.instanceId,
      zordCardId: "RS-075",
      step: "mothership",
      validInstanceIds: [etCmd.instanceId],
    }, {});
    expect(advanced.kind).toBe("payment");
    if (advanced.kind !== "payment") return;
    expect(advanced.payment.kind).toBe("mothership_hold");
  });

  it("offers category payment for hold_extra_command zord-up (XG7-012)", () => {
    const zord = inst("XG7-012", "xg7");
    const wbCategory = inst("TST-WB", "wb-cmd");
    const extraOp = inst("TST-OP", "extra-op");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [zord],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3"), inst("TST-P", "p4")],
        command: [wbCategory, extraOp],
      },
    });
    state.definitions["XG7-012"] = {
      id: "XG7-012",
      name: "アバレッド×爆竜ティラノサウルス",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: "4+",
      rushAdditionalCondition: {
        conditionId: "hold_extra_command",
        text: "追加で自軍コマンドを1つホールドする",
        unitCount: 1,
      },
      bp: 5000,
      size: "M",
    };
    state.definitions["TST-WB"] = {
      id: "TST-WB",
      name: "WB Command",
      type: "operation",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 1,
    };
    state.definitions["TST-OP"] = {
      id: "TST-OP",
      name: "Extra Op",
      type: "operation",
      category: "ET",
      rarity: "N",
      expansion: "test",
      powerCost: 1,
    };

    const payment = buildPaymentFromInitiateAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: zord.instanceId,
      zordExtraCommandHoldInstanceIds: [extraOp.instanceId],
    });
    expect(payment).not.toBeNull();
    expect(payment?.continuation.type).toBe("rush");
    expect(payment?.continuation.zordExtraCommandHoldInstanceIds).toEqual([extraOp.instanceId]);

    const actions = getLegalActions(state).filter(
      (a) =>
        a.type === "initiate_command_payment" &&
        a.kind === "category_use" &&
        a.sourceInstanceId === zord.instanceId,
    );
    expect(actions.length).toBeGreaterThan(0);

    const initiated = applyAction(state, {
      type: "initiate_command_payment",
      playerId: "player1",
      kind: "category_use",
      sourceInstanceId: zord.instanceId,
      zordExtraCommandHoldInstanceIds: [extraOp.instanceId],
    });
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;

    const resolved = applyAction(initiated.state, {
      type: "resolve_command_payment",
      playerId: "player1",
      commandInstanceIds: [wbCategory.instanceId],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.state.players.player1.rush.some((c) => c.instanceId === zord.instanceId)).toBe(
      true,
    );
    expect(resolved.state.players.player1.command.find((c) => c.instanceId === wbCategory.instanceId)?.commandHeld).toBe(
      true,
    );
    expect(resolved.state.players.player1.command.find((c) => c.instanceId === extraOp.instanceId)?.commandHeld).toBe(
      true,
    );
  });

  it("explainCannotRush mentions extra command hold for XG7-012", () => {
    const zord = inst("XG7-012", "xg7");
    const state = createTestState({
      phase: "rush",
      activePlayer: "player1",
      player1: {
        hand: [zord],
        power: [inst("TST-P", "p1"), inst("TST-P", "p2"), inst("TST-P", "p3"), inst("TST-P", "p4")],
        command: [inst("TST-WB", "wb-cmd")],
      },
    });
    state.definitions["XG7-012"] = {
      id: "XG7-012",
      name: "アバレッド×爆竜ティラノサウルス",
      type: "unit",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: "4+",
      rushAdditionalCondition: {
        conditionId: "hold_extra_command",
        text: "追加で自軍コマンドを1つホールドする",
        unitCount: 1,
      },
      bp: 5000,
      size: "M",
    };
    state.definitions["TST-WB"] = {
      id: "TST-WB",
      name: "WB Command",
      type: "operation",
      category: "WB",
      rarity: "N",
      expansion: "test",
      powerCost: 1,
    };

    const reason = explainCannotRush(state, "player1", zord.instanceId);
    expect(reason).toContain("追加で自軍コマンド");
  });
});
