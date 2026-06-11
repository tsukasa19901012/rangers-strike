import { describe, expect, it } from "vitest";
import { inferRushAdditionalCondition } from "./metaMaps";

describe("zord up metadata", () => {
  it("infers named unit discard", () => {
    const cond = inferRushAdditionalCondition(
      "自軍「ドラス」1体を捨札にする",
      "7+",
    );
    expect(cond).toEqual({
      conditionId: "discard_named_unit",
      text: "自軍「ドラス」1体を捨札にする",
      partnerName: "ドラス",
      unitCount: 1,
    });
  });

  it("infers feature unit discard", () => {
    const cond = inferRushAdditionalCondition(
      "特徴「メカ」を持つ自軍ユニットを1体捨札にする",
      "10+",
    );
    expect(cond?.conditionId).toBe("discard_feature_unit");
    expect(cond?.requiredFeature).toBe("メカ");
  });

  it("infers state gate for count conditions", () => {
    const cond = inferRushAdditionalCondition("ユニットが7体以上ある", "5+");
    expect(cond?.conditionId).toBe("state_gate");
  });
});
