import type { CardDefinition } from "./schema";
import { getUnitEffectBlock } from "./unitEffects";

/** ユニットがレジスト（バトル撃破時ホールド留場）を持つか。 */
export function hasResist(
  definitions: Record<string, CardDefinition>,
  cardId: string,
): boolean {
  const def = definitions[cardId];
  if (!def) return false;
  if (def.features?.includes("レジスト")) return true;
  if (def.text?.includes("レジスト")) return true;
  const block = getUnitEffectBlock(cardId);
  if (!block) return false;
  return block.unnamedText.some(
    (entry) => entry.kind === "note" && entry.text.includes("レジスト"),
  );
}
