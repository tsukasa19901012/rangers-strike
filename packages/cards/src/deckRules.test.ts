import { describe, expect, it, vi } from "vitest";
import * as bannedCards from "./bannedCards";
import { getCardById } from "./catalog";
import { FULL_PLAYABLE_CARD_COUNT } from "./catalog/tiers";
import { fullPlayableCatalog, getFullPlayableCardById } from "./extendedCatalog";
import abarenohDeck from "./legend1/decks/abarenoh.json";
import dekarangerDeck from "./legend1/decks/dekaranger.json";
import magikingDeck from "./legend1/decks/magiking.json";
import roaringWingsDeck from "./legend3/decks/roaring-wings.json";
import silverAdventurerDeck from "./legend3/decks/silver-adventurer.json";
import type { DeckDefinition } from "./schema";
import {
  DECK_NAME_COPY_LIMIT,
  DECK_UNLIMITED_COPY_CAP,
  deckCopyUnlimited,
  maxCopiesForCard,
  remainingCopiesForCard,
  validateDeckEntries,
} from "./deckRules";

const starterDecks: DeckDefinition[] = [
  abarenohDeck,
  dekarangerDeck,
  magikingDeck,
  roaringWingsDeck,
  silverAdventurerDeck,
];

describe("deck build rules", () => {
  it("allows up to 3 copies of SR cards such as RS-050", () => {
    const card = getCardById("RS-050");
    expect(card?.rarity).toBe("SR");
    expect(maxCopiesForCard(card!)).toBe(DECK_NAME_COPY_LIMIT);
    const three = validateDeckEntries([{ cardId: "RS-050", count: 3 }], undefined, {
      minSize: 0,
    });
    expect(three.errors.filter((e) => e.includes("枚まで") || e.includes("同名"))).toHaveLength(0);
    const four = validateDeckEntries([{ cardId: "RS-050", count: 4 }], undefined, {
      minSize: 0,
    });
    expect(four.errors.some((e) => e.includes("アバレンオー"))).toBe(true);
  });

  it("treats 戦闘員 and deck-note cards as unlimited", () => {
    const hidora = getCardById("RS-080");
    expect(hidora).toBeDefined();
    expect(deckCopyUnlimited(hidora!)).toBe(true);
    expect(maxCopiesForCard(hidora!)).toBe(DECK_UNLIMITED_COPY_CAP);
    const many = validateDeckEntries([{ cardId: "RS-080", count: 10 }], undefined, {
      minSize: 0,
    });
    expect(many.errors.filter((e) => e.includes("枚まで") || e.includes("同名"))).toHaveLength(0);
  });

  it("limits copies across different ids with the same name", () => {
    const deka2nd = getFullPlayableCardById("RS-572");
    const dekaCore = getFullPlayableCardById("RS-319");
    // wiki 準拠で 2nd は区別表記付きだが、同名判定では同じ名前として扱う
    expect(deka2nd?.name).toBe("デカマスター（2nd）");
    expect(dekaCore?.name).toBe("デカマスター");

    const entries = [
      { cardId: "RS-572", count: 2 },
      { cardId: "RS-319", count: 1 },
    ];
    expect(remainingCopiesForCard(deka2nd!, entries, fullPlayableCatalog)).toBe(0);
    const over = validateDeckEntries(
      [
        { cardId: "RS-572", count: 2 },
        { cardId: "RS-319", count: 2 },
      ],
      fullPlayableCatalog,
      { minSize: 0 },
    );
    expect(over.errors.some((e) => e.includes("デカマスター"))).toBe(true);
  });

  it("rejects more than 3 copies of the same card name", () => {
    const over = validateDeckEntries([{ cardId: "RS-054", count: 4 }], undefined, {
      minSize: 0,
    }).errors;
    expect(over.length).toBeGreaterThan(0);
    expect(over.join(" ")).toMatch(/アバレッド（RS-054）|同名|最大/);
  });

  it("reports shortfall when deck is below minimum size", () => {
    const result = validateDeckEntries([{ cardId: "RS-050", count: 10 }]);
    expect(result.errors).toContain(
      "デッキは最低40枚必要です（現在 10 枚）。あと 30 枚必要です",
    );
  });

  it("counts 2nd/XG variants as the same card name (glossary 2nd)", () => {
    // RS-443 バトルジャパン + XG1-001 バトルジャパン（XG）は同名扱いで合計3枚まで
    const over = validateDeckEntries(
      [
        { cardId: "RS-443", count: 2 },
        { cardId: "XG1-001", count: 2 },
      ],
      fullPlayableCatalog,
      { minSize: 0 },
    );
    expect(over.errors.some((e) => e.includes("同名で最大 3 枚"))).toBe(true);

    const ok = validateDeckEntries(
      [
        { cardId: "RS-443", count: 1 },
        { cardId: "XG1-001", count: 2 },
      ],
      fullPlayableCatalog,
      { minSize: 0 },
    );
    expect(ok.errors).toEqual([]);
  });

  it("flags unknown ids against fullPlayableCatalog with pool context", () => {
    const result = validateDeckEntries(
      [{ cardId: "RS-9999", count: 1 }],
      fullPlayableCatalog,
      { minSize: 0 },
    );
    expect(result.errors).toContain(
      `カタログにないカードです: RS-9999（${FULL_PLAYABLE_CARD_COUNT.toLocaleString()}枚プール外の可能性）`,
    );
  });

  it("validates official starter decks", () => {
    for (const deck of Object.values(starterDecks)) {
      const result = validateDeckEntries(deck.entries);
      expect(result.errors, deck.id).toEqual([]);
      expect(result.total).toBe(40);
    }
  });

  it("validates all 5 starter decks against fullPlayableCatalog", () => {
    for (const deck of starterDecks) {
      const result = validateDeckEntries(deck.entries, fullPlayableCatalog);
      expect(result.errors, deck.id).toEqual([]);
      expect(result.total).toBe(40);
    }
  });

  it("rejects banned cards when isBannedCardId returns true", () => {
    const spy = vi.spyOn(bannedCards, "isBannedCardId").mockImplementation((id) => id === "RS-050");
    const result = validateDeckEntries([{ cardId: "RS-050", count: 1 }], undefined, {
      minSize: 0,
    });
    expect(result.errors).toContain("禁止カードが含まれています: アバレンオー（RS-050）");
    spy.mockRestore();
  });

  it("rejects commander cards even when present in an extended catalog", () => {
    const commander = {
      id: "XC-001",
      name: "ゾル大佐",
      type: "commander" as const,
      category: "DA" as const,
      rarity: "N" as const,
      expansion: "wiki_stub",
      powerCost: 0,
    };
    const catalog = { expansion: "test", cards: [commander] };
    const result = validateDeckEntries([{ cardId: "XC-001", count: 1 }], catalog, {
      minSize: 0,
    });
    expect(result.errors.some((e) => e.includes("コマンダーカード"))).toBe(true);
  });
});

describe("isBannedCardId", () => {
  it("returns false for ids not in BANNED_CARD_IDS", () => {
    expect(bannedCards.isBannedCardId("RS-050")).toBe(false);
    expect(bannedCards.isBannedCardId("RS-318")).toBe(false);
  });
});
