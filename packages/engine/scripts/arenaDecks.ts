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
 * starters（スターター 46 個）、arena（arena-decks のうち下の 3 グループ以外）、wiki（atwiki 由来）、blog（ブログ等由来、下の 3 グループ以外）、
 * livedoor（livedoor「letsrenst」由来の 373 個）、blog2（2026-10-28 に足したブログ 3 つと OCTGN のサンプルデッキ、90 個）、
 * rstournament（レンスト地域対抗戦 2018〜19 年のデッキ 56 個。計測用のテスト用デッキ）。
 * この 3 グループは arena・blog には入れず、名指ししたときだけ使う。
 */
const GROUP_PREFIXES = {
  livedoor: ["blog-livedoor-"],
  blog2: ["blog-gyorie-", "blog-bluesplash-urara-", "blog-hokkaidohobbies-", "octgn-rsxg-"],
  rstournament: ["rstournament-"],
} as const;
const NAMED_ONLY = Object.values(GROUP_PREFIXES).flat();
const inGroup = (id: string, prefixes: readonly string[]) => prefixes.some((p) => id.startsWith(p));

export function resolveDeckList(spec: string): string[] {
  const groups: Record<string, () => readonly string[]> = {
    starters: () => ALL_STARTER_DECK_IDS,
    arena: () => arenaDeckIds().filter((id) => !inGroup(id, NAMED_ONLY)),
    wiki: () => arenaDeckIds("wiki-"),
    blog: () => arenaDeckIds("blog-").filter((id) => !inGroup(id, NAMED_ONLY)),
    livedoor: () => arenaDeckIds().filter((id) => inGroup(id, GROUP_PREFIXES.livedoor)),
    blog2: () => arenaDeckIds().filter((id) => inGroup(id, GROUP_PREFIXES.blog2)),
    rstournament: () => arenaDeckIds().filter((id) => inGroup(id, GROUP_PREFIXES.rstournament)),
  };
  return spec.split(",").flatMap((s) => (groups[s] ? [...groups[s]!()] : [s]));
}
