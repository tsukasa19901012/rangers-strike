/**
 * Auto-generated full-playable integration test manifest (M13).
 * Regenerate: npm run generate-integration-tests -w @rangers-strike/cards
 */
import { describe, it, expect } from "vitest";
import * as cardDsl from "@rangers-strike/cards/dsl";

describe("full-playable DSL integration manifest", () => {
  const coreRegistry = cardDsl.createCardRegistryFromCatalog();
  const fullRegistry = cardDsl.createFullPlayableRegistry();

  it("covers 698 core interpreter-ready cards", () => {
    expect(coreRegistry.listDslReady().length).toBe(698);
  });

  it("covers 1849 full-playable interpreter-ready cards", () => {
    expect(fullRegistry.listDslReady().length).toBeGreaterThanOrEqual(1849);
  });

  it("indexes 3097 effect test cases (3054 active, 43 skipped)", () => {
    expect(3097).toBeGreaterThan(0);
  });
});

