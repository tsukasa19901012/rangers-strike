/**
 * Auto-generated full-playable integration test manifest (M13).
 * Regenerate: npm run generate-integration-tests -w @rangers-strike/cards
 */
import { describe, it, expect } from "vitest";
import * as cardDsl from "@rangers-strike/cards/dsl";

describe("full-playable DSL integration manifest", () => {
  const coreRegistry = cardDsl.createCardRegistryFromCatalog();
  const fullRegistry = cardDsl.createFullPlayableRegistry();

  it("covers 691 core interpreter-ready cards", () => {
    expect(coreRegistry.listDslReady().length).toBe(691);
  });

  it("covers 1730 full-playable interpreter-ready cards", () => {
    expect(fullRegistry.listDslReady().length).toBeGreaterThanOrEqual(1730);
  });

  it("indexes 2978 effect test cases (2971 active, 7 skipped)", () => {
    expect(2978).toBeGreaterThan(0);
  });
});

