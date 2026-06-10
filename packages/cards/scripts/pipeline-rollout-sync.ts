/**
 * 全カード反映イテレーション用の一括同期。
 * 週次マイルストーン（M21+）で pipeline:m20-sync + メトリクス + 監査 + テストを実行。
 *
 * Usage:
 *   npm run pipeline:rollout-sync
 *   npm run pipeline:rollout-sync -- --skip-tests
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");
const skipTests = process.argv.includes("--skip-tests");

const cardSteps = [
  "pipeline:recompile-vanilla",
  "pipeline:recompile-complexity",
  "remigrate-stub-effects",
  "promote-dsl-ready",
  "finalize-effect-primitives",
  "remigrate-enqueue-effects",
  "emit-vanilla-catalog",
  "emit-complexity-catalog",
  "generate-engine-smoke",
  "audit:effect-keywords",
  "audit:runtime-effects",
  "audit:runtime-delegates",
  "audit:enqueue-coverage",
  "metrics:full-playable",
  "audit:rollout-status",
];

function run(workspace: string, script: string): void {
  console.log(`\n=== ${workspace}:${script} ===`);
  const result = spawnSync("npm", ["run", script, "-w", workspace], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`Failed: ${workspace}:${script}`);
    process.exit(result.status ?? 1);
  }
}

for (const script of cardSteps) {
  run("@rangers-strike/cards", script);
}

if (!skipTests) {
  run("@rangers-strike/cards", "test");
  run("@rangers-strike/engine", "test");
}

console.log("\n=== pipeline:rollout-sync complete ===");
console.log("See packages/cards/pipeline/data/rollout-status.json");
