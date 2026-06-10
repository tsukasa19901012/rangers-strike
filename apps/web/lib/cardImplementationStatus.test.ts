import { describe, expect, it } from "vitest";
import { getCardImplementationStatus } from "./cardImplementationStatus";

describe("getCardImplementationStatus", () => {
  it("returns core for L1–3 catalog cards", () => {
    expect(getCardImplementationStatus("RS-050")).toBe("core");
  });

  it("returns ui-uncertain for promoted-only cards", () => {
    expect(getCardImplementationStatus("BK-001")).toBe("ui-uncertain");
  });

  it("returns null for unknown card ids", () => {
    expect(getCardImplementationStatus("RS-9999")).toBeNull();
  });
});
