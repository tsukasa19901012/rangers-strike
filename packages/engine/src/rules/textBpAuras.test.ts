/**
 * 常駐オペレーションの BP 修正・BP の「＋」反転を、カード ID ではなく本文の文言で判定することの確認。
 * - RS-017 と RS-246「気力」は同じ本文（「すべての自軍Sユニットは、敵軍ターン中、リリース状態の自軍コマンド1つにつきBP＋1000される」）
 * - RS-210 ゴーマ16世【大地動転の玉】は、どちらのエリアにあっても「ナンバーを持つすべてのSユニット」の BP＋を－にする
 */
import { describe, expect, it } from "vitest";
import { bpOf, inst, releasedN, st } from "../cardSpec/RS4-201-221.helpers";

describe("text-based permanent BP auras", () => {
  for (const id of ["RS-017", "RS-246"]) {
    it(`${id} 気力: 敵軍ターン中、リリース状態の自軍コマンド1つにつき自軍 S ユニットが BP＋1000`, () => {
      const enemyTurn = st({
        activePlayer: "player2",
        player1: { operation: [inst(id, "ki")], battle: [inst("RS-208", "k")], command: releasedN(2) },
      });
      expect(bpOf(enemyTurn, "player1", "RS-208:k")).toBe(5000);
      const ownTurn = st({
        activePlayer: "player1",
        player1: { operation: [inst(id, "ki")], battle: [inst("RS-208", "k")], command: releasedN(2) },
      });
      expect(bpOf(ownTurn, "player1", "RS-208:k")).toBe(3000);
    });
  }

  it("RS-246 気力の BP＋も、ゴーマ16世の下ではナンバーを持つ S ユニットに－として働く（RS-210 atwiki/page-107）", () => {
    const s = st({
      activePlayer: "player2",
      player1: { operation: [inst("RS-246", "ki")], battle: [inst("RS-208", "k")], command: releasedN(1) },
      player2: { battle: [inst("RS-210", "g")] },
    });
    expect(bpOf(s, "player1", "RS-208:k")).toBe(2000);
  });
});
