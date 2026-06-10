/**
 * vanilla-promoted 354枚の smoke テスト生成（M11）。
 *
 * Usage:
 *   npm run generate-vanilla-smoke
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFullPlayableRegistry } from "../src/dsl/registry";
import { validateCardDocument } from "../src/dsl/validator";
import { vanillaPromotedCatalog, fullPlayableCatalog } from "../src/extendedCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "src/dsl/generated/vanillaPromoted.smoke.generated.test.ts");
const reportPath = join(root, "pipeline/data/vanilla-promoted-metrics.json");

function main(): void {
  const registry = createFullPlayableRegistry();
  const snap = registry.snapshot();
  let validationFailed = 0;
  const failedIds: string[] = [];

  for (const card of registry.listCards()) {
    if (!vanillaPromotedCatalog.cards.some((c) => c.id === card.id)) continue;
    const result = validateCardDocument(card);
    if (!result.ok) {
      validationFailed += 1;
      failedIds.push(card.id);
    }
  }

  const promotedInRegistry = vanillaPromotedCatalog.cards.filter((c) =>
    registry.getCard(c.id),
  ).length;

  const testContent = `/**
 * Auto-generated vanilla-promoted smoke test (M11)
 * Promoted: ${vanillaPromotedCatalog.cards.length} | Full playable: ${fullPlayableCatalog.cards.length}
 */
import { describe, it, expect } from "vitest";
import { createFullPlayableRegistry } from "../registry";
import { validateCardDocument } from "../validator";
import { fullPlayableCatalog, vanillaPromotedCatalog } from "../../extendedCatalog";

describe("vanilla-promoted catalog", () => {
  const registry = createFullPlayableRegistry();

  it("merges legend and promoted without duplicate ids", () => {
    expect(vanillaPromotedCatalog.cards.length).toBe(${vanillaPromotedCatalog.cards.length});
    expect(fullPlayableCatalog.cards.length).toBe(${fullPlayableCatalog.cards.length});
    const ids = new Set(fullPlayableCatalog.cards.map((c) => c.id));
    expect(ids.size).toBe(fullPlayableCatalog.cards.length);
  });

  it("has promoted dslReady cards", () => {
    expect(fullPlayableCatalog.cards.length).toBe(1849);
    expect(registry.size()).toBeGreaterThanOrEqual(1849);
  });

  it("validates every promoted card document", () => {
    for (const card of vanillaPromotedCatalog.cards) {
      const doc = registry.getCard(card.id);
      expect(doc, card.id).toBeDefined();
      const result = validateCardDocument(doc!);
      expect(result.ok, \`\${card.id}: \${result.issues.map((i) => i.message).join(", ")}\`).toBe(true);
    }
  });

  it("reports handler coverage for promoted subset", () => {
    const snap = registry.snapshot();
    const promotedIds = new Set(vanillaPromotedCatalog.cards.map((c) => c.id));
    const promotedDocs = registry.listCards().filter((c) => promotedIds.has(c.id));
    const interpreter = promotedDocs.filter((c) => c.implementation?.handler === "interpreter").length;
    const typescript = promotedDocs.filter((c) => c.implementation?.handler === "typescript").length;
    const unimplemented = promotedDocs.filter((c) => c.implementation?.handler === "unimplemented").length;
    expect(interpreter + typescript + unimplemented).toBe(promotedDocs.length);
    expect(unimplemented).toBe(0);
    expect(interpreter).toBeGreaterThan(0);
  });
});
`;

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, testContent);

  const metrics = {
    generatedAt: new Date().toISOString(),
    vanillaPromoted: vanillaPromotedCatalog.cards.length,
    fullPlayable: fullPlayableCatalog.cards.length,
    registrySize: registry.size(),
    promotedInRegistry,
    dslReady: snap.dslReady.filter((id) => vanillaPromotedCatalog.cards.some((c) => c.id === id)).length,
    legacyHandler: snap.legacyHandler.filter((id) => vanillaPromotedCatalog.cards.some((c) => c.id === id)).length,
    unimplemented: snap.unimplemented.filter((id) => vanillaPromotedCatalog.cards.some((c) => c.id === id)).length,
    validationFailed,
    failedIds,
  };

  writeFileSync(reportPath, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(JSON.stringify(metrics, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
