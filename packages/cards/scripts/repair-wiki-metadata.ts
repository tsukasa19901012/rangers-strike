/**
 * atwiki ソースから SP / ビークルサイズを DSL スタブへ再反映し、カタログを再生成する。
 *
 * Usage: tsx scripts/repair-wiki-metadata.ts
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inferCategoryFromWikiLabels,
  inferRushAdditionalCondition,
  parsePowerCost,
  parseSp,
  SIZE_MAP,
} from "../src/pipeline/metaMaps";
import type { RushAdditionalCondition } from "../src/effectTaxonomy";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");
const repoRoot = join(cardsRoot, "../..");
const atwikiDir = join(repoRoot, "docs/wiki/sources/atwiki");
const dslDir = join(cardsRoot, "src/generated/dsl-stubs");

type WikiMeta = {
  cardId: string;
  categoryRaw?: string;
  sp?: string;
  kind?: string;
  features?: string;
  powerCostRaw?: string;
  addCond?: string;
};

function parseWikiPage(content: string): WikiMeta | null {
  const cardId = content.match(/カードID:\s*(\S+)/)?.[1];
  if (!cardId) return null;
  const categoryRaw = content.match(/カテゴリ[：:]\s*([^\n]+)/)?.[1]?.trim();
  const sp = content.match(/SP[：:]\s*([^\n]+)/)?.[1]?.trim();
  const kind = content.match(/種類[：:]\s*([^\n]+)/)?.[1]?.trim();
  const features = content.match(/特徴[：:]\s*([^\n]+)/)?.[1]?.trim();
  const powerCostRaw = content.match(/必要パワー[：:]\s*([^\n]+)/)?.[1]?.trim();
  const addCond = content.match(/追加条件[：:]\s*([^\n]+)/)?.[1]?.trim();
  return { cardId, categoryRaw, sp, kind, features, powerCostRaw, addCond };
}

function categoriesEqual(
  a: unknown,
  b: ReturnType<typeof inferCategoryFromWikiLabels>,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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

function repairDslStubs(wiki: Map<string, WikiMeta>): {
  categoryFixed: number;
  spFixed: number;
  vehicleSized: number;
  powerCostFixed: number;
  rushCondFixed: number;
} {
  let categoryFixed = 0;
  let spFixed = 0;
  let vehicleSized = 0;
  let powerCostFixed = 0;
  let rushCondFixed = 0;

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const card = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    const cardId = String(card.id ?? "");
    const meta = wiki.get(cardId);
    if (!meta) continue;

    let changed = false;

    if (meta.categoryRaw) {
      const nextCategory = inferCategoryFromWikiLabels(meta.categoryRaw);
      if (!categoriesEqual(card.category, nextCategory)) {
        card.category = nextCategory;
        categoryFixed += 1;
        changed = true;
      }
    }

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

    if (meta.powerCostRaw) {
      const nextPowerCost = parsePowerCost(meta.powerCostRaw);
      if (card.powerCost !== nextPowerCost) {
        card.powerCost = nextPowerCost;
        powerCostFixed += 1;
        changed = true;
      }
    }

    const powerCostStr = String(card.powerCost);
    if (
      meta.addCond &&
      meta.addCond !== "なし" &&
      (powerCostStr.endsWith("+") || powerCostStr.endsWith("-"))
    ) {
      const nextRush = inferRushAdditionalCondition(
        meta.addCond,
        card.powerCost as number | string,
      );
      if (nextRush) {
        const prev = card.rushAdditionalCondition as RushAdditionalCondition | undefined;
        if (!prev) {
          card.rushAdditionalCondition = nextRush;
          rushCondFixed += 1;
          changed = true;
        } else if (powerCostStr.endsWith("-")) {
          const prevJson = JSON.stringify(prev);
          const nextJson = JSON.stringify(nextRush);
          if (prevJson !== nextJson) {
            card.rushAdditionalCondition = nextRush;
            rushCondFixed += 1;
            changed = true;
          }
        }
      } else if (powerCostStr.endsWith("-") && !card.rushAdditionalCondition) {
        card.rushAdditionalCondition = {
          conditionId: "state_gate",
          text: meta.addCond,
        };
        rushCondFixed += 1;
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(path, `${JSON.stringify(card, null, 2)}\n`);
    }
  }

  return { categoryFixed, spFixed, vehicleSized, powerCostFixed, rushCondFixed };
}

const wiki = loadWikiMeta();
const result = repairDslStubs(wiki);
console.log(JSON.stringify({ wikiPages: wiki.size, ...result }, null, 2));

execSync("npm run emit-vanilla-catalog", { cwd: cardsRoot, stdio: "inherit" });
execSync("npm run emit-complexity-catalog", { cwd: cardsRoot, stdio: "inherit" });
execSync("npm run emit-full-playable-catalog", { cwd: cardsRoot, stdio: "inherit" });

console.log("Catalog regeneration complete.");
