/**
 * legend1–3 プレイ可能カードの Wiki 突合（M9）。
 *
 * Usage:
 *   npm run verify-wiki-effects
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allCardsCatalog } from "../src/catalog";
import { parseWikiMarkdown } from "../src/pipeline/parseWiki";
import { DEFAULT_WIKI_DIR } from "../src/pipeline/runPipeline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "pipeline/data/wiki-verify-report.json");

type DriftEntry = {
  id: string;
  field: string;
  catalog: string | number | undefined;
  wiki: string | number | undefined;
  severity: "P0" | "P1";
};

function main(): void {
  const entries: DriftEntry[] = [];

  for (const card of allCardsCatalog.cards) {
    let parsed;
    try {
      parsed = parseWikiMarkdown(card.id, DEFAULT_WIKI_DIR);
    } catch {
      entries.push({
        id: card.id,
        field: "wiki_md",
        catalog: "present",
        wiki: "missing",
        severity: "P0",
      });
      continue;
    }

    const wikiName = parsed.name?.trim();
    if (wikiName && wikiName !== card.name) {
      entries.push({
        id: card.id,
        field: "name",
        catalog: card.name,
        wiki: wikiName,
        severity: "P1",
      });
    }

    const wikiPower = parsed.status.必要パワー ?? parsed.status.BP;
    const catalogPower = String(card.powerCost);
    if (wikiPower && wikiPower !== catalogPower && wikiPower !== String(card.powerCost)) {
      entries.push({
        id: card.id,
        field: "powerCost",
        catalog: catalogPower,
        wiki: wikiPower,
        severity: "P0",
      });
    }

    if (card.type === "unit" && card.bp !== undefined) {
      const wikiBp = Number(parsed.status.BP);
      if (Number.isFinite(wikiBp) && wikiBp !== card.bp) {
        entries.push({
          id: card.id,
          field: "bp",
          catalog: card.bp,
          wiki: wikiBp,
          severity: "P0",
        });
      }
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    catalogTotal: allCardsCatalog.cards.length,
    driftCount: entries.length,
    p0: entries.filter((e) => e.severity === "P0").length,
    p1: entries.filter((e) => e.severity === "P1").length,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify({ summary, entries }, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
