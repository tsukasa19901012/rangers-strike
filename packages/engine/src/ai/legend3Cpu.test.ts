import { describe, expect, it } from "vitest";
import { legend1Catalog, legend2Catalog, legend3Catalog } from "@rangers-strike/cards";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { isCpuTurn, pickCpuAction } from "./level1";
import { pickCpuFallbackAction } from "./helpers";
import { createTestState, inst } from "../testing/fixtures";

const defs = {
  ...Object.fromEntries(
    [...legend1Catalog.cards, ...legend2Catalog.cards, ...legend3Catalog.cards].map(
      (card) => [card.id, card],
    ),
  ),
  "TST-P": {
    id: "TST-P",
    name: "Test Power",
    type: "power",
    category: "OT",
    rarity: "C",
    expansion: "legend1",
    powerCost: 0,
    bp: 0,
    sp: 0,
  },
  "TST-OP-DA": {
    id: "TST-OP-DA",
    name: "DA Command",
    type: "command",
    category: "DA",
    rarity: "C",
    expansion: "legend1",
    powerCost: 0,
    bp: 0,
    sp: 0,
  },
};

function runCpuUntilStable(
  initial: ReturnType<typeof createTestState>,
  cpuPlayer: "player1" | "player2" = "player2",
  maxSteps = 40,
): { state: ReturnType<typeof createTestState>; steps: number } {
  let state = initial;
  let steps = 0;
  while (steps < maxSteps && !state.winner && isCpuTurn(state, cpuPlayer)) {
    const action =
      pickCpuAction(state, cpuPlayer) ?? pickCpuFallbackAction(state, cpuPlayer);
    expect(action, `CPU stuck at step ${steps}`).not.toBeNull();
    const result = applyAction(state, action!);
    expect(result.ok, `CPU action failed: ${result.error}`).toBe(true);
    state = result.state;
    steps += 1;
  }
  return { state, steps };
}

describe("legend3 CPU", () => {
  it("resolves RS-165 hand discard and enters battle", () => {
    const wolf = inst("RS-165", "wolf");
    const hand1 = inst("TST-P", "h1");
    const hand2 = inst("TST-OP-DA", "h2");
    const initial = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player2: {
        rush: [wolf],
        hand: [hand1, hand2],
      },
    });

    const { state } = runCpuUntilStable(initial, "player2", 10);
    expect(state.pendingEffectChoice).toBeUndefined();
    expect(
      state.players.player2.battle.some((c) => c.cardId === "RS-165") ||
        state.players.player2.battleEntryHandDiscardReady === true,
    ).toBe(true);
  });

  it("resolves RS-132 rush discard before battle entry", () => {
    const cannon = inst("RS-132", "cannon");
    const silver = inst("RS-079", "silver");
    const initial = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player2: {
        rush: [cannon, silver],
      },
    });

    const first = pickCpuAction(initial, "player2");
    expect(first?.type).toBe("move_to_battle");

    const { state } = runCpuUntilStable(initial, "player2", 8);
    expect(state.pendingEffectChoice).toBeUndefined();
    expect(state.players.player2.battle.some((c) => c.cardId === "RS-132")).toBe(true);
  });

  it("handles end_turn_menu without freezing", () => {
    const jet = inst("RS-138", "jet");
    const initial = createTestState({
      definitions: defs,
      phase: "end",
      activePlayer: "player2",
      player2: {
        battle: [jet],
      },
      player1: {
        pendingEffectChoice: undefined,
      },
    });
    const withMenu = {
      ...initial,
      pendingEffectChoice: {
        playerId: "player2" as const,
        effectId: "end_turn_effects",
        sourceCardId: "RS-138",
        kind: "end_turn_menu" as const,
        phasePlayerId: "player2" as const,
        validInstanceIds: ["RS-138:jet"],
        optional: true,
      },
    };

    const action = pickCpuAction(withMenu, "player2");
    expect(
      action?.type === "skip_effect_choice" ||
        (action?.type === "resolve_effect_choice" && action.instanceId === "RS-138:jet"),
    ).toBe(true);
  });

  it("pickCpuFallbackAction returns skip for optional pending choice", () => {
    const initial = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player2: {
        battle: [inst("RS-138", "jet")],
      },
    });
    const withJet = {
      ...initial,
      pendingEffectChoice: {
        playerId: "player2" as const,
        effectId: "jet_skateboard",
        sourceCardId: "RS-138",
        sourceInstanceId: "RS-138:jet",
        kind: "select_unit" as const,
        phasePlayerId: "player2" as const,
        validInstanceIds: ["RS-138:jet"],
        optional: true,
      },
    };

    const fallback = pickCpuFallbackAction(withJet, "player2");
    expect(fallback?.type).toBe("skip_effect_choice");
  });

  it("sagas_sniper scry picks only eligible deck card", () => {
    const initial = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player2: {
        deck: [
          inst("RS-079", "cheap"),
          inst("RS-135", "expensive"),
        ],
      },
    });
    const withPending = {
      ...initial,
      pendingEffectChoice: {
        playerId: "player2" as const,
        effectId: "sagas_sniper",
        sourceCardId: "RS-178",
        kind: "scry_keep_one" as const,
        phasePlayerId: "player2" as const,
        viewedInstanceIds: ["RS-079:cheap", "RS-135:expensive"],
        validInstanceIds: ["RS-079:cheap"],
        maxPowerCost: 2,
        optional: true,
      },
    };

    const actions = getLegalActions(withPending).filter((a) => a.playerId === "player2");
    const action = pickCpuAction(withPending, "player2");
    expect(action?.type).toBe("resolve_effect_choice");
    if (action?.type === "resolve_effect_choice") {
      expect(action.instanceId).toBe("RS-079:cheap");
    }
    expect(actions.some((a) => a.type === "resolve_effect_choice")).toBe(true);
  });

  it("prioritizes mandatory battle entry over end_phase", () => {
    const unit = inst("RS-138", "must-enter");
    const state = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player1: {
        operation: [{ ...inst("RS-022", "earth"), cardId: "RS-022" }],
      },
      player2: {
        rush: [unit],
      },
    });

    const actions = getLegalActions(state);
    const action = pickCpuAction(state, "player2");
    expect(action?.type).toBe("move_to_battle");
    expect(actions.some((a) => a.type === "end_phase")).toBe(false);
  });

  it("completes CPU turns with legend3 pending choices without freezing", () => {
    const initial = createTestState({
      definitions: defs,
      phase: "battle",
      activePlayer: "player2",
      player2: {
        rush: [inst("RS-165", "wolf")],
        hand: [inst("TST-P", "h1"), inst("TST-OP-DA", "h2")],
      },
    });

    const { steps, state } = runCpuUntilStable(initial, "player2", 12);
    expect(steps).toBeGreaterThan(0);
    expect(state.pendingEffectChoice).toBeUndefined();
  });
});
