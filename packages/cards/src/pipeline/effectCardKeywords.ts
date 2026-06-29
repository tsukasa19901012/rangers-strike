import { slugifyEffectId } from "./metaMaps";

const EFFECT_CARD_RE = /^effect_card::[A-Z0-9]+-[0-9]+(?:::[a-z0-9_]+)?$/;

/** 名前付き効果の安定 grant_keyword（catchall 監査用。実行は cardId 側ハンドラに委譲）。 */
export function buildEffectCardKeyword(cardId: string, effectId?: string): string {
  const base = `effect_card::${cardId}`;
  if (effectId && !effectId.startsWith("note_") && !effectId.startsWith("unnamed_")) {
    const slug = slugifyEffectId(effectId).slice(0, 24);
    if (slug.length >= 2) return `${base}::${slug}`;
  }
  return base;
}

export function isEffectCardKeyword(keyword: string): boolean {
  return EFFECT_CARD_RE.test(keyword);
}
