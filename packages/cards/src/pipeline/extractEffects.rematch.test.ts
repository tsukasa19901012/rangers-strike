import { describe, expect, it } from "vitest";
import { rematchExtractedEffect } from "./extractEffects";

describe("rematchExtractedEffect (M20)", () => {
  it("matches destroy with 選び撃破", () => {
    const built = rematchExtractedEffect(
      "敵軍バトルエリアから、カテゴリにDAを持つ敵軍Sユニットを1体選び撃破する。",
      { name: "ライダーキック", kind: "named", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("destroy_enemy_s_category_da");
    expect(built?.effects[0]?.type).toBe("choose");
  });

  it("matches no ride while held note", () => {
    const built = rematchExtractedEffect(
      "※これはホールド状態のときビークルにライドできない。",
      { kind: "note", trigger: { type: "nc" } },
    );
    expect(built?.effects).toEqual([
      { type: "grant_keyword", keyword: "no_ride_while_held", duration: "permanent" },
    ]);
  });

  it("matches conditional recruit from discard", () => {
    const built = rematchExtractedEffect(
      "※これが撃破されて捨札になったとき、自軍捨札に「シンケンレッド」のカードがあれば1枚選び、自軍ラッシュエリアに出す。",
      { kind: "note", trigger: { type: "nc" } },
    );
    expect(built?.matchedPattern).toBe("recruit_named_from_discard_if_present");
    expect(built?.trigger).toEqual({ type: "nc" });
  });
});
