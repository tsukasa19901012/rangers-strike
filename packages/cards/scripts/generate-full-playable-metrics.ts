/**
 * full-playable レジストリメトリクス出力（M11/M12）。
 *
 * Usage:
 *   npm run metrics:full-playable
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  complexityPromotedCatalog,
  fullPlayableCatalog,
  vanillaPromotedCatalog,
} from "../src/extendedCatalog";
import {
  createFullPlayableRegistry,
  snapshotFullPlayableRegistryMetrics,
} from "../src/dsl/registry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "pipeline/data/full-playable-metrics.json");

function main(): void {
  const registry = createFullPlayableRegistry();
  const metrics = {
    generatedAt: new Date().toISOString(),
    catalog: {
      vanillaPromoted: vanillaPromotedCatalog.cards.length,
      complexityPromoted: complexityPromotedCatalog.cards.length,
      fullPlayable: fullPlayableCatalog.cards.length,
    },
    registry: snapshotFullPlayableRegistryMetrics(registry),
  };

  writeFileSync(outputPath, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(JSON.stringify(metrics, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
