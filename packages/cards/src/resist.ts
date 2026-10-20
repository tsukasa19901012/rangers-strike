import { textHasKeywordNotation } from "./keywordNotation";
import type { CardDefinition } from "./schema";
import { getUnitEffectBlock } from "./unitEffects";

/**
 * ユニットがレジスト（バトル撃破時ホールド留場）を持つか。
 * ルール: R-KW-00 — 本文の「※レジスト」表記だけで判定する。「レジストを持つ敵軍…」のような
 * 本文中の語や、他のユニットに付与する「…を得る⇒※レジスト」はこのカード自身のキーワードではない。
 */
export function hasResist(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const def = definitions[cardId];
  if (!def) return false;
  if (textHasKeywordNotation(def.text, "レジスト")) return true;
  const block = getUnitEffectBlock(cardId);
  if (!block) return false;
  return block.unnamedText.some(
    (entry) => entry.kind === "note" && textHasKeywordNotation(entry.text, "レジスト"),
  );
}
