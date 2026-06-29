/** grant_keyword ハッシュ／semantic catchall スタブ — cards パイプラインと同期。 */

export {
  isCatchallGrantKeyword,
  isHashGrantKeywordStub,
} from "@rangers-strike/cards/pipeline/hashGrantKeywords";

const EFFECT_CARD_RE = /^effect_card::[A-Z0-9]+-[0-9]+(?:::[a-z0-9_]+)?$/;
const NOTE_CARD_RE = /^note_card::[A-Z0-9]+-[0-9]+(?:::[a-z0-9_]+)?$/;

export function isEffectCardKeyword(keyword: string): boolean {
  return EFFECT_CARD_RE.test(keyword);
}

export function isNoteCardKeyword(keyword: string): boolean {
  return NOTE_CARD_RE.test(keyword);
}
