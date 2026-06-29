/** atwiki / 公式HP の「修正後は以下。」以降だけを残す。 */
const RECOMMENDED_REPLACEMENT_MARKER = /修正後は以下。\s*/;

export function applyRecommendedReplacementText(text: string | undefined): string | undefined {
  if (!text) return text;
  const markerIndex = text.search(RECOMMENDED_REPLACEMENT_MARKER);
  if (markerIndex < 0) return text;
  const after = text.slice(markerIndex).replace(RECOMMENDED_REPLACEMENT_MARKER, "");
  return after.trim() || text;
}
