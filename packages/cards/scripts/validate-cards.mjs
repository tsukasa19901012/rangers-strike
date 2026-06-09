#!/usr/bin/env node
/**
 * 全カタログ CardDocument のバリデーションを実行。
 *
 * Usage: npm run validate-cards
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const result = spawnSync(
  "npx",
  ["tsx", join(root, "scripts/validate-cards.ts")],
  { stdio: "inherit", cwd: root },
);

process.exit(result.status ?? 1);
