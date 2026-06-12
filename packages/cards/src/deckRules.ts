import { isBannedCardId } from "./bannedCards";
import { allCardsCatalog } from "./catalog";
import type { CardCatalog, CardDefinition, DeckEntry } from "./schema";
import { hasUnnamedRule } from "./unitEffects";

/** 公式デッキ最小枚数。 */
export const DECK_MIN_SIZE = 40;

/** デッキ1枚あたりの同名カード枚数上限（既定）。 */
export const DECK_NAME_COPY_LIMIT = 3;

/** デッキビルダー UI で無制限枚数カードの上限。 */
export const DECK_UNLIMITED_COPY_CAP = 40;

const UNLIMITED_DECK_NOTE = "デッキに3枚以上入れてもよい";

const FULL_PLAYABLE_POOL_SIZE = 1849;

function formatCardRef(card: CardDefinition): string {
  return `${card.name}（${card.id}）`;
}

export type DeckValidationResult = {
  ok: boolean;
  total: number;
  errors: string[];
};

/** 通常3枚制限を超えてよいカード（例: 戦闘員）。 */
export function deckCopyUnlimited(card: CardDefinition): boolean {
  if (card.features?.includes("戦闘員")) {
    return true;
  }
  if (card.text?.includes(UNLIMITED_DECK_NOTE)) {
    return true;
  }
  if (hasUnnamedRule(card.id, "deck_copy_unlimited")) {
    return true;
  }
  return false;
}

export function maxCopiesForCard(card: CardDefinition): number {
  return deckCopyUnlimited(card) ? DECK_UNLIMITED_COPY_CAP : DECK_NAME_COPY_LIMIT;
}

/** 同名（正規化名称）ごとのデッキ枚数。 */
export function countDeckCopiesByName(
  entries: DeckEntry[],
  catalog: CardCatalog = allCardsCatalog,
): Map<string, number> {
  const byId = new Map(catalog.cards.map((card) => [card.id, card]));
  const byName = new Map<string, number>();
  for (const entry of entries) {
    const card = byId.get(entry.cardId);
    if (!card) continue;
    byName.set(card.name, (byName.get(card.name) ?? 0) + entry.count);
  }
  return byName;
}

/** このカードをあと何枚デッキに入れられるか（同名の別 ID 枚数を含む）。 */
export function remainingCopiesForCard(
  card: CardDefinition,
  entries: DeckEntry[],
  catalog: CardCatalog = allCardsCatalog,
): number {
  const sameNameCards = catalog.cards.filter((c) => c.name === card.name);
  const limit = nameCopyLimit(sameNameCards);
  const totalForName = countDeckCopiesByName(entries, catalog).get(card.name) ?? 0;
  return Math.max(0, limit - totalForName);
}

function nameCopyLimit(cards: CardDefinition[]): number {
  return cards.some(deckCopyUnlimited) ? DECK_UNLIMITED_COPY_CAP : DECK_NAME_COPY_LIMIT;
}

export function validateDeckEntries(
  entries: DeckEntry[],
  catalog: CardCatalog = allCardsCatalog,
  options?: { minSize?: number },
): DeckValidationResult {
  const minSize = options?.minSize ?? DECK_MIN_SIZE;
  const errors: string[] = [];
  const byId = new Map(catalog.cards.map((card) => [card.id, card]));
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  if (total < minSize) {
    const shortfall = minSize - total;
    errors.push(
      `デッキは最低${minSize}枚必要です（現在 ${total} 枚）。あと ${shortfall} 枚必要です`,
    );
  }

  const byName = new Map<string, { count: number; cards: CardDefinition[] }>();

  for (const entry of entries) {
    const card = byId.get(entry.cardId);
    if (!card) {
      errors.push(
        `カタログにないカードです: ${entry.cardId}（${FULL_PLAYABLE_POOL_SIZE.toLocaleString()}枚プール外の可能性）`,
      );
      continue;
    }
    if (entry.count <= 0) {
      errors.push(`${formatCardRef(card)} の枚数が不正です`);
      continue;
    }

    if (isBannedCardId(entry.cardId)) {
      errors.push(`禁止カードが含まれています: ${formatCardRef(card)}`);
      continue;
    }

    const perCardMax = maxCopiesForCard(card);
    if (entry.count > perCardMax) {
      errors.push(`${formatCardRef(card)}は最大 ${perCardMax} 枚までです`);
    }

    const bucket = byName.get(card.name) ?? { count: 0, cards: [] };
    bucket.count += entry.count;
    if (!bucket.cards.some((c) => c.id === card.id)) {
      bucket.cards.push(card);
    }
    byName.set(card.name, bucket);
  }

  for (const [name, { count, cards }] of byName) {
    const limit = nameCopyLimit(cards);
    if (count > limit) {
      const ids = cards.map((c) => c.id).join(", ");
      errors.push(
        `「${name}（${ids}）」は同名で最大 ${limit} 枚までです（現在 ${count} 枚）`,
      );
    }
  }

  return { ok: errors.length === 0 && total >= minSize, total, errors };
}
