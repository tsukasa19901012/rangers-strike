// Pre-bundles packages/engine (+ packages/cards) into one ESM file for the
// PocketJS guest, and prunes the card data down to the cards a starter-deck
// match can reference.
//
//   tsx scripts/build-engine.ts            # every playable card -> src/generated/engine.js
//   tsx scripts/build-engine.ts --starter  # pruned to the starter decks -> .cache/engine-starter.js
//   tsx scripts/build-engine.ts --out=path --no-minify
//
// Pruning is build-only: esbuild's onLoad replaces the large generated JSON
// files (catalog tiers, DSL stub bundle, wiki set labels) with copies that keep
// only the card ids of the starter decks (rules in
// packages/client-core/src/data/split.ts). Engine source is untouched.
// scripts/verify-engine-prune.mjs checks that pruned and full bundles play
// identical seeded CPU-vs-CPU matches.
import { build, type Plugin } from "esbuild";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDeckChunks,
  collectDeckCardIds,
  pruneCardData,
  type DeckLike,
} from "../../../packages/client-core/src/data/split";
import { bakeCardImages } from "./bake-card-images";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(APP_ROOT, "../..");
const CARDS_SRC = join(REPO, "packages/cards/src");

const args = process.argv.slice(2);
// The Vita build carries every playable card. --starter keeps the pruned
// starter-deck bundle (scripts/verify-engine-prune.mjs compares the two).
const full = !args.includes("--starter");
const minify = !args.includes("--no-minify");
const outArg = args.find((a) => a.startsWith("--out="));
const out = outArg
  ? resolve(outArg.slice("--out=".length))
  : join(APP_ROOT, full ? "src/generated/engine.js" : ".cache/engine-starter.js");

// The engine imports @rangers-strike/cards and a few subpaths; resolve them to
// TypeScript sources (same mapping as packages/engine/vitest.config.ts).
const CARD_SUBPATHS: Record<string, string> = {
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

function loadStarterDecks(): DeckLike[] {
  const decks: DeckLike[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (dir.endsWith("/decks") && name.endsWith(".json")) {
        decks.push(JSON.parse(readFileSync(path, "utf8")) as DeckLike);
      }
    }
  };
  walk(CARDS_SRC);
  return decks.sort((a, b) => a.id.localeCompare(b.id));
}

const decks = loadStarterDecks();
const keep = collectDeckCardIds(decks);
/** Card ids the full bundle can play: the full-playable catalog plus the starter decks. */
function playableCardIds(): Set<string> {
  const catalog = JSON.parse(readFileSync(join(CARDS_SRC, "generated/catalog/full-playable/cards.json"), "utf8")) as {
    cards: { id: string }[];
  };
  return new Set([...keep, ...catalog.cards.map((c) => c.id)]);
}
const bundled = full ? playableCardIds() : keep;
const pruneStats: [string, number, number][] = [];

const plugins: Plugin[] = [
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
];
if (!full) {
  plugins.push({
    name: "rangers-strike-prune-card-data",
    setup(b) {
      b.onLoad({ filter: /\.json$/ }, (a) => {
        const rel = relative(CARDS_SRC, a.path).split("\\").join("/");
        const raw = readFileSync(a.path, "utf8");
        const pruned = pruneCardData(rel, JSON.parse(raw), keep);
        if (pruned === null) return undefined;
        const text = JSON.stringify(pruned);
        pruneStats.push([rel, Buffer.byteLength(raw), Buffer.byteLength(text)]);
        return { contents: text, loader: "json" };
      });
    },
  });
}

mkdirSync(dirname(out), { recursive: true });
const started = Date.now();
const result = await build({
  entryPoints: [join(APP_ROOT, "engine/entry.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2020",
  mainFields: ["module", "main"],
  outfile: out,
  minify,
  legalComments: "none",
  charset: "utf8",
  metafile: true,
  logLevel: "warning",
  plugins,
});
const bytes = statSync(out).size;
const nodeInputs = Object.keys(result.metafile.inputs).filter((k) => k.startsWith("node:"));
if (nodeInputs.length) throw new Error(`Node-only imports leaked into the bundle: ${nodeInputs.join(", ")}`);

const meta = {
  full,
  minify,
  bytes,
  starterDecks: decks.length,
  keptCards: full ? null : keep.size,
  prune: pruneStats.map(([file, before, after]) => ({ file, before, after })),
};
writeFileSync(out.replace(/\.js$/, ".meta.json"), JSON.stringify(meta, null, 2) + "\n");
if (full && !outArg) {
  // Chunk manifest for the Vita AssetLoader: one chunk baked into the bundle,
  // plus the per-deck chunk plan a lazy-loading shell would use.
  const manifest = {
    baked: { id: "full-playable", cardIds: [...bundled].sort(), bytes },
    perDeck: buildDeckChunks(decks).map((c) => ({ id: c.id, cards: c.cardIds.length })),
  };
  writeFileSync(
    join(APP_ROOT, "src/generated/manifest.ts"),
    "// AUTO-GENERATED by scripts/build-engine.ts — do not edit.\n" +
      `export const BAKED_CHUNK = ${JSON.stringify(manifest.baked)};\n` +
      `export const PER_DECK_CHUNKS = ${JSON.stringify(manifest.perDeck)};\n`,
  );
}
if (full && !outArg) {
  // Glyph coverage for the baked font atlas: every non-ASCII character the
  // guest can draw — card names/texts and engine log strings (from the pruned
  // bundle) plus UI strings in client-core and the Vita shell. PocketJS reads
  // this through src/fonts.json "characterFiles".
  const sources = [readFileSync(out, "utf8")];
  const walkText = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== "generated" && name !== "node_modules") walkText(path);
      } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) sources.push(readFileSync(path, "utf8"));
    }
  };
  walkText(join(REPO, "packages/client-core/src"));
  walkText(join(APP_ROOT, "src"));
  const chars = new Set<string>();
  for (const text of sources) {
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp > 0x7e && !(cp >= 0xd800 && cp <= 0xdfff)) chars.add(ch);
    }
  }
  chars.add("…");
  const sorted = [...chars].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
  writeFileSync(join(APP_ROOT, "src/generated/chars.txt"), sorted.join(""));
  console.log(`glyphs: ${sorted.length} non-ASCII characters -> src/generated/chars.txt`);
}
if (full && !outArg && !args.includes("--no-images")) await bakeCardImages(APP_ROOT, REPO, bundled);
console.log(
  `engine: ${relative(APP_ROOT, out)} ${(bytes / 1024 / 1024).toFixed(2)} MiB` +
    `${full ? " (full card data)" : ` (pruned to ${keep.size} cards from ${decks.length} starter decks)`}` +
    ` in ${Date.now() - started} ms`,
);
for (const [rel, before, after] of pruneStats) {
  console.log(`  prune ${rel}: ${(before / 1024).toFixed(0)} KiB -> ${(after / 1024).toFixed(0)} KiB`);
}
