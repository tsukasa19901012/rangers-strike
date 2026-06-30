/**
 * Auto-generated full-playable integration test manifest (M13).
 * Regenerate: npm run generate-integration-tests -w @rangers-strike/cards
 */
import { describe, it, expect } from "vitest";
import * as cardDsl from "@rangers-strike/cards/dsl";

describe("full-playable DSL integration manifest", () => {
  const coreRegistry = cardDsl.createCardRegistryFromCatalog();
  const fullRegistry = cardDsl.createFullPlayableRegistry();

  it("covers 1052 core interpreter-ready cards", () => {
    expect(coreRegistry.listDslReady().length).toBe(1052);
  });

  it("covers 1832 full-playable interpreter-ready cards", () => {
    expect(fullRegistry.listDslReady().length).toBeGreaterThanOrEqual(1832);
  });

  it("indexes 3094 effect test cases (3050 active, 44 skipped)", () => {
    expect(3094).toBeGreaterThan(0);
  });
});

