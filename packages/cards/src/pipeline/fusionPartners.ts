import { corePlayableCatalog, fullPlayableCatalog } from "../catalog/unifiedCatalog";

export type ZordFusionRule = {
  text: string;
  partnerCardIds: string[];
};

function buildCardNameToIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const card of fullPlayableCatalog.cards) {
    if (!map.has(card.name)) {
      map.set(card.name, card.id);
    }
    const aliasMatch = card.text?.match(/※これは「([^」]+)」としてつかえる/);
    if (aliasMatch?.[1] && !map.has(aliasMatch[1])) {
      map.set(aliasMatch[1], card.id);
    }
  }
  for (const card of corePlayableCatalog.cards) {
    map.set(card.name, card.id);
    const aliasMatch = card.text?.match(/※これは「([^」]+)」としてつかえる/);
    if (aliasMatch?.[1]) {
      map.set(aliasMatch[1], card.id);
    }
  }
  return map;
}

const CARD_NAME_TO_ID = buildCardNameToIdMap();

function resolvePartnerSegment(rawName: string): string | undefined {
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

  for (const name of candidates) {
    const id = CARD_NAME_TO_ID.get(name);
    if (id) return id;
  }
  return undefined;
}

/** 合体―行からパートナー名を抽出し cardId に解決（atwiki / カード文面）。 */
export function parseZordFusionLine(text: string): ZordFusionRule | null {
  const match = text.match(/※?合体[―－\-ー─]([^【]+)/);
  if (!match) return null;

  const segment = match[1]!.trim();

  const names = segment
    .split(/[＋+]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const partnerCardIds: string[] = [];
  for (const rawName of names) {
    const resolved = resolvePartnerSegment(rawName);
    if (resolved) partnerCardIds.push(resolved);
  }

  if (partnerCardIds.length === 0) return null;

  return {
    text: `合体―${names.join("＋")}`,
    partnerCardIds: [...new Set(partnerCardIds)],
  };
}

export function resolveCardNameToId(name: string): string | undefined {
  return CARD_NAME_TO_ID.get(name);
}
