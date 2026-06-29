import { canonicalCardName, fusionMaterialAliasNames } from "../cardName";
import { corePlayableCatalog, fullPlayableCatalog } from "../catalog/unifiedCatalog";

export type ZordFusionRule = {
  text: string;
  /** 合体―行の各枠ごとに使える cardId（同名別収録・別名含む）。 */
  partnerSlotCardIds: string[][];
  /** 全枠の cardId 和集合（registry / 素材判定用）。 */
  partnerCardIds: string[];
};

function buildCardNameToIdsMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (rawName: string, cardId: string) => {
    const key = canonicalCardName(rawName);
    const list = map.get(key) ?? [];
    if (!list.includes(cardId)) list.push(cardId);
    map.set(key, list);
  };

  for (const card of fullPlayableCatalog.cards) {
    add(card.name, card.id);
    for (const alias of fusionMaterialAliasNames(card.text)) {
      add(alias, card.id);
    }
  }
  for (const card of corePlayableCatalog.cards) {
    add(card.name, card.id);
    for (const alias of fusionMaterialAliasNames(card.text)) {
      add(alias, card.id);
    }
  }
  return map;
}

const CARD_NAME_TO_IDS = buildCardNameToIdsMap();

/** 合体―行をパートナー枠に分割（括弧内の ＋ は区切らない）。 */
function splitFusionPartnerNames(segment: string): string[] {
  const names: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of segment) {
    if (char === "（") depth += 1;
    if (char === "）") depth -= 1;
    if ((char === "＋" || char === "+") && depth === 0) {
      if (current.trim()) names.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) names.push(current.trim());
  return names;
}

function resolvePartnerSegment(rawName: string): string[] {
  const candidates: string[] = [];
  const parenMatch = rawName.match(/^([^（]+)（([^）]+)）$/);
  if (parenMatch) {
    candidates.push(parenMatch[1]!.trim());
    candidates.push(
      ...parenMatch[2]!
        .split(/または/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
  } else {
    candidates.push(
      ...rawName
        .split(/または/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
  }

  const ids = new Set<string>();
  for (const name of candidates) {
    const resolved = CARD_NAME_TO_IDS.get(canonicalCardName(name));
    if (resolved) {
      for (const id of resolved) ids.add(id);
    }
  }
  return [...ids];
}

/** 合体―行の末尾に続く ※無名ルール（ウイング等）を除く。 */
function stripTrailingUnnamedRules(segment: string): string {
  const noteIndex = segment.search(/ ※/);
  if (noteIndex >= 0) return segment.slice(0, noteIndex).trim();
  return segment.trim();
}

/** 合体―行からパートナー名を抽出し cardId に解決（atwiki / カード文面）。 */
export function parseZordFusionLine(text: string): ZordFusionRule | null {
  const match = text.match(/※?合体[―－\-ー─]([^【]+)/);
  if (!match) return null;

  const segment = stripTrailingUnnamedRules(match[1]!);

  const names = splitFusionPartnerNames(segment);

  const partnerSlotCardIds: string[][] = [];
  for (const rawName of names) {
    const slotIds = resolvePartnerSegment(rawName);
    if (slotIds.length === 0) return null;
    partnerSlotCardIds.push(slotIds);
  }

  return {
    text: `合体―${names.join("＋")}`,
    partnerSlotCardIds,
    partnerCardIds: [...new Set(partnerSlotCardIds.flat())],
  };
}

export function resolveCardNameToId(name: string): string | undefined {
  return CARD_NAME_TO_IDS.get(canonicalCardName(name))?.[0];
}

export function resolveCardNameToIds(name: string): string[] {
  return CARD_NAME_TO_IDS.get(canonicalCardName(name)) ?? [];
}

/** 合体―行のパートナー枠数（同名別収録の展開前）。 */
export function countZordFusionPartnerSlots(text: string): number {
  const match = text.match(/※?合体[―－\-ー─]([^【]+)/);
  if (!match) return 0;
  return splitFusionPartnerNames(stripTrailingUnnamedRules(match[1]!)).length;
}
