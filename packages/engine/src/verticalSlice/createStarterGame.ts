import {
  buildAbarenohDeck,
  buildDekarangerDeck,
  buildMagikingDeck,
  type CardDefinition,
} from "@rangers-strike/cards";
import { createGame, type CreateGameOptions } from "../core/createGame";
import type { GameState } from "../types/game";

export const LEGEND1_STARTER_IDS = ["abarenoh", "dekaranger", "magiking"] as const;
export type Legend1StarterId = (typeof LEGEND1_STARTER_IDS)[number];

const STARTER_BUILDERS: Record<Legend1StarterId, () => CardDefinition[]> = {
  abarenoh: buildAbarenohDeck,
  dekaranger: buildDekarangerDeck,
  magiking: buildMagikingDeck,
};

export function buildLegend1StarterDeck(id: Legend1StarterId): CardDefinition[] {
  return STARTER_BUILDERS[id]();
}

export type CreateStarterGameOptions = Omit<
  CreateGameOptions,
  "player1Deck" | "player2Deck"
> & {
  player1Starter?: Legend1StarterId;
  player2Starter?: Legend1StarterId;
  player1Deck?: CardDefinition[];
  player2Deck?: CardDefinition[];
};

/**
 * 第1弾スターター（Type A/B/C）でゲームを開始する。
 * フルカタログ definitions（カード効果 TS ハンドラ含む）。
 */
export function createStarterGame(options: CreateStarterGameOptions = {}): GameState {
  const player1Deck =
    options.player1Deck ?? buildLegend1StarterDeck(options.player1Starter ?? "abarenoh");
  const player2Deck =
    options.player2Deck ?? buildLegend1StarterDeck(options.player2Starter ?? "dekaranger");

  return createGame({
    ...options,
    player1Deck,
    player2Deck,
  });
}
