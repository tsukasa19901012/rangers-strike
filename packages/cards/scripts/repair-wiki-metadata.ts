/**
 * atwiki ソースから SP / ビークルサイズを DSL スタブへ再反映し、カタログを再生成する。
 *
 * Usage: tsx scripts/repair-wiki-metadata.ts
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSp, SIZE_MAP } from "../src/pipeline/metaMaps";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");
const repoRoot = join(cardsRoot, "../..");
const atwikiDir = join(repoRoot, "docs/wiki/sources/atwiki");
const dslDir = join(cardsRoot, "src/generated/dsl-stubs");

type WikiMeta = {
  cardId: string;
  sp?: string;
  kind?: string;
  features?: string;
};

function parseWikiPage(content: string): WikiMeta | null {
  const cardId = content.match(/カードID:\s*(\S+)/)?.[1];
  if (!cardId) return null;
  const sp = content.match(/SP[：:]\s*([^\n]+)/)?.[1]?.trim();
  const kind = content.match(/種類[：:]\s*([^\n]+)/)?.[1]?.trim();
  const features = content.match(/特徴[：:]\s*([^\n]+)/)?.[1]?.trim();
  return { cardId, sp, kind, features };
}

function loadWikiMeta(): Map<string, WikiMeta> {
  const map = new Map<string, WikiMeta>();
  for (const file of readdirSync(atwikiDir)) {
    if (!file.endsWith(".md")) continue;
    const parsed = parseWikiPage(readFileSync(join(atwikiDir, file), "utf8"));
    if (parsed) map.set(parsed.cardId, parsed);
  }
  return map;
}

function repairDslStubs(wiki: Map<string, WikiMeta>): { spFixed: number; vehicleSized: number } {
  let spFixed = 0;
  let vehicleSized = 0;

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const card = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const cardId = String(card.id ?? "");
    const meta = wiki.get(cardId);
    if (!meta) continue;

    let changed = false;

    if (meta.sp) {
      const nextSp = parseSp(meta.sp);
      if (nextSp !== null && nextSp !== undefined && card.sp !== nextSp) {
        card.sp = nextSp;
        spFixed += 1;
        changed = true;
      }
    }

    if (card.type === "vehicle" && meta.kind) {
      const size = SIZE_MAP[meta.kind];
      if (size && card.size !== size) {
        card.size = size;
        vehicleSized += 1;
        changed = true;
      }
      if (meta.features && meta.features !== "なし" && !card.features) {
        card.features = meta.features.split(/[／/]/).map((s) => s.trim()).filter(Boolean);
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(path, `${JSON.stringify(card, null, 2)}\n`);
    }
  }

  return { spFixed, vehicleSized };
}

const wiki = loadWikiMeta();
const result = repairDslStubs(wiki);
console.log(JSON.stringify({ wikiPages: wiki.size, ...result }, null, 2));

execSync("node scripts/bundle-dsl-overlays.mjs", { cwd: cardsRoot, stdio: "inherit" });
execSync("npm run emit-vanilla-catalog", { cwd: cardsRoot, stdio: "inherit" });
execSync("npm run emit-complexity-catalog", { cwd: cardsRoot, stdio: "inherit" });
execSync("npm run emit-full-playable-catalog", { cwd: cardsRoot, stdio: "inherit" });

console.log("Catalog regeneration complete.");
