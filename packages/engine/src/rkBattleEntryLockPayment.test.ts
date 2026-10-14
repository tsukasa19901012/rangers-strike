/**
 * 回帰: rkBkMonkey seed=34 — RK-334 仮面ライダー電王LF（2nd）のロック中に、RK-119 ギガゼール
 * （「※これは自軍コマンドを1つホールドしなければバトルエリアに出られない」、必要パワー0）の
 * battle_entry 支払いが合法手に出て、resolve_command_payment が illegal_action になっていた。
 *
 * 原因: 支払いを始められるかの判定（canMoveUnitToBattleExceptHoldRequirements）が、ホールドでは解けない
 * 進入禁止（RK-140 / RK-334 のロック等）を見ていなかった。支払い後の move_to_battle は canMoveUnitToBattle で
 * 弾かれるため、legalActions と applyAction が食い違った。
 */
import { describe, expect, it } from "vitest";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { applyAction, getLegalActions, isLegalAction } from "./index";
import { createTestState, inst, MERGED_DEFINITIONS } from "./testing/fixtures";
import type { GameState } from "./types/game";

const definitions = {
  ...MERGED_DEFINITIONS,
  ...Object.fromEntries(fullPlayableCatalog.cards.map((c) => [c.id, c])),
};

function battleState(enemyBattle: string[]): GameState {
  return createTestState({
    phase: "battle",
    turn: 3,
    definitions,
    player1: {
      rush: [inst("RK-119", "giga")],
      command: [inst("RK-189", "cmd")],
    },
    player2: {
      battle: enemyBattle.map((id, i) => inst(id, `enemy${i}`)),
    },
  });
}

const giga = inst("RK-119", "giga").instanceId;

function entryPayments(state: GameState) {
  return getLegalActions(state).filter(
    (a) =>
      a.type === "initiate_command_payment" &&
      a.kind === "battle_entry" &&
      a.sourceInstanceId === giga,
  );
}

describe("RK-334 / RK-140 lock vs battle_entry command payment (rkBkMonkey seed 34)", () => {
  it("without the lock, RK-119 can start its battle_entry payment and enter", () => {
    const state = battleState([]);
    const [initiate] = entryPayments(state);
    expect(initiate).toBeDefined();
    const opened = applyAction(state, initiate!);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const resolve = getLegalActions(opened.state).find((a) => a.type === "resolve_command_payment");
    expect(resolve).toBeDefined();
    const entered = applyAction(opened.state, resolve!);
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;
    expect(entered.state.players.player1.battle.some((c) => c.instanceId === giga)).toBe(true);
  });

  it.each(["RK-334", "RK-140"])(
    "while %s is on the field, the battle_entry payment is not offered",
    (lockId) => {
      const state = battleState([lockId]);
      expect(entryPayments(state)).toEqual([]);
      expect(
        isLegalAction(state, {
          type: "initiate_command_payment",
          playerId: "player1",
          kind: "battle_entry",
          sourceInstanceId: giga,
        }),
      ).toBe(false);
    },
  );

  it("an already-open payment cannot be resolved into an illegal move_to_battle", () => {
    const base = battleState(["RK-334"]);
    const state: GameState = {
      ...base,
      pendingCommandPayment: {
        playerId: "player1",
        kind: "battle_entry",
        sourceInstanceId: giga,
        sourceCardId: "RK-119",
        eligibleNeeded: 1,
        totalNeeded: 1,
        validInstanceIds: [inst("RK-189", "cmd").instanceId],
        continuation: { type: "move_to_battle" },
      },
    };
    const resolve = {
      type: "resolve_command_payment" as const,
      playerId: "player1" as const,
      commandInstanceIds: [inst("RK-189", "cmd").instanceId],
    };
    const legal = getLegalActions(state);
    // legalActions と applyAction が一致すること。
    expect(legal.some((a) => a.type === "resolve_command_payment")).toBe(false);
    expect(isLegalAction(state, resolve)).toBe(false);
    expect(legal.some((a) => a.type === "cancel_command_payment")).toBe(true);
    const cancelled = applyAction(state, { type: "cancel_command_payment", playerId: "player1" });
    expect(cancelled.ok).toBe(true);
  });
});
