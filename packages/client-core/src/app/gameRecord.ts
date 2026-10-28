// The record of a finished match (web: sent to api/share.js when the match ends, read back by
// apps/web-pocket/scripts/list-game-records.mjs). Seed, decks and every applied action replay the
// whole match with the engine, so the CPU's losses to people can be looked at move by move.
import type { CpuLevel, GameAction, PlayerId } from "../engineApi";
import type { GameSession } from "../session/session";

export const GAME_RECORD_VERSION = 1;

export type GameRecord = {
  v: typeof GAME_RECORD_VERSION;
  /** When the match ended (ms since epoch). */
  at: number;
  seed: number;
  cpuLevel: CpuLevel;
  /** Starter ids, or the custom deck's id (custom:...). */
  humanDeck: string;
  cpuDeck: string;
  /** Card ids of a custom deck in the order the session built it (the shuffle depends on the order). */
  humanCards?: string[];
  cpuCards?: string[];
  winner: PlayerId | null;
  turns: number;
  actions: GameAction[];
};

/** The record of the session's match, or null when it cannot be replayed (a shared board, autoplay, not over). */
export function buildGameRecord(session: GameSession, at: number): GameRecord | null {
  const o = session.options;
  if (!session.actions || o.humanLevel || !session.winner) return null;
  const ids = (cards: typeof o.humanCards) => cards?.map((c) => c.id);
  return {
    v: GAME_RECORD_VERSION,
    at,
    seed: o.seed,
    cpuLevel: o.cpuLevel,
    humanDeck: o.humanDeck,
    cpuDeck: o.cpuDeck,
    ...(o.humanCards ? { humanCards: ids(o.humanCards) } : {}),
    ...(o.cpuCards ? { cpuCards: ids(o.cpuCards) } : {}),
    winner: session.winner,
    turns: session.state.turn,
    actions: session.actions,
  };
}

/** Checks a decoded record (it comes from the network). */
export function parseGameRecord(value: unknown): GameRecord | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Partial<GameRecord>;
  if (r.v !== GAME_RECORD_VERSION || typeof r.seed !== "number" || !Array.isArray(r.actions)) return null;
  if (typeof r.humanDeck !== "string" || typeof r.cpuDeck !== "string") return null;
  return r as GameRecord;
}
