/**
 * E17: 「スタートフェイズ開始時」「ターン開始時」の効果は、ホールド中のコマンドの有無に関係なく
 * スタートフェイズの3行程より前に発動する。
 */
import { describe, expect, it } from "vitest";
import { fullPlayableCatalog, type CardDefinition } from "@rangers-strike/cards";
import { applyAction, getLegalActions } from "./index";
import type { GameState } from "./types/game";
import { createTestState, inst, MERGED_DEFINITIONS } from "./testing/fixtures";

const DEFINITIONS: Record<string, CardDefinition> = {
  ...MERGED_DEFINITIONS,
  ...Object.fromEntries(fullPlayableCatalog.cards.map((card) => [card.id, card])),
};

function endTurnOf(state: GameState): GameState {
  const result = applyAction(state, { type: "end_phase", playerId: state.activePlayer });
  if (!result.ok) throw new Error(`end_phase failed: ${result.error}`);
  return result.state;
}

describe("E17: スタートフェイズ開始時の効果", () => {
  it("R-START-06: ホールド中のコマンドがなくても「ターン開始時」の置き換え（XG4-049）を3行程より前に選べる", () => {
    const acrobatter = inst("XG4-049", "acro");
    const roboizer = inst("XG4-050", "robo");
    let state = createTestState({
      definitions: DEFINITIONS,
      phase: "end",
      activePlayer: "player2",
      turn: 2,
      player1: {
        deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2")],
        hand: [roboizer],
        rush: [acrobatter],
        command: [{ ...inst("TST-OP", "c1"), commandHeld: false }],
      },
    });

    state = endTurnOf(state);
    expect(state.phase).toBe("start");
    expect(state.activePlayer).toBe("player1");
    // ドロー前に選択が開いている
    expect(state.players.player1.hand).toHaveLength(1);
    expect(state.players.player1.hasDrawnThisStart).toBe(false);
    const choice = state.pendingEffectChoice;
    expect(choice?.effectId).toBe("turn_start_swap_hand_named");
    expect(choice?.validInstanceIds).toEqual([roboizer.instanceId]);

    const pick = getLegalActions(state).find(
      (a) => "instanceId" in a && a.instanceId === roboizer.instanceId,
    );
    expect(pick).toBeDefined();
    const picked = applyAction(state, pick!);
    if (!picked.ok) throw new Error(picked.error);
    expect(picked.state.players.player1.rush.map((c) => c.cardId)).toEqual(["XG4-050"]);
    expect(picked.state.players.player1.hand.map((c) => c.cardId)).toEqual(["XG4-049"]);
  });

  it("R-TIME-06: ホールド中のコマンドがあっても、リリースより前に開始時の選択が開く", () => {
    const acrobatter = inst("XG4-049", "acro");
    const roboizer = inst("XG4-050", "robo");
    let state = createTestState({
      definitions: DEFINITIONS,
      phase: "end",
      activePlayer: "player2",
      turn: 2,
      player1: {
        hand: [roboizer],
        rush: [acrobatter],
        command: [{ ...inst("TST-OP", "c1"), commandHeld: true }],
      },
    });

    state = endTurnOf(state);
    expect(state.pendingEffectChoice?.effectId).toBe("turn_start_swap_hand_named");
    expect(state.players.player1.command[0]?.commandHeld).toBe(true);
  });

  it("R-START-06: ゲゲル（RK-081）は重ねたカードが10枚以上ならホールド中のコマンドなしでも SP1 を与える", () => {
    const gegeru = {
      ...inst("RK-081", "gegeru"),
      stackedCards: Array.from({ length: 10 }, (_, i) => ({ ...inst("TST-OP", `s${i}`), faceDown: true })),
    };
    const unit = inst("TST-UNIT-0", "u1");
    let state = createTestState({
      definitions: DEFINITIONS,
      phase: "end",
      activePlayer: "player2",
      turn: 2,
      player1: {
        operation: [gegeru],
        rush: [unit],
        command: [],
      },
    });

    state = endTurnOf(state);
    expect(state.phase === "start" || state.phase === "charge").toBe(true);
    expect(state.players.player1.rush[0]?.activatedNcEffects).toContain("gegeru_sp1");
  });
});
