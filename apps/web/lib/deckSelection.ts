import {
  buildStarterDeck,
  fullPlayableCatalog,
  type CardDefinition,
  type StarterDeckId,
} from "@rangers-strike/cards";
import {
  buildFullPromotedDeck,
  buildHybridPromotedDeck,
  createFullPromotedGame,
  createGameForDecks,
  type GameState,
  type Legend1StarterId,
  type PlayerId,
} from "@rangers-strike/engine";
import { buildCardDefinitions, getCustomDeck } from "./deckBuilder";
import { STARTER_OPTIONS, type StarterId } from "./labels";

export type HybridPromotedTier = 10 | 25 | 35;

export type DeckSelection =
  | { kind: "starter"; id: StarterId }
  | { kind: "custom"; id: string }
  | { kind: "full-promoted" }
  | { kind: "hybrid-promoted"; tier: HybridPromotedTier };

/** フルプレイアブル対戦用プリセット（1,849 枚プール経由）。 */
export const FULL_PLAYABLE_DECK_OPTIONS = [
  { key: "full-promoted", label: "フル昇格（40枚・ランダム）" },
  { key: "hybrid-promoted:10", label: "ハイブリッド +10枚（スターターベース）" },
  { key: "hybrid-promoted:25", label: "ハイブリッド +25枚" },
  { key: "hybrid-promoted:35", label: "ハイブリッド +35枚" },
] as const;

const HYBRID_TIERS = new Set<HybridPromotedTier>([10, 25, 35]);

const DEFAULT_HYBRID_STARTERS: Record<"player1" | "player2", Legend1StarterId> = {
  player1: "abarenoh",
  player2: "dekaranger",
};

export function encodeDeckSelection(selection: DeckSelection): string {
  if (selection.kind === "full-promoted") return "full-promoted";
  if (selection.kind === "hybrid-promoted") {
    return `hybrid-promoted:${selection.tier}`;
  }
  return `${selection.kind}:${selection.id}`;
}

export function decodeDeckSelection(value: string): DeckSelection | null {
  if (value === "full-promoted") {
    return { kind: "full-promoted" };
  }
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if (kind === "hybrid-promoted") {
    const tier = Number(rest[0]);
    if (HYBRID_TIERS.has(tier as HybridPromotedTier)) {
      return { kind: "hybrid-promoted", tier: tier as HybridPromotedTier };
    }
    return null;
  }
  if (!id) return null;
  if (kind === "starter" && STARTER_OPTIONS.some((option) => option.id === id)) {
    return { kind: "starter", id: id as StarterId };
  }
  if (kind === "custom") {
    return { kind: "custom", id };
  }
  return null;
}

export function isFullPlayableSelection(selection: DeckSelection): boolean {
  return selection.kind === "full-promoted" || selection.kind === "hybrid-promoted";
}

function deckRngFrom(rng: () => number): () => number {
  let seed = Math.floor(rng() * 0xffffffff) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** スターター / 自作デッキ用。promoted プリセットは createGameFromDeckSelections を使う。 */
export function resolveDeckCards(selection: DeckSelection): CardDefinition[] {
  if (selection.kind === "full-promoted") {
    return buildFullPromotedDeck(deckRngFrom(Math.random));
  }
  if (selection.kind === "hybrid-promoted") {
    return buildHybridPromotedDeck(
      DEFAULT_HYBRID_STARTERS.player1,
      deckRngFrom(Math.random),
      selection.tier,
    );
  }
  if (selection.kind === "starter") {
    return buildStarterDeck(selection.id as StarterDeckId);
  }
  const deck = getCustomDeck(selection.id);
  if (!deck) {
    throw new Error(`Custom deck not found: ${selection.id}`);
  }
  return buildCardDefinitions(deck.entries);
}

function buildDeckForPlayer(
  selection: DeckSelection,
  slot: "player1" | "player2",
  rng: () => number,
): CardDefinition[] {
  const deckRng = deckRngFrom(rng);
  if (selection.kind === "full-promoted") {
    return buildFullPromotedDeck(deckRng);
  }
  if (selection.kind === "hybrid-promoted") {
    return buildHybridPromotedDeck(
      DEFAULT_HYBRID_STARTERS[slot],
      deckRng,
      selection.tier,
    );
  }
  return resolveDeckCards(selection);
}

export function createGameFromDeckSelections(
  humanSelection: DeckSelection,
  cpuSelection: DeckSelection,
  options: { firstPlayer: PlayerId; rng?: () => number },
): GameState {
  const rng = options.rng ?? Math.random;

  if (humanSelection.kind === "full-promoted" && cpuSelection.kind === "full-promoted") {
    return createFullPromotedGame({
      firstPlayer: options.firstPlayer,
      rng,
    });
  }

  const player1Deck = buildDeckForPlayer(humanSelection, "player1", rng);
  const player2Deck = buildDeckForPlayer(cpuSelection, "player2", rng);
  return createGameForDecks(player1Deck, player2Deck, {
    firstPlayer: options.firstPlayer,
    rng,
  });
}

export function deckSelectionLabel(selection: DeckSelection): string {
  if (selection.kind === "full-promoted") {
    return FULL_PLAYABLE_DECK_OPTIONS[0].label;
  }
  if (selection.kind === "hybrid-promoted") {
    const option = FULL_PLAYABLE_DECK_OPTIONS.find(
      (entry) => entry.key === `hybrid-promoted:${selection.tier}`,
    );
    return option?.label ?? `ハイブリッド +${selection.tier}枚`;
  }
  if (selection.kind === "starter") {
    return STARTER_OPTIONS.find((option) => option.id === selection.id)?.label ?? selection.id;
  }
  return getCustomDeck(selection.id)?.name ?? "（削除されたデッキ）";
}

/** fullPlayableCatalog のカード数（デッキビルダー拡張用メタ）。 */
export function fullPlayablePoolSize(): number {
  return fullPlayableCatalog.cards.length;
}
