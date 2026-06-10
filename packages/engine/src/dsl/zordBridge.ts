import { listZordFusionPartnerIds as listLegacyZordPartners } from "@rangers-strike/cards";
import { getCardDocument } from "./dslCatalog";

/** CardDocument unnamedRules.zord を優先し、なければ unitEffects.json にフォールバック。 */
export function resolveZordFusionPartnerIds(zordCardId: string): string[] {
  const doc = getCardDocument(zordCardId);
  const zordRule = doc?.unnamedRules?.find((entry) => entry.kind === "zord");
  if (zordRule?.partnerCardIds && zordRule.partnerCardIds.length > 0) {
    return zordRule.partnerCardIds;
  }
  return listLegacyZordPartners(zordCardId);
}
