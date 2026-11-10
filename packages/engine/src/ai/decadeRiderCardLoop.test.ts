import { describe, expect, it } from "vitest";
import { applyAction } from "../core/applyAction";
import { getLegalActions } from "../core/legalActions";
import { choiceIds, inst, rcOff, st, deckCards } from "../cardSpec/XG5-061-080.helpers";
import { pickCpuAction } from "./index";

describe("XG5-079 ディケイド【ライダーカード】で同じ選択を繰り返さない", () => {
  // 敵軍捨札にも XG5-079 がある。それを選ぶと同じ【ライダーカード】の選択がまた開き、CPU が選び続けて対戦が終わらなかった
  // （ticket-breaker-a 同士、Lv5、seed 3、v8 の価値ネット。2026-11-10）。
  const fired = () =>
    rcOff(
      st({ player1: { deck: deckCards(8), rush: [inst("XG5-080", "md"), inst("XG5-079", "dc")] }, player2: { deck: deckCards(8, "e"), discard: [inst("XG5-079", "edc"), inst("XG5-072", "ib")] } }),
      "XG5-079:dc",
      "XG5-080:md",
    );

  it("CPU が選択を続けても、ライダーカードの選択が開いたままにならない", () => {
    for (const level of [1, 3, 5] as const) {
      let s = fired();
      let opened = 0;
      for (let i = 0; i < 50 && s.pendingEffectChoice; i++) {
        if (s.pendingEffectChoice.effectId === "xg5_079_rider_card") opened++;
        const action = pickCpuAction(s, s.pendingEffectChoice.playerId, level) ?? getLegalActions(s)[0]!;
        const r = applyAction(s, action);
        if (!r.ok) break;
        s = r.state;
      }
      expect(opened, `Lv${level}`).toBeLessThanOrEqual(1);
    }
  });

  it("敵軍捨札の XG5-079 は候補に入らない（選んでも同じ選択が開くだけ）", () => {
    expect(choiceIds(fired())).toEqual(["XG5-072:ib"]);
  });
});
