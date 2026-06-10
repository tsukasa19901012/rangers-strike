export {
  createStarterGame,
  buildLegend1StarterDeck,
  LEGEND1_STARTER_IDS,
  type Legend1StarterId,
  type CreateStarterGameOptions,
} from "./createStarterGame";
export {
  buildFullPromotedDeck,
  buildHybridPromotedDeck,
  createFullPromotedGame,
  createHybridPromotedGame,
  type CreateFullPromotedGameOptions,
  type CreateHybridPromotedGameOptions,
} from "./createPromotedGame";
export {
  playStarterMatchUntilEnd,
  type StarterMatchResult,
  type StarterMatchStopReason,
} from "./playStarterMatch";
