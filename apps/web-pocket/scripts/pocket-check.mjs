#!/usr/bin/env node
// `pocket check` for the browser target: validates pocket.json against the
// PocketJS web-app profile and type-checks the app (tsconfig.json).
import { spawnSync } from "node:child_process";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FRAMEWORK_ROOT, bunBinDir, bunBinary, ensureToolchain } from "../../vita/scripts/toolchain.mjs";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
ensureToolchain();
const result = spawnSync(
  bunBinary(),
  [join(FRAMEWORK_ROOT, "tools/pocket.ts"), "check", "--manifest", join(APP_ROOT, "pocket.json"), "--target", "web-app"],
  {
    cwd: APP_ROOT,
    stdio: "inherit",
    env: { ...process.env, PATH: [bunBinDir(), process.env.PATH ?? ""].join(delimiter), POCKETJS_FRAMEWORK_ROOT: FRAMEWORK_ROOT },
  },
);
process.exit(result.status ?? 1);
