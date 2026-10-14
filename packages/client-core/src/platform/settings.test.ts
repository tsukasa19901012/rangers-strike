import { describe, expect, it } from "vitest";
import { MemoryKeyValueStore, heapOrEstimateProbe } from "./memory";
import { SettingsStore } from "./settings";

describe("SettingsStore", () => {
  it("round-trips settings and keeps the newest records", () => {
    const store = new SettingsStore(new MemoryKeyValueStore());
    const defaults = { humanDeck: "a", cpuDeck: "b", cpuLevel: 2 };
    expect(store.load(defaults)).toEqual(defaults);
    store.save({ humanDeck: "c", cpuDeck: "d", cpuLevel: 4 });
    expect(store.load(defaults)).toEqual({ humanDeck: "c", cpuDeck: "d", cpuLevel: 4 });
    for (let i = 0; i < 25; i++) {
      store.addRecord({ humanDeck: "a", cpuDeck: "b", winner: "player1", turns: i, cpuMoves: 1, avgThinkMs: 1 });
    }
    expect(store.records()).toHaveLength(20);
    expect(store.records()[0]!.turns).toBe(24);
  });

  it("falls back to defaults on corrupt data", () => {
    const kv = new MemoryKeyValueStore();
    kv.set("rs.settings.v1", "{not json");
    expect(new SettingsStore(kv).load({ humanDeck: "a", cpuDeck: "b", cpuLevel: 1 }).humanDeck).toBe("a");
  });
});

describe("memory probes", () => {
  it("prefers the heap figure and falls back to a state estimate", () => {
    const state = { a: 1 } as never;
    expect(heapOrEstimateProbe(() => 2 * 1024 * 1024).sample(state)).toMatchObject({ kind: "heap", label: "heap 2.0MB" });
    expect(heapOrEstimateProbe(() => null).sample(state)).toMatchObject({ kind: "estimate" });
  });
});
