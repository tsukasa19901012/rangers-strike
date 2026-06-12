import { describe, expect, it } from "vitest";
import { RK_BATCH_01 } from "./rkUiTestSpecs/batch01";
import { rkUiBatchTestBody } from "./rkUiBatchTest";

describe("RK UI logic batch 01 (RK-001〜RK-010)", () => {
  it("defines 10 cards", () => {
    expect(RK_BATCH_01).toHaveLength(10);
    expect(RK_BATCH_01.map((s) => s.cardId)).toEqual([
      "RK-001",
      "RK-002",
      "RK-003",
      "RK-004",
      "RK-005",
      "RK-006",
      "RK-007",
      "RK-008",
      "RK-009",
      "RK-010",
    ]);
  });

  rkUiBatchTestBody(RK_BATCH_01);
});
