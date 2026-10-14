import { describe, expect, it } from "vitest";
import { buildDeckChunks, chunksForMatch, collectDeckCardIds, pruneCardData } from "./split";

const decks = [
  { id: "a", entries: [{ cardId: "RS-001", count: 2 }, { cardId: "RS-002", count: 1 }] },
  { id: "b", entries: [{ cardId: "RS-002", count: 3 }, { cardId: "RS-003", count: 1 }] },
];

describe("card data split", () => {
  it("collects the union of deck card ids", () => {
    expect([...collectDeckCardIds(decks)].sort()).toEqual(["RS-001", "RS-002", "RS-003"]);
  });

  it("builds per-deck chunks and selects them for a match", () => {
    const chunks = buildDeckChunks(decks);
    expect(chunks.map((c) => c.id)).toEqual(["deck:a", "deck:b"]);
    expect(chunksForMatch(chunks, ["b"])[0]!.cardIds).toEqual(["RS-002", "RS-003"]);
  });

  it("prunes catalog, stub and label files and ignores other files", () => {
    const keep = new Set(["RS-001"]);
    expect(
      pruneCardData("generated/catalog/full-playable/cards.json", { expansion: "x", cards: [{ id: "RS-001" }, { id: "RS-009" }] }, keep),
    ).toEqual({ expansion: "x", cards: [{ id: "RS-001" }] });
    expect(pruneCardData("generated/dsl-stubs/stubs-bundle.json", { "RS-001": 1, "RS-009": 2 }, keep)).toEqual({ "RS-001": 1 });
    expect(pruneCardData("generated/wiki-set-labels.json", { cardCount: 2, labels: { "RS-001": "x", "RS-009": "y" } }, keep)).toEqual({
      cardCount: 2,
      labels: { "RS-001": "x" },
    });
    expect(pruneCardData("legend1/decks/abarenoh.json", {}, keep)).toBeNull();
  });
});
