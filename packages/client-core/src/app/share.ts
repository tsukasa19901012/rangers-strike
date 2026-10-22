// A board shared from one match to another (web: the 共有 button). The payload is
// the whole GameState without card definitions (every client has the full
// catalog), plus what the receiving side needs to keep playing it.
import type { CpuLevel, GameState } from "../engineApi";
import type { GameSession } from "../session/session";

export const SHARE_VERSION = 1;

export type SharePayload = {
  v: typeof SHARE_VERSION;
  cpuLevel: CpuLevel;
  state: Omit<GameState, "definitions">;
};

export function buildSharePayload(session: GameSession): SharePayload {
  const { definitions: _definitions, ...state } = session.state;
  return { v: SHARE_VERSION, cpuLevel: session.options.cpuLevel, state };
}

/** Checks a decoded payload (it comes from a URL anyone can write). */
export function parseSharePayload(value: unknown): SharePayload | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<SharePayload>;
  if (p.v !== SHARE_VERSION || !p.state || typeof p.state !== "object") return null;
  const players = (p.state as Partial<GameState>).players;
  if (!players || typeof players !== "object" || !players.player1 || !players.player2) return null;
  const level = Number(p.cpuLevel);
  const cpuLevel = (Number.isInteger(level) && level >= 1 && level <= 5 ? level : 2) as CpuLevel;
  return { v: SHARE_VERSION, cpuLevel, state: p.state };
}
