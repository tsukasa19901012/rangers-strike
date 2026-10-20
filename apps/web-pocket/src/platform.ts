// Browser implementations of the client-core platform seams.
import { MemoryKeyValueStore, heapOrEstimateProbe, type KeyValueStore, type Platform } from "@rangers-strike/client-core";
import { engine } from "./engine";

type BrowserGlobals = {
  performance?: { now?: () => number; memory?: { usedJSHeapSize?: number } };
  console?: { log?: (...args: unknown[]) => void };
  localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; key(i: number): string | null; length: number };
};
const g = globalThis as unknown as BrowserGlobals;

/** Saves (settings, custom decks, records) live in localStorage; private windows fall back to memory. */
function createStorage(): KeyValueStore {
  const ls = g.localStorage;
  if (ls) {
    try {
      ls.setItem("rs.probe", "1");
      ls.removeItem("rs.probe");
      return {
        persistent: true,
        get: (k) => ls.getItem(k),
        set: (k, v) => {
          try {
            ls.setItem(k, v);
          } catch {
            g.console?.log?.(`[rs-web] save failed: ${k}`);
          }
        },
        remove: (k) => ls.removeItem(k),
        keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i) ?? "").filter(Boolean),
      };
    } catch {
      // storage blocked
    }
  }
  return new MemoryKeyValueStore();
}

const now = g.performance?.now ? () => g.performance!.now!() : () => Date.now();

export const webPlatform: Platform = {
  name: "web",
  clock: now,
  log: (line) => g.console?.log?.(`[rs-web] ${line}`),
  memory: heapOrEstimateProbe(() => g.performance?.memory?.usedJSHeapSize ?? null),
  storage: createStorage(),
  assets: {
    loadMatchData: () => engine,
    chunks: () => [{ id: "full-playable", cardIds: engine.deckApi.cards.map((c) => c.id) }],
    cardImage: (cardId) => `cards/${cardId}.jpg`,
    fontStrategy: "baked-atlas",
  },
};
