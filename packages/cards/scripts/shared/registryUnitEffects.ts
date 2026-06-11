import { corePlayableCatalog } from "../../src/catalog/unifiedCatalog";
import type { UnitEffectBlock } from "../../src/effectTaxonomy";
import { getUnitEffectBlock } from "../../src/unitEffects";

/** U5 — コアカードの unit effect ブロック（レジストリ / CardDocument 由来）。 */
export function loadCoreRegistryUnitEffects(): Record<string, UnitEffectBlock> {
  const blocks: Record<string, UnitEffectBlock> = {};

  for (const card of corePlayableCatalog.cards) {
    if (card.type !== "unit" && card.type !== "vehicle") continue;
    const block = getUnitEffectBlock(card.id);
    if (!block) continue;
    if (
      block.namedEffects.length === 0 &&
      block.unnamedText.length === 0 &&
      !block.rushAdditionalCondition
    ) {
      continue;
    }
    blocks[card.id] = block;
  }

  return blocks;
}
