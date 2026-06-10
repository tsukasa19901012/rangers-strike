import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument } from "../types";
import { mergeCardDocument } from "../loader";
import { validateCardDocument } from "../validator";
import { applyCardOverride } from "../overrides/loadCardOverrides";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stubDslDir = join(__dirname, "../../generated/dsl-stubs");

let cachedStubOverlays: Map<string, Partial<CardDocument>> | null = null;

/** batch-compile-stubs が出力した Wiki スタブ DSL オーバーレイ。 */
export function loadStubDslOverlays(): Map<string, Partial<CardDocument>> {
  if (cachedStubOverlays) return cachedStubOverlays;

  const map = new Map<string, Partial<CardDocument>>();
  if (!existsSync(join(stubDslDir, "manifest.json"))) {
    cachedStubOverlays = map;
    return map;
  }

  for (const file of readdirSync(stubDslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const cardId = file.replace(/\.dsl\.json$/, "");
    const raw = readFileSync(join(stubDslDir, file), "utf8");
    map.set(cardId, JSON.parse(raw) as Partial<CardDocument>);
  }

  cachedStubOverlays = map;
  return map;
}

export function resetStubDslOverlayCache(): void {
  cachedStubOverlays = null;
}

export function applyStubDslOverlay(base: CardDocument): CardDocument {
  const overlay = loadStubDslOverlays().get(base.id);
  if (!overlay) return base;

  const partial: Partial<CardDocument> = {};
  if (overlay.effects) partial.effects = overlay.effects;
  if (overlay.implementation) partial.implementation = overlay.implementation;
  if (overlay.unnamedRules) partial.unnamedRules = overlay.unnamedRules;
  if (overlay.tags) partial.tags = overlay.tags;
  if (overlay.features) partial.features = overlay.features;
  if (overlay.text) partial.text = overlay.text;
  if (overlay.bp !== undefined) partial.bp = overlay.bp;
  if (overlay.size !== undefined) partial.size = overlay.size;
  if (overlay.sp !== undefined) partial.sp = overlay.sp;
  if (overlay.comboNumber !== undefined) partial.comboNumber = overlay.comboNumber;
  if (overlay.category !== undefined) partial.category = overlay.category;
  if (overlay.rarity !== undefined) partial.rarity = overlay.rarity;
  if (overlay.powerCost !== undefined) partial.powerCost = overlay.powerCost;
  if (Object.keys(partial).length === 0) return base;

  try {
    const merged = mergeCardDocument(base, partial);
    const withOverride = applyCardOverride(merged);
    const validation = validateCardDocument(withOverride);
    if (!validation.ok) return base;
    return withOverride;
  } catch {
    return base;
  }
}
