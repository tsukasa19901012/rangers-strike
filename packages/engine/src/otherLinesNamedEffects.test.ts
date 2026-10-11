/**
 * RS 以外のライン（XG・XP・SK）のカード固有の効果（rules/legend1/otherLinesNamedEffects.ts）。
 * 出典: atwiki/page-1411（SK-004）・page-2257（XP-026）。
 */
import { describe, expect, it } from "vitest";
import type { CardInstance } from "./types/game";
import { act, attackedInEnemyTurn, choiceIds, deckCards, inst, pick, skip, st, zoneOf } from "./cardSpec/RS8-560-581.helpers";

const faceDown = (id: string, tag: string): CardInstance => ({ ...inst(id, tag), faceDown: true });

describe("SK-004 仮面ライダークウガUF【凄まじき戦士】（後半）", () => {
  it("ユニットでなくなるとき（バトルで撃破されるとき）、重ねたウラ向きのカードを1枚捨札にしてその場に留める（出典: atwiki/page-1411）", () => {
    const kuuga = { ...inst("SK-004", "k"), stackedCards: [faceDown("TST-OP", "u1")] };
    const s = attackedInEnemyTurn({ battle: [kuuga] }, "SK-004:k");
    expect(zoneOf(s, "player1", "SK-004:k")).toBe("battle");
    expect(s.players.player1.discard.map((c) => c.instanceId)).toEqual(["TST-OP:u1"]);
    expect(s.players.player1.discard[0]?.faceDown).toBe(true);
  });

  it("重ねたウラ向きのカードが2枚以上なら、捨札にするカードを選ぶ（出典: atwiki/page-1411「1枚選び」）", () => {
    const kuuga = { ...inst("SK-004", "k"), stackedCards: [faceDown("TST-OP", "u1"), faceDown("TST-OP", "u2")] };
    let s = attackedInEnemyTurn({ battle: [kuuga] }, "SK-004:k");
    expect(s.pendingEffectChoice?.playerId).toBe("player1");
    expect(choiceIds(s).sort()).toEqual(["TST-OP:u1", "TST-OP:u2"]);
    s = pick(s, "TST-OP:u2");
    expect(zoneOf(s, "player1", "SK-004:k")).toBe("battle");
    expect(zoneOf(s, "player1", "TST-OP:u2")).toBe("discard");
  });

  it("重ねたウラ向きのカードがなければ留まらない（出典: atwiki/page-1411）", () => {
    const s = attackedInEnemyTurn({ battle: [inst("SK-004", "k")] }, "SK-004:k");
    expect(zoneOf(s, "player1", "SK-004:k")).toBe("discard");
  });
});

describe("XP-026 仮面ライダーアクセル ※（自分がターンを終えるとき）", () => {
  const board = () =>
    st({
      phase: "battle",
      player1: {
        battle: [inst("XP-026", "accel")],
        command: [inst("RK-054", "kasoku"), inst("TST-OP-ET", "et")],
        deck: deckCards(5),
      },
      player2: { battle: [inst("TST-UNIT-0", "e")], deck: deckCards(5, "e") },
    });

  it("特徴「加速」の自軍コマンドをホールドしてラッシュエリアに戻すと、【アクセルグランツァー】を発動できる（出典: atwiki/page-2257）", () => {
    let s = act(board(), { type: "end_phase", playerId: "player1" });
    for (let i = 0; i < 3 && s.pendingEffectChoice?.effectId !== "xp026_accel_return"; i++) {
      if (s.pendingEffectChoice || s.phase === "end") break;
      s = act(s, { type: "end_phase", playerId: "player1" });
    }
    expect(s.pendingEffectChoice?.effectId).toBe("xp026_accel_return");
    expect(choiceIds(s)).toEqual(["RK-054:kasoku"]);
    s = pick(s, "RK-054:kasoku");
    expect(zoneOf(s, "player1", "XP-026:accel")).toBe("rush");
    expect(s.players.player1.command.find((c) => c.instanceId === "RK-054:kasoku")?.commandHeld).toBe(true);
    // 戻ったので【アクセルグランツァー】: ET を手札に戻し、ET を持たない敵軍 S ユニットを捨札にする。
    expect(s.pendingEffectChoice?.effectId).toBe("xp026_accel_granzer");
    s = pick(s, "TST-OP-ET:et");
    expect(zoneOf(s, "player1", "TST-OP-ET:et")).toBe("hand");
    s = pick(s, "TST-UNIT-0:e");
    expect(zoneOf(s, "player2", "TST-UNIT-0:e")).toBe("discard");
  });

  it("戻さないことを選べる（出典: atwiki/page-2257「戻してよい」）", () => {
    let s = act(board(), { type: "end_phase", playerId: "player1" });
    for (let i = 0; i < 3 && s.pendingEffectChoice?.effectId !== "xp026_accel_return"; i++) {
      if (s.pendingEffectChoice || s.phase === "end") break;
      s = act(s, { type: "end_phase", playerId: "player1" });
    }
    expect(s.pendingEffectChoice?.effectId).toBe("xp026_accel_return");
    s = skip(s);
    expect(zoneOf(s, "player1", "XP-026:accel")).toBe("battle");
    expect(s.players.player1.command.find((c) => c.instanceId === "RK-054:kasoku")?.commandHeld ?? false).toBe(false);
  });
});
