import { describe, expect, it } from "vitest";
import { computeLayout } from "./layout";

describe("computeLayout", () => {
  it("uses two columns on the Vita logical viewport (480x272)", () => {
    const l = computeLayout({ width: 480, height: 272 });
    expect(l.orientation).toBe("landscape");
    expect(l.fontPx).toBe(12);
    expect(l.info.x + l.info.w).toBe(l.side.x);
    expect(l.side.x + l.side.w).toBe(480);
    expect(l.footer.y + l.footer.h).toBe(272);
    expect(l.sideLines).toBeGreaterThanOrEqual(10);
  });

  it("stacks panes in portrait (phone) and scales the font", () => {
    const l = computeLayout({ width: 390, height: 844 });
    expect(l.orientation).toBe("portrait");
    expect(l.fontPx).toBe(14);
    expect(l.info.w).toBe(390);
    expect(l.side.y).toBe(l.info.y + l.info.h);
  });

  it("uses a larger font on tablets", () => {
    expect(computeLayout({ width: 1024, height: 768 }).fontPx).toBe(16);
  });
});
