import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import type { GameState } from "../types/game";
import { createStarterGame, type AllStarterDeckId } from "../verticalSlice/createStarterGame";
import { pickCpuAction } from "./index";

/** 同じデッキ同士で Lv5 に最後まで打たせ、手の種類ごとに「合法だった局面の数」と「選んだ数」を数える（scripts/selfplay.ts と同じ進め方）。 */
function playAndCount(deck: AllStarterDeckId, seed = 1, maxSteps = 4000) {
  // seed を決めて、毎回同じ対戦にする（決めないと山札の並びが毎回変わり、起動しない対戦を引くことがある）。
  let s: GameState = createStarterGame({ player1Starter: deck, player2Starter: deck, seed });
  const legal: Record<string, number> = {};
  const chosen: Record<string, number> = {};
  for (let step = 0; step < maxSteps && !s.winner; step++) {
    const actions = getLegalActions(s);
    if (actions.length === 0) break;
    for (const t of new Set(actions.map((a) => a.type))) legal[t] = (legal[t] ?? 0) + 1;
    const a = pickCpuAction(s, actions[0]!.playerId, 5);
    if (!a) break;
    chosen[a.type] = (chosen[a.type] ?? 0) + 1;
    const r = applyAction(s, a);
    if (!r.ok) break;
    s = r.state;
  }
  return { winner: s.winner, legal, chosen };
}

describe("CPU は列挙に無い合法手も候補にする（remainingActions）", () => {
  // 以前は collectRushCandidates が手の種類を列挙して候補を作っていたので、常駐の起動（ミラーワールドなど）や
  // 場のユニットの起動効果を一度も選ばなかった。単に候補へ足すと、ミラーワールドの「起動 → 重ねるのを見送る」で
  // 局面が戻る手を選び続けて対戦が終わらなかったので、局面が戻る手は外している。
  it("常駐（ミラーワールドなど）を起動することがあり、起動を繰り返して終わらなくなることはない", () => {
    let legal = 0;
    let chosen = 0;
    // 起動するかどうかは対戦の流れと同梱の重みで変わるので、seed 2 つ × 3 デッキのどれかで起動すればよい。
    for (const seed of [1, 2]) for (const deck of ["rider-exp-1-b", "rider-exp-4-1", "blue-nine-b"] as const) {
      const r = playAndCount(deck, seed);
      expect(r.winner).not.toBeNull();
      expect(r.chosen.activate_resident_operation ?? 0).toBeLessThan(60);
      legal += r.legal.activate_resident_operation ?? 0;
      chosen += r.chosen.activate_resident_operation ?? 0;
    }
    expect(legal).toBeGreaterThan(0);
    expect(chosen).toBeGreaterThan(0);
  }, 240_000);

  it("ticket-breaker-a: 場のユニットの起動効果を使うことがある", () => {
    const r = playAndCount("ticket-breaker-a");
    expect(r.winner).not.toBeNull();
    expect(r.legal.activate_field_unit_ability ?? 0).toBeGreaterThan(0);
    expect(r.chosen.activate_field_unit_ability ?? 0).toBeGreaterThan(0);
  }, 120_000);
});
