import {
  buildAbarenohDeck,
  buildDekarangerDeck,
  buildMagikingDeck,
  buildStarterDeck,
  type CardDefinition,
  type StarterDeckId,
} from "@rangers-strike/cards";
import { createGame, type CreateGameOptions } from "../core/createGame";
import type { GameState } from "../types/game";
import { ALL_STARTER_DECK_IDS, type AllStarterDeckId } from "./starterDeckIds";

export const LEGEND1_STARTER_IDS = ["abarenoh", "dekaranger", "magiking"] as const;
export type Legend1StarterId = (typeof LEGEND1_STARTER_IDS)[number];

export { ALL_STARTER_DECK_IDS, type AllStarterDeckId };

const STARTER_BUILDERS: Record<Legend1StarterId, () => CardDefinition[]> = {
  abarenoh: buildAbarenohDeck,
  dekaranger: buildDekarangerDeck,
  magiking: buildMagikingDeck,
};

export function buildLegend1StarterDeck(id: Legend1StarterId): CardDefinition[] {
  return STARTER_BUILDERS[id]();
}

export function buildAnyStarterDeck(id: StarterDeckId): CardDefinition[] {
  return buildStarterDeck(id);
}

export type CreateStarterGameOptions = Omit<
  CreateGameOptions,
  "player1Deck" | "player2Deck"
> & {
  player1Starter?: Legend1StarterId | StarterDeckId;
  player2Starter?: Legend1StarterId | StarterDeckId;
  player1Deck?: CardDefinition[];
  player2Deck?: CardDefinition[];
};

/**
 * スターターデッキ（Type A/B/C ほか全15種）でゲームを開始する。
 * フルカタログ definitions（カード効果 TS ハンドラ含む）。
 */
export function createStarterGame(options: CreateStarterGameOptions = {}): GameState {
  const player1Deck =
    options.player1Deck ??
    buildAnyStarterDeck((options.player1Starter ?? "abarenoh") as StarterDeckId);
  const player2Deck =
    options.player2Deck ??
    buildAnyStarterDeck((options.player2Starter ?? "dekaranger") as StarterDeckId);

  return createGame({
    ...options,
    player1Deck,
    player2Deck,
  });
}
