// Test-only: the real engine from TypeScript sources, shaped as EngineApi.
import * as engine from "@rangers-strike/engine";
import * as cards from "@rangers-strike/cards";
import { getEffectLabel, starterDecks } from "@rangers-strike/cards";
import { createDeckApi, type DeckRuleFunctions } from "../data/deckApi";
import type { EngineApi } from "../engineApi";
import { MemoryKeyValueStore, stateSizeMemoryProbe } from "../platform/memory";
import type { Platform } from "../platform/interfaces";
import { buildDeckChunks } from "../data/split";

export const testEngine: EngineApi = {
  ...engine,
  getEffectLabel,
  starterDecks,
  deckApi: createDeckApi({ ...cards, catalog: cards.fullPlayableCatalog } as unknown as DeckRuleFunctions),
} as unknown as EngineApi;

export function testPlatform(lines: string[] = []): Platform {
  let now = 0;
  return {
    name: "test",
    clock: () => (now += 1),
    log: (line) => lines.push(line),
    memory: stateSizeMemoryProbe,
    storage: new MemoryKeyValueStore(),
    assets: {
      loadMatchData: () => testEngine,
      chunks: () => buildDeckChunks(Object.values(starterDecks)),
      cardImage: () => null,
      fontStrategy: "system-font",
    },
  };
}
