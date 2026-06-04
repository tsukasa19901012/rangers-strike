import { describe, expect, it } from "vitest";
import {
  mothershipHoldsRequiredForRush,
  zordSlotsFilledByMaterial,
} from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import {
  applyMothershipHolds,
  collectMothershipEligibleCommands,
} from "./rules/mothership";
import { createTestState, heldEtCommand, heldOtCommand, inst } from "./testing/fixtures";

describe("jaguar mothership (RS-076)", () => {
  const rs075Def = {
    id: "RS-075",
    name: "ブルバルカン",
    type: "unit" as const,
    category: "ET" as const,
    rarity: "N" as const,
    expansion: "legend2",
    powerCost: "5+" as const,
    bp: 5000,
    size: "M" as const,
  };

  it("allows rushing RS-075 by holding ET command when RS-076 is in rush", () => {
    const zord = inst("RS-075", "rush-zord");
    const mothership = inst("RS-076", "mothership");
    const etCmd = { ...inst("TST-OP-ET", "et-cmd"), commandHeld: false };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [mothership],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldEtCommand("held"), etCmd],
        rushCategoryHoldReady: true,
      },
    });
    state.definitions["RS-075"] = rs075Def;

    const result = applyAction(state, {
      type: "rush",
      playerId: "player1",
      instanceId: zord.instanceId,
      zordMothershipHoldInstanceIds: [etCmd.instanceId],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.state.players.player1;
    expect(p.rush.some((c) => c.cardId === "RS-075")).toBe(true);
    expect(p.command.find((c) => c.instanceId === etCmd.instanceId)?.commandHeld).toBe(
      true,
    );
  });

  it("works when command zone is full (Q4)", () => {
    const zord = inst("RS-075", "rush-zord");
    const mothership = inst("RS-076", "mothership");
    const commands = Array.from({ length: 5 }, (_, i) => ({
      ...inst("TST-OP-ET", `et-${i}`),
      commandHeld: i === 0,
    }));
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [mothership],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: commands,
      },
    });
    state.definitions["RS-075"] = rs075Def;

    const canPayWithMothership = getLegalActions(state).some(
      (a) =>
        a.type === "begin_zord_setup" && a.zordInstanceId === zord.instanceId,
    );
    expect(canPayWithMothership).toBe(true);
  });

  it("does not apply to send_s_unit_to_discard zords (Q5)", () => {
    const zord = inst("RS-096", "rush-zord");
    const mothership = inst("RS-076", "mothership");
    const etCmd = { ...inst("TST-OP-ET", "et-cmd"), commandHeld: false };
    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [mothership],
        power: Array.from({ length: 4 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldEtCommand("held"), etCmd],
      },
    });
    state.definitions["RS-096"] = {
      id: "RS-096",
      name: "ハリケンホーク",
      type: "unit",
      category: "MA",
      rarity: "N",
      expansion: "legend2",
      powerCost: "4+",
      bp: 5000,
      size: "M",
    };

    const mothershipRush = getLegalActions(state).filter(
      (a) =>
        a.type === "rush" &&
        a.instanceId === zord.instanceId &&
        (a.zordMothershipHoldInstanceIds?.length ?? 0) > 0,
    );
    expect(mothershipRush).toHaveLength(0);
  });

  it("Q3: can hold ET command placed in rush (gallery-style)", () => {
    const etCmd = { ...inst("TST-OP-ET", "cmd-rush"), commandHeld: false };
    const state = createTestState({
      player1: {
        rush: [etCmd],
        command: [heldEtCommand("held")],
      },
    });

    const eligible = collectMothershipEligibleCommands(
      state.players.player1,
      state.definitions,
      "ET",
    );
    expect(eligible.some((e) => e.zone === "rush" && e.card.instanceId === etCmd.instanceId)).toBe(
      true,
    );

    const after = applyMothershipHolds(state.players.player1, state.definitions, [
      etCmd.instanceId,
    ], "jaguar");
    expect(after?.rush.find((c) => c.instanceId === etCmd.instanceId)?.commandHeld).toBe(
      true,
    );
  });

  it("Q7: S to command as material needs no extra mothership holds", () => {
    expect(zordSlotsFilledByMaterial("RS-075", true, "command")).toBe(1);
    expect(mothershipHoldsRequiredForRush("RS-075", 1)).toBe(0);
  });

  it("RS-010 prism cannot substitute mothership holds (Q2)", () => {
    const zord = inst("RS-075", "rush-zord");
    const mothership = inst("RS-076", "mothership");
    const prism = inst("RS-010", "prism");
    const cmd1 = { ...inst("TST-OP-ET", "c1"), commandHeld: true };
    const cmd2 = { ...inst("TST-OP-ET", "c2"), commandHeld: true };
    const etPay = { ...inst("TST-OP-ET", "pay"), commandHeld: false };
    const etMothership = { ...inst("TST-OP-ET", "mship"), commandHeld: false };

    const state = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [mothership],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [cmd1, cmd2, etPay, etMothership],
        operation: [prism],
      },
    });
    state.definitions["RS-075"] = rs075Def;
    state.definitions["RS-010"] = {
      id: "RS-010",
      name: "プリズムパワー",
      type: "operation",
      category: "OT",
      rarity: "R",
      expansion: "test",
      powerCost: 2,
      tags: ["常駐"],
    };

    const mothershipPay = getLegalActions(state).filter(
      (a) =>
        a.type === "begin_zord_setup" && a.zordInstanceId === zord.instanceId,
    );
    expect(mothershipPay.length).toBeGreaterThan(0);

    const prismOnlyHeld = createTestState({
      phase: "rush",
      player1: {
        hand: [zord],
        rush: [mothership],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [cmd1, cmd2],
        operation: [prism],
      },
    });
    prismOnlyHeld.definitions["RS-075"] = rs075Def;
    prismOnlyHeld.definitions["RS-010"] = state.definitions["RS-010"];

    const noMothershipPay = getLegalActions(prismOnlyHeld).filter(
      (a) =>
        a.type === "initiate_command_payment" &&
        a.kind === "category_use" &&
        a.sourceInstanceId === zord.instanceId &&
        (a.zordMothershipHoldInstanceIds?.length ?? 0) > 0 &&
        !a.zordMaterialInstanceId,
    );
    expect(noMothershipPay).toHaveLength(0);
  });
});

describe("dekabase mothership (RS-105)", () => {
  const defs = {
    "RS-046": {
      id: "RS-046",
      name: "パトアーマー",
      type: "unit" as const,
      category: "OT" as const,
      rarity: "N" as const,
      expansion: "legend1",
      powerCost: "5+" as const,
      bp: 5000,
      size: "M" as const,
    },
    "RS-105": {
      id: "RS-105",
      name: "デカベースクローラー",
      type: "unit" as const,
      category: "OT" as const,
      rarity: "N" as const,
      expansion: "legend2",
      powerCost: 5,
      bp: 5000,
      size: "L" as const,
    },
    "TST-OP-OT": {
      id: "TST-OP-OT",
      name: "Test OT Command",
      type: "operation" as const,
      category: "OT" as const,
      rarity: "R" as const,
      expansion: "test",
      powerCost: 1,
    },
    "TST-P": {
      id: "TST-P",
      name: "Test Power",
      type: "operation" as const,
      category: "WB" as const,
      rarity: "N" as const,
      expansion: "test",
      powerCost: 0,
    },
  };

  it("allows RS-046 rush via OT command hold when RS-105 is in rush", () => {
    const zord = inst("RS-046", "rush-zord");
    const mothership = inst("RS-105", "mothership");
    const sUnit = inst("RS-080", "s1");
    const otCmd = { ...inst("TST-OP-OT", "ot-cmd"), commandHeld: false };
    const state = createTestState({
      phase: "rush",
      definitions: {
        ...defs,
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
        rush: [mothership, sUnit],
        power: Array.from({ length: 5 }, (_, i) => inst("TST-P", `p${i}`)),
        command: [heldOtCommand("held"), otCmd],
        rushCategoryHoldReady: true,
      },
    });

    const result = applyAction(state, {
      type: "rush",
      playerId: "player1",
      instanceId: zord.instanceId,
      zordMothershipHoldInstanceIds: [otCmd.instanceId],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.state.players.player1.command.find((c) => c.instanceId === otCmd.instanceId)
        ?.commandHeld,
    ).toBe(true);
    expect(result.state.players.player1.rush.some((c) => c.cardId === "RS-046")).toBe(true);
  });
});
