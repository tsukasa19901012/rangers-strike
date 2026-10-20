#!/usr/bin/env node
// Fetches Noto Sans JP regular + bold (SIL OFL 1.1) from npm
// (@expo-google-fonts/noto-sans-jp) into .cache/fonts/. The PocketJS font
// baker keeps only the glyphs the build collects, so the TTFs are build
// inputs, not shipped files.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = "@expo-google-fonts/noto-sans-jp@0.4.4";
const outDir = join(APP_ROOT, ".cache/fonts");
const want = [
  ["package/400Regular/NotoSansJP_400Regular.ttf", "NotoSansJP-Regular.ttf"],
  ["package/700Bold/NotoSansJP_700Bold.ttf", "NotoSansJP-Bold.ttf"],
  ["package/LICENSE_FONT", "LICENSE-NotoSansJP.txt"],
];

if (want.every(([, name]) => existsSync(join(outDir, name)))) {
  console.log(`fonts: already present in ${outDir}`);
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "rs-web-font-"));
try {
  execFileSync("npm", ["pack", PACKAGE, "--pack-destination", work, "--silent"], { stdio: "inherit" });
  const tgz = readdirSync(work).find((f) => f.endsWith(".tgz"));
  if (!tgz) throw new Error("npm pack produced no tarball");
  execFileSync("tar", ["xzf", join(work, tgz), "-C", work, ...want.map(([src]) => src)]);
  for (const [src, name] of want) copyFileSync(join(work, src), join(outDir, name));
  console.log(`fonts: ${PACKAGE} -> ${outDir}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
