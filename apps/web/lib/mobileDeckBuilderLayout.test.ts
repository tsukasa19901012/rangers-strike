import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(
  join(process.cwd(), "app/globals.css"),
  "utf8",
);

/**
 * AC-06 structural contract: mobile-first deck builder layout (~767px and below).
 * Full tap-flow E2E is out of scope; CSS + component hooks are asserted here.
 */
describe("AC-06 — mobile deck builder layout contract", () => {
  it("uses single-column layout by default (mobile-first)", () => {
    const layoutBlock = globalsCss.match(
      /\.deck-builder__layout\s*\{[^}]+\}/,
    )?.[0];
    expect(layoutBlock).toBeDefined();
    expect(layoutBlock).toMatch(/flex-direction:\s*column/);
  });

  it("uses dvh-based catalog height on narrow viewports", () => {
    expect(globalsCss).toMatch(
      /\.deck-builder__catalog\s*\{[^}]*min-height:\s*200px/,
    );
    expect(globalsCss).toMatch(/100dvh/);
  });

  it("expands to two-column grid only at desktop breakpoint (1024px+)", () => {
    const desktopSection = globalsCss.slice(
      globalsCss.indexOf("@media (min-width: 1024px)"),
    );
    expect(desktopSection).toMatch(
      /\.deck-builder__layout\s*\{[^}]*grid-template-columns/,
    );
  });

  it("defines touch-friendly catalog row targets and virtual scroll", () => {
    expect(globalsCss).toMatch(/\.deck-builder__catalog-item/);
    expect(globalsCss).toMatch(/\.deck-builder__catalog-virtual/);
    expect(globalsCss).toMatch(/--db-touch-min:\s*44px/);
  });

  it("uses sticky catalog toolbar from tablet breakpoint (avoids footer overlap on mobile)", () => {
    const tabletSection = globalsCss.slice(
      globalsCss.indexOf("@media (min-width: 640px)"),
      globalsCss.indexOf("@media (min-width: 1024px)"),
    );
    expect(tabletSection).toMatch(
      /\.deck-builder__catalog-toolbar\s*\{[^}]*position:\s*sticky/,
    );
    const mobileSection = globalsCss.slice(
      globalsCss.indexOf("@media (max-width: 639px)"),
      globalsCss.indexOf("@media (min-width: 640px)"),
    );
    expect(mobileSection).toMatch(/\.deck-builder\s*\{[^}]*overflow:\s*hidden/);
  });
});
