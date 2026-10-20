// The rules engine with every playable card. The host page loads the
// pre-bundled engine (dist/engine.js, built by apps/vita/scripts/build-engine.ts)
// as its own ESM file and hands it over as globalThis.__rsEngine before the
// app bundle runs, so the UI bundle stays small and both cache separately.
import { createDeckApi, type DeckRuleFunctions, type EngineApi } from "@rangers-strike/client-core";

const bundled = (globalThis as unknown as { __rsEngine?: object }).__rsEngine;
if (!bundled) throw new Error("rules engine missing: the host must set globalThis.__rsEngine");
const rules = bundled as unknown as DeckRuleFunctions & { fullPlayableCatalog: DeckRuleFunctions["catalog"] };

export const engine = {
  ...bundled,
  deckApi: createDeckApi({ ...rules, catalog: rules.fullPlayableCatalog }),
} as unknown as EngineApi;
