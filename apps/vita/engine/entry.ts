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
  ALL_STARTER_DECK_IDS,
  WIN_DAMAGE,
} from "../../../packages/engine/src/index";
export { getEffectLabel, starterDecks } from "../../../packages/cards/src/index";
