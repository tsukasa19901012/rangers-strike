import {
  complexityPromotedCatalog,
  fullPlayableCatalog,
  vanillaPromotedCatalog,
  type CardDefinition,
} from "@rangers-strike/cards";
import { createGame, type CreateGameOptions } from "../core/createGame";
import type { GameState } from "../types/game";
import {
  buildLegend1StarterDeck,
  type CreateStarterGameOptions,
  type Legend1StarterId,
} from "./createStarterGame";

const PROMOTED_IDS = new Set([
  ...vanillaPromotedCatalog.cards.map((c) => c.id),
  ...complexityPromotedCatalog.cards.map((c) => c.id),
]);

const PROMOTED_POOL = fullPlayableCatalog.cards.filter(
  (c) =>
    PROMOTED_IDS.has(c.id) &&
    (c.type === "unit" || c.type === "operation" || c.type === "vehicle"),
);

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = tmp as T;
  }
  return copy;
}

type DeckQuota = {
  label: string;
  count: number;
  matches: (card: CardDefinition) => boolean;
};

/** CPU シミュレーションが deck-out 偏重にならないようサイズ・種別の下限を設ける。 */
const FULL_PROMOTED_QUOTAS: DeckQuota[] = [
  {
    label: "M units",
    count: 12,
    matches: (c) => c.type === "unit" && c.size === "M",
  },
  {
    label: "L units",
    count: 10,
    matches: (c) => c.type === "unit" && c.size === "L",
  },
  {
    label: "XL units",
    count: 2,
    matches: (c) => c.type === "unit" && c.size === "XL",
  },
  {
    label: "operations",
    count: 6,
    matches: (c) => c.type === "operation",
  },
  {
    label: "vehicles",
    count: 2,
    matches: (c) => c.type === "vehicle",
  },
  {
    label: "S units",
    count: 8,
    matches: (c) => c.type === "unit" && c.size === "S",
  },
];

function pickUniqueCards(
  pool: CardDefinition[],
  count: number,
  usedNames: Set<string>,
): CardDefinition[] {
  const picks: CardDefinition[] = [];
  for (const card of pool) {
    if (picks.length >= count) break;
    if (usedNames.has(card.name)) continue;
    usedNames.add(card.name);
    picks.push(card);
  }
  return picks;
}

/**
 * 昇格カードのみで 40 枚デッキを構築する（同名1枚、M18 full promoted）。
 */
export function buildFullPromotedDeck(rng: () => number): CardDefinition[] {
  const picks: CardDefinition[] = [];
  const usedNames = new Set<string>();

  for (const quota of FULL_PROMOTED_QUOTAS) {
    const bucket = shuffle(
      PROMOTED_POOL.filter((card) => quota.matches(card)),
      rng,
    );
    const picked = pickUniqueCards(bucket, quota.count, usedNames);
    if (picked.length < quota.count) {
      throw new Error(
        `full promoted deck quota "${quota.label}" needs ${quota.count}, got ${picked.length}`,
      );
    }
    picks.push(...picked);
  }

  if (picks.length < 40) {
    const filler = pickUniqueCards(
      shuffle(
        PROMOTED_POOL.filter((card) => !usedNames.has(card.name)),
        rng,
      ),
      40 - picks.length,
      usedNames,
    );
    picks.push(...filler);
  }

  if (picks.length < 40) {
    throw new Error(`full promoted deck needs 40 unique cards, got ${picks.length}`);
  }
  return shuffle(picks, rng);
}

/**
 * スターターデッキの末尾を昇格カードで差し替えた 40 枚デッキを構築する。
 */
export function buildHybridPromotedDeck(
  starterId: Legend1StarterId,
  rng: () => number,
  swapCount = 10,
): CardDefinition[] {
  const base = buildLegend1StarterDeck(starterId);
  const picks: CardDefinition[] = [];
  const usedNames = new Set<string>();

  for (const card of shuffle(PROMOTED_POOL, rng)) {
    if (picks.length >= swapCount) break;
    if (usedNames.has(card.name)) continue;
    usedNames.add(card.name);
    picks.push(card);
  }

  const keep = Math.max(0, base.length - picks.length);
  return [...base.slice(0, keep), ...picks];
}

export type CreateHybridPromotedGameOptions = Omit<
  CreateGameOptions,
  "player1Deck" | "player2Deck"
> &
  Omit<CreateStarterGameOptions, "player1Deck" | "player2Deck"> & {
    swapCount?: number;
  };

/**
 * スターター + 昇格カードのハイブリッドデッキでゲームを開始する（M16 vertical slice v2）。
 */
export type CreateFullPromotedGameOptions = Omit<
  CreateGameOptions,
  "player1Deck" | "player2Deck"
> & {
  player1Deck?: CardDefinition[];
  player2Deck?: CardDefinition[];
};

/** 昇格カードのみの 40 枚デッキでゲームを開始する（M18）。 */
export function createFullPromotedGame(
  options: CreateFullPromotedGameOptions = {},
): GameState {
  const rng = options.rng ?? Math.random;
  const deckRng = mulberry32FromRng(rng);
  const player1Deck = options.player1Deck ?? buildFullPromotedDeck(deckRng);
  const player2Deck = options.player2Deck ?? buildFullPromotedDeck(deckRng);

  return createGame({
    ...options,
    player1Deck,
    player2Deck,
  });
}

export function createHybridPromotedGame(
  options: CreateHybridPromotedGameOptions = {},
): GameState {
  const rng = options.rng ?? Math.random;
  const swapCount = options.swapCount ?? 10;
  const player1Starter = options.player1Starter ?? "abarenoh";
  const player2Starter = options.player2Starter ?? "dekaranger";

  const player1Deck =
    options.player1Deck ??
    buildHybridPromotedDeck(player1Starter, mulberry32FromRng(rng), swapCount);
  const player2Deck =
    options.player2Deck ??
    buildHybridPromotedDeck(player2Starter, mulberry32FromRng(rng), swapCount);

  return createGame({
    ...options,
    player1Deck,
    player2Deck,
  });
}

function mulberry32FromRng(rng: () => number): () => number {
  let seed = Math.floor(rng() * 0xffffffff) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
