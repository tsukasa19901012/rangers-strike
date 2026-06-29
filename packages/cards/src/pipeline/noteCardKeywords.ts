import { slugifyEffectId } from "./metaMaps";

const NOTE_CARD_RE = /^note_card::[A-Z0-9]+-[0-9]+(?:::[a-z0-9_]+)?$/;

/** カード固有 ※ 注釈の安定 grant_keyword（catchall 監査用。実行は cardId 側ハンドラに委譲）。 */
export function buildNoteCardKeyword(
  cardId: string,
  text: string,
  effectId?: string,
): string {
  const base = `note_card::${cardId}`;
  if (effectId && !effectId.startsWith("note_") && !effectId.startsWith("unnamed_")) {
    const slug = slugifyEffectId(effectId).slice(0, 20);
    if (slug.length >= 2) return `${base}::${slug}`;
  }
  const textSlug = slugifyEffectId(text.replace(/^※/, "").slice(0, 48)).slice(0, 16);
  return textSlug.length >= 2 ? `${base}::${textSlug}` : base;
}

export function isNoteCardKeyword(keyword: string): boolean {
  return NOTE_CARD_RE.test(keyword);
}
