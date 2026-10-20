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
  // Injected into the Vita host by scripts/patch-pocketjs-vita.mjs (native/rs_store.rs).
  rsStore?: { read(k: string): string | undefined; write(k: string, v: string): boolean; remove(k: string): boolean; keys(): string };
  localStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; key(i: number): string | null; length: number };
};
const g = globalThis as unknown as MaybeGlobals;

/**
 * Storage: the stock Vita profile has no data.fs / data.sqlite capability
 * (PocketJS 0.14), so the build injects `rsStore` into the Vita host, which
 * keeps one file per key under ux0:data/rangers-strike/. The browser dev host
 * uses localStorage; anything else falls back to memory for the session.
 */
function createStorage(): KeyValueStore {
  const native = g.rsStore;
  if (native) {
    return {
      persistent: true,
      get: (k) => native.read(k) ?? null,
      set: (k, v) => {
        if (!native.write(k, v)) g.console?.log?.(`[rs-vita] save failed: ${k}`);
      },
      remove: (k) => void native.remove(k),
      keys: () => native.keys().split("\n").filter(Boolean),
    };
  }
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
