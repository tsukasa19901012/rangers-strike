export type ExpansionGroupId = "booster" | "promo" | "other";

export const EXPANSION_GROUP_LABELS: Record<ExpansionGroupId, string> = {
  booster: "ブースター・エキスパンション",
  promo: "プロモ・大会配布",
  other: "その他",
};

const PROMO_PATTERN =
  /プロモ|賞品|参加賞|優勝|付録|配布|景品|プレゼント|キャンペーン|Vジャンプ|大会専用|雑誌|付属|自販/;

const BOOSTER_PATTERN =
  /^XG|クロスギャザー|エキスパンション|EXP|Vol\.|英雄|究極|五龍|紅き|三界|四雄|七忍|蒼九|二人|スペシャルメタル|ザ・マスクドライダー|マスクドライダー|コンプリートブック/;

export function classifyWikiSet(label: string): ExpansionGroupId {
  if (PROMO_PATTERN.test(label)) return "promo";
  if (BOOSTER_PATTERN.test(label)) return "booster";
  return "other";
}

export function groupWikiSets(
  sets: readonly string[],
): { id: ExpansionGroupId; label: string; sets: string[] }[] {
  const buckets: Record<ExpansionGroupId, string[]> = {
    booster: [],
    promo: [],
    other: [],
  };
  for (const set of sets) {
    buckets[classifyWikiSet(set)].push(set);
  }
  return (["booster", "promo", "other"] as const).map((id) => ({
    id,
    label: EXPANSION_GROUP_LABELS[id],
    sets: buckets[id],
  }));
}
