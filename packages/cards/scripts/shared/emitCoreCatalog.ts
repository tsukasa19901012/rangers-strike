import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadCorePlayableCards } from "../../src/catalog/coreCatalogSources";
import type { CardDefinition } from "../../src/schema";
import { enrichFromDsl } from "./emitDslEnrich";

export type EmitCoreCatalogOptions = {
  root: string;
  outputDir?: string;
  manifestName?: string;
};

function loadExistingImageFields(
  outputPath: string,
): Map<string, Pick<CardDefinition, "imageUrl" | "imageSourceUrl">> {
  if (!existsSync(outputPath)) return new Map();
  const file = JSON.parse(readFileSync(outputPath, "utf8")) as { cards: CardDefinition[] };
  return new Map(
    file.cards
      .filter((card) => card.imageUrl)
      .map((card) => [
        card.id,
        { imageUrl: card.imageUrl, imageSourceUrl: card.imageSourceUrl },
      ]),
  );
}

export function emitCoreCatalog(options: EmitCoreCatalogOptions): {
  coreCount: number;
  byExpansion: Record<string, number>;
  outputPath: string;
} {
  const outputDir = options.outputDir ?? "src/generated/catalog/core-playable";
  const manifestName = options.manifestName ?? "manifest.json";
  const outputPath = join(options.root, outputDir, "cards.json");
  const manifestPath = join(options.root, outputDir, manifestName);
  const existingImages = loadExistingImageFields(outputPath);

  const cards = loadCorePlayableCards()
    .map((card) =>
      enrichFromDsl(options.root, {
        ...card,
        ...(existingImages.get(card.id) ?? {}),
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const byExpansion = cards.reduce<Record<string, number>>((acc, card) => {
    acc[card.expansion] = (acc[card.expansion] ?? 0) + 1;
    return acc;
  }, {});

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ expansion: "core-playable", cards }, null, 2)}\n`,
  );
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "generated/catalog/core-playable/cards.json",
        coreCount: cards.length,
        byExpansion,
      },
      null,
      2,
    )}\n`,
  );

  return { coreCount: cards.length, byExpansion, outputPath };
}
