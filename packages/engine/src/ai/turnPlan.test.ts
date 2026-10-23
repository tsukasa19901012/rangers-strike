import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { getLegalActions, isLegalAction } from "../core/legalActions";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import { pickCpuAction } from "./level1";
import { getCpuLevelConfig } from "./types";

describe("ターン単位の読み（turnPlanSteps）", () => {
  it("ラッシュ・バトルフェイズで合法手を選び、対戦を最後まで進められる", () => {
    const options = { ...getCpuLevelConfig(5), turnPlanSteps: 30 };
    let state = createStarterGame({ player1Starter: "abarenoh", player2Starter: "magiking", seed: 11, firstPlayer: "player1" });
    let planned = 0;
    for (let i = 0; i < 1500 && !state.winner; i++) {
      const legal = getLegalActions(state);
      if (legal.length === 0) break;
      const playerId = legal[0]!.playerId;
      const action = pickCpuAction(state, playerId, playerId === "player1" ? options : { enableSearch: false });
      expect(action).not.toBeNull();
      expect(isLegalAction(state, action!)).toBe(true);
      if (playerId === "player1" && state.activePlayer === "player1" && (state.phase === "rush" || state.phase === "battle")) planned++;
      const result = applyAction(state, action!);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.winner).toBeDefined();
    expect(planned).toBeGreaterThan(0);
  }, 120_000);
});
