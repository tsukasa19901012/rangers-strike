/** atwiki / 公式HP の「修正後は以下。」読み替えを適用する。 */
const RECOMMENDED_REPLACEMENT_MARKER = /・このテキストは[^。]*。\s*修正後は以下。\s*/;

/**
 * エラッタ（読み替え）を適用したカードテキストを返す。
 *
 * 修正後テキストが【効果名】ブロックから始まり、そのブロックが元テキストの
 * 途中にある場合は、ブロックより前の注記（※…）はエラッタ対象外なので保持する
 * （例: RS-227 のバトル投入ホールド注記、RK-231 の SP1 撃破条項）。
 */
export function applyRecommendedReplacementText(text: string | undefined): string | undefined {
  if (!text) return text;
  const marker = text.match(RECOMMENDED_REPLACEMENT_MARKER);
  if (!marker || marker.index === undefined) return text;
  const original = text.slice(0, marker.index).trim();
  const corrected = text.slice(marker.index + marker[0].length).trim();
  if (!corrected) return text;

  const head = corrected.match(/^【[^】]*】/)?.[0];
  if (head) {
    const blockStart = original.indexOf(head);
    if (blockStart > 0) {
      return `${original.slice(0, blockStart)}${corrected}`.trim();
    }
  }
  return corrected;
}
