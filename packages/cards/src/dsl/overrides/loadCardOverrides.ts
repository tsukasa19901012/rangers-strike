import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument } from "../types";
import { mergeCardDocument } from "../loader";

const __dirname = dirname(fileURLToPath(import.meta.url));
const overridesDir = join(__dirname);

let cachedOverrides: Map<string, Partial<CardDocument>> | null = null;

/** 人手修正 DSL（`src/dsl/overrides/{cardId}.json`）。 */
export function loadCardOverrides(): Map<string, Partial<CardDocument>> {
  if (cachedOverrides) return cachedOverrides;

  const map = new Map<string, Partial<CardDocument>>();
  if (!existsSync(overridesDir)) {
    cachedOverrides = map;
    return map;
  }

  for (const file of readdirSync(overridesDir)) {
    if (!file.endsWith(".json") || file === "manifest.json") continue;
    const cardId = file.replace(/\.json$/, "");
    const raw = readFileSync(join(overridesDir, file), "utf8");
    map.set(cardId, JSON.parse(raw) as Partial<CardDocument>);
  }

  cachedOverrides = map;
  return map;
}

export function resetCardOverrideCache(): void {
  cachedOverrides = null;
}

export function applyCardOverride(base: CardDocument): CardDocument {
  const overlay = loadCardOverrides().get(base.id);
  if (!overlay) return base;
  return mergeCardDocument(base, overlay);
}

export function listCardOverrideIds(): string[] {
  return [...loadCardOverrides().keys()];
}
