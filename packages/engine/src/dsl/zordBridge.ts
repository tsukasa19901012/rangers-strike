import { getCardDocument } from "./dslCatalog";

function zordRuleFor(cardId: string) {
  const doc = getCardDocument(cardId);
  return doc?.unnamedRules?.find((entry) => entry.kind === "zord");
}

/** CardDocument unnamedRules.zord から合体パートナーを解決（U4: registry のみ）。 */
export function resolveZordFusionPartnerIds(zordCardId: string): string[] {
  return zordRuleFor(zordCardId)?.partnerCardIds ?? [];
}

/**
 * 「X（または、A＋B＋…）」の代替素材: 枠番号 → かわりにそろえる枠の並び（RS-236 スーパーダイボウケン）。
 */
export function resolveZordFusionSlotAlternatives(zordCardId: string): Map<number, string[][]> {
  const map = new Map<number, string[][]>();
  for (const alt of zordRuleFor(zordCardId)?.partnerSlotAlternatives ?? []) {
    map.set(alt.slot, alt.slots);
  }
  return map;
}

/** 合体―行の各枠ごとに使える cardId。レガシーは 1 ID = 1 枠として扱う。 */
export function resolveZordFusionPartnerSlots(zordCardId: string): string[][] {
  const zordRule = zordRuleFor(zordCardId);
  if (zordRule?.partnerSlotCardIds?.length) {
    return zordRule.partnerSlotCardIds;
  }
  const flat = zordRule?.partnerCardIds ?? [];
  return flat.map((id) => [id]);
}
