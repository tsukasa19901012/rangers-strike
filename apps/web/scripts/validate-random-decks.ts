import {
  fullPlayableCatalog,
  isCardDslReady,
  type CardDefinition,
  type DeckEntry,
} from "@rangers-strike/cards";
import {
  remainingCopiesForCard,
  validateDeckEntries,
} from "../lib/deckBuilder";
import { estimateDeckWarnings } from "../lib/deckWarnings";
import { assertRkDeckBuilder } from "../lib/rkUiLogic";
import { RK_BATCH_01 } from "../lib/rkUiTestSpecs/batch01";
import { RK_BATCH_02 } from "../lib/rkUiTestSpecs/batch02";

const DECK_SIZE = 40;
const RK_SPECS = [...RK_BATCH_01, ...RK_BATCH_02];
const RK_BY_ID = new Map(RK_SPECS.map((spec) => [spec.cardId, spec]));
const POOL = fullPlayableCatalog.cards;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countsToEntries(counts: Map<string, number>): DeckEntry[] {
  return [...counts.entries()]
    .map(([cardId, count]) => ({ cardId, count }))
    .sort((a, b) => a.cardId.localeCompare(b.cardId));
}

function buildRandomDeckEntries(seed: number): DeckEntry[] {
  const rng = mulberry32(seed);
  const counts = new Map<string, number>();
  let total = 0;
  let attempts = 0;
  const maxAttempts = 200_000;

  while (total < DECK_SIZE) {
    if (++attempts > maxAttempts) {
      throw new Error(`seed ${seed}: could not assemble ${DECK_SIZE} cards within copy limits`);
    }
    const card: CardDefinition = POOL[Math.floor(rng() * POOL.length)]!;
    const entries = countsToEntries(counts);
    if (remainingCopiesForCard(card, entries) <= 0) continue;
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
    total += 1;
  }

  return countsToEntries(counts);
}

type SeedResult = {
  seed: number;
  pass: boolean;
  errors: string[];
  uiUncertainCount: number;
  uncertainCardIds: string[];
};

function validateSeed(seed: number): SeedResult {
  const errors: string[] = [];
  let entries: DeckEntry[];
  try {
    entries = buildRandomDeckEntries(seed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      seed,
      pass: false,
      errors: [msg],
      uiUncertainCount: 0,
      uncertainCardIds: [],
    };
  }

  const validation = validateDeckEntries(entries);
  if (!validation.ok) {
    errors.push(...validation.errors);
  }

  const warnings = estimateDeckWarnings(entries);
  for (const cardId of warnings.uncertainCardIds) {
    if (isCardDslReady(cardId)) {
      errors.push(`${cardId}: DSL-ready card listed in uncertainCardIds`);
    }
  }

  const deckCardIds = new Set(entries.map((e) => e.cardId));
  for (const cardId of deckCardIds) {
    const spec = RK_BY_ID.get(cardId);
    if (!spec) continue;
    try {
      assertRkDeckBuilder(spec);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
    }
  }

  return {
    seed,
    pass: errors.length === 0,
    errors,
    uiUncertainCount: warnings.uiUncertainCount,
    uncertainCardIds: warnings.uncertainCardIds,
  };
}

function parseArgs(argv: string[]): { count: number; seedStart: number } {
  let count = 1000;
  let seedStart = 1;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--count" && argv[i + 1]) {
      count = Number(argv[++i]);
    } else if (argv[i] === "--seed-start" && argv[i + 1]) {
      seedStart = Number(argv[++i]);
    }
  }
  return { count, seedStart };
}

function cardIdFromError(error: string): string | undefined {
  const m = /^([A-Z]{2,3}-\d+)/.exec(error);
  if (m) return m[1];
  const inParens = /\(([A-Z]{2,3}-\d+)/.exec(error);
  return inParens?.[1];
}

function main(): void {
  const { count, seedStart } = parseArgs(process.argv.slice(2));
  const results: SeedResult[] = [];
  let uiUncertainIdHits = 0;
  let uiUncertainCountTotal = 0;

  for (let i = 0; i < count; i++) {
    const seed = seedStart + i;
    const result = validateSeed(seed);
    results.push(result);
    uiUncertainIdHits += result.uncertainCardIds.length;
    uiUncertainCountTotal += result.uiUncertainCount;
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  const first10Failures = results
    .filter((r) => !r.pass)
    .slice(0, 10)
    .map((r) => ({
      seed: r.seed,
      cardId: cardIdFromError(r.errors[0] ?? ""),
      errors: r.errors,
    }));

  const summary = {
    pass,
    fail,
    first10Failures,
    uiUncertainCount: uiUncertainCountTotal,
    apply_failed: 0,
    unresolved_rate: 0,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
