import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildAbarenohDeck,
  buildDekarangerDeck,
  buildMagikingDeck,
  buildStarterDeck,
  deckCardCount,
  getCardBackImageUrl,
  getCardById,
  getCardImageUrl,
  legend1Catalog,
  legend2Catalog,
  legend3Catalog,
  allCardsCatalog,
  starterDecks,
} from "./index";

const legend1AssetsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/legend1",
);
const legend2AssetsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/legend2",
);
const legend3AssetsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/legend3",
);

describe("legend1 catalog", () => {
  it("contains 70 cards", () => {
    expect(legend1Catalog.cards).toHaveLength(70);
  });

  it("each card has imageUrl and a downloaded asset", () => {
    for (const card of legend1Catalog.cards) {
      expect(card.imageUrl).toBe(`/cards/legend1/${card.id}.jpg`);
      expect(card.imageSourceUrl).toContain("grnrngr.com");
      expect(getCardImageUrl(card.id)).toBe(card.imageUrl);
      expect(existsSync(path.join(legend1AssetsDir, `${card.id}.jpg`))).toBe(true);
    }
    expect(getCardBackImageUrl()).toBe("/cards/legend1/back.jpg");
    expect(existsSync(path.join(legend1AssetsDir, "back.jpg"))).toBe(true);
  });
});

describe("legend2 catalog", () => {
  it("contains 52 cards", () => {
    expect(legend2Catalog.cards).toHaveLength(52);
  });

  it("each card has imageUrl and a downloaded asset", () => {
    for (const card of legend2Catalog.cards) {
      expect(card.imageUrl).toBe(`/cards/legend2/${card.id}.jpg`);
      expect(card.imageSourceUrl).toContain("grnrngr.com");
      expect(getCardImageUrl(card.id)).toBe(card.imageUrl);
      expect(existsSync(path.join(legend2AssetsDir, `${card.id}.jpg`))).toBe(true);
    }
  });

  it("merges legend1 and legend2 without duplicate ids", () => {
    const merged = [...legend1Catalog.cards, ...legend2Catalog.cards];
    expect(merged).toHaveLength(122);
    const ids = new Set(merged.map((card) => card.id));
    expect(ids.size).toBe(122);
    expect(getCardById("RS-071")?.name).toBe("ヒドラー兵の卵");
    expect(getCardById("RS-122")?.name).toBe("ゴーゴーマリン");
  });
});

describe("legend3 catalog", () => {
  it("contains 57 cards", () => {
    expect(legend3Catalog.cards).toHaveLength(57);
  });

  it("each card has imageUrl and a downloaded asset", () => {
    for (const card of legend3Catalog.cards) {
      expect(card.imageUrl).toBe(`/cards/legend3/${card.id}.jpg`);
      expect(card.imageSourceUrl).toContain("grnrngr.com");
      expect(getCardImageUrl(card.id)).toBe(card.imageUrl);
      expect(existsSync(path.join(legend3AssetsDir, `${card.id}.jpg`))).toBe(true);
    }
  });

  it("merges into allCardsCatalog without duplicate ids", () => {
    expect(allCardsCatalog.cards).toHaveLength(179);
    const ids = new Set(allCardsCatalog.cards.map((card) => card.id));
    expect(ids.size).toBe(179);
    expect(getCardById("RS-123")?.name).toBe("スーパーダイナマイト");
    expect(getCardById("RS-151")?.name).toBe("ガオキング");
    expect(getCardById("SR-001")?.rarity).toBe("SC");
  });
});

describe.each([
  ["abarenoh", "A", "RS-050", 1],
  ["dekaranger", "B", "RS-042", 1],
  ["magiking", "C", "RS-070", 1],
  ["roaring-wings", "D", "RS-176", 1],
  ["silver-adventurer", "E", "RS-178", 1],
] as const)("starter deck %s", (id, type, flagshipId, flagshipCount) => {
  const deck = starterDecks[id];

  it("has 40 cards total", () => {
    expect(deckCardCount(deck)).toBe(40);
  });

  it(`is type ${type}`, () => {
    expect(deck.starterType).toBe(type);
  });

  it("expands to 40 card definitions", () => {
    expect(buildStarterDeck(id)).toHaveLength(40);
  });

  it(`includes flagship ${flagshipId}`, () => {
    const ids = buildStarterDeck(id).map((c) => c.id);
    expect(ids.filter((cardId) => cardId === flagshipId)).toHaveLength(
      flagshipCount,
    );
  });
});

describe("deck builders", () => {
  it("buildAbarenohDeck returns abaranger units", () => {
    const ids = buildAbarenohDeck().map((c) => c.id);
    expect(ids.filter((id) => id === "RS-051")).toHaveLength(2);
  });

  it("buildDekarangerDeck returns deka robo parts", () => {
    const ids = buildDekarangerDeck().map((c) => c.id);
    expect(ids.filter((id) => id === "RS-043")).toHaveLength(2);
    expect(ids.filter((id) => id === "RS-049")).toHaveLength(3);
  });

  it("buildMagikingDeck returns magiranger team", () => {
    const ids = buildMagikingDeck().map((c) => c.id);
    expect(ids.filter((id) => id === "RS-057")).toHaveLength(3);
    expect(ids.filter((id) => id === "RS-070")).toHaveLength(1);
  });

  it("buildStarterDeck(roaring-wings) includes GoGo vehicles and DaiTanken", () => {
    const ids = buildStarterDeck("roaring-wings").map((c) => c.id);
    expect(ids.filter((id) => id === "RS-171")).toHaveLength(2);
    expect(ids.filter((id) => id === "RS-176")).toHaveLength(1);
  });

  it("buildStarterDeck(silver-adventurer) includes power animals and Bouken Silver", () => {
    const ids = buildStarterDeck("silver-adventurer").map((c) => c.id);
    expect(ids.filter((id) => id === "RS-153")).toHaveLength(2);
    expect(ids.filter((id) => id === "RS-178")).toHaveLength(1);
  });
});
