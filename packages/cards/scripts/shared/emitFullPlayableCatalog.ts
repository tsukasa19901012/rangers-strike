import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { CardCatalog, CardDefinition } from "../../src/schema";
import { FULL_PLAYABLE_CARD_COUNT, PLAYABLE_EXCLUDED_CARD_TYPES } from "../../src/catalog/tiers";
import type { CatalogTier } from "../../src/catalog/tiers";

type TierSource = {
  tier: CatalogTier;
  path: string;
};

const TIER_SOURCES: TierSource[] = [
  { tier: "core", path: "src/generated/catalog/core-playable/cards.json" },
  { tier: "vanilla-promoted", path: "src/generated/catalog/vanilla-promoted/cards.json" },
  { tier: "complexity-promoted", path: "src/generated/catalog/complexity-promoted/cards.json" },
];

export type EmitFullPlayableCatalogOptions = {
  root: string;
  outputDir?: string;
};

function readCatalog(root: string, relativePath: string): CardCatalog {
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    throw new Error(`Missing catalog shard: ${relativePath}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as CardCatalog;
}

export function emitFullPlayableCatalog(options: EmitFullPlayableCatalogOptions): {
  total: number;
  byTier: Record<string, number>;
  outputPath: string;
  indexPath: string;
} {
  const outputDir = options.outputDir ?? "src/generated/catalog/full-playable";
  const outputPath = join(options.root, outputDir, "cards.json");
  const indexPath = join(options.root, outputDir, "index.json");
  const manifestPath = join(options.root, outputDir, "manifest.json");

  const merged: CardDefinition[] = [];
  const byTier: Record<string, number> = {};
  const index: Record<string, { tier: CatalogTier }> = {};
  const seen = new Set<string>();
  const excludedTypes = new Set<string>(PLAYABLE_EXCLUDED_CARD_TYPES);

  for (const source of TIER_SOURCES) {
    const catalog = readCatalog(options.root, source.path);
    let tierCount = 0;

    for (const card of catalog.cards) {
      if (excludedTypes.has(card.type)) continue;
      if (seen.has(card.id)) {
        throw new Error(`Duplicate card id across tiers: ${card.id}`);
      }
      seen.add(card.id);
      merged.push(card);
      index[card.id] = { tier: source.tier };
      tierCount += 1;
    }
    byTier[source.tier] = tierCount;
  }

  merged.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  if (merged.length !== FULL_PLAYABLE_CARD_COUNT) {
    throw new Error(
      `full-playable expected ${FULL_PLAYABLE_CARD_COUNT} cards, got ${merged.length}`,
    );
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ expansion: "full-playable", cards: merged }, null, 2)}\n`,
  );
  writeFileSync(indexPath, `${JSON.stringify({ byId: index }, null, 2)}\n`);
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: TIER_SOURCES.map((s) => s.path),
        total: merged.length,
        byTier,
      },
      null,
      2,
    )}\n`,
  );

  return { total: merged.length, byTier, outputPath, indexPath };
}
