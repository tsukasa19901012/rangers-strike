#!/usr/bin/env node
/**
 * atwiki wikibody から core-playable catalog の legend3 カードを更新（全文 + メタデータ）。
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
const cardsPath = path.join(packageRoot, "src/generated/catalog/core-playable/cards.json");

async function main() {
  const pageMap = JSON.parse(await readFile(pagesPath, "utf8"));
  const catalog = JSON.parse(await readFile(cardsPath, "utf8"));
  const missing = [];

  const refreshed = [];
  const legend3Cards = catalog.cards.filter((card) => card.expansion === "legend3");
  for (const existing of legend3Cards) {
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

  const refreshedById = new Map(refreshed.map((card) => [card.id, card]));
  catalog.cards = catalog.cards.map((card) => refreshedById.get(card.id) ?? card);
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
