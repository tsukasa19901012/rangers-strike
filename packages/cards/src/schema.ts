export type Category = "ET" | "WB" | "OT" | "MA" | "DA";

export type UnitSize = "S" | "M" | "L" | "XL" | "SC";

export type CardType = "unit" | "operation" | "vehicle" | "commander";

export type Rarity = "N" | "R" | "SR" | "NR" | "SC" | "PR";

/** SP値: 数値、「special」（!）、またはなし */
export type SpValue = number | "special" | null;

export type ComboNumber = number | "L" | "R" | "RC" | null;

export type { RushAdditionalCondition, ZordConditionId } from "./effectTaxonomy";

import type { RushAdditionalCondition } from "./effectTaxonomy";

export type CardDefinition = {
  id: string;
  name: string;
  type: CardType;
  category: Category | Category[];
  rarity: Rarity;
  expansion: string;
  /** 必要パワー。末尾が「+」の場合はゾードアップ可能（例: "7+"）。 */
  powerCost: number | string;
  bp?: number;
  sp?: SpValue;
  size?: UnitSize;
  comboNumber?: ComboNumber;
  /**
   * カード効果文（【】 / ※）。Rush 追加条件は `rushAdditionalCondition` を参照。
   * 構造化パースは unitEffects.json にあり、effectTaxonomy.ts を参照。
   */
  text?: string;
  /** powerCost が「+」で終わるときの Rush 追加条件（atwiki / 追加条件別一覧）。 */
  rushAdditionalCondition?: RushAdditionalCondition;
  effectId?: string;
  tags?: string[];
  /** メカ、男 などのユニット特徴。 */
  features?: string[];
  /** Web アプリルートから配信するパス（例: /cards/legend1/RS-001.jpg） */
  imageUrl?: string;
  /** ダウンロード / 出典表示用の元画像 URL */
  imageSourceUrl?: string;
};

export type DeckEntry = {
  cardId: string;
  count: number;
};

export type DeckDefinition = {
  id: string;
  name: string;
  starterType: "A" | "B" | "C" | "D" | "E";
  expansion: string;
  source: string;
  entries: DeckEntry[];
};

export type CardCatalog = {
  expansion: string;
  cards: CardDefinition[];
};

export function expandDeck(
  deck: DeckDefinition,
  catalog: CardCatalog,
): CardDefinition[] {
  const byId = new Map(catalog.cards.map((c) => [c.id, c]));
  const result: CardDefinition[] = [];

  for (const entry of deck.entries) {
    const card = byId.get(entry.cardId);
    if (!card) {
      throw new Error(`Unknown card id in deck ${deck.id}: ${entry.cardId}`);
    }
    for (let i = 0; i < entry.count; i += 1) {
      result.push(card);
    }
  }

  return result;
}

export function deckCardCount(deck: DeckDefinition): number {
  return deck.entries.reduce((sum, e) => sum + e.count, 0);
}

export function cardCategories(definition: CardDefinition | undefined): Category[] {
  if (!definition) return [];
  return Array.isArray(definition.category) ? definition.category : [definition.category];
}

export function cardHasCategory(card: CardDefinition, category: Category): boolean {
  return cardCategories(card).includes(category);
}
