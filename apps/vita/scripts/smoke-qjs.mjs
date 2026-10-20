#!/usr/bin/env node
// Bundles smoke/qjs-main.ts (client-core + pruned engine) into one script and
// runs it under the QuickJS CLI (`qjs`, override with QJS=path) with -d to
// dump QuickJS memory usage at exit. Writes the output to .cache/smoke-qjs.log.
//
//   node scripts/smoke-qjs.mjs [matches=3]
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP_ROOT } from "./toolchain.mjs";

const matches = process.argv[2] ?? "3";
const out = join(APP_ROOT, ".cache/smoke-qjs.js");
mkdirSync(join(APP_ROOT, ".cache"), { recursive: true });
await build({
  entryPoints: [join(APP_ROOT, "smoke/qjs-main.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2020",
  outfile: out,
  logLevel: "warning",
});
const qjs = process.env.QJS ?? "qjs";
const started = Date.now();
const result = spawnSync(qjs, ["-d", "--module", out, matches], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (result.error) {
  console.error(`could not run ${qjs}: ${result.error.message} (install QuickJS or set QJS=path)`);
  process.exit(1);
}
const text = `${result.stdout}${result.stderr}`;
writeFileSync(join(APP_ROOT, ".cache/smoke-qjs.log"), text);
process.stdout.write(text);
console.log(`[smoke] qjs exit=${result.status} wall=${Date.now() - started}ms`);
process.exit(result.status ?? 1);
