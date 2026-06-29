/**
 * RK/BK スタブ・モック監査 + モンキーテスト
 *
 * Usage:
 *   npx vitest run src/rkBkMonkey.test.ts
 *   MONKEY_GAMES=100 npx vitest run src/rkBkMonkey.test.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fullPlayableCatalog, type CardDefinition } from "@rangers-strike/cards";
import { isCatchallGrantKeyword } from "./dsl/hashGrantKeywordStub";
import { applyAction, createGame, getLegalActions } from "./index";
import { createFullPromotedGame } from "./verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "./verticalSlice/playStarterMatch";
import {
  collectEffectResolutionMetrics,
  INTERPRET_EFFECT_UNRESOLVED,
  mergeEffectResolutionTraces,
} from "./verticalSlice/effectResolutionMetrics";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const dslDir = join(repoRoot, "packages/cards/src/generated/dsl-stubs");

const RK_BK_POOL = fullPlayableCatalog.cards.filter(
  (c) => c.id.startsWith("RK-") || c.id.startsWith("BK-"),
);

const MONKEY_GAMES = Number(process.env.MONKEY_GAMES ?? 60);
const SIM_GAMES = Number(process.env.RKBK_SIM_GAMES ?? 150);
const MAX_STEPS = Number(process.env.RKBK_MAX_STEPS ?? 15_000);

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
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function buildRkBkDeck(rng: () => number, size = 40): CardDefinition[] {
  const used = new Set<string>();
  const picks: CardDefinition[] = [];
  for (const card of shuffle(RK_BK_POOL, rng)) {
    if (used.has(card.name)) continue;
    used.add(card.name);
    picks.push(card);
    if (picks.length >= size) break;
  }
  if (picks.length < size) {
    throw new Error(`RK/BK pool too small: need ${size}, got ${picks.length}`);
  }
  return picks;
}

function loadDslDocs(prefix: "RK-" | "BK-") {
  return readdirSync(dslDir)
    .filter((f) => f.startsWith(prefix))
    .map((f) => JSON.parse(readFileSync(join(dslDir, f), "utf8")) as {
      id: string;
      name?: string;
      effects?: Array<{
        id: string;
        text?: string;
        name?: string;
        trigger?: unknown;
        effects?: Array<{ type: string; keyword?: string }>;
      }>;
    });
}

function auditDslStubs(prefix: "RK-" | "BK-") {
  const docs = loadDslDocs(prefix);
  let catchallStubs = 0;
  let interpretEffect = 0;
  const catchallCards: string[] = [];

  for (const doc of docs) {
    for (const effect of doc.effects ?? []) {
      for (const p of effect.effects ?? []) {
        if (p.type === "interpret_effect") interpretEffect += 1;
        if (p.type === "grant_keyword" && p.keyword && isCatchallGrantKeyword(p.keyword)) {
          catchallStubs += 1;
          catchallCards.push(doc.id);
        }
      }
    }
  }

  return {
    cards: docs.length,
    catchallStubs,
    catchallCards: [...new Set(catchallCards)].sort(),
    interpretEffect,
  };
}

type MonkeyFailure = {
  seed: number;
  step: number;
  reason: string;
  phase: string;
};

function runRkBkMonkeyGame(seed: number): MonkeyFailure | null {
  const rng = mulberry32(seed);
  const deckA = buildRkBkDeck(rng);
  const deckB = buildRkBkDeck(rng);

  let state = createGame({
    player1Deck: deckA,
    player2Deck: deckB,
    firstPlayer: seed % 2 === 0 ? "player1" : "player2",
    rng,
  });

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (state.winner) return null;
    const actions = getLegalActions(state);
    if (actions.length === 0) {
      return { seed, step, reason: "no_legal_actions", phase: state.phase };
    }
    const action = actions[Math.floor(rng() * actions.length)]!;
    const result = applyAction(state, action);
    if (!result.ok) {
      if (result.error === "cannot_enter_battle") continue;
      return { seed, step, reason: `apply_failed:${result.error}`, phase: state.phase };
    }
    state = result.state;
  }

  return { seed, step: MAX_STEPS, reason: "step_limit", phase: state.phase };
}

function isRkBkCardId(cardId: string | undefined): boolean {
  return !!cardId && (cardId.startsWith("RK-") || cardId.startsWith("BK-"));
}

describe("RK/BK DSL stub and mock audit", () => {
  it("BK: zero catchall stubs, zero interpret_effect", () => {
    const r = auditDslStubs("BK-");
    expect(r.cards).toBe(19);
    expect(r.catchallStubs, r.catchallCards.join(",")).toBe(0);
    expect(r.interpretEffect).toBe(0);
  });

  it("RK: zero catchall stubs, zero interpret_effect", () => {
    const r = auditDslStubs("RK-");
    expect(r.cards).toBe(335);
    expect(r.catchallStubs, r.catchallCards.join(",")).toBe(0);
    expect(r.interpretEffect).toBe(0);
  });

  it("RK/BK pool has enough cards for 40-card decks", () => {
    expect(RK_BK_POOL.length).toBeGreaterThanOrEqual(40);
    const rk = RK_BK_POOL.filter((c) => c.id.startsWith("RK-")).length;
    const bk = RK_BK_POOL.filter((c) => c.id.startsWith("BK-")).length;
    expect(rk).toBeGreaterThanOrEqual(335);
    expect(bk).toBe(19);
  });
});

describe("RK/BK monkey test (random legal actions, RK/BK-only decks)", () => {
  it(
    `completes ${MONKEY_GAMES} games without engine errors`,
    { timeout: 180_000 },
    () => {
      const failures: MonkeyFailure[] = [];
      let finished = 0;
      let timedOut = 0;

      for (let seed = 1; seed <= MONKEY_GAMES; seed += 1) {
        const failure = runRkBkMonkeyGame(seed);
        if (!failure) {
          finished += 1;
          continue;
        }
        if (failure.reason === "step_limit") {
          timedOut += 1;
          continue;
        }
        failures.push(failure);
      }

      if (failures.length > 0) {
        const sample = failures
          .slice(0, 8)
          .map((f) => `seed=${f.seed} step=${f.step} ${f.reason} phase=${f.phase}`)
          .join("\n");
        expect.fail(`${failures.length} RK/BK monkey failure(s):\n${sample}`);
      }

      expect(finished + timedOut).toBe(MONKEY_GAMES);
      expect(finished).toBeGreaterThan(0);
      console.info(
        `[rk-bk-monkey] games=${MONKEY_GAMES} won=${finished} step_limit=${timedOut} errors=0`,
      );
    },
  );
});

describe("RK/BK CPU simulation (hybrid promoted, unresolved audit)", () => {
  it(
    `${SIM_GAMES} games with zero interpret_effect_unresolved on RK/BK cards`,
    { timeout: 300_000 },
    () => {
      const traces = [];
      let applyFailed = 0;
      let noLegal = 0;
      let winners = 0;

      for (let seed = 1; seed <= SIM_GAMES; seed += 1) {
        const rng = mulberry32(seed);
        const initial = createFullPromotedGame({
          rng,
          firstPlayer: seed % 2 === 0 ? "player1" : "player2",
          player1Deck: buildRkBkDeck(rng),
          player2Deck: buildRkBkDeck(rng),
        });
        const result = playStarterMatchUntilEnd(initial, { maxSteps: MAX_STEPS });
        traces.push(collectEffectResolutionMetrics(result.state.log));

        if (result.reason === "winner") winners += 1;
        else if (result.reason === "apply_failed") applyFailed += 1;
        else if (result.reason === "no_legal_actions") noLegal += 1;
      }

      const merged = mergeEffectResolutionTraces(traces);
      const rkBkUnresolved = Object.entries(merged.byCardId)
        .filter(([cardId]) => isRkBkCardId(cardId))
        .reduce((sum, [, count]) => sum + count, 0);

      const rkBkUnresolvedByEffect = Object.entries(merged.byEffectId)
        .filter(([id]) => id.includes("RK-") || id.includes("BK-") || /^[a-z_]+$/.test(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.info(
        JSON.stringify({
          simGames: SIM_GAMES,
          winners,
          applyFailed,
          noLegal,
          totalEffectResolutions: merged.effectLogCount,
          totalUnresolved: merged.unresolvedCount,
          rkBkUnresolved,
          rkBkUnresolvedRate:
            merged.effectLogCount > 0 ? rkBkUnresolved / merged.effectLogCount : 0,
          topRkBkUnresolvedEffects: rkBkUnresolvedByEffect,
        }),
      );

      expect(applyFailed, "apply_failed during CPU sim").toBe(0);
      expect(rkBkUnresolved, `RK/BK ${INTERPRET_EFFECT_UNRESOLVED} hits`).toBe(0);
      expect(winners).toBeGreaterThan(0);
    },
  );
});
