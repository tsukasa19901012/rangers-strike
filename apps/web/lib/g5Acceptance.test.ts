import {
  fullPlayableCatalog,
  getCardById,
  getFullPlayableCardById,
  getStarterDeck,
  resolvePlayableCard,
  type DeckEntry,
} from "@rangers-strike/cards";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./deckBuilder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./deckBuilder")>();
  return {
    ...actual,
    getCustomDeck: vi.fn(),
  };
});

import { getCustomDeck, validateDeckEntries } from "./deckBuilder";
import { estimateDeckWarnings } from "./deckWarnings";
import {
  createGameFromDeckSelections,
  resolveDeckCards,
} from "./deckSelection";
import { STARTER_OPTIONS } from "./labels";

function abarenohEntriesWithPromoted(): DeckEntry[] {
  return getStarterDeck("abarenoh").entries.map((entry) =>
    entry.cardId === "RS-014" ? { cardId: "BK-001", count: 1 } : { ...entry },
  );
}

describe("AC-01 — fullPlayableCatalog includes BK core cards", () => {
  it("AC-01: fullPlayableCatalog contains BK-001 as core legend1", () => {
    const ids = new Set(fullPlayableCatalog.cards.map((card) => card.id));
    expect(ids.has("BK-001")).toBe(true);
    expect(fullPlayableCatalog.cards.length).toBe(1849);

    const card = getFullPlayableCardById("BK-001");
    expect(card).toBeDefined();
    expect(card?.name).toBeTruthy();
    expect(card?.expansion).toBe("legend1");
    expect(getCardById("BK-001")).toEqual(card);
  });
});

describe("AC-02 — promoted deck validation and UI warnings", () => {
  it("AC-02: 40-card promoted entries pass validateDeckEntries without DSL-ready warnings", () => {
    const entries = abarenohEntriesWithPromoted();
    const validation = validateDeckEntries(entries);
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.total).toBe(40);

    const warnings = estimateDeckWarnings(entries);
    expect(warnings.uiUncertainCount).toBe(0);
    expect(warnings.uncertainCardIds).not.toContain("BK-001");
  });
});

describe("AC-03 — game start from promoted custom vs starter", () => {
  beforeEach(() => {
    vi.mocked(getCustomDeck).mockReset();
  });

  it("AC-03: createGameFromDeckSelections starts charge phase for promoted custom vs starter", () => {
    const entries = abarenohEntriesWithPromoted();
    vi.mocked(getCustomDeck).mockReturnValue({
      id: "g5-promoted",
      name: "G5 promoted",
      entries,
      updatedAt: 0,
    });

    const game = createGameFromDeckSelections(
      { kind: "custom", id: "g5-promoted" },
      { kind: "starter", id: "dekaranger" },
      { firstPlayer: "player1", rng: () => 0.42 },
    );

    expect(game.phase).toBe("charge");
    expect(game.winner).toBeNull();
    expect(game.definitions["BK-001"]).toBeDefined();
    expect(
      game.players.player1.hand.length +
        game.players.player1.deck.length +
        game.players.player2.hand.length +
        game.players.player2.deck.length,
    ).toBeGreaterThan(0);
  });
});

describe("AC-04 — resolvePlayableCard vs core getCardById", () => {
  it("AC-04: BK-001 is core via getCardById and resolvePlayableCard", () => {
    const fromCore = getCardById("BK-001");
    expect(fromCore).toBeDefined();
    expect(fromCore?.name.length).toBeGreaterThan(0);
    expect(fromCore?.text?.length).toBeGreaterThan(0);

    const card = resolvePlayableCard("BK-001");
    expect(card).toEqual(fromCore);
  });

  it("AC-04: PK-001 remains promoted-only outside core catalog", () => {
    expect(getCardById("PK-001")).toBeUndefined();
    expect(resolvePlayableCard("PK-001")).toBeDefined();
  });
});

describe("AC-05 — starter decks and full-playable presets", () => {
  it.each(STARTER_OPTIONS.map((option) => [option.id] as const))(
    "AC-05: starter %s validates and resolves to 40 cards",
    (starterId) => {
      const deck = getStarterDeck(starterId);
      const validation = validateDeckEntries(deck.entries);
      expect(validation.ok).toBe(true);
      expect(validation.errors).toEqual([]);

      const cards = resolveDeckCards({ kind: "starter", id: starterId });
      expect(cards).toHaveLength(40);
    },
  );

  it("AC-05: full-promoted and hybrid-promoted presets start a game", () => {
    const fullPromoted = createGameFromDeckSelections(
      { kind: "full-promoted" },
      { kind: "full-promoted" },
      { firstPlayer: "player1", rng: () => 0.42 },
    );
    expect(fullPromoted.phase).toBe("charge");
    expect(fullPromoted.winner).toBeNull();

    const hybrid = createGameFromDeckSelections(
      { kind: "hybrid-promoted", tier: 10 },
      { kind: "starter", id: "abarenoh" },
      { firstPlayer: "player2", rng: () => 0.77 },
    );
    expect(hybrid.phase).toBe("charge");
    expect(hybrid.winner).toBeNull();
    expect(hybrid.players.player1.hand.length).toBeGreaterThan(0);
    expect(hybrid.players.player2.hand.length).toBeGreaterThan(0);
  });
});

// AC-06: mobileDeckBuilderLayout.test.ts (CSS) + e2e/deck-builder-mobile.spec.ts (Playwright)
