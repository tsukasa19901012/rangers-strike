import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument } from "../types";
import { mergeCardDocument } from "../loader";
import { validateCardDocument } from "../validator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = join(__dirname);

let cachedGenerated: Map<string, Partial<CardDocument>> | null = null;

/** Phase 4: 一括生成 DSL オーバーレイ（generate-all-dsl 出力）。 */
export function loadGeneratedDslOverlays(): Map<string, Partial<CardDocument>> {
  if (cachedGenerated) return cachedGenerated;

  const map = new Map<string, Partial<CardDocument>>();
  if (!existsSync(join(generatedDir, "manifest.json"))) {
    cachedGenerated = map;
    return map;
  }

  for (const file of readdirSync(generatedDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const cardId = file.replace(/\.dsl\.json$/, "");
    const raw = readFileSync(join(generatedDir, file), "utf8");
    map.set(cardId, JSON.parse(raw) as Partial<CardDocument>);
  }

  cachedGenerated = map;
  return map;
}

export function resetGeneratedDslOverlayCache(): void {
  cachedGenerated = null;
}

export function applyGeneratedDslOverlay(base: CardDocument): CardDocument {
  const overlay = loadGeneratedDslOverlays().get(base.id);
  if (!overlay) return base;

  if (overlay.implementation?.handler === "unimplemented") {
    return base;
  }

  const partial: Partial<CardDocument> = {};
  if (overlay.effects) partial.effects = overlay.effects;
  if (overlay.implementation) partial.implementation = overlay.implementation;
  if (overlay.unnamedRules) partial.unnamedRules = overlay.unnamedRules;
  if (overlay.tags) partial.tags = overlay.tags;
  if (overlay.features) partial.features = overlay.features;
  if (Object.keys(partial).length === 0) return base;

  try {
    const merged = mergeCardDocument(base, partial);
    const validation = validateCardDocument(merged);
    if (!validation.ok) return base;
    return merged;
  } catch {
    return base;
  }
}
