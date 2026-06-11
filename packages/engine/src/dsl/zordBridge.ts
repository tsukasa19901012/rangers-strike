import { getCardDocument } from "./dslCatalog";

/** CardDocument unnamedRules.zord から合体パートナーを解決（U4: registry のみ）。 */
export function resolveZordFusionPartnerIds(zordCardId: string): string[] {
  const doc = getCardDocument(zordCardId);
  const zordRule = doc?.unnamedRules?.find((entry) => entry.kind === "zord");
  return zordRule?.partnerCardIds ?? [];
}
