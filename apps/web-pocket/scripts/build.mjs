#!/usr/bin/env node
// Builds the static site in dist/ (serve it from any static host):
//
//   dist/index.html, host.js       browser host (canvas, pointer/keyboard, card images)
//   dist/pocket/                   PocketJS WASM core + its JS binding
//   dist/app/main.js, main.pak     the PocketJS guest bundle (Solid UI + client-core)
//   dist/engine.js                 rules engine + every playable card (ESM, loaded by the host)
//   dist/cards/, card-images.json  card images (copied from apps/web/public/cards)
//
//   node scripts/build.mjs             full build
//   node scripts/build.mjs --app-only  rebuild only the guest bundle and host files
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FRAMEWORK_ROOT, bunBinary, ensureToolchain } from "../../vita/scripts/toolchain.mjs";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(APP_ROOT, "../..");
const DIST = join(APP_ROOT, "dist");
const appOnly = process.argv.includes("--app-only");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: APP_ROOT, ...opts });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

ensureToolchain();
mkdirSync(DIST, { recursive: true });

// 1. Engine: the same pre-bundled engine the Vita app embeds, as a separate
//    ESM file the host imports (browsers cache it apart from the UI bundle).
const engineOut = join(DIST, "engine.js");
if (!appOnly || !existsSync(engineOut)) {
  run("npx", ["tsx", join(REPO, "apps/vita/scripts/build-engine.ts"), `--out=${engineOut}`]);
  rmSync(join(DIST, "engine.meta.json"), { force: true });
}

// 2. Glyph coverage: every non-ASCII character the UI can draw (card names and
//    texts, engine log strings, client-core and app UI strings).
const sources = [readFileSync(engineOut, "utf8")];
const walkText = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "generated" && name !== "node_modules") walkText(path);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) sources.push(readFileSync(path, "utf8"));
  }
};
walkText(join(REPO, "packages/client-core/src"));
walkText(join(APP_ROOT, "src"));
const chars = new Set();
for (const text of sources) {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp > 0x7e && !(cp >= 0xd800 && cp <= 0xdfff)) chars.add(ch);
  }
}
for (const ch of "…‹›▲▼◀▶●○×△□") chars.add(ch);
mkdirSync(join(APP_ROOT, "src/generated"), { recursive: true });
writeFileSync(join(APP_ROOT, "src/generated/chars.txt"), [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join(""));
console.log(`glyphs: ${chars.size} non-ASCII characters`);

// 3. Guest bundle. Density 2 bakes the font atlases at 2 samples per logical
//    px, so text stays sharp on high-DPI screens.
const fonts = join(APP_ROOT, ".cache/fonts");
if (!existsSync(join(fonts, "NotoSansJP-Regular.ttf"))) run("node", [join(APP_ROOT, "scripts/fetch-fonts.mjs")]);
run(bunBinary(), [
  join(FRAMEWORK_ROOT, "tools/build.ts"),
  join(APP_ROOT, "src/main.tsx"),
  `--project-root=${APP_ROOT}`,
  `--outdir=${join(DIST, "app")}`,
  "--no-config",
  "--density=2",
  `--font-regular=${join(fonts, "NotoSansJP-Regular.ttf")}`,
  `--font-bold=${join(fonts, "NotoSansJP-Bold.ttf")}`,
]);

// 4. Host: our page + the PocketJS WASM core and its binding.
mkdirSync(join(DIST, "pocket"), { recursive: true });
for (const name of ["index.html", "host.js"]) copyFileSync(join(APP_ROOT, "host", name), join(DIST, name));
for (const name of ["pocketjs.wasm", "wasm-ops.js"]) copyFileSync(join(FRAMEWORK_ROOT, "hosts/web", name), join(DIST, "pocket", name));

// 5. Card images: one JPEG per card id, the same files the Next.js app serves.
const cardsOut = join(DIST, "cards");
if (!appOnly || !existsSync(cardsOut)) {
  const cardsSrc = join(REPO, "apps/web/public/cards");
  rmSync(cardsOut, { recursive: true, force: true });
  cpSync(cardsSrc, cardsOut, { recursive: true });
  const images = {};
  for (const set of readdirSync(cardsOut)) {
    for (const file of readdirSync(join(cardsOut, set))) {
      const m = /^(.+)\.jpg$/.exec(file);
      if (!m) continue;
      const id = m[1] === "back" ? "back" : m[1];
      // The first set wins for ids present twice (legend sets before promoted).
      images[id] ??= `cards/${set}/${file}`;
    }
  }
  writeFileSync(join(DIST, "card-images.json"), JSON.stringify(images));
  console.log(`cards: ${Object.keys(images).length} images`);
}

const size = (p) => (statSync(p).size / 1024 / 1024).toFixed(2);
console.log(`built ${relative(REPO, DIST)}: app/main.js ${size(join(DIST, "app/main.js"))} MiB, app/main.pak ${size(join(DIST, "app/main.pak"))} MiB, engine.js ${size(engineOut)} MiB`);
