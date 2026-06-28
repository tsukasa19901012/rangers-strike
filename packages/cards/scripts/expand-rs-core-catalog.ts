/**
 * RS-179〜RS-690 を core-playable に昇格し、promoted シャードから除去する。
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
  for (let n = 179; n <= 690; n += 1) {
    const id = `RS-${String(n).padStart(3, "0")}`;
    if (coreIds.has(id)) continue;
    const card = fullById.get(id);
    if (!card) {
      throw new Error(`Missing full-playable entry: ${id}`);
    }
    toPromote.push({ ...card, expansion: card.expansion ?? "legend1" });
  }

  const mergedCore = [...core.cards, ...toPromote].sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true }),
  );

  const filterPromoted = (cards: CardDefinition[]) =>
    cards.filter((c) => !isRsExtended(c.id));

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
  const nextWiki = filterPromoted(wiki.cards);
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
