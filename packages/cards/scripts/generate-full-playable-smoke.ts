/**
 * full-playable 1849枚の smoke テスト生成（M12）。
 *
 * Usage:
 *   npm run generate-full-playable-smoke
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  complexityPromotedCatalog,
  fullPlayableCatalog,
  vanillaPromotedCatalog,
} from "../src/extendedCatalog";
import {
  createFullPlayableRegistry,
  snapshotFullPlayableRegistryMetrics,
} from "../src/dsl/registry";
import { validateCardDocument } from "../src/dsl/validator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "src/dsl/generated/fullPlayable.smoke.generated.test.ts");
const reportPath = join(root, "pipeline/data/full-playable-metrics.json");

function main(): void {
  const registry = createFullPlayableRegistry();
  const metrics = snapshotFullPlayableRegistryMetrics(registry);
  let validationFailed = 0;
  const failedIds: string[] = [];

  const promotedIds = new Set([
    ...vanillaPromotedCatalog.cards.map((c) => c.id),
    ...complexityPromotedCatalog.cards.map((c) => c.id),
  ]);

  for (const card of registry.listCards()) {
    if (!promotedIds.has(card.id)) continue;
    const result = validateCardDocument(card);
    if (!result.ok) {
      validationFailed += 1;
      failedIds.push(card.id);
    }
  }

  const testContent = `/**
 * Auto-generated full-playable smoke test (M12)
 * Full playable: ${fullPlayableCatalog.cards.length}
 */
import { describe, it, expect } from "vitest";
import { createFullPlayableRegistry } from "../registry";
import { validateCardDocument } from "../validator";
import {
  complexityPromotedCatalog,
  fullPlayableCatalog,
  vanillaPromotedCatalog,
} from "../../extendedCatalog";

describe("full-playable catalog", () => {
  const registry = createFullPlayableRegistry();

  it("merges all tiers without duplicate ids", () => {
    expect(fullPlayableCatalog.cards.length).toBe(${fullPlayableCatalog.cards.length});
    expect(vanillaPromotedCatalog.cards.length).toBe(${vanillaPromotedCatalog.cards.length});
    expect(complexityPromotedCatalog.cards.length).toBe(${complexityPromotedCatalog.cards.length});
    const ids = new Set(fullPlayableCatalog.cards.map((c) => c.id));
    expect(ids.size).toBe(fullPlayableCatalog.cards.length);
  });

  it("registers all full-playable cards", () => {
    expect(registry.size()).toBe(${fullPlayableCatalog.cards.length});
  });

  it("validates every stub-promoted card document", () => {
    const promotedIds = new Set([
      ...vanillaPromotedCatalog.cards.map((c) => c.id),
      ...complexityPromotedCatalog.cards.map((c) => c.id),
    ]);
    for (const card of registry.listCards()) {
      if (!promotedIds.has(card.id)) continue;
      const result = validateCardDocument(card);
      expect(result.ok, \`\${card.id}: \${result.issues.map((i) => i.message).join(", ")}\`).toBe(true);
    }
  });
});
`;

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, testContent);

  const report = {
    generatedAt: new Date().toISOString(),
    fullPlayable: fullPlayableCatalog.cards.length,
    vanillaPromoted: vanillaPromotedCatalog.cards.length,
    complexityPromoted: complexityPromotedCatalog.cards.length,
    registry: metrics,
    validationFailed,
    failedIds,
  };

  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
