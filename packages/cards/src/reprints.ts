/**
 * 再録・プロモ（同名・同文のカード）の同一性。
 * カードの処理は ID ではなく効果の同一性で決まる（例: RS-253 ファイブテクター = RS-014、RS-306 ハリケンレッド = RS-099）。
 * ID ごとに登録された実装（効果 ID の表など）を、同じカードの別 ID からも引けるようにする。
 */
import { extendedCardsCatalog } from "./catalog/unifiedCatalog";

/** 本文の同一性を比べるための正規化（全角半角・空白・※常駐／※カウンターの注記・句点の違いを吸収）。 */
export function normalizeCardIdentityText(text: string | undefined): string {
  return (text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/※(?:常駐|カウンター)\([^)]*\)/g, "")
    .replace(/※(?:常駐|カウンター)/g, "")
    .replace(/。/g, "");
}

/**
 * 本文が元カードと表記だけ違う再録・プロモ（効果名・「SP1」の括弧・OT/オーバーテクノロジーなどの略記・
 * 元カードのカタログ本文が空）。処理は元カードと同じ（docs/verification/unverified/PR-judgments.md ほか）。
 */
const PROMO_REPRINT_OF: Readonly<Record<string, string>> = {
  "PK-001": "RK-033",
  "PK-002": "RK-059",
  "PK-003": "RK-033",
  "PK-004": "RK-066",
  "PK-005": "RK-060",
  "PK-007": "RK-142",
  "PK-008": "RK-074",
  "PK-010": "RK-239",
  "PK-011": "RK-242",
  "PK-012": "RK-333",
  "PK-013": "RK-252",
  "PK-014": "RK-314",
  "PR-001": "RS-062",
  "PR-002": "RS-117",
  "PR-003": "RS-030",
  "PR-004": "RS-031",
  "PR-006": "RS-106",
  "PR-007": "RS-126",
  "PR-008": "RS-079",
  "PR-009": "RS-073",
  "PR-010": "RS-001",
  "PR-011": "RS-062",
  "PR-012": "RS-018",
  "PR-013": "RS-236",
  "PR-014": "RS-078",
  "PR-017": "RS-340",
  "PR-018": "RS-422",
  "PR-019": "RS-204",
  "PR-020": "RS-218",
  "PR-021": "RS-436",
  "PR-022": "RS-508",
  "PR-023": "RS-483",
  "PR-026": "RS-572",
  "PR-027": "RS-431",
  "SK-001": "PK-006",
  "SK-002": "PK-009",
  "SR-001": "RS-151",
  "XP-001": "RS-608",
  "XP-002": "RS-609",
  "XP-004": "XG2-077",
  "XP-007": "XG2-069",
  "XP-009": "XG2-073",
  "XP-010": "RS-496",
  "XP-011": "RS-345",
  "XP-012": "XG1-038",
  "XP-019": "RK-023",
  "XP-023": "RS-289",
};

let groups: Map<string, string[]> | null = null;

function identityGroups(): Map<string, string[]> {
  if (groups) return groups;
  const byKey = new Map<string, string[]>();
  const byId = new Map<string, string[]>();
  const keyOf = new Map<string, string>();
  for (const card of extendedCardsCatalog.cards) {
    const text = normalizeCardIdentityText(card.text);
    if (!text) continue;
    const key = `${card.type}|${card.name}|${text}`;
    keyOf.set(card.id, key);
    const list = byKey.get(key) ?? [];
    if (!list.includes(card.id)) list.push(card.id);
    byKey.set(key, list);
  }
  for (const [promoId, originalId] of Object.entries(PROMO_REPRINT_OF)) {
    const key = keyOf.get(originalId) ?? `reprint|${originalId}`;
    const list = byKey.get(key) ?? [];
    for (const id of [originalId, promoId]) if (!list.includes(id)) list.push(id);
    byKey.set(key, list);
    const promoKey = keyOf.get(promoId);
    if (promoKey && promoKey !== key) {
      const own = byKey.get(promoKey) ?? [];
      byKey.set(promoKey, own.filter((id) => id !== promoId));
    }
  }
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    for (const id of list) byId.set(id, list);
  }
  groups = byId;
  return byId;
}

const NO_SIBLINGS: readonly string[] = Object.freeze([]);
let siblingCache: Map<string, readonly string[]> | null = null;

/** 同名・同文の別 ID（自分自身を除く）。対局中に何度も引かれるので ID ごとに結果を覚える。 */
function cachedSiblingIds(cardId: string): readonly string[] {
  const cache = (siblingCache ??= new Map());
  const hit = cache.get(cardId);
  if (hit) return hit;
  const group = identityGroups().get(cardId);
  const siblings = group ? Object.freeze(group.filter((id) => id !== cardId)) : NO_SIBLINGS;
  cache.set(cardId, siblings);
  return siblings;
}

/** 同名・同文の別 ID（自分自身を除く）。 */
export function reprintSiblingIds(cardId: string): string[] {
  return [...cachedSiblingIds(cardId)];
}

/** ID で引く表を、再録・プロモの同一カードの ID でも引く。 */
export function lookupByCardIdentity<T>(table: Readonly<Record<string, T>>, cardId: string): T | undefined {
  const own = table[cardId];
  if (own !== undefined) return own;
  for (const id of cachedSiblingIds(cardId)) {
    const hit = table[id];
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** 2つの ID が同じカード（同一 ID か、再録・プロモの同名・同文）か。 */
export function isSameCardIdentity(a: string, b: string): boolean {
  if (a === b) return true;
  // 同じ組（自分自身を含む）に b があれば同一（a !== b なので自分自身との一致はない）。
  const group = (groups ?? identityGroups()).get(a);
  return group !== undefined && group.includes(b);
}
