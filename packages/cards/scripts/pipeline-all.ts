/**
 * カードパイプライン一括実行（M10）。
 *
 * Usage:
 *   npm run pipeline:all
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const steps = [
  ["generate-wiki-stubs", "generate-wiki-stubs"],
  ["generate-all-dsl", "generate-all-dsl"],
  ["pipeline:compile-stubs", "pipeline:compile-stubs"],
  ["pipeline:compile-stubs-extended", "pipeline:compile-stubs-extended"],
  ["pipeline:recompile-vanilla", "pipeline:recompile-vanilla"],
  ["pipeline:recompile-complexity", "pipeline:recompile-complexity"],
  ["emit-core-dsl-stubs", "emit-core-dsl-stubs"],
  ["emit-core-catalog", "emit-core-catalog"],
  ["emit-vanilla-catalog", "emit-vanilla-catalog"],
  ["emit-complexity-catalog", "emit-complexity-catalog"],
  ["emit-full-playable-catalog", "emit-full-playable-catalog"],
  ["generate-vanilla-smoke", "generate-vanilla-smoke"],
  ["generate-full-playable-smoke", "generate-full-playable-smoke"],
  ["generate-engine-smoke", "generate-engine-smoke"],
  ["audit:fallback-progress", "audit:fallback-progress"],
  ["audit:stub-delegates", "audit:stub-delegates"],
  ["audit:enqueue-coverage", "audit:enqueue-coverage"],
  ["remigrate-enqueue-effects", "remigrate-enqueue-effects"],
  ["remigrate-stub-effects", "remigrate-stub-effects"],
  ["audit:effect-keywords", "audit:effect-keywords"],
  ["verify-wiki-effects", "verify-wiki-effects"],
  ["wiki-drift", "wiki-drift"],
  ["generate-integration-tests", "generate-integration-tests"],
  ["metrics:extended-registry", "metrics:extended-registry"],
  ["metrics:full-playable", "metrics:full-playable"],
  ["audit:runtime-effects", "audit:runtime-effects"],
  ["extract-effect-catalog", "extract-effect-catalog"],
  ["audit:rollout-status", "audit:rollout-status"],
];

for (const [label, script] of steps) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync("npm", ["run", script, "-w", "@rangers-strike/cards"], {
    cwd: join(root, "../.."),
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n=== pipeline:all complete ===");
