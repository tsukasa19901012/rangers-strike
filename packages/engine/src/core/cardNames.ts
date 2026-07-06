import { normalizeSameCardName } from "@rangers-strike/cards";

/**
 * 同名カード判定（wiki 区別表記の（2nd）/（XG〜XG7）を無視して比較）。
 * glossary「2nd」: カードテキストや種類が異なっても同名カードとして扱う。
 */
export function sameCardName(
  a: string | undefined,
  b: string | undefined,
): boolean {
  if (!a || !b) return false;
  return normalizeSameCardName(a) === normalizeSameCardName(b);
}
