import { describe, expect, it } from "vitest";
import { inferRushAdditionalCondition, parsePowerCost } from "./metaMaps";

describe("zord down metadata", () => {
  it("preserves minus suffix in parsePowerCost", () => {
    expect(parsePowerCost("7-")).toBe("7-");
    expect(parsePowerCost("14－")).toBe("14-");
  });

  it("infers zord down additional condition from wiki text", () => {
    const cond = inferRushAdditionalCondition(
      "自軍「アバレッド」1体を捨札にすれば必要パワー0になる",
      "7-",
    );
    expect(cond).toEqual({
      conditionId: "zord_down_discard_named",
      text: "自軍「アバレッド」1体を捨札にすれば必要パワー0になる",
      partnerName: "アバレッド",
      unitCount: 1,
    });
  });

  it("infers send to power with 枚 counter", () => {
    const cond = inferRushAdditionalCondition(
      "自軍「仮面ライダーカブトMF」1枚をパワーゾーンに送れば必要パワー0になる",
      "7-",
    );
    expect(cond).toEqual({
      conditionId: "zord_down_send_to_power",
      text: "自軍「仮面ライダーカブトMF」1枚をパワーゾーンに送れば必要パワー0になる",
      partnerName: "仮面ライダーカブトMF",
      unitCount: 1,
    });
  });

  it("infers fusion zord down condition", () => {
    const cond = inferRushAdditionalCondition(
      "自軍合体ユニットを捨札にすれば必要パワー0になる",
      "10-",
    );
    expect(cond?.conditionId).toBe("zord_down_discard_fusion");
  });
});
