// Card search for the deck builder: filters over the card data fields (type,
// category, set, power cost, BP) and free-text search over a card's number,
// name, features, works (作品名) and effect text. No UI here; DeckBuilder keeps the state.
import type { CardDefinition } from "../engineApi";

export type FilterKey = "type" | "category" | "set" | "cost" | "bp";

export type FilterOption = {
  id: string;
  /** Menu row text. */
  label: string;
  /** Chip text when this option is chosen (defaults to label). */
  chip?: string;
  test: (card: CardDefinition, categories: readonly string[]) => boolean;
};

export type CardFilter = { key: FilterKey; title: string; options: FilterOption[] };

const all = (label: string): FilterOption => ({ id: "all", label, test: () => true });

/** Leading number of a power cost ("7+", "10-", 3), or NaN. */
export function costValue(card: CardDefinition): number {
  return typeof card.powerCost === "number" ? card.powerCost : Number.parseInt(String(card.powerCost), 10);
}

/** Set code from the card number: "XG3-012" -> "XG3", "RS-001" -> "RS". */
export function setCode(card: CardDefinition): string {
  return card.id.replace(/-.*$/, "");
}

const SET_ORDER = ["RS", "RK", "RM", "BK", "XG1", "XG2", "XG3", "XG4", "XG5", "XG6", "XG7", "XP"];

const CATEGORY_LABELS: Record<string, string> = {
  ET: "ET アーステクノロジー",
  WB: "WB ワイルドビースト",
  OT: "OT オーバーテクノロジー",
  MA: "MA ミスティックアームズ",
  DA: "DA ダークアライアンス",
};

function range(label: string, min: number, max: number, field: (card: CardDefinition) => number | undefined): FilterOption {
  return {
    id: label,
    label,
    test: (card) => {
      const value = field(card);
      return value !== undefined && !Number.isNaN(value) && value >= min && value <= max;
    },
  };
}

/** The deck builder's filters; set options come from the card pool (main sets first, the rest as "その他"). */
export function cardFilters(pool: readonly CardDefinition[]): CardFilter[] {
  const codes = new Set(pool.map(setCode));
  const main = SET_ORDER.filter((code) => codes.has(code));
  const mainSet = new Set(main);
  const hasOther = [...codes].some((code) => !mainSet.has(code));
  const sets: FilterOption[] = [
    all("全弾"),
    ...main.map((code) => ({ id: code, label: code, test: (card: CardDefinition) => setCode(card) === code })),
  ];
  if (hasOther) sets.push({ id: "other", label: "その他（PR など）", chip: "その他", test: (card) => !mainSet.has(setCode(card)) });

  const cost = (card: CardDefinition) => costValue(card);
  const bp = (card: CardDefinition) => card.bp;
  return [
    {
      key: "type",
      title: "種類",
      options: [
        all("全種類"),
        { id: "unit", label: "ユニット", test: (card) => card.type === "unit" },
        { id: "operation", label: "オペレーション", test: (card) => card.type === "operation" },
        { id: "vehicle", label: "ビークル", test: (card) => card.type === "vehicle" },
      ],
    },
    {
      key: "category",
      title: "カテゴリ",
      options: [
        all("全カテゴリ"),
        ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
          id,
          label,
          test: (_card: CardDefinition, categories: readonly string[]) => categories.includes(id),
        })),
      ],
    },
    { key: "set", title: "弾", options: sets },
    {
      key: "cost",
      title: "コスト",
      options: [
        all("全コスト"),
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ ...range(`コスト${n}`, n, n, cost), id: String(n) })),
        { ...range("コスト8以上", 8, Infinity, cost), id: "8+" },
        { id: "zord", label: "ゾードアップ可（＋）", chip: "コスト＋", test: (card) => String(card.powerCost).endsWith("+") },
      ],
    },
    {
      key: "bp",
      title: "BP",
      options: [
        all("全BP"),
        range("BP〜2000", 0, 2000, bp),
        range("BP2500〜4000", 2500, 4000, bp),
        range("BP4500〜6000", 4500, 6000, bp),
        range("BP6500〜9000", 6500, 9000, bp),
        range("BP10000以上", 10000, Infinity, bp),
        { id: "none", label: "BPなし", test: (card) => card.bp === undefined },
      ],
    },
  ];
}

/**
 * Folds text for search: full-width / half-width (NFKC), case, and katakana
 * to hiragana, so "ﾚｯﾄﾞ", "レッド" and "れっど" match each other.
 */
export function foldSearchText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** Search terms: words separated by spaces (full-width too); every term must match. */
export function searchTerms(query: string): string[] {
  return foldSearchText(query).split(/\s+/).filter(Boolean);
}

/** What free-text search looks at: number, name, features, works (作品名) and effect text. */
export function cardSearchText(card: CardDefinition): string {
  return foldSearchText([card.id, card.name, ...(card.features ?? []), ...(card.works ?? []), card.text ?? ""].join("\n"));
}

export function matchesTerms(haystack: string, terms: readonly string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}
