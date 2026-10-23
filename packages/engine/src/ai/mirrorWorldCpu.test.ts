// RK-016 ミラーワールド: 自軍ラッシュフェイズに場の自軍 S ユニットを重ねると、同名の自軍ユニットは相手に選ばれにくく、アタックされにくくなる。
// 盤面評価がこの守りを数えず、起動の手も重ねる前の盤面で評価されていたので、CPU はどのレベルでも一度も重ねなかった。
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { applyAction } from "../core/applyAction";
import { pickCpuAction } from "./index";
import type { CpuLevel } from "./types";
import { deckCards, inst, st, sUnit } from "../cardSpec/RK1-001-021.helpers";

const MW_UNIT = sUnit("SPEC-MW", { category: "WB", bp: 2000 });
const BIG = sUnit("SPEC-BIG", { bp: 5000 });

/** player1 の自軍ラッシュフェイズ。ミラーワールドと、同名の S ユニット n 体がバトルエリアにいる。 */
function board(n: number): GameState {
  return st(
    {
      phase: "rush",
      player1: { operation: [inst("RK-016", "mw")], battle: Array.from({ length: n }, (_, i) => inst("SPEC-MW", `u${i}`)), deck: deckCards(10) },
      player2: { battle: [inst("SPEC-BIG", "e")], deck: deckCards(10, "e") },
    },
    [MW_UNIT, BIG],
  );
}

function step(s: GameState, level: CpuLevel): GameState {
  const a = pickCpuAction(s, "player1", level);
  expect(a).not.toBeNull();
  const r = applyAction(s, a!);
  expect(r.ok, r.error).toBe(true);
  return r.state;
}

const stacked = (s: GameState) => s.players.player1.operation[0]?.stackedCards?.length ?? 0;

describe("CPU とミラーワールド", () => {
  for (const level of [1, 2, 3, 4, 5] as CpuLevel[]) {
    it(`Lv${level}: 同名の S ユニットが2体いれば1体を重ね、残りに守りを与える`, () => {
      let s = board(2);
      s = step(s, level);
      expect(s.pendingEffectChoice?.sourceCardId).toBe("RK-016");
      s = step(s, level);
      expect(stacked(s)).toBe(1);
      expect(s.players.player1.battle).toHaveLength(1);
    });

    it(`Lv${level}: 1体しかいなければ重ねない（守るユニットがいなくなる）`, () => {
      const a = pickCpuAction(board(1), "player1", level);
      expect(a?.type).not.toBe("activate_resident_operation");
    });
  }
});
