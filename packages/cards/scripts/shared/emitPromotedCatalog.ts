import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { listCoreCardIds } from "../../src/catalog/unifiedCatalog";
import type { CardDefinition } from "../../src/schema";

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

function enrichFromDsl(root: string, base: CardDefinition): CardDefinition {
  const dslPath = join(root, "src/generated/dsl-stubs", `${base.id}.dsl.json`);
  if (!existsSync(dslPath)) return base;
  const dsl = JSON.parse(readFileSync(dslPath, "utf8")) as CardDefinition;
  return {
    ...base,
    bp: dsl.bp ?? base.bp,
    size: dsl.size ?? base.size,
    sp: dsl.sp ?? base.sp,
    comboNumber: dsl.comboNumber ?? base.comboNumber,
    text: dsl.text ?? base.text,
    features: dsl.features ?? base.features,
  };
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
  const existingImages = loadExistingImageFields(outputPath);

  const promoted = stubsFile.stubs
    .filter((s) => options.grades.has(s.grade) && !playableIds.has(s.id))
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
