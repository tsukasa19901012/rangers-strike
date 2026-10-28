import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allCardsCatalog, validateDeckEntries, type DeckDefinition } from "@rangers-strike/cards";
import { resolveDeckList, resolveDeckPool } from "../../scripts/arenaDecks";

const dir = resolve(__dirname, "../../arena-decks");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

describe("arena-decks のデッキ", () => {
  it.each(files)("%s はデッキの決まり（40 枚以上・同名 3 枚まで・カタログのカード）を満たす", (file) => {
    const deck = JSON.parse(readFileSync(resolve(dir, file), "utf8")) as DeckDefinition;
    expect(deck.id).toBe(file.slice(0, -".json".length));
    expect(validateDeckEntries(deck.entries, allCardsCatalog).errors).toEqual([]);
  });
});

describe("--decks の「名前=重み」", () => {
  it("グループを重みの割合で選び、その中から同じ確率で選ぶ", () => {
    const starters = new Set(resolveDeckList("starters"));
    const pool = resolveDeckPool("starters=3,livedoor=1");
    let s = 1;
    const rand = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    let fromStarters = 0;
    for (let i = 0; i < 4000; i++) if (starters.has(pool.pick(rand))) fromStarters++;
    // livedoor（373 個）はスターター（46 個）より多いが、選ばれるのは重みどおり 3:1。
    expect(fromStarters / 4000).toBeGreaterThan(0.7);
    expect(fromStarters / 4000).toBeLessThan(0.8);
  });

  it("= がなければ今までどおり全デッキから選ぶ", () => {
    expect(resolveDeckPool("starters,arena").ids).toEqual(resolveDeckList("starters,arena"));
  });
});
