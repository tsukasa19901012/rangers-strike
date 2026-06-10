/**
 * Auto-generated registry smoke test
 * Cards: 179 | Effects: 166
 */
import { describe, it, expect } from "vitest";
import { createCardRegistryFromCatalog } from "../registry";
import { validateCardDocument } from "../validator";

describe("CardRegistry smoke", () => {
  const registry = createCardRegistryFromCatalog();

  it("loads all catalog cards", () => {
    expect(registry.size()).toBeGreaterThan(0);
  });

  it("every card passes validation", () => {
    for (const card of registry.listCards()) {
      const result = validateCardDocument(card);
      expect(result.ok, `${card.id}: ${result.issues.map((i) => i.message).join(", ")}`).toBe(true);
    }
  });

  it("indexes effects by trigger", () => {
    const onRush = registry.listByTrigger("on_rush");
    expect(onRush.length).toBeGreaterThan(0);
  });

  it("reports implementation coverage", () => {
    const snap = registry.snapshot();
    expect(snap.legacyHandler.length + snap.dslReady.length + snap.unimplemented.length).toBe(
      registry.size(),
    );
  });
});
