import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument } from "../../types";
import { mergeCardDocument } from "../../loader";
import { validateCardDocument } from "../../validator";

const __dirname = dirname(fileURLToPath(import.meta.url));

type StarterBundle = { cards: Partial<CardDocument>[] };

let cachedOverlays: Map<string, Partial<CardDocument>> | null = null;

function readBundle(): StarterBundle {
  const raw = readFileSync(join(__dirname, "overlays.json"), "utf8");
  return JSON.parse(raw) as StarterBundle;
}

/** Legend 1 スターター DSL オーバーレイ（TypeScript ハンドラ不使用） */
export function loadLegend1StarterOverlays(): Map<string, Partial<CardDocument>> {
  if (cachedOverlays) return cachedOverlays;

  const bundle = readBundle();
  const map = new Map<string, Partial<CardDocument>>();

  for (const partial of bundle.cards) {
    if (!partial.id) continue;
    map.set(partial.id, partial);
  }

  cachedOverlays = map;
  return map;
}

export function getLegend1StarterOverlay(cardId: string): Partial<CardDocument> | undefined {
  return loadLegend1StarterOverlays().get(cardId);
}

export function listLegend1StarterCardIds(): string[] {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, "manifest.json"), "utf8"),
  ) as { cardIds: string[] };
  return manifest.cardIds;
}

export function resetLegend1StarterOverlayCache(): void {
  cachedOverlays = null;
}

export function applyLegend1StarterOverlay(base: CardDocument): CardDocument {
  const overlay = getLegend1StarterOverlay(base.id);
  if (!overlay) return base;
  const merged = mergeCardDocument(base, overlay);
  const validation = validateCardDocument(merged);
  if (!validation.ok) {
    const detail = validation.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
    throw new Error(`starter DSL overlay ${base.id}: ${detail}`);
  }
  return merged;
}
