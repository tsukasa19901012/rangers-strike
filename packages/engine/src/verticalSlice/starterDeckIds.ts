import type { StarterDeckId } from "@rangers-strike/cards";

/** 全15種スターターデッキ（1〜9弾）。 */
export const ALL_STARTER_DECK_IDS = [
  "abarenoh",
  "dekaranger",
  "magiking",
  "five-dragons-a",
  "five-dragons-b",
  "five-dragons-c",
  "five-dragons-d",
  "roaring-wings",
  "silver-adventurer",
  "seven-ninja-a",
  "seven-ninja-b",
  "seven-ninja-c",
  "blue-nine-a",
  "blue-nine-b",
  "blue-nine-c",
] as const satisfies readonly StarterDeckId[];

export type AllStarterDeckId = (typeof ALL_STARTER_DECK_IDS)[number];
