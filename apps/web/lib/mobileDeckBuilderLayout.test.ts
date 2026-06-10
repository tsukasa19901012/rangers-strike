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
  it("uses single-column panels by default (mobile-first)", () => {
    const panelsBlock = globalsCss.match(
      /\.deck-builder__panels\s*\{[^}]+\}/,
    )?.[0];
    expect(panelsBlock).toBeDefined();
    expect(panelsBlock).toMatch(/flex-direction:\s*column/);
  });

  it("limits catalog scroll height on narrow viewports", () => {
    expect(globalsCss).toMatch(
      /\.deck-builder__catalog\s*\{[^}]*max-height:\s*280px/,
    );
  });

  it("expands to two-column grid only at desktop breakpoint (1024px+)", () => {
    const desktopSection = globalsCss.slice(
      globalsCss.indexOf("@media (min-width: 1024px)"),
    );
    expect(desktopSection).toMatch(
      /\.deck-builder__panels\s*\{[^}]*grid-template-columns/,
    );
  });

  it("defines touch-friendly catalog row targets", () => {
    expect(globalsCss).toMatch(/\.deck-builder__catalog-item/);
    expect(globalsCss).toMatch(/\.deck-builder__catalog-virtual/);
  });
});
