import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allCardsCatalog, validateDeckEntries, type DeckDefinition } from "@rangers-strike/cards";

const dir = resolve(__dirname, "../../arena-decks");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("arena-decks のデッキ", () => {
  it.each(files)("%s はデッキの決まり（40 枚以上・同名 3 枚まで・カタログのカード）を満たす", (file) => {
    const deck = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as DeckDefinition;
    expect(deck.id).toBe(file.slice(0, -".json".length));
    expect(validateDeckEntries(deck.entries, allCardsCatalog).errors).toEqual([]);
  });
});
