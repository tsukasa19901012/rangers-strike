// 対戦台・自己対戦で使うデッキ（スターター以外は arena-decks/<id>.json）を読む。cpu-arena.ts と selfplay.ts で共有する。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allCardsCatalog, expandDeck, type CardDefinition, type DeckDefinition } from "@rangers-strike/cards";
import { ALL_STARTER_DECK_IDS } from "../src/verticalSlice/createStarterGame";

export const ARENA_DECKS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../arena-decks");

/** arena-decks/<id>.json（大会のデッキ等、スターター以外）があればそのデッキ、なければ undefined（スターターを使う）。 */
export function arenaDeck(id: string): CardDefinition[] | undefined {
  const file = resolve(ARENA_DECKS_DIR, `${id}.json`);
  if (!existsSync(file)) return undefined;
  const deck = JSON.parse(readFileSync(file, "utf8")) as DeckDefinition;
  return expandDeck(deck, allCardsCatalog);
}

/** arena-decks にあるデッキの id。prefix を渡すとその接頭辞のものだけ（"blog-" など）。 */
export function arenaDeckIds(prefix = ""): string[] {
  return readdirSync(ARENA_DECKS_DIR)
    .filter((f) => f.endsWith(".json") && f.startsWith(prefix))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

/**
 * --decks の値をデッキ id の一覧にする。カンマ区切りで、id のほかにまとめて指定する名前も使える:
 * starters（スターター 46 個）、arena（arena-decks の全部）、wiki（atwiki 由来）、blog（ブログ等由来）。
 */
export function resolveDeckList(spec: string): string[] {
  const groups: Record<string, () => readonly string[]> = {
    starters: () => ALL_STARTER_DECK_IDS,
    arena: () => arenaDeckIds(),
    wiki: () => arenaDeckIds("wiki-"),
    blog: () => arenaDeckIds("blog-"),
  };
  return spec.split(",").flatMap((s) => (groups[s] ? [...groups[s]!()] : [s]));
}
