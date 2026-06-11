import { describe, expect, it } from "vitest";
import {
  GRNRNGR_CARD_IMAGE_BASE,
  grnrngrCardImageUrl,
  resolveCardImageUrl,
} from "./cardImages";

describe("resolveCardImageUrl", () => {
  it("returns local imageUrl for L1–3 cards (RS-006)", () => {
    expect(resolveCardImageUrl("RS-006")).toBe("/cards/legend1/RS-006.jpg");
  });

  it("returns local imageUrl for promoted cards when downloaded (BK-001)", () => {
    expect(resolveCardImageUrl("BK-001")).toBe("/cards/promoted/BK-001.jpg");
  });

  it("returns local imageUrl for promoted cards when downloaded (SX-002)", () => {
    expect(resolveCardImageUrl("SX-002")).toBe("/cards/promoted/SX-002.jpg");
  });

  it("falls back to grnrngr URL when promoted has no local imageUrl (XC-001)", () => {
    expect(resolveCardImageUrl("XC-001")).toBe(grnrngrCardImageUrl("XC-001"));
    expect(resolveCardImageUrl("XC-001")).toBe(
      `${GRNRNGR_CARD_IMAGE_BASE}/XC-001.jpg`,
    );
  });

  it("returns undefined for unknown ids", () => {
    expect(resolveCardImageUrl("UNKNOWN-999")).toBeUndefined();
  });
});
