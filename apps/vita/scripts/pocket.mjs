#!/usr/bin/env node
// `node scripts/pocket.mjs <check|compile|build> [--target vita] [-- backend args]`
// Runs the PocketJS manifest compiler from the isolated toolchain against
// apps/vita/pocket.json.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { delimiter } from "node:path";
import { APP_ROOT, FRAMEWORK_ROOT, bunBinDir, bunBinary, ensureToolchain } from "./toolchain.mjs";

ensureToolchain();
const args = process.argv.slice(2);
if (!args.includes("--target") && !args.some((a) => a.startsWith("--target="))) {
  args.splice(1, 0, "--target", "vita");
}
if (!args.includes("--manifest")) args.splice(1, 0, "--manifest", join(APP_ROOT, "pocket.json"));
const result = spawnSync(bunBinary(), [join(FRAMEWORK_ROOT, "tools/pocket.ts"), ...args], {
  cwd: APP_ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    PATH: [bunBinDir(), process.env.PATH ?? ""].join(delimiter),
    POCKETJS_FRAMEWORK_ROOT: FRAMEWORK_ROOT,
  },
});
process.exit(result.status ?? 1);
