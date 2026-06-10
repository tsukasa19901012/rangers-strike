/**
 * atwiki page 2079 — 通常大会禁止のみ。
 * タッグストライク専用（RS-244 / RS-289 / RS-348）は除外。
 *
 * 禁止対象の「ドギー・クルーガー（XG2）」コマンダー版は 1,849 枚カタログに未収録。
 * RS-318 はユニット版のため通常大会禁止対象外。
 */
export const BANNED_CARD_IDS: readonly string[] = [];

export function isBannedCardId(id: string): boolean {
  return BANNED_CARD_IDS.includes(id);
}
