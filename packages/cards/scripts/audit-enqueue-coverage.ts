/**
 * full-playable の enqueue_trigger 委譲カバレッジ監査（M16）。
 *
 * Usage:
 *   npm run audit:enqueue-coverage
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFullPlayableRegistry } from "../src/dsl/registry";
import { loadAllCardDocuments } from "../src/dsl/loader";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dispatchPath = join(root, "../engine/src/dsl/runtimeEffectDispatch.ts");
const outputPath = join(root, "pipeline/data/enqueue-coverage-audit.json");

type CoverageEntry = {
  effectId: string;
  cardCount: number;
  sampleCardIds: string[];
  category: "core_legacy" | "promoted_noop" | "mixed_primitives";
};

function main(): void {
  const registry = createFullPlayableRegistry();
  const coreIds = new Set(loadAllCardDocuments().map((c) => c.id));
  const dispatchSource = readFileSync(dispatchPath, "utf8");

  const byEffectId = new Map<
    string,
    { count: number; sampleCardIds: string[]; hasNonEnqueue: boolean; isCore: boolean }
  >();

  for (const card of registry.listCards()) {
    for (const effect of card.effects ?? []) {
      const enqueue = effect.effects.filter((p) => p.type === "enqueue_trigger");
      if (enqueue.length === 0) continue;

      for (const p of enqueue) {
        if (p.type !== "enqueue_trigger") continue;
        const effectId = p.effectId;
        const bucket = byEffectId.get(effectId) ?? {
          count: 0,
          sampleCardIds: [],
          hasNonEnqueue: false,
          isCore: false,
        };
        bucket.count += 1;
        if (bucket.sampleCardIds.length < 5) bucket.sampleCardIds.push(card.id);
        bucket.hasNonEnqueue =
          bucket.hasNonEnqueue ||
          effect.effects.some((prim) => prim.type !== "enqueue_trigger");
        bucket.isCore = bucket.isCore || coreIds.has(card.id);
        byEffectId.set(effectId, bucket);
      }
    }
  }

  const entries: CoverageEntry[] = [...byEffectId.entries()].map(([effectId, meta]) => {
    let category: CoverageEntry["category"] = "promoted_noop";
    if (meta.isCore) category = "core_legacy";
    else if (meta.hasNonEnqueue) category = "mixed_primitives";

    return {
      effectId,
      cardCount: meta.count,
      sampleCardIds: meta.sampleCardIds,
      category,
    };
  });

  const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  const topPromoted = entries
    .filter((e) => e.category === "promoted_noop")
    .sort((a, b) => b.cardCount - a.cardCount)
    .slice(0, 30);

  const report = {
    generatedAt: new Date().toISOString(),
    dispatchSource: "packages/engine/src/dsl/runtimeEffectDispatch.ts",
    uniqueEnqueueEffectIds: entries.length,
    byCategory,
    legacyDelegatePatternsFound: [
      "resolveOperationEffect",
      "applyLegacyNumberComboEffect",
      "resolveLegend2EnterBattle",
      "resolveLegend3EnterBattle",
      "resolveNamedOnRushEffects",
    ].filter((name) => dispatchSource.includes(name)),
    topPromotedNoop: topPromoted,
    note: "promoted_noop = enqueue-only stub; grant_keyword/choose primitives resolve via effectLookup full-playable fallback (M16).",
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { uniqueEnqueueEffectIds: entries.length, byCategory },
      null,
      2,
    ),
  );
  console.log(`→ ${outputPath}`);
}

main();
