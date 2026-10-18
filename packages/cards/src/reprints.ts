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

let groups: Map<string, string[]> | null = null;

function identityGroups(): Map<string, string[]> {
  if (groups) return groups;
  const byKey = new Map<string, string[]>();
  const byId = new Map<string, string[]>();
  for (const card of extendedCardsCatalog.cards) {
    const text = normalizeCardIdentityText(card.text);
    if (!text) continue;
    const key = `${card.type}|${card.name}|${text}`;
    const list = byKey.get(key) ?? [];
    if (!list.includes(card.id)) list.push(card.id);
    byKey.set(key, list);
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
