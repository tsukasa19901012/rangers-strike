// RK-022 ライダーパス・XG2-070 ライドブッカー・ブックモード: 配置するとき自軍山札のカードを「～枚まで」重ねる。
// 盤面評価は重ねたカードを数えず、山札が減る分だけ下がるので、CPU は読みで比べて毎回「重ねない」を選び、
// 置き換え（ライダーパス）やモーフ（ブックモード）に使うカードが無いままになっていた。
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { applyAction } from "../core/applyAction";
import { pickCpuAction } from "./index";
import type { CpuLevel } from "./types";
import { deckCards, inst, playOp, powerCards, releasedCat, st } from "../cardSpec/RK2-022-042.helpers";

/** player1 が手札の常駐を配置した直後（重ねる選択が出ている）。 */
function placed(opId: string, deck: ReturnType<typeof inst>[], power = 0): GameState {
  const s = st(
    { phase: "rush", player1: { hand: [inst(opId, "op")], command: releasedCat("OT", 1), power: powerCards(power), deck: [...deck, ...deckCards(10)] }, player2: { deck: deckCards(5, "e") } },
    [],
  );
  const r = playOp(s, "player1", `${opId}:op`);
  expect(r.ok, r.error).toBe(true);
  expect(r.state.pendingEffectChoice?.sourceCardId).toBe(opId);
  return r.state;
}

function runCpu(s: GameState, level: CpuLevel): GameState {
  for (let i = 0; i < 8 && s.pendingEffectChoice; i++) {
    const a = pickCpuAction(s, "player1", level);
    expect(a).not.toBeNull();
    const r = applyAction(s, a!);
    expect(r.ok, r.error).toBe(true);
    s = r.state;
  }
  return s;
}

const stackedIds = (s: GameState, opId: string) =>
  (s.players.player1.operation.find((c) => c.instanceId === `${opId}:op`)?.stackedCards ?? []).map((c) => c.instanceId).sort();

describe("CPU と山札から重ねる常駐", () => {
  for (const level of [1, 2, 3, 4, 5] as CpuLevel[]) {
    it(`Lv${level}: ライダーパスに「DEN-O」を4枚まで重ねる（同じカード名より別のカード名を先に選ぶ）`, () => {
      const deck = [inst("RK-062", "a1"), inst("RK-062", "a2"), inst("RK-061", "r"), inst("RK-066", "s"), inst("RK-072", "g")];
      const s = runCpu(placed("RK-022", deck), level);
      expect(s.pendingEffectChoice).toBeFalsy();
      expect(stackedIds(s, "RK-022")).toEqual(["RK-061:r", "RK-062:a1", "RK-066:s", "RK-072:g"].sort());
    });

    it(`Lv${level}: ライドブッカー・ブックモードにモーフのユニットを3枚まで重ねる`, () => {
      const deck = [inst("XG2-043", "a"), inst("XG2-044", "b"), inst("XG2-045", "c"), inst("XG2-077", "d")];
      const s = runCpu(placed("XG2-070", deck, 4), level);
      expect(s.pendingEffectChoice).toBeFalsy();
      expect(stackedIds(s, "XG2-070")).toHaveLength(3);
    });
  }
});
