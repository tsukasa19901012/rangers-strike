// Entry for the pre-bundled engine (scripts/build-engine.mjs -> src/generated/engine.js).
// Only the surface the Vita text UI and the smoke tests use is re-exported.
// The engine itself is not modified; card data is pruned at bundle time.
export {
  createStarterGame,
  getLegalActions,
  applyAction,
  getActionPlayerId,
  isCpuTurn,
  pickCpuAction,
  pickCpuFallbackAction,
  formatGameLog,
  formatActionError,
  effectiveBp,
  countAvailablePower,
  countOpponentMultiCategoryCommands,
  ALL_STARTER_DECK_IDS,
  WIN_DAMAGE,
} from "../../../packages/engine/src/index";
export { getEffectLabel, starterDecks } from "../../../packages/cards/src/index";
// Deck-builder rules over the full playable pool (wrapped by client-core's createDeckApi).
export {
  fullPlayableCatalog,
  validateDeckEntries,
  normalizeSameCardName,
  maxCopiesForCard,
  cardCategories,
  expandDeck,
} from "../../../packages/cards/src/index";
