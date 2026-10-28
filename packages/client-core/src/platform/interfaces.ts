// Platform seams. Each shell (Vita/PocketJS now; web, iOS/Android later)
// provides these; the core never touches files, the DOM or native APIs.
import type { EngineApi, GameState } from "../engineApi";
import type { GameRecord } from "../app/gameRecord";

/** Monotonic-ish milliseconds (Date.now on QuickJS, performance.now in browsers). */
export type Clock = () => number;

/** Line-oriented diagnostics (stdout on Vita/QuickJS, console elsewhere). */
export type LogSink = (line: string) => void;

export type MemorySample = {
  /** Short text for the HUD, e.g. "heap 48.2MB" or "state≈310KB". */
  label: string;
  bytes: number;
  /** What was measured: real JS heap, or an estimate from serialized state. */
  kind: "heap" | "estimate";
};

export interface MemoryProbe {
  sample(state: GameState): MemorySample | null;
}

/** Synchronous string key-value storage (saves, settings, custom decks). */
export interface KeyValueStore {
  readonly persistent: boolean;
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

/** Card-data chunk description produced by the data splitter (see data/split.ts). */
export type CardDataChunk = {
  id: string;
  cardIds: string[];
  /** Bytes when known (for loading UI). */
  bytes?: number;
};

export type MatchDataRequest = { decks: string[] };

/**
 * Loads the engine and the card data a match needs. A shell can return the
 * engine synchronously (Vita: bundled and pruned at build time) or a Promise
 * (web: fetch only the chunks for the requested decks).
 */
export interface AssetLoader {
  loadMatchData(request: MatchDataRequest): EngineApi | Promise<EngineApi>;
  /** Chunks available to this shell (informational; Vita has one baked chunk). */
  chunks(): CardDataChunk[];
  /** Card image URL/path, or null when the shell is text-only. */
  cardImage(cardId: string): string | null;
  /** How Japanese glyphs reach the screen on this platform. */
  readonly fontStrategy: "baked-atlas" | "system-font";
}

export type Platform = {
  name: string;
  clock: Clock;
  log: LogSink;
  memory: MemoryProbe;
  storage: KeyValueStore;
  assets: AssetLoader;
  /** Keeps the record of a finished match somewhere the developers can read it (web: api/share.js). */
  sendGameRecord?(record: GameRecord): void;
};
