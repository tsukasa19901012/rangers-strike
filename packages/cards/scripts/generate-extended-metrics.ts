/**
 * 拡張レジストリのカバレッジメトリクス出力（M8）。
 *
 * Usage:
 *   npm run metrics:extended-registry
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createExtendedCardRegistry,
  snapshotExtendedRegistryMetrics,
} from "../src/dsl/registry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "pipeline/data/extended-registry-metrics.json");

function main(): void {
  const registry = createExtendedCardRegistry();
  const metrics = snapshotExtendedRegistryMetrics(registry);
  const snap = registry.snapshot();

  const stubHandlers = {
    interpreter: snap.dslReady.filter((id) => !id.startsWith("RS-") && !id.startsWith("RK-") && !id.startsWith("RM-")).length,
    typescript: snap.legacyHandler.filter((id) => !["RS-", "RK-", "RM-"].some((p) => id.startsWith(p))).length,
    unimplemented: snap.unimplemented.length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    ...metrics,
    stubHandlers,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
