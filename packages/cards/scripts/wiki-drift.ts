/**
 * 拡張カタログ vs Wiki スタブの drift 検出（M10）。
 *
 * Usage:
 *   npm run wiki-drift
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extendedCardsCatalog } from "../src/extendedCatalog";
import { parseWikiMarkdown } from "../src/pipeline/parseWiki";
import { DEFAULT_WIKI_DIR } from "../src/pipeline/runPipeline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "pipeline/data/wiki-drift.json");

type DriftRow = {
  id: string;
  field: string;
  expected: string | number;
  actual: string | number;
  severity: "P0" | "P1";
};

function main(): void {
  const rows: DriftRow[] = [];

  for (const card of extendedCardsCatalog.cards) {
    let parsed;
    try {
      parsed = parseWikiMarkdown(card.id, DEFAULT_WIKI_DIR);
    } catch {
      rows.push({
        id: card.id,
        field: "wiki_md",
        expected: "exists",
        actual: "missing",
        severity: "P0",
      });
      continue;
    }

    const wikiPower = parsed.status.必要パワー;
    if (wikiPower && String(card.powerCost) !== wikiPower.replace(/[＋+]/g, "+")) {
      const normalized = wikiPower.replace(/[＋+]/g, "+");
      if (String(card.powerCost) !== normalized && String(card.powerCost) !== wikiPower) {
        rows.push({
          id: card.id,
          field: "powerCost",
          expected: normalized,
          actual: String(card.powerCost),
          severity: "P1",
        });
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    extendedTotal: extendedCardsCatalog.cards.length,
    driftCount: rows.length,
    p0: rows.filter((r) => r.severity === "P0").length,
    p1: rows.filter((r) => r.severity === "P1").length,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
