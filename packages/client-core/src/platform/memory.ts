// Reusable platform pieces that need no native API.
import type { GameState } from "../engineApi";
import type { KeyValueStore, MemoryProbe, MemorySample } from "./interfaces";

/** Volatile store (used where the host has no writable storage yet). */
export class MemoryKeyValueStore implements KeyValueStore {
  readonly persistent = false;
  private readonly data = new Map<string, string>();
  get(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.data.set(key, value);
  }
  remove(key: string): void {
    this.data.delete(key);
  }
  keys(): string[] {
    return [...this.data.keys()];
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

/**
 * Estimate when the runtime exposes no heap statistics (PocketJS guests on
 * Vita): UTF-16 size of the serialized GameState. This is a lower bound of the
 * match state only, not the process footprint.
 */
export const stateSizeMemoryProbe: MemoryProbe = {
  sample(state: GameState): MemorySample {
    const bytes = JSON.stringify(state).length * 2;
    return { bytes, kind: "estimate", label: `state≈${formatBytes(bytes)}` };
  },
};

/** Uses `heapBytes()` when it returns a number, otherwise falls back to the estimate. */
export function heapOrEstimateProbe(heapBytes: () => number | null): MemoryProbe {
  return {
    sample(state) {
      const heap = heapBytes();
      if (heap !== null && Number.isFinite(heap)) {
        return { bytes: heap, kind: "heap", label: `heap ${formatBytes(heap)}` };
      }
      return stateSizeMemoryProbe.sample(state);
    },
  };
}
