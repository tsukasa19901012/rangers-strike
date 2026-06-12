import type { CardDefinition } from "./schema";
import {
  canonicalCardName,
  fusionMaterialAliasNames,
  sameCanonicalCardName,
} from "./cardName";

/** フィールド上のカードが合体パートナー名（または別名）に一致するか。 */
export function cardMatchesFusionPartnerName(
  material: Pick<CardDefinition, "name" | "text">,
  partnerName: string,
): boolean {
  const partnerCanonical = canonicalCardName(partnerName);
  if (sameCanonicalCardName(material.name, partnerCanonical)) return true;
  return fusionMaterialAliasNames(material.text).some((alias) => alias === partnerCanonical);
}

/** materialCardId が partnerCardIds のいずれか、または同名・別名として一致するか。 */
export function isFusionMaterialForPartners(
  material: Pick<CardDefinition, "id" | "name" | "text">,
  partnerCardIds: string[],
  definitions: Record<string, CardDefinition>,
): boolean {
  if (partnerCardIds.includes(material.id)) return true;

  for (const partnerId of partnerCardIds) {
    const partnerDef = definitions[partnerId];
    if (!partnerDef) continue;
    if (cardMatchesFusionPartnerName(material, partnerDef.name)) return true;
  }

  return false;
}
