import { describe, expect, it } from "vitest";
import { getCardById } from "./catalog";
import abarenohDeck from "./legend1/decks/abarenoh.json";
import dekarangerDeck from "./legend1/decks/dekaranger.json";
import magikingDeck from "./legend1/decks/magiking.json";
import type { DeckDefinition } from "./schema";
import {
  DECK_NAME_COPY_LIMIT,
  DECK_UNLIMITED_COPY_CAP,
  deckCopyUnlimited,
  maxCopiesForCard,
  validateDeckEntries,
} from "./deckRules";

const starterDecks: DeckDefinition[] = [abarenohDeck, dekarangerDeck, magikingDeck];

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

  it("rejects more than 3 copies of the same card name", () => {
    const over = validateDeckEntries([{ cardId: "RS-054", count: 4 }]).errors;
    expect(over.length).toBeGreaterThan(0);
    expect(over.join(" ")).toMatch(/アバレッド|同名|最大/);
  });

  it("validates official starter decks", () => {
    for (const deck of Object.values(starterDecks)) {
      const result = validateDeckEntries(deck.entries);
      expect(result.errors, deck.id).toEqual([]);
      expect(result.total).toBe(40);
    }
  });
});
