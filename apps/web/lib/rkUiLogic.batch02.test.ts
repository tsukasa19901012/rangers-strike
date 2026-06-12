import { describe, expect, it } from "vitest";
import { RK_BATCH_02 } from "./rkUiTestSpecs/batch02";
import { rkUiBatchTestBody } from "./rkUiBatchTest";

describe("RK UI logic batch 02 (RK-011〜RK-020)", () => {
  it("defines 10 cards", () => {
    expect(RK_BATCH_02).toHaveLength(10);
    expect(RK_BATCH_02.map((s) => s.cardId)).toEqual([
      "RK-011",
      "RK-012",
      "RK-013",
      "RK-014",
      "RK-015",
      "RK-016",
      "RK-017",
      "RK-018",
      "RK-019",
      "RK-020",
    ]);
  });

  rkUiBatchTestBody(RK_BATCH_02);
});
