import { describe, expect, it } from "vitest";
import { isCardDslReady, isCardDslUnimplemented } from "./dslReady";
import dslReadyIdsData from "./generated/dsl-ready-ids.json";

describe("dslReady", () => {
  it("marks RS-006 as DSL ready", () => {
    expect(isCardDslReady("RS-006")).toBe(true);
    expect(isCardDslUnimplemented("RS-006")).toBe(false);
  });

  it("marks unimplemented ids from generated snapshot when present", () => {
    const unimplemented = dslReadyIdsData.unimplemented as string[];
    if (unimplemented.length === 0) {
      expect(isCardDslUnimplemented("RS-006")).toBe(false);
      return;
    }
    const sampleId = unimplemented[0]!;
    expect(isCardDslUnimplemented(sampleId)).toBe(true);
    expect(isCardDslReady(sampleId)).toBe(false);
  });
});
