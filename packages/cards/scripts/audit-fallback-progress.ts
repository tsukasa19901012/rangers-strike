/**
 * fallback 移行進捗レポート（M14）。
 *
 * Usage:
 *   npm run audit:fallback-progress
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFullPlayableRegistry,
  snapshotFullPlayableRegistryMetrics,
} from "../src/dsl/registry";
import { complexityPromotedCatalog, vanillaPromotedCatalog } from "../src/extendedCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "pipeline/data/fallback-progress.json");

function main(): void {
  const registry = createFullPlayableRegistry();
  const metrics = snapshotFullPlayableRegistryMetrics(registry);
  const snap = registry.snapshot();

  const byTier = {
    vanilla: { total: vanillaPromotedCatalog.cards.length, interpreter: 0, typescript: 0, unimplemented: 0, fallbackOnly: 0 },
    complexity: { total: complexityPromotedCatalog.cards.length, interpreter: 0, typescript: 0, unimplemented: 0, fallbackOnly: 0 },
  };

  const vanillaIds = new Set(vanillaPromotedCatalog.cards.map((c) => c.id));
  const complexityIds = new Set(complexityPromotedCatalog.cards.map((c) => c.id));

  for (const card of registry.listCards()) {
    const tier = vanillaIds.has(card.id) ? "vanilla" : complexityIds.has(card.id) ? "complexity" : null;
    if (!tier) continue;
    const handler = card.implementation?.handler ?? "unknown";
    const effects = card.effects ?? [];
    const fbOnly =
      effects.length > 0 &&
      effects.every((e) => e.effects.every((p) => p.type === "fallback_handler"));

    if (handler === "interpreter") byTier[tier].interpreter += 1;
    else if (handler === "typescript") byTier[tier].typescript += 1;
    else if (handler === "unimplemented") byTier[tier].unimplemented += 1;
    if (fbOnly) byTier[tier].fallbackOnly += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    registry: metrics,
    dslReady: snap.dslReady.length,
    legacyHandler: snap.legacyHandler.length,
    unimplemented: snap.unimplemented.length,
    byTier,
    targets: {
      fullPlayable: 1849,
      dslReadyGoal: 1700,
      fallbackOnlyGoal: 0,
    },
  };

  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
