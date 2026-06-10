import { describe, expect, it } from "vitest";
import { resolvePlayableCard } from "./extendedCatalog";

describe("resolvePlayableCard", () => {
  it("returns core definition when id is in core catalog", () => {
    const card = resolvePlayableCard("RS-006");
    expect(card).toBeDefined();
    expect(card?.name).toBe("新体操アクション");
    expect(card?.expansion).toBe("legend1");
  });

  it("returns full playable definition for promoted-only ids", () => {
    const card = resolvePlayableCard("BK-001");
    expect(card).toBeDefined();
    expect(card?.name).toBe("タイフーン（1号）");
    expect(card?.expansion).toBe("vanilla-promoted");
  });

  it("returns undefined for unknown ids", () => {
    expect(resolvePlayableCard("UNKNOWN-999")).toBeUndefined();
  });
});
