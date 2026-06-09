import { describe, it, expect } from "vitest";
import { CardRegistry, createCardRegistryFromCatalog } from "./registry";

describe("dsl/registry", () => {
  it("indexes cards and effects", () => {
    const registry = createCardRegistryFromCatalog();
    expect(registry.size()).toBeGreaterThan(0);
    expect(registry.effectCount()).toBeGreaterThan(0);

    const card = registry.getCard("RS-046");
    expect(card).toBeDefined();

    const effect = registry.getEffect("armor_attack");
    expect(effect?.cardId).toBe("RS-046");
  });

  it("lists by trigger", () => {
    const registry = createCardRegistryFromCatalog();
    const onRush = registry.listByTrigger("on_rush");
    expect(onRush.some((e) => e.cardId === "RS-046")).toBe(true);
  });

  it("snapshot reports coverage buckets", () => {
    const registry = new CardRegistry();
    registry.registerAll(createCardRegistryFromCatalog().listCards().slice(0, 10));
    const snap = registry.snapshot();
    expect(snap.cards.size).toBe(10);
  });
});
