import { describe, expect, it } from "vitest";
import {
  getCardDslDocument,
  isDslInterpreterCard,
  listDslEffectsForTrigger,
} from "./effectLookup";

describe("effectLookup full-playable fallback", () => {
  it("resolves core cards from default registry", () => {
    const doc = getCardDslDocument("RS-001");
    expect(doc?.implementation?.handler).toBe("interpreter");
  });

  it("resolves promoted cards not in core registry", () => {
    const doc = getCardDslDocument("PK-001");
    expect(doc).toBeDefined();
    expect(doc?.implementation?.handler).toBe("interpreter");
    expect(isDslInterpreterCard("PK-001")).toBe(true);
  });

  it("lists DSL effects for promoted card triggers", () => {
    const effects = listDslEffectsForTrigger("PK-001", "nc");
    expect(effects.length).toBeGreaterThan(0);
    expect(effects[0]?.effects.some((p) => p.type === "grant_keyword")).toBe(true);
  });

  it("lists while_in_field grant_keyword on promoted vehicle", () => {
    const effects = listDslEffectsForTrigger("RK-030", "while_in_field");
    expect(effects.some((e) => e.effects.some((p) => p.type === "grant_keyword"))).toBe(
      true,
    );
  });
});
