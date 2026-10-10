import { canonicalCardName, fusionMaterialAliasNames } from "../cardName";
import { corePlayableCatalog, fullPlayableCatalog } from "../catalog/unifiedCatalog";

export type ZordFusionRule = {
  text: string;
  /** 合体―行の各枠ごとに使える cardId（同名別収録・別名含む）。 */
  partnerSlotCardIds: string[][];
  /** 全枠の cardId 和集合（registry / 素材判定用。代替素材も含む）。 */
  partnerCardIds: string[];
  /** 「X（または、A＋B＋…）」の代替素材。枠 slot は slots の全枠をそろえても満たせる。 */
  partnerSlotAlternatives?: { slot: number; slots: string[][] }[];
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
      if (current.trim()) names.push(normalizePartnerName(current.trim()));
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) names.push(normalizePartnerName(current.trim()));
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

/**
 * 「X（または、A＋B＋…）」の括弧内（＋でつながった複数の合体ユニット）を枠ごとの cardId に解決する。
 * 該当しない（単一名の別名指定など）なら null。
 */
function resolveAlternativeSlots(rawName: string): string[][] | null {
  const parenMatch = rawName.match(/^[^（]+（または[、,]?([^）]+)）$/);
  if (!parenMatch) return null;
  const parts = parenMatch[1]!.split(/[＋+]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const slots: string[][] = [];
  for (const part of parts) {
    const ids = CARD_NAME_TO_IDS.get(canonicalCardName(part));
    if (!ids?.length) return null;
    slots.push([...ids]);
  }
  return slots;
}

/** 合体―行の末尾に続く ※無名ルール（ウイング等）を除く。 */
function stripTrailingUnnamedRules(segment: string): string {
  const noteIndex = segment.indexOf("※");
  if (noteIndex >= 0) {
    return segment
      .slice(0, noteIndex)
      .replace(/[＋+]\s*$/u, "")
      .trim();
  }
  return segment.trim();
}

function normalizePartnerName(name: string): string {
  return name.replace(/^[-－ー─\s]+/u, "").trim();
}

/** 合体―行からパートナー名を抽出し cardId に解決（atwiki / カード文面）。 */
export function parseZordFusionLine(text: string): ZordFusionRule | null {
  const match = text.match(/※?合体[―－\-ー─]([^【]+)/);
  if (!match) return null;

  const segment = stripTrailingUnnamedRules(match[1]!);

  const names = splitFusionPartnerNames(segment);

  const partnerSlotCardIds: string[][] = [];
  const partnerSlotAlternatives: { slot: number; slots: string[][] }[] = [];
  for (const [slot, rawName] of names.entries()) {
    const slotIds = resolvePartnerSegment(rawName);
    if (slotIds.length === 0) return null;
    partnerSlotCardIds.push(slotIds);
    const alternative = resolveAlternativeSlots(rawName);
    if (alternative) partnerSlotAlternatives.push({ slot, slots: alternative });
  }

  return {
    text: `合体―${names.join("＋")}`,
    partnerSlotCardIds,
    partnerCardIds: [
      ...new Set([...partnerSlotCardIds.flat(), ...partnerSlotAlternatives.flatMap((a) => a.slots.flat())]),
    ],
    ...(partnerSlotAlternatives.length > 0 ? { partnerSlotAlternatives } : {}),
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
