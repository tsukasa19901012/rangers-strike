/**
 * Wiki 1849枚から、カタログ未登録カードのスタブ定義を生成（M6）。
 *
 * Usage:
 *   npm run generate-wiki-stubs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allCardsCatalog } from "../src/catalog";
import { inferCategoryFromWikiLabels } from "../src/pipeline/metaMaps";
import { parseWikiMarkdown } from "../src/pipeline/parseWiki";
import type { CardDefinition } from "../src/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const wikiDir = join(root, "../../docs/wiki/cards");
const classificationPath = join(root, "pipeline/data/card-classification.json");
const outputPath = join(root, "pipeline/data/wiki-catalog-stubs.json");
const catalogShardPath = join(root, "src/generated/catalog/wiki-stubs/cards.json");
const catalogManifestPath = join(root, "src/generated/catalog/wiki-stubs/manifest.json");

type ClassificationFile = {
  cards: Array<{ id: string; grade: string }>;
};

type WikiCatalogStub = {
  id: string;
  name: string;
  type: CardDefinition["type"];
  category: CardDefinition["category"];
  rarity: CardDefinition["rarity"];
  expansion: string;
  powerCost: number | string;
  grade: string;
  wikiFound: boolean;
};

function inferExpansion(cardId: string): string {
  if (cardId.startsWith("RS-")) return "legend1";
  if (cardId.startsWith("RK-")) return "legend2";
  if (cardId.startsWith("RM-")) return "legend3";
  return "wiki_stub";
}

function inferType(statusKind?: string): CardDefinition["type"] {
  if (!statusKind) return "unit";
  if (statusKind.includes("オペ")) return "operation";
  if (statusKind.includes("ビークル")) return "vehicle";
  if (statusKind.includes("コマンダー")) return "commander";
  return "unit";
}

function main(): void {
  const catalogIds = new Set(allCardsCatalog.cards.map((c) => c.id));
  const classification = JSON.parse(
    readFileSync(classificationPath, "utf8"),
  ) as ClassificationFile;
  const gradeById = new Map(classification.cards.map((c) => [c.id, c.grade]));

  const wikiFiles = readdirSync(wikiDir).filter((f) => f.endsWith(".md"));
  const stubs: WikiCatalogStub[] = [];

  for (const file of wikiFiles) {
    const cardId = file.replace(/\.md$/, "");
    if (catalogIds.has(cardId)) continue;

    let wikiFound = true;
    let name = cardId;
    let type: CardDefinition["type"] = "unit";
    let category: CardDefinition["category"] = "OT";
    let rarity: CardDefinition["rarity"] = "N";
    let powerCost: number | string = 0;

    try {
      const parsed = parseWikiMarkdown(cardId, wikiDir);
      name = parsed.name || cardId;
      type = inferType(parsed.status.種類);
      category = inferCategoryFromWikiLabels(
        parsed.categoryLabel,
        parsed.status.カテゴリ,
      );
      const pc = parsed.status.必要パワー ?? parsed.status.BP;
      if (pc && /^\d+\+?$/.test(pc)) {
        powerCost = pc.includes("+") ? pc : Number(pc);
      }
    } catch {
      wikiFound = false;
    }

    stubs.push({
      id: cardId,
      name,
      type,
      category,
      rarity,
      expansion: inferExpansion(cardId),
      powerCost,
      grade: gradeById.get(cardId) ?? "C",
      wikiFound,
    });
  }

  stubs.sort((a, b) => a.id.localeCompare(b.id));

  const summary = {
    generatedAt: new Date().toISOString(),
    wikiTotal: wikiFiles.length,
    catalogRegistered: catalogIds.size,
    stubCount: stubs.length,
    byGrade: stubs.reduce<Record<string, number>>((acc, stub) => {
      acc[stub.grade] = (acc[stub.grade] ?? 0) + 1;
      return acc;
    }, {}),
  };

  const catalogCards: CardDefinition[] = stubs.map((stub) => ({
    id: stub.id,
    name: stub.name,
    type: stub.type,
    category: stub.category,
    rarity: stub.rarity,
    expansion: stub.expansion,
    powerCost: stub.powerCost,
  }));

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ summary, stubs }, null, 2)}\n`,
  );

  mkdirSync(dirname(catalogShardPath), { recursive: true });
  writeFileSync(
    catalogShardPath,
    `${JSON.stringify({ expansion: "wiki-stubs", cards: catalogCards }, null, 2)}\n`,
  );
  writeFileSync(
    catalogManifestPath,
    `${JSON.stringify(
      {
        generatedAt: summary.generatedAt,
        source: "wiki-catalog-stubs.json",
        stubCount: catalogCards.length,
      },
      null,
      2,
    )}\n`,
  );

  console.log(JSON.stringify(summary, null, 2));
  console.log(`→ ${outputPath}`);
  console.log(`→ ${catalogShardPath}`);
}

main();
