/**
 * M20 パイプライン同期: 再コンパイル → stub effect 再マイグレーション → 監査/スモーク生成。
 *
 * Usage:
 *   npm run pipeline:m20-sync
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

const steps = [
  "pipeline:recompile-vanilla",
  "pipeline:recompile-complexity",
  "remigrate-stub-effects",
  "remigrate-enqueue-effects",
  "emit-vanilla-catalog",
  "emit-complexity-catalog",
  "generate-engine-smoke",
  "audit:effect-keywords",
  "audit:runtime-effects",
  "audit:enqueue-coverage",
];

for (const script of steps) {
  console.log(`\n=== ${script} ===`);
  const result = spawnSync("npm", ["run", script, "-w", "@rangers-strike/cards"], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`Failed: ${script}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n=== pipeline:m20-sync complete ===");
