// RK-021 / RK-078 クロックアップ: 重ねたカードがある間、「加速」を持つユニットにアタックしてもバトルは行われず、
// 重ねたカードが 1 枚山札の下に戻るだけ。CPU はこれを「何も起きない」と見てアタックしなかったので、
// ストライクできないユニットでも出たまま何もせず、重ねたカードがいつまでも減らなかった。
import { describe, expect, it } from "vitest";
import { pickCpuAction } from "./index";
import type { CpuLevel } from "./types";
import { act, deckCards, inst, st, sUnit } from "../cardSpec/RK1-001-021.helpers";

const ACCEL = sUnit("SPEC-ACCEL", { category: "OT", bp: 1000, features: ["加速"] });
const BIG_NOSP = sUnit("SPEC-BIG-NOSP", { bp: 5000, sp: undefined });
const BIG_SP = sUnit("SPEC-BIG-SP", { bp: 5000, sp: 1 });

const clock = (stacked: number) => ({
  ...inst("RK-021", "cu"),
  stackedCards: Array.from({ length: stacked }, (_, i) => ({ ...inst("TST-OP", `stk${i}`), faceDown: true })),
});

/** CPU（player2）の BP5000・SP なしのユニットがバトルエリアに出た直後。player1 は「加速」のユニットとクロックアップ。 */
function entered(stacked: number, unit = "SPEC-BIG-NOSP") {
  const s = st(
    {
      activePlayer: "player2",
      player1: { operation: [clock(stacked)], battle: [inst("SPEC-ACCEL", "d")], deck: deckCards(10) },
      player2: { rush: [inst(unit, "a")], deck: deckCards(10, "e") },
    },
    [ACCEL, BIG_NOSP, BIG_SP],
  );
  return act(s, { type: "move_to_battle", playerId: "player2", instanceId: `${unit}:a` });
}

describe("CPU とクロックアップ", () => {
  for (const level of [1, 2, 3, 4, 5] as CpuLevel[]) {
    it(`Lv${level}: ストライクできないユニットは、重ねたカードを減らすために「加速」のユニットにアタックする`, () => {
      const s = entered(3);
      expect(s.pendingBattleEntry?.instanceId).toBe("SPEC-BIG-NOSP:a");
      const picked = pickCpuAction(s, "player2", level);
      expect(picked).toMatchObject({ type: "battle", defenderInstanceId: "SPEC-ACCEL:d" });
    });

    it(`Lv${level}: ストライクできるユニットは、止められるアタックよりストライクを選ぶ`, () => {
      const picked = pickCpuAction(entered(3, "SPEC-BIG-SP"), "player2", level);
      expect(picked).toMatchObject({ type: "strike", instanceId: "SPEC-BIG-SP:a" });
    });
  }
});
