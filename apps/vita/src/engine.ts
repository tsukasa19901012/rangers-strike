// The pre-bundled, data-pruned engine (scripts/build-engine.ts) typed as the
// client-core EngineApi. Run `npm run build:engine` before PocketJS builds.
import type { EngineApi } from "@rangers-strike/client-core";
// @ts-ignore -- generated ESM bundle without declarations
import * as bundled from "./generated/engine.js";

export const engine = bundled as unknown as EngineApi;
