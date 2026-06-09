#!/usr/bin/env node
/**
 * カードテストスタブを自動生成する。
 *
 * Usage:
 *   npm run generate-card-tests
 *   npm run generate-card-tests -- RS-046 RS-001
 *   npm run generate-card-tests -- --smoke-only
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const result = spawnSync(
  "npx",
  ["tsx", join(root, "scripts/generate-card-tests.ts"), ...process.argv.slice(2)],
  { stdio: "inherit", cwd: root },
);

process.exit(result.status ?? 1);
