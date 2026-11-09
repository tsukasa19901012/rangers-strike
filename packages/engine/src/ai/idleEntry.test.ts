import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { createStarterGame } from "../verticalSlice/createStarterGame";
import type { GameState } from "../types/game";
import { planComboEntry } from "./comboOrder";
import { isIdleBattleEntry, withoutIdleEntries } from "./idleEntry";
import { pickCpuAction } from "./level1";
import { getCpuLevelConfig } from "./types";

/** Lv2 同士で進めて、バトルフェイズの手番の局面を集める。 */
function battleStates(seed: number): GameState[] {
  let state = createStarterGame({ player1Starter: "abarenoh", player2Starter: "abarenoh", seed, firstPlayer: "player1" });
  const out: GameState[] = [];
  for (let i = 0; i < 1500 && !state.winner; i++) {
    const legal = getLegalActions(state);
    if (legal.length === 0) break;
    const playerId = legal[0]!.playerId;
    if (state.phase === "battle" && !state.pendingBattleEntry && playerId === state.activePlayer && legal.some((a) => a.type === "move_to_battle")) out.push(state);
    const result = applyAction(state, pickCpuAction(state, playerId, { enableSearch: false }) ?? legal[0]!);
    if (!result.ok) break;
    state = result.state;
  }
  return out;
}

describe("何もできないバトル進入（isIdleBattleEntry）", () => {
  const states = [1, 2, 3].flatMap(battleStates);

  it("出た直後に「何もしない」しか選べず、効果も起きない進入だけを当てはめる", () => {
    let idle = 0;
    let active = 0;
    for (const state of states) {
      const me = state.activePlayer;
      for (const action of getLegalActions(state)) {
        if (action.type !== "move_to_battle") continue;
        const result = applyAction(state, action);
        if (!result.ok) continue;
        const after = getLegalActions(result.state);
        if (isIdleBattleEntry(state, me, action)) {
          idle++;
          expect(after.every((a) => a.type === "pass_battle_entry" || a.type === "battle")).toBe(true);
        } else if (after.some((a) => a.type === "strike" || a.type === "battle")) {
          active++;
        }
      }
    }
    expect(idle).toBeGreaterThan(0);
    expect(active).toBeGreaterThan(0);
  });

  it("skipIdleEntry の CPU は、NC の並べ方の先出しでなければ何もできないユニットを出さない", () => {
    const options = { ...getCpuLevelConfig(4), skipIdleEntry: true };
    let idleOnly = 0;
    let checked = 0;
    for (const state of states.slice(0, 40)) {
      const me = state.activePlayer;
      const legal = getLegalActions(state);
      const combo = planComboEntry(state, me, legal);
      const picked = pickCpuAction(state, me, options);
      expect(picked).not.toBeNull();
      // 出せるユニットが全部「何もできない」局面も含める（出さずにバトルフェイズを終える）。
      if (withoutIdleEntries(state, me, legal).every((a) => a.type !== "move_to_battle")) idleOnly++;
      if (picked!.type !== "move_to_battle" || combo?.move.instanceId === picked!.instanceId) continue;
      expect(isIdleBattleEntry(state, me, picked!)).toBe(false);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    expect(idleOnly).toBeGreaterThan(0);
  }, 120_000);
});
