// Vita (PocketJS) implementations of the client-core platform seams.
import {
  MemoryKeyValueStore,
  heapOrEstimateProbe,
  type AssetLoader,
  type KeyValueStore,
  type Platform,
} from "@rangers-strike/client-core";
import { engine } from "./engine";
import { BAKED_CHUNK } from "./generated/manifest";

type MaybeGlobals = {
  performance?: { now?: () => number; memory?: { usedJSHeapSize?: number } };
  console?: { log?: (...args: unknown[]) => void };
  localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; key(i: number): string | null; length: number };
};
const g = globalThis as unknown as MaybeGlobals;

/**
 * Storage: the stock Vita profile has no data.fs / data.sqlite capability
 * (PocketJS 0.14), so saves live in memory for the session. In the browser
 * dev host localStorage is used, which exercises the same interface.
 */
function createStorage(): KeyValueStore {
  const ls = g.localStorage;
  if (ls) {
    try {
      ls.setItem("rs.probe", "1");
      ls.removeItem("rs.probe");
      return {
        persistent: true,
        get: (k) => ls.getItem(k),
        set: (k, v) => ls.setItem(k, v),
        remove: (k) => ls.removeItem(k),
        keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i) ?? "").filter(Boolean),
      };
    } catch {
      // fall through
    }
  }
  return new MemoryKeyValueStore();
}

const assets: AssetLoader = {
  // All starter-deck card data is baked into the bundle at build time.
  loadMatchData: () => engine,
  chunks: () => [{ id: BAKED_CHUNK.id, cardIds: BAKED_CHUNK.cardIds, bytes: BAKED_CHUNK.bytes }],
  cardImage: () => null,
  fontStrategy: "baked-atlas",
};

const now = g.performance?.now ? () => g.performance!.now!() : () => Date.now();

export const vitaPlatform: Platform = {
  name: "vita",
  clock: now,
  log: (line) => g.console?.log?.(`[rs-vita] ${line}`),
  memory: heapOrEstimateProbe(() => g.performance?.memory?.usedJSHeapSize ?? null),
  storage: createStorage(),
  assets,
};
