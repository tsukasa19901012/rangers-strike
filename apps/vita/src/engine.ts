// The pre-bundled engine with every playable card (scripts/build-engine.ts)
// typed as the client-core EngineApi. Run `npm run build:engine` before PocketJS builds.
import { createDeckApi, type DeckRuleFunctions, type EngineApi } from "@rangers-strike/client-core";
// @ts-ignore -- generated ESM bundle without declarations
import * as bundled from "./generated/engine.js";

const rules = bundled as unknown as DeckRuleFunctions & { fullPlayableCatalog: DeckRuleFunctions["catalog"] };

export const engine = {
  ...(bundled as object),
  deckApi: createDeckApi({ ...rules, catalog: rules.fullPlayableCatalog }),
} as unknown as EngineApi;
