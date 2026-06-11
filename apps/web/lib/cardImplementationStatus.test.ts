import { describe, expect, it } from "vitest";
import { getCardImplementationStatus } from "./cardImplementationStatus";

describe("getCardImplementationStatus", () => {
  it("returns core for L1–3 catalog cards", () => {
    expect(getCardImplementationStatus("RS-050")).toBe("core");
  });

  it("returns promoted for DSL-ready promoted cards", () => {
    expect(getCardImplementationStatus("BK-001")).toBe("promoted");
  });

  it("returns null for unknown card ids", () => {
    expect(getCardImplementationStatus("RS-9999")).toBeNull();
  });
});
