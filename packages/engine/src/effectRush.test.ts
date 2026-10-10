import { afterEach, describe, expect, it } from "vitest";
import { legend1Catalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import { ON_RUSH_EFFECTS } from "./rules/rushEffects";
import { createTestState, heldEtCommand, inst } from "./testing/fixtures";
import type { GameState } from "./types/game";

function def(id: string) {
  const card = legend1Catalog.cards.find((c) => c.id === id);
  if (!card) throw new Error(`missing ${id}`);
  return card;
}

function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const FX_UNIT = "TST-EFFECT-RUSH-FX";

function withDefinitions(state: GameState): GameState {
  state.definitions[FX_UNIT] = {
    id: FX_UNIT,
    name: "Effect Rush FX",
    type: "unit",
    category: "WB",
    rarity: "N",
    expansion: "test",
    powerCost: 0,
    bp: 2000,
    size: "S",
  };
  state.definitions["RS-005"] = def("RS-005");
  state.definitions["RS-026"] = def("RS-026");
  state.definitions["RS-057"] = def("RS-057");
  ON_RUSH_EFFECTS[FX_UNIT] = "draw_1";
  return state;
}

/** 疾風流超忍法（RS-026, 「ラッシュされたとき」カウンター）を撃てる相手。 */
function counterReadyOpponent() {
  return {
    hand: [inst("RS-026", "c1")],
    command: [inst("RS-057", "cmd")],
    power: [inst("TST-OP", "p2"), inst("TST-OP", "p3"), inst("TST-OP", "p4")],
  };
}

afterEach(() => {
  delete ON_RUSH_EFFECTS[FX_UNIT];
});

describe("効果ラッシュ（E11）", () => {
  it("R-RUSH-22: ランドバルカン（RS-005）で出したユニットの「ラッシュしたとき」が発動し、カウンター窓が開く", () => {
    const op = inst("RS-005", "op1");
    const sCmd = { ...inst(FX_UNIT, "cmd-s"), commandHeld: false };
    const state = withDefinitions(
      createTestState({
        phase: "rush",
        player1: {
          hand: [op],
          deck: [inst("TST-OP", "deck1"), inst("TST-OP", "deck2")],
          power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
          command: [sCmd, heldEtCommand("held")],
        },
        player2: counterReadyOpponent(),
      }),
    );

    const action = getLegalActions(state).find(
      (a) => a.type === "play_operation" && a.instanceId === op.instanceId,
    );
    expect(action).toBeDefined();
    const next = unwrap(applyAction(state, action!));

    expect(next.players.player1.rush.some((c) => c.instanceId === sCmd.instanceId)).toBe(true);
    // 「ラッシュしたとき」1枚ドロー
    expect(next.players.player1.deck).toHaveLength(1);
    // 「ラッシュされたとき」カウンター窓
    expect(next.pendingRush?.rushedInstanceId).toBe(sCmd.instanceId);
    expect(next.activePlayer).toBe("player2");
    // オペレーションは解決済みで捨札へ
    expect(next.players.player1.discard.some((c) => c.instanceId === op.instanceId)).toBe(true);

    const passed = unwrap(applyAction(next, { type: "pass_rush_reaction", playerId: "player2" }));
    expect(passed.pendingRush).toBeUndefined();
    expect(passed.activePlayer).toBe("player1");
  });

  it("R-RUSH-22: 効果で捨札からラッシュエリアに出したユニットにも「ラッシュしたとき」とカウンター窓がある", () => {
    const target = inst(FX_UNIT, "dis");
    const state = withDefinitions(
      createTestState({
        phase: "rush",
        player1: {
          discard: [target],
          deck: [inst("TST-OP", "deck1"), inst("TST-OP", "deck2")],
        },
        player2: counterReadyOpponent(),
        pendingEffectChoice: {
          playerId: "player1",
          effectId: "test_rush_from_discard",
          sourceCardId: "TST-OP",
          phasePlayerId: "player1",
          kind: "select_unit",
          validInstanceIds: [target.instanceId],
          unitDestination: "rush_from_discard",
          optional: true,
        },
      }),
    );

    const next = unwrap(
      applyAction(state, {
        type: "resolve_effect_choice",
        playerId: "player1",
        instanceId: target.instanceId,
      }),
    );
    expect(next.players.player1.rush.some((c) => c.instanceId === target.instanceId)).toBe(true);
    expect(next.players.player1.deck).toHaveLength(1);
    expect(next.pendingRush?.rushedInstanceId).toBe(target.instanceId);
  });

  it("R-RUSH-22: カウンターを持たない相手にはカウンター窓を開かない（誘発は発動する）", () => {
    const op = inst("RS-005", "op1");
    const sCmd = { ...inst(FX_UNIT, "cmd-s"), commandHeld: false };
    const state = withDefinitions(
      createTestState({
        phase: "rush",
        player1: {
          hand: [op],
          deck: [inst("TST-OP", "deck1"), inst("TST-OP", "deck2")],
          power: Array.from({ length: 4 }, (_, i) => inst("TST-OP", `p${i}`)),
          command: [sCmd, heldEtCommand("held")],
        },
      }),
    );
    const action = getLegalActions(state).find(
      (a) => a.type === "play_operation" && a.instanceId === op.instanceId,
    );
    const next = unwrap(applyAction(state, action!));
    expect(next.players.player1.deck).toHaveLength(1);
    expect(next.pendingRush).toBeUndefined();
    expect(next.activePlayer).toBe("player1");
  });
});
