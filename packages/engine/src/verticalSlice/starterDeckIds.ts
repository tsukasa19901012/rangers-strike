import type { StarterDeckId } from "@rangers-strike/cards";

/** 全28種スターターデッキ（1〜9弾＋ライダーEXP vol.1〜4）。 */
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
  "rider-exp-1-a",
  "rider-exp-1-b",
  "rider-exp-1-c",
  "rider-exp-1-d",
  "rider-exp-2-a",
  "rider-exp-2-b",
  "rider-exp-2-c",
  "rider-exp-2-d",
  "rider-exp-3-a",
  "rider-exp-3-b",
  "rider-exp-4-1",
  "rider-exp-4-2",
  "rider-exp-4-3",
] as const satisfies readonly StarterDeckId[];

export type AllStarterDeckId = (typeof ALL_STARTER_DECK_IDS)[number];
