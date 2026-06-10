#!/usr/bin/env node
/**
 * Wiki → card.json 量産パイプライン
 *
 * Usage:
 *   npm run pipeline:card -- RS-020 RS-054 RS-059
 *   npm run pipeline:card -- --examples
 *   npm run pipeline:card -- --all-simple   # grade A/B only (dry-run summary)
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const result = spawnSync(
  "npx",
  ["tsx", join(root, "scripts/run-card-pipeline.ts"), ...process.argv.slice(2)],
  { stdio: "inherit", cwd: root },
);

process.exit(result.status ?? 1);
