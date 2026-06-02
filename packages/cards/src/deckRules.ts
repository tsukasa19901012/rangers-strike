import { allCardsCatalog } from "./catalog";
import type { CardCatalog, CardDefinition, DeckEntry } from "./schema";
import { hasUnitEffectNote } from "./unitEffects";

/** Official minimum deck size. */
export const DECK_MIN_SIZE = 40;

/** Default max copies per card name in one deck. */
export const DECK_NAME_COPY_LIMIT = 3;

/** Upper bound for unlimited-copy cards in the deck builder UI. */
export const DECK_UNLIMITED_COPY_CAP = 40;

const UNLIMITED_DECK_NOTE = "デッキに3枚以上入れてもよい";

export type DeckValidationResult = {
  ok: boolean;
  total: number;
  errors: string[];
};

/** Cards that may exceed the usual 3-per-name limit (e.g. 戦闘員). */
export function deckCopyUnlimited(card: CardDefinition): boolean {
  if (card.features?.includes("戦闘員")) {
    return true;
  }
  if (card.text?.includes(UNLIMITED_DECK_NOTE)) {
    return true;
  }
  if (hasUnitEffectNote(card.id, UNLIMITED_DECK_NOTE)) {
    return true;
  }
  return false;
}

export function maxCopiesForCard(card: CardDefinition): number {
  return deckCopyUnlimited(card) ? DECK_UNLIMITED_COPY_CAP : DECK_NAME_COPY_LIMIT;
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
    errors.push(`デッキは最低${minSize}枚必要です（現在 ${total} 枚）`);
  }

  const byName = new Map<string, { count: number; cards: CardDefinition[] }>();

  for (const entry of entries) {
    const card = byId.get(entry.cardId);
    if (!card) {
      errors.push(`不明なカード: ${entry.cardId}`);
      continue;
    }
    if (entry.count <= 0) {
      errors.push(`${card.name} の枚数が不正です`);
      continue;
    }

    const perCardMax = maxCopiesForCard(card);
    if (entry.count > perCardMax) {
      errors.push(`${card.name} は最大 ${perCardMax} 枚までです`);
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
      errors.push(`「${name}」は同名で最大 ${limit} 枚までです（現在 ${count} 枚）`);
    }
  }

  return { ok: errors.length === 0 && total >= minSize, total, errors };
}
