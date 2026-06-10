import { buildStarterDeck, getStarterDeck, type DeckEntry } from "@rangers-strike/cards";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./deckBuilder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./deckBuilder")>();
  return {
    ...actual,
    getCustomDeck: vi.fn(),
  };
});

import { buildCardDefinitions, getCustomDeck } from "./deckBuilder";
import {
  createGameFromDeckSelections,
  resolveDeckCards,
  validateDeckSelection,
} from "./deckSelection";

function abarenohEntriesWithPromoted(): DeckEntry[] {
  return getStarterDeck("abarenoh").entries.map((entry) =>
    entry.cardId === "RS-014" ? { cardId: "BK-001", count: 1 } : { ...entry },
  );
}

describe("validateDeckSelection", () => {
  beforeEach(() => {
    vi.mocked(getCustomDeck).mockReset();
  });

  it("accepts a valid custom deck with a promoted card", () => {
    vi.mocked(getCustomDeck).mockReturnValue({
      id: "test-promoted",
      name: "Promoted test",
      entries: abarenohEntriesWithPromoted(),
      updatedAt: 0,
    });

    const result = validateDeckSelection({ kind: "custom", id: "test-promoted" });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a custom deck with fewer than 40 cards", () => {
    const entries = abarenohEntriesWithPromoted().map((entry) =>
      entry.cardId === "RS-022" ? { ...entry, count: 0 } : entry,
    );
    vi.mocked(getCustomDeck).mockReturnValue({
      id: "test-short",
      name: "Short deck",
      entries,
      updatedAt: 0,
    });

    const result = validateDeckSelection({ kind: "custom", id: "test-short" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("40枚"))).toBe(true);
  });

  it("rejects a missing custom deck", () => {
    vi.mocked(getCustomDeck).mockReturnValue(undefined);

    const result = validateDeckSelection({ kind: "custom", id: "missing" });
    expect(result).toEqual({ ok: false, errors: ["デッキが見つかりません"] });
  });

  it("accepts starter and promoted presets without validation", () => {
    expect(validateDeckSelection({ kind: "starter", id: "abarenoh" })).toEqual({
      ok: true,
      errors: [],
    });
    expect(validateDeckSelection({ kind: "full-promoted" })).toEqual({
      ok: true,
      errors: [],
    });
    expect(validateDeckSelection({ kind: "hybrid-promoted", tier: 10 })).toEqual({
      ok: true,
      errors: [],
    });
  });
});

describe("resolveDeckCards", () => {
  beforeEach(() => {
    vi.mocked(getCustomDeck).mockReset();
  });

  it("returns 40 cards for a starter deck", () => {
    const cards = resolveDeckCards({ kind: "starter", id: "abarenoh" });
    expect(cards).toHaveLength(40);
  });

  it("expands a promoted custom deck through fullPlayableCatalog", () => {
    const entries = abarenohEntriesWithPromoted();
    vi.mocked(getCustomDeck).mockReturnValue({
      id: "test-promoted",
      name: "Promoted test",
      entries,
      updatedAt: 0,
    });

    const cards = resolveDeckCards({ kind: "custom", id: "test-promoted" });
    expect(buildCardDefinitions(entries)).toHaveLength(40);
    expect(cards).toHaveLength(40);
    expect(cards.some((card) => card.id === "BK-001")).toBe(true);
  });
});

describe("createGameFromDeckSelections — custom promoted deck", () => {
  beforeEach(() => {
    vi.mocked(getCustomDeck).mockReset();
  });

  it("starts a game from a custom deck containing a promoted card", () => {
    const entries = abarenohEntriesWithPromoted();
    vi.mocked(getCustomDeck).mockReturnValue({
      id: "test-promoted",
      name: "Promoted test",
      entries,
      updatedAt: 0,
    });

    const game = createGameFromDeckSelections(
      { kind: "custom", id: "test-promoted" },
      { kind: "starter", id: "abarenoh" },
      { firstPlayer: "player1", rng: () => 0.42 },
    );

    expect(game.phase).toBe("charge");
    expect(game.winner).toBeNull();
    expect(game.definitions["BK-001"]).toBeDefined();
    expect(
      game.players.player1.deck.length +
        game.players.player1.hand.length +
        game.players.player2.deck.length +
        game.players.player2.hand.length,
    ).toBeGreaterThan(0);
    expect(buildStarterDeck("abarenoh")).toHaveLength(40);
  });
});
