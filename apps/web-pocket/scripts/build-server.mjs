#!/usr/bin/env node
// Bundles the rules engine for api/match.js (対人戦 server) into server/match-engine.mjs.
// It runs in Vercel's install step (vercel.json installCommand), so the file is there before any
// function is traced, whatever order Vercel builds the site and the functions in. Not committed.
//
//   node scripts/build-server.mjs
//
// ENGINE_VERSION is a hash of the bundle: a match saved by another engine is replayed from its moves
// when it is loaded (engine match.ts deserializeMatch), so only engine changes trigger a replay.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(APP_ROOT, "../..");
const CARDS_SRC = join(REPO, "packages/cards/src");
const CARD_SUBPATHS = {
  "": "index.ts",
  "/dsl": "dsl/index.ts",
  "/dsl/types": "dsl/types.ts",
  "/dsl/loader": "dsl/loader.ts",
  "/dsl/registry": "dsl/registry.ts",
  "/pipeline": "pipeline/index.ts",
  "/pipeline/extractEffects": "pipeline/extractEffects.ts",
  "/pipeline/hashGrantKeywords": "pipeline/hashGrantKeywords.ts",
  "/pipeline/implementedGrantKeywords": "pipeline/implementedGrantKeywords.ts",
  "/pipeline/rkClassify": "pipeline/rkClassify.ts",
};

const result = await build({
  entryPoints: [join(APP_ROOT, "server/entry.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  minify: true,
  legalComments: "none",
  charset: "utf8",
  write: false,
  logLevel: "warning",
  plugins: [
    {
      name: "rangers-strike-cards-alias",
      setup(b) {
        b.onResolve({ filter: /^@rangers-strike\/cards(\/.*)?$/ }, (a) => {
          const sub = a.path.slice("@rangers-strike/cards".length);
          const file = CARD_SUBPATHS[sub];
          if (!file) throw new Error(`unmapped @rangers-strike/cards subpath: ${sub}`);
          return { path: join(CARDS_SRC, file) };
        });
      },
    },
  ],
});
const code = result.outputFiles[0].text;
const version = createHash("sha256").update(code).digest("hex").slice(0, 16);
const out = join(APP_ROOT, "server/match-engine.mjs");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${code}\nexport const ENGINE_VERSION = ${JSON.stringify(version)};\n`);
console.log(`server/match-engine.mjs ${(Buffer.byteLength(code) / 1024).toFixed(0)} KB, engine ${version}`);
