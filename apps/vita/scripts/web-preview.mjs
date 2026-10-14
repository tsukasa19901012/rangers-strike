#!/usr/bin/env node
// Runs the Vita app in PocketJS's browser host (WASM core, density 1) for
// development on a desktop. Builds src/main.tsx into the toolchain's
// framework dist/ (where hosts/web serves bundles from) and starts the server.
//
//   node scripts/web-preview.mjs [--build-only] [--port=8130]
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { APP_ROOT, FRAMEWORK_ROOT, bunBinary, ensureToolchain } from "./toolchain.mjs";

ensureToolchain();
const args = process.argv.slice(2);
const port = (args.find((a) => a.startsWith("--port=")) ?? "--port=8130").slice("--port=".length);
const bun = bunBinary();
const built = spawnSync(
  bun,
  [
    join(FRAMEWORK_ROOT, "tools/build.ts"),
    join(APP_ROOT, "src/main.tsx"),
    `--project-root=${APP_ROOT}`,
    `--outdir=${join(FRAMEWORK_ROOT, "dist")}`,
    "--no-config",
  ],
  { cwd: APP_ROOT, stdio: "inherit" },
);
if (built.status !== 0) process.exit(built.status ?? 1);
if (args.includes("--build-only")) process.exit(0);
console.log(`open http://127.0.0.1:${port}/ and pick "main"`);
const server = spawn(bun, [join(FRAMEWORK_ROOT, "hosts/web/serve.ts")], {
  cwd: FRAMEWORK_ROOT,
  stdio: "inherit",
  env: { ...process.env, PORT: port },
});
server.on("exit", (code) => process.exit(code ?? 0));
