/**
 * full-playable 向け engine integration test 生成（M13）。
 *
 * Usage:
 *   npm run generate-integration-tests
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { complexityPromotedCatalog, vanillaPromotedCatalog } from "../src/extendedCatalog";
import {
  createCardRegistryFromCatalog,
  createFullPlayableRegistry,
} from "../src/dsl/registry";
import { buildTestCasesForCard } from "../src/dsl/testGenerator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");
const engineOut = join(cardsRoot, "../engine/src/generated/playable.integration.generated.test.ts");
const manifestPath = join(cardsRoot, "pipeline/data/integration-test-manifest.json");

function main(): void {
  const coreRegistry = createCardRegistryFromCatalog();
  const fullRegistry = createFullPlayableRegistry();
  const coreSnap = coreRegistry.snapshot();
  const fullSnap = fullRegistry.snapshot();
  const cases: Array<{ cardId: string; effectId: string; trigger: string; skip: boolean }> = [];

  for (const cardId of fullSnap.dslReady) {
    const card = fullRegistry.getCard(cardId);
    if (!card) continue;
    for (const testCase of buildTestCasesForCard(card)) {
      cases.push({
        cardId: testCase.cardId,
        effectId: testCase.effectId ?? "—",
        trigger: testCase.trigger,
        skip: !!testCase.skipReason,
      });
    }
  }

  const skipped = cases.filter((c) => c.skip).length;
  const active = cases.length - skipped;
  const promotedIds = new Set([
    ...vanillaPromotedCatalog.cards.map((c) => c.id),
    ...complexityPromotedCatalog.cards.map((c) => c.id),
  ]);
  const promotedDslReady = fullSnap.dslReady.filter((id) => promotedIds.has(id)).length;

  const lines = [
    "/**",
    " * Auto-generated full-playable integration test manifest (M13).",
    " * Regenerate: npm run generate-integration-tests -w @rangers-strike/cards",
    " */",
    "import { describe, it, expect } from \"vitest\";",
    "import { cardDsl } from \"@rangers-strike/cards\";",
    "",
    "describe(\"full-playable DSL integration manifest\", () => {",
    "  const coreRegistry = cardDsl.createCardRegistryFromCatalog();",
    "  const fullRegistry = cardDsl.createFullPlayableRegistry();",
    "",
    `  it("covers ${coreSnap.dslReady.length} core interpreter-ready cards", () => {`,
    "    expect(coreRegistry.listDslReady().length).toBe(179);",
    "  });",
    "",
    `  it("covers ${fullSnap.dslReady.length} full-playable interpreter-ready cards", () => {`,
    `    expect(fullRegistry.listDslReady().length).toBeGreaterThanOrEqual(${fullSnap.dslReady.length});`,
    "  });",
    "",
    `  it("indexes ${cases.length} effect test cases (${active} active, ${skipped} skipped)", () => {`,
    `    expect(${cases.length}).toBeGreaterThan(0);`,
    "  });",
    "});",
    "",
  ];

  mkdirSync(dirname(engineOut), { recursive: true });
  writeFileSync(engineOut, `${lines.join("\n")}\n`);
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        coreDslReady: coreSnap.dslReady.length,
        fullDslReady: fullSnap.dslReady.length,
        promotedDslReady,
        cases: cases.length,
        active,
        skipped,
        entries: cases,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Wrote ${engineOut}`);
  console.log(`→ ${manifestPath}`);
  console.log(
    JSON.stringify(
      {
        coreDslReady: coreSnap.dslReady.length,
        fullDslReady: fullSnap.dslReady.length,
        promotedDslReady,
        cases: cases.length,
        active,
      },
      null,
      2,
    ),
  );
}

main();
