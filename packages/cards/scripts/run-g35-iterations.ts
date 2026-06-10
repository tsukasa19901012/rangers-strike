/**
 * Run G3.5 iterations 10–30: splice PATTERNS, remigrate, test, commit.
 *
 * Usage:
 *   npx tsx scripts/run-g35-iterations.ts
 *   npx tsx scripts/run-g35-iterations.ts --from 15
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { G35_BATCHES } from "./g35-iteration-batches";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const repoRoot = join(root, "..", "..");
const extractPath = join(root, "src/pipeline/extractEffects.ts");
const MARKER = "  // __G35_ITERATION_PATTERNS__";

function run(cmd: string, quiet = false): string {
  return execSync(cmd, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: quiet ? ["pipe", "pipe", "pipe"] : "inherit",
  }) as string;
}

function splicePatterns(batchPatterns: string): void {
  let src = readFileSync(extractPath, "utf8");
  if (!src.includes(MARKER)) {
    src = src.replace(
      /  \{\n    pattern: "grant_effect_generic",/,
      `${MARKER}\n  {\n    pattern: "grant_effect_generic",`,
    );
  }
  const markerIdx = src.indexOf(MARKER);
  if (markerIdx === -1) throw new Error("G35 marker not found in extractEffects.ts");

  const closeIdx = src.indexOf("\n];", markerIdx);
  if (closeIdx === -1) throw new Error("PATTERNS array close not found");

  const insert = `${batchPatterns},\n`;
  src = src.slice(0, closeIdx) + insert + src.slice(closeIdx);
  writeFileSync(extractPath, src);
}

function remigrateCount(): number {
  const out = run("npm run remigrate-stub-effects -w @rangers-strike/cards", true);
  console.log(out);
  const match = out.match(/"migrated":\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function main(): void {
  const fromArg = process.argv.indexOf("--from");
  const from = fromArg >= 0 ? Number(process.argv[fromArg + 1]) : 10;

  for (const batch of G35_BATCHES) {
    if (batch.iteration < from) continue;

    console.log(`\n========== Iteration ${batch.iteration} ==========`);
    splicePatterns(batch.patterns);

    const migrated = remigrateCount();
    run("npm run emit-vanilla-catalog -w @rangers-strike/cards", true);
    run("npm run emit-complexity-catalog -w @rangers-strike/cards", true);
    run("npm run generate-engine-smoke -w @rangers-strike/cards", true);
    run("npm run audit:rollout-status -w @rangers-strike/cards", true);
    run("npm run test -w @rangers-strike/cards", true);
    run("npm run test -w @rangers-strike/engine", true);

    const msg = `${batch.commitSubject} (${migrated} remigrated)`;
    run(
      `git add packages/cards/src/pipeline/extractEffects.ts packages/cards/pipeline/data/ packages/cards/src/generated/ packages/engine/src/generated/promotedInterpreter.smoke.generated.test.ts packages/cards/scripts/g35-iteration-batches.ts packages/cards/scripts/run-g35-iterations.ts`,
    );
    run(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
    console.log(`Committed: ${msg}`);
  }
}

main();
