#!/usr/bin/env node
/**
 * Refresh legend3/cards.json from atwiki wikibody (full text + metadata).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractCardMetaFromAtwikiHtml,
  extractEffectTextFromAtwikiHtml,
  fetchAtwikiPage,
} from "./atwikiText.js";
import { buildLegend3Card } from "./legend3CardBuilder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const pagesPath = path.join(packageRoot, "src/legend3/atwiki-pages.json");
const cardsPath = path.join(packageRoot, "src/legend3/cards.json");

async function main() {
  const pageMap = JSON.parse(await readFile(pagesPath, "utf8"));
  const catalog = JSON.parse(await readFile(cardsPath, "utf8"));
  const missing = [];

  const refreshed = [];
  for (const existing of catalog.cards) {
    const entry = pageMap[existing.id];
    if (!entry) {
      missing.push(`${existing.id}:no-page`);
      refreshed.push(existing);
      continue;
    }

    const html = await fetchAtwikiPage(entry.page);
    const meta = extractCardMetaFromAtwikiHtml(html);
    const text = extractEffectTextFromAtwikiHtml(html);
    const card = buildLegend3Card(
      existing.id,
      existing.name,
      existing.type,
      existing.rarity,
      meta,
      text || undefined,
    );
    if (existing.imageUrl) card.imageUrl = existing.imageUrl;
    if (existing.imageSourceUrl) card.imageSourceUrl = existing.imageSourceUrl;
    refreshed.push(card);
    process.stdout.write(`OK ${existing.id}\n`);
    await new Promise((r) => setTimeout(r, 60));
  }

  catalog.cards = refreshed;
  await writeFile(cardsPath, `${JSON.stringify(catalog, null, 2)}\n`);

  if (missing.length > 0) {
    throw new Error(`Missing pages: ${missing.join(", ")}`);
  }
  console.log(`Refreshed ${refreshed.length} legend3 cards.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
