/**
 * RK/BK スタブ・モック・シミュレーション監査（CLI レポート）
 *
 * Usage: npx tsx packages/engine/scripts/rkbk-audit.ts
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fullPlayableCatalog } from "@rangers-strike/cards";
import { classifyRuntimeRematch } from "../../cards/src/pipeline/measureEffectResolution";
import { isCatchallGrantKeyword } from "../src/dsl/hashGrantKeywordStub";
import { createFullPromotedGame } from "../src/verticalSlice/createPromotedGame";
import { playStarterMatchUntilEnd } from "../src/verticalSlice/playStarterMatch";
import {
  collectEffectResolutionMetrics,
  mergeEffectResolutionTraces,
} from "../src/verticalSlice/effectResolutionMetrics";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dslDir = join(__dirname, "../../cards/src/generated/dsl-stubs");
const outDir = join(__dirname, "../../cards/pipeline/data");
const outPath = join(outDir, "rkbk-audit-report.json");

const SIM_GAMES = Number(process.env.RKBK_SIM_GAMES ?? 200);
const RK_BK_POOL = fullPlayableCatalog.cards.filter(
  (c) => c.id.startsWith("RK-") || c.id.startsWith("BK-"),
);

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

function buildRkBkDeck(rng: () => number) {
  const used = new Set<string>();
  const picks = [];
  for (const card of shuffle(RK_BK_POOL, rng)) {
    if (used.has(card.name)) continue;
    used.add(card.name);
    picks.push(card);
    if (picks.length >= 40) break;
  }
  return picks;
}

function auditPrefix(prefix: "RK-" | "BK-") {
  const catchallCards: string[] = [];
  let interpretEffect = 0;
  let catchallStubs = 0;
  let strictUnresolved = 0;
  let effects = 0;

  for (const file of readdirSync(dslDir).filter((f) => f.startsWith(prefix))) {
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8"));
    for (const effect of doc.effects ?? []) {
      effects += 1;
      for (const p of effect.effects ?? []) {
        if (p.type === "interpret_effect") interpretEffect += 1;
        if (p.type === "grant_keyword" && p.keyword && isCatchallGrantKeyword(p.keyword)) {
          catchallStubs += 1;
          catchallCards.push(doc.id);
        }
      }
      if (classifyRuntimeRematch(effect, doc.id) === "strict_unresolved") {
        strictUnresolved += 1;
      }
    }
  }

  return {
    prefix,
    cards: readdirSync(dslDir).filter((f) => f.startsWith(prefix)).length,
    effects,
    catchallStubs,
    catchallCards: [...new Set(catchallCards)],
    interpretEffect,
    strictUnresolved,
  };
}

function main(): void {
  const dsl = {
    BK: auditPrefix("BK-"),
    RK: auditPrefix("RK-"),
  };

  const traces = [];
  let winners = 0;
  let applyFailed = 0;

  for (let seed = 1; seed <= SIM_GAMES; seed += 1) {
    const rng = mulberry32(seed);
    const initial = createFullPromotedGame({
      rng,
      firstPlayer: seed % 2 ? "player1" : "player2",
      player1Deck: buildRkBkDeck(rng),
      player2Deck: buildRkBkDeck(rng),
    });
    const result = playStarterMatchUntilEnd(initial, { maxSteps: 15_000 });
    traces.push(collectEffectResolutionMetrics(result.state.log));
    if (result.reason === "winner") winners += 1;
    if (result.reason === "apply_failed") applyFailed += 1;
  }

  const merged = mergeEffectResolutionTraces(traces);
  const rkBkUnresolved = Object.entries(merged.byCardId)
    .filter(([id]) => id.startsWith("RK-") || id.startsWith("BK-"))
    .map(([cardId, count]) => ({ cardId, count }))
    .sort((a, b) => b.count - a.count);

  const report = {
    generatedAt: new Date().toISOString(),
    dsl,
    simulation: {
      games: SIM_GAMES,
      winners,
      applyFailed,
      effectLogCount: merged.effectLogCount,
      unresolvedCount: merged.unresolvedCount,
      rkBkUnresolvedTotal: rkBkUnresolved.reduce((s, x) => s + x.count, 0),
      topRkBkUnresolved: rkBkUnresolved.slice(0, 20),
    },
    pass:
      dsl.BK.catchallStubs === 0 &&
      dsl.RK.catchallStubs === 0 &&
      dsl.BK.interpretEffect === 0 &&
      dsl.RK.interpretEffect === 0 &&
      dsl.BK.strictUnresolved === 0 &&
      dsl.RK.strictUnresolved === 0 &&
      applyFailed === 0 &&
      rkBkUnresolved.reduce((s, x) => s + x.count, 0) === 0,
  };

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\n→ ${outPath}`);
}

main();
