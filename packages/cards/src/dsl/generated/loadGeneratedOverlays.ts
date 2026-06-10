import generatedOverlays from "./overlays-bundle.json";
import type { CardDocument } from "../types";
import { mergeCardDocument } from "../loader";
import { validateCardDocument } from "../validator";

let cachedGenerated: Map<string, Partial<CardDocument>> | null = null;

/** Phase 4: 一括生成 DSL オーバーレイ（generate-all-dsl 出力）。 */
export function loadGeneratedDslOverlays(): Map<string, Partial<CardDocument>> {
  if (cachedGenerated) return cachedGenerated;
  cachedGenerated = new Map(
    Object.entries(generatedOverlays as Record<string, Partial<CardDocument>>),
  );
  return cachedGenerated;
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
