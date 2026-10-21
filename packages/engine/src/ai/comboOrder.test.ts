import { describe, expect, it } from "vitest";
import { pickCpuAction } from "./index";
import { planComboEntry } from "./comboOrder";
import { getLegalActions } from "../core/legalActions";
import { deckCards, inst, st } from "../cardSpec/RK1-001-021.helpers";

/** player1 の自軍バトルフェイズ。ラッシュエリアのユニットはまだ 1 体もバトルエリアに出ていない。 */
function battlePhase(rush: string[]) {
  return st({
    player1: { rush: rush.map((id, i) => inst(id, `r${i}`)), deck: deckCards(10) },
    player2: { deck: deckCards(10, "e") },
  });
}

describe("NC の並べ方（comboOrder）", () => {
  // RS-508 ゴーオンレッド（ナンバー4）は「毎ターン、可能ならバトルエリアに出る」。以前の CPU は先に出して
  // 1 番目に置き、ラン（1）・ゴーオンブルー（2）・サクラ（3）・レッド（4）の NC を全部ふさいでいた。
  it("「可能なら出る」ユニットより、NC が成立する順番を先に出す", () => {
    const s = battlePhase(["RS-508", "RS-509", "RS-462", "RS-460"]);
    expect(pickCpuAction(s, "player1", 2)).toMatchObject({ type: "move_to_battle", instanceId: "RS-460:r3" });
  });

  it("ラッシュエリアに同じカードが何枚も並んでも、NC が成立する順番を読み切る", () => {
    // 埋め草（ナンバーなし）を 8 体並べても、ラン（1）を最初に出して 3 つの NC を数える。
    const s = battlePhase([...Array(8).fill("TST-UNIT-0"), "RS-462", "RS-509", "RS-460"]);
    const plan = planComboEntry(s, "player1", getLegalActions(s));
    expect(plan).toMatchObject({ total: 3, triggersNow: true, move: { instanceId: "RS-460:r10" } });
  });
});
