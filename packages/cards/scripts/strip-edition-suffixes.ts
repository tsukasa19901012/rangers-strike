/**
 * カタログ / DSL スタブから収録エディション表記（2nd, XG 系）を名前から除去する。
 *
 * Usage: npx tsx packages/cards/scripts/strip-edition-suffixes.ts
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalCardName, hasEditionSuffix } from "../src/cardName";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");
const repoRoot = join(cardsRoot, "../..");

function stripJsonFile(path: string, getName: (obj: Record<string, unknown>) => string | undefined, setName: (obj: Record<string, unknown>, name: string) => void): number {
  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw) as Record<string, unknown>;
  let changed = 0;

  const visit = (obj: Record<string, unknown>) => {
    const name = getName(obj);
    if (name && hasEditionSuffix(name)) {
      setName(obj, canonicalCardName(name));
      changed += 1;
    }
  };

  if (Array.isArray(data.cards)) {
    for (const card of data.cards) {
      if (card && typeof card === "object") visit(card as Record<string, unknown>);
    }
  } else {
    visit(data);
  }

  if (changed > 0) {
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  }
  return changed;
}

let total = 0;

const catalogPaths = [
  "src/generated/catalog/core-playable/cards.json",
  "src/generated/catalog/vanilla-promoted/cards.json",
  "src/generated/catalog/complexity-promoted/cards.json",
  "src/generated/catalog/full-playable/cards.json",
  "src/generated/catalog/wiki-stubs/cards.json",
  "pipeline/data/wiki-catalog-stubs.json",
];

for (const rel of catalogPaths) {
  const path = join(cardsRoot, rel);
  total += stripJsonFile(
    path,
    (obj) => (typeof obj.name === "string" ? obj.name : undefined),
    (obj, name) => {
      obj.name = name;
    },
  );
  console.log(rel);
}

const dslDir = join(cardsRoot, "src/generated/dsl-stubs");
for (const file of readdirSync(dslDir)) {
  if (!file.endsWith(".dsl.json")) continue;
  total += stripJsonFile(
    join(dslDir, file),
    (obj) => (typeof obj.name === "string" ? obj.name : undefined),
    (obj, name) => {
      obj.name = name;
    },
  );
}
console.log(`dsl-stubs: ${readdirSync(dslDir).filter((f) => f.endsWith(".dsl.json")).length} files`);

const overlayDir = join(cardsRoot, "src/dsl/generated");
for (const file of readdirSync(overlayDir)) {
  if (!file.endsWith(".dsl.json")) continue;
  total += stripJsonFile(
    join(overlayDir, file),
    (obj) => (typeof obj.name === "string" ? obj.name : undefined),
    (obj, name) => {
      obj.name = name;
    },
  );
}

console.log(`Renamed ${total} card name fields.`);

execSync("npm run emit-full-playable-catalog -w @rangers-strike/cards", {
  cwd: repoRoot,
  stdio: "inherit",
});
execSync("node scripts/bundle-dsl-overlays.mjs", { cwd: cardsRoot, stdio: "inherit" });
execSync("npx tsx scripts/repair-fusion-partners.ts", { cwd: cardsRoot, stdio: "inherit" });
