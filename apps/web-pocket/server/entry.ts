// Entry for the server-side engine bundle (scripts/build-server.mjs -> server/match-engine.mjs), used by
// api/match.js. The browser never loads it: it holds the real board, seed and both hands.
export {
  createMatch,
  joinMatch,
  matchAct,
  matchTick,
  matchResign,
  matchView,
  serializeMatch,
  deserializeMatch,
  deadlineOf,
  MatchError,
  MAX_DECK_CARDS,
} from "../../../packages/engine/src/match/match";
export { ALL_STARTER_DECK_IDS } from "../../../packages/engine/src/index";
