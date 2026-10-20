import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { listCoreCardIds } from "../../src/catalog/unifiedCatalog";
import { PLAYABLE_EXCLUDED_CARD_TYPES } from "../../src/catalog/tiers";
import type { CardDefinition } from "../../src/schema";
import { enrichFromDsl } from "./emitDslEnrich";

type StubsFile = {
  stubs: Array<{
    id: string;
    name: string;
    type: CardDefinition["type"];
    category: CardDefinition["category"];
    rarity: CardDefinition["rarity"];
    expansion: string;
    powerCost: number | string;
    grade: string;
  }>;
};

export type EmitPromotedOptions = {
  root: string;
  grades: Set<string>;
  expansionLabel: string;
  outputDir: string;
  manifestName: string;
};

type ImageFields = Pick<CardDefinition, "imageUrl" | "imageSourceUrl">;

function loadImageFieldsFrom(path: string, into: Map<string, ImageFields>): void {
  if (!existsSync(path)) return;
  const file = JSON.parse(readFileSync(path, "utf8")) as { cards: CardDefinition[] };
  for (const card of file.cards) {
    if (!card.imageUrl || into.has(card.id)) continue;
    into.set(card.id, { imageUrl: card.imageUrl, imageSourceUrl: card.imageSourceUrl });
  }
}

/**
 * 既存の画像フィールド。自 tier の出力を優先し、グレード変更で tier を移るカード
 * （例: E7 で効果文が補われ A→C になったカード）の画像も落とさないよう他の promoted tier も参照する。
 */
function loadExistingImageFields(root: string, outputPath: string): Map<string, ImageFields> {
  const images = new Map<string, ImageFields>();
  loadImageFieldsFrom(outputPath, images);
  for (const tier of ["vanilla-promoted", "complexity-promoted", "full-playable"]) {
    loadImageFieldsFrom(join(root, "src/generated/catalog", tier, "cards.json"), images);
  }
  return images;
}

export function emitPromotedCatalog(options: EmitPromotedOptions): {
  promotedCount: number;
  byGrade: Record<string, number>;
  outputPath: string;
} {
  const stubsPath = join(options.root, "pipeline/data/wiki-catalog-stubs.json");
  const outputPath = join(options.root, options.outputDir, "cards.json");
  const manifestPath = join(options.root, options.outputDir, options.manifestName);

  const playableIds = listCoreCardIds();
  const stubsFile = JSON.parse(readFileSync(stubsPath, "utf8")) as StubsFile;
  const existingImages = loadExistingImageFields(options.root, outputPath);

  const excludedTypes = new Set<string>(PLAYABLE_EXCLUDED_CARD_TYPES);
  const promoted = stubsFile.stubs
    .filter(
      (s) =>
        options.grades.has(s.grade) &&
        !playableIds.has(s.id) &&
        !excludedTypes.has(s.type),
    )
    .map((stub) =>
      enrichFromDsl(options.root, {
        id: stub.id,
        name: stub.name,
        type: stub.type,
        category: stub.category,
        rarity: stub.rarity,
        expansion: stub.expansion === "wiki_stub" ? options.expansionLabel : stub.expansion,
        powerCost: stub.powerCost,
        ...(existingImages.get(stub.id) ?? {}),
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  const byGrade = promoted.reduce<Record<string, number>>((acc, card) => {
    const stub = stubsFile.stubs.find((s) => s.id === card.id);
    const grade = stub?.grade ?? "?";
    acc[grade] = (acc[grade] ?? 0) + 1;
    return acc;
  }, {});

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ expansion: options.expansionLabel, cards: promoted }, null, 2)}\n`,
  );
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "wiki-catalog-stubs.json",
        grades: [...options.grades],
        promotedCount: promoted.length,
        byGrade,
      },
      null,
      2,
    )}\n`,
  );

  return { promotedCount: promoted.length, byGrade, outputPath };
}
