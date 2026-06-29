/**
 * RS-179〜RS-690、SR-*、BK-*、RK-* を core-playable に昇格し、promoted シャードから除去する。
 *
 * Usage:
 *   npx tsx packages/cards/scripts/expand-rs-core-catalog.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardCatalog, CardDefinition } from "../src/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readCatalog(relativePath: string): CardCatalog {
  const path = join(root, relativePath);
  return JSON.parse(readFileSync(path, "utf8")) as CardCatalog;
}

function writeCatalog(relativePath: string, catalog: CardCatalog): void {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
}

function isRsExtended(id: string): boolean {
  if (!id.startsWith("RS-")) return false;
  const num = Number.parseInt(id.slice(3), 10);
  return num >= 179 && num <= 690;
}

function isSrCard(id: string): boolean {
  return id.startsWith("SR-");
}

function isBkCard(id: string): boolean {
  return id.startsWith("BK-");
}

function isRkCard(id: string): boolean {
  return id.startsWith("RK-");
}

function shouldRemoveFromPromoted(id: string): boolean {
  return isRsExtended(id) || isSrCard(id) || isBkCard(id) || isRkCard(id);
}

const LEGEND_EXPANSIONS = new Set(["legend1", "legend2", "legend3"]);

function normalizeCoreExpansion(card: CardDefinition): CardDefinition {
  if (LEGEND_EXPANSIONS.has(card.expansion)) return card;
  if (card.id === "SR-001") return { ...card, expansion: "legend3" };
  return { ...card, expansion: "legend1" };
}

function listCorePromotionIds(full: CardCatalog, coreIds: Set<string>): string[] {
  const ids = new Set<string>();
  for (let n = 179; n <= 690; n += 1) {
    ids.add(`RS-${String(n).padStart(3, "0")}`);
  }
  for (const card of full.cards) {
    if (isSrCard(card.id) || isBkCard(card.id) || isRkCard(card.id)) {
      ids.add(card.id);
    }
  }
  return [...ids].filter((id) => !coreIds.has(id)).sort();
}

function main(): void {
  const corePath = "src/generated/catalog/core-playable/cards.json";
  const vanillaPath = "src/generated/catalog/vanilla-promoted/cards.json";
  const complexityPath = "src/generated/catalog/complexity-promoted/cards.json";
  const fullPath = "src/generated/catalog/full-playable/cards.json";

  const core = readCatalog(corePath);
  const vanilla = readCatalog(vanillaPath);
  const complexity = readCatalog(complexityPath);
  const full = readCatalog(fullPath);

  const coreIds = new Set(core.cards.map((c) => c.id));
  const fullById = new Map(full.cards.map((c) => [c.id, c]));

  const toPromote: CardDefinition[] = [];
  for (const id of listCorePromotionIds(full, coreIds)) {
    const card = fullById.get(id);
    if (!card) {
      throw new Error(`Missing full-playable entry: ${id}`);
    }
    toPromote.push(normalizeCoreExpansion({ ...card, expansion: card.expansion ?? "legend1" }));
  }

  const mergedCore = [...core.cards, ...toPromote]
    .map(normalizeCoreExpansion)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const filterPromoted = (cards: CardDefinition[]) =>
    cards.filter((c) => !shouldRemoveFromPromoted(c.id));

  const nextVanilla = filterPromoted(vanilla.cards);
  const nextComplexity = filterPromoted(complexity.cards);

  writeCatalog(corePath, { expansion: "core-playable", cards: mergedCore });
  writeCatalog(vanillaPath, { expansion: vanilla.expansion, cards: nextVanilla });
  writeCatalog(complexityPath, {
    expansion: complexity.expansion,
    cards: nextComplexity,
  });

  const wikiPath = "src/generated/catalog/wiki-stubs/cards.json";
  const wiki = readCatalog(wikiPath);
  const nextWiki = wiki.cards.filter((c) => !shouldRemoveFromPromoted(c.id));
  writeCatalog(wikiPath, { expansion: wiki.expansion, cards: nextWiki });

  writeFileSync(
    join(root, "src/generated/catalog/core-playable/manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "expand-rs-core-catalog.ts",
        coreCount: mergedCore.length,
        rsPromoted: toPromote.length,
        byExpansion: mergedCore.reduce<Record<string, number>>((acc, card) => {
          acc[card.expansion] = (acc[card.expansion] ?? 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    JSON.stringify(
      {
        coreBefore: core.cards.length,
        coreAfter: mergedCore.length,
        promoted: toPromote.length,
        vanillaBefore: vanilla.cards.length,
        vanillaAfter: nextVanilla.length,
        complexityBefore: complexity.cards.length,
        complexityAfter: nextComplexity.length,
        wikiBefore: wiki.cards.length,
        wikiAfter: nextWiki.length,
      },
      null,
      2,
    ),
  );
}

main();
