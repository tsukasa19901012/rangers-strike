import { describe, expect, it } from "vitest";
import { loadCardDslEffectsFromCatalog } from "./loadFromCards";
import { resetDslRegistryForTests } from "./registry";

describe("loadFromCards", () => {
  it("registers fully DSL effects from card catalog", () => {
    resetDslRegistryForTests();
    const count = loadCardDslEffectsFromCatalog();
    expect(count).toBeGreaterThan(0);
  });
});
