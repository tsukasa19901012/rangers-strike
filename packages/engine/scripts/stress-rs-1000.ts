/**
 * RS カードのみのデッキで CPU vs CPU モンキーテスト（1000 試合）。
 *
 * Usage: npx tsx packages/engine/scripts/stress-rs-1000.ts
 */
import { fullPlayableCatalog, type CardDefinition } from "@rangers-strike/cards";
import { createGameForDecks } from "../src/core/createGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import {
  mergeEffectResolutionTraces,
  type EffectResolutionTrace,
} from "../src/verticalSlice/effectResolutionMetrics";

const RS_POOL = fullPlayableCatalog.cards.filter(
  (c) =>
    c.id.startsWith("RS-") &&
    (c.type === "unit" || c.type === "operation" || c.type === "vehicle"),
);

type DeckQuota = {
  label: string;
  count: number;
  matches: (card: CardDefinition) => boolean;
};

const RS_DECK_QUOTAS: DeckQuota[] = [
  { label: "M units", count: 12, matches: (c) => c.type === "unit" && c.size === "M" },
  { label: "L units", count: 10, matches: (c) => c.type === "unit" && c.size === "L" },
  { label: "XL units", count: 2, matches: (c) => c.type === "unit" && c.size === "XL" },
  { label: "operations", count: 6, matches: (c) => c.type === "operation" },
  { label: "vehicles", count: 2, matches: (c) => c.type === "vehicle" },
  { label: "S units", count: 8, matches: (c) => c.type === "unit" && c.size === "S" },
];

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

function buildRsDeck(rng: () => number): CardDefinition[] {
  const picks: CardDefinition[] = [];
  const usedNames = new Set<string>();

  for (const quota of RS_DECK_QUOTAS) {
    const bucket = shuffle(RS_POOL.filter((c) => quota.matches(c)), rng);
    const picked = pickUniqueCards(bucket, quota.count, usedNames);
    if (picked.length < quota.count) {
      throw new Error(
        `RS deck quota "${quota.label}" needs ${quota.count}, got ${picked.length}`,
      );
    }
    picks.push(...picked);
  }

  if (picks.length < 40) {
    const filler = pickUniqueCards(
      shuffle(
        RS_POOL.filter((c) => !usedNames.has(c.name)),
        rng,
      ),
      40 - picks.length,
      usedNames,
    );
    picks.push(...filler);
  }

  return shuffle(picks, rng);
}

const GAME_COUNT = 1000;
const MAX_STEPS = 20_000;

type Failure = {
  seed: number;
  reason: string;
  phase: string;
  pending?: string;
  lastLog?: string;
  error?: string;
};

const failures: Failure[] = [];
const traces: EffectResolutionTrace[] = [];
let winner = 0;
let applyFailed = 0;
let stepLimit = 0;
let noLegal = 0;
let strikes = 0;
let battles = 0;

console.log(`RS pool: ${RS_POOL.length} cards`);
console.log(`Running ${GAME_COUNT} monkey games...\n`);

for (let seed = 1; seed <= GAME_COUNT; seed += 1) {
  const rng = mulberry32(seed);
  const deckRng = mulberry32(seed * 9973 + 42);
  const p1Deck = buildRsDeck(deckRng);
  const p2Deck = buildRsDeck(mulberry32(seed * 7919 + 17));

  const initial = createGameForDecks(p1Deck, p2Deck, {
    rng,
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
  });

  const result = playStarterMatchUntilEnd(initial, { maxSteps: MAX_STEPS, rng });
  traces.push(result.trace.effectResolution);
  strikes += result.trace.strikes;
  battles += result.trace.battles;

  switch (result.reason) {
    case "winner":
      winner += 1;
      break;
    case "apply_failed":
      applyFailed += 1;
      failures.push({
        seed,
        reason: result.reason,
        phase: result.state.phase,
        pending:
          result.state.pendingEffectChoice?.effectId ??
          result.state.pendingEffectChoice?.kind,
        lastLog: result.state.log.at(-1),
        error: result.error,
      });
      break;
    case "step_limit":
      stepLimit += 1;
      failures.push({
        seed,
        reason: result.reason,
        phase: result.state.phase,
        pending:
          result.state.pendingEffectChoice?.effectId ??
          result.state.pendingEffectChoice?.kind,
        lastLog: result.state.log.at(-1),
        error: result.error,
      });
      break;
    case "no_legal_actions":
      noLegal += 1;
      failures.push({
        seed,
        reason: result.reason,
        phase: result.state.phase,
        pending:
          result.state.pendingEffectChoice?.effectId ??
          result.state.pendingEffectChoice?.kind,
        lastLog: result.state.log.at(-1),
        error: result.error,
      });
      break;
  }

  if (seed % 100 === 0) {
    process.stdout.write(`  ${seed}/${GAME_COUNT}...\n`);
  }
}

const merged = mergeEffectResolutionTraces(traces);

console.log("\n=== RS Monkey Test (1000 games) ===");
console.log(`winner:           ${winner}`);
console.log(`apply_failed:     ${applyFailed}`);
console.log(`step_limit:       ${stepLimit}`);
console.log(`no_legal_actions: ${noLegal}`);
console.log(`games_with_strike: ${strikes > 0 ? "yes" : "no"} (total strikes: ${strikes})`);
console.log(`games_with_battle: ${battles > 0 ? "yes" : "no"} (total battles: ${battles})`);
console.log(
  `effect_unresolved: ${merged.unresolvedCount} (${(merged.unresolvedRate * 100).toFixed(2)}%)`,
);

if (merged.topUnresolvedByCardId.length > 0) {
  console.log("\nTop unresolved RS cardIds:");
  for (const { cardId, count } of merged.topUnresolvedByCardId.filter((x) =>
    x.cardId.startsWith("RS-"),
  ).slice(0, 10)) {
    console.log(`  ${cardId}: ${count}`);
  }
}

if (failures.length > 0) {
  const applyFails = failures.filter((f) => f.reason === "apply_failed");
  if (applyFails.length > 0) {
    console.log(`\nApply failures (${applyFails.length}):`);
    for (const f of applyFails) {
      console.log(
        `  seed=${f.seed} error=${f.error ?? "-"} phase=${f.phase} log=${f.lastLog ?? "-"}`,
      );
    }
  }
  console.log(`\nFailures (${failures.length}, first 20):`);
  for (const f of failures.slice(0, 20)) {
    console.log(
      `  seed=${f.seed} ${f.reason} phase=${f.phase} pending=${f.pending ?? "-"} error=${f.error ?? "-"} log=${f.lastLog ?? "-"}`,
    );
  }
}

process.exit(failures.length > 0 ? 1 : 0);
