import { describe, expect, it } from "vitest";
import { hasDestroySelfDamageNote } from "@rangers-strike/cards";
import { applyAction } from "./index";
import { finalizeLeavePending } from "./rules/operationCounters";
import { moveToExile } from "./rules/exile";
import { createTestState, inst } from "./testing/fixtures";
import { legendDefinitions } from "./testing/battleEntry";
import type { GameState, PendingLeave } from "./types/game";

// RS-054 アバレッド「※これが撃破されたとき、1点ダメージを受ける。」
const ABARED = "RS-054";

function unwrap(result: ReturnType<typeof applyAction>): GameState {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function abaredState(extra: { resist?: boolean } = {}) {
  const abared = inst(ABARED, "ab");
  const state = createTestState({
    definitions: {
      ...legendDefinitions,
      ...(extra.resist
        ? { [ABARED]: { ...legendDefinitions[ABARED]!, features: ["レジスト"] } }
        : {}),
    },
    phase: "battle",
    activePlayer: "player1",
    player2: {
      battle: [abared],
      deck: [inst("TST-OP", "d1"), inst("TST-OP", "d2"), inst("TST-OP", "d3")],
    },
  });
  return { state, abared };
}

function destroyLeave(instanceId: string, overrides: Partial<PendingLeave> = {}): PendingLeave {
  return {
    ownerPlayerId: "player2",
    instanceId,
    fromZone: "battle",
    toZone: "discard",
    leavingCardId: ABARED,
    phasePlayerId: "player1",
    ...overrides,
  };
}

describe("撃破の事実（E10）", () => {
  it("fixture: RS-054 は「撃破されたとき1点ダメージ」を持つ", () => {
    expect(hasDestroySelfDamageNote(ABARED)).toBe(true);
  });

  it("R-DESTROY-01: 撃破されて捨札になれば「撃破されたとき」が発動する", () => {
    const { state, abared } = abaredState();
    const next = finalizeLeavePending(state, destroyLeave(abared.instanceId), false);
    expect(next.players.player2.discard.some((c) => c.instanceId === abared.instanceId)).toBe(true);
    expect(next.players.player2.damage).toBe(1);
  });

  it("R-DESTROY-02: 置換・カウンターで場に留まっても「撃破されたとき」は発動する", () => {
    const { state, abared } = abaredState();
    const next = finalizeLeavePending(state, destroyLeave(abared.instanceId), true);
    expect(next.players.player2.battle.some((c) => c.instanceId === abared.instanceId)).toBe(true);
    expect(next.players.player2.damage).toBe(1);
  });

  it("R-DESTROY-02: レジストで場に留まっても「撃破されたとき」は発動する（R-KW-RESIST-05）", () => {
    const { state, abared } = abaredState({ resist: true });
    const pendingRegisterState = finalizeLeavePending(
      state,
      destroyLeave(abared.instanceId, { registerEligible: true }),
      false,
    );
    expect(pendingRegisterState.pendingRegister).toBeDefined();
    expect(pendingRegisterState.players.player2.damage).toBe(0);
    const next = unwrap(
      applyAction(pendingRegisterState, { type: "use_register", playerId: "player2" }),
    );
    expect(next.players.player2.battle.find((c) => c.instanceId === abared.instanceId)?.registerHeld).toBe(
      true,
    );
    expect(next.players.player2.damage).toBe(1);
  });

  it("R-DESTROY-02: バトルで撃破されてパワーゾーンに置かれても「撃破されたとき」は発動する", () => {
    const { state, abared } = abaredState();
    const next = finalizeLeavePending(
      state,
      destroyLeave(abared.instanceId, { toZone: "power", registerEligible: true }),
      false,
    );
    expect(next.players.player2.power.some((c) => c.instanceId === abared.instanceId)).toBe(true);
    expect(next.players.player2.damage).toBe(1);
  });

  it("R-DESTROY-02: 撃破でない移動（効果でパワーゾーンに置く）を留めても「撃破されたとき」は発動しない", () => {
    const { state, abared } = abaredState();
    const prevented = finalizeLeavePending(
      state,
      destroyLeave(abared.instanceId, { toZone: "power" }),
      true,
    );
    expect(prevented.players.player2.damage).toBe(0);
    const moved = finalizeLeavePending(
      state,
      destroyLeave(abared.instanceId, { toZone: "power" }),
      false,
    );
    expect(moved.players.player2.damage).toBe(0);
  });

  it("R-DESTROY-03: 除外は撃破ではないので「撃破されたとき」は発動しない", () => {
    const { state, abared } = abaredState();
    const next = moveToExile(state, "player2", "battle", abared.instanceId);
    expect(next.players.player2.exile?.some((c) => c.instanceId === abared.instanceId)).toBe(true);
    expect(next.players.player2.damage).toBe(0);
  });
});
