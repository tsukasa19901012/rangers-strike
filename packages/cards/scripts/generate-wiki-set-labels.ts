/**
 * Wiki 1849枚から cardId → wikiSetLabel（収録先頭トークン）を抽出。
 *
 * Usage:
 *   npm run generate-wiki-set-labels
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractWikiSetLabel } from "../src/pipeline/parseWiki";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const wikiDir = join(root, "../../docs/wiki/cards");
const pipelineOutputPath = join(root, "pipeline/data/wiki-set-labels.json");
const generatedOutputPath = join(root, "src/generated/wiki-set-labels.json");

type WikiSetLabelsFile = {
  generatedAt: string;
  cardCount: number;
  setCount: number;
  labels: Record<string, string>;
  sets: string[];
};

function main(): void {
  const wikiFiles = readdirSync(wikiDir).filter((f) => f.endsWith(".md"));
  const labels: Record<string, string> = {};
  const sets = new Set<string>();
  let missing = 0;

  for (const file of wikiFiles) {
    const cardId = file.replace(/\.md$/, "");
    const content = readFileSync(join(wikiDir, file), "utf8");
    const label = extractWikiSetLabel(content);
    if (!label) {
      missing += 1;
      continue;
    }
    labels[cardId] = label;
    sets.add(label);
  }

  const output: WikiSetLabelsFile = {
    generatedAt: new Date().toISOString(),
    cardCount: Object.keys(labels).length,
    setCount: sets.size,
    labels,
    sets: [...sets].sort((a, b) => a.localeCompare(b, "ja")),
  };

  mkdirSync(dirname(pipelineOutputPath), { recursive: true });
  mkdirSync(dirname(generatedOutputPath), { recursive: true });
  const json = `${JSON.stringify(output, null, 2)}\n`;
  writeFileSync(pipelineOutputPath, json, "utf8");
  writeFileSync(generatedOutputPath, json, "utf8");

  console.log(
    `wiki-set-labels: ${output.cardCount} cards, ${output.setCount} sets` +
      (missing > 0 ? ` (${missing} without 収録)` : ""),
  );
}

main();
