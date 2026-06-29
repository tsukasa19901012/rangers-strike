/**
 * コア収録（allCardsCatalog）かつ Wiki ありのカードをパイプラインで dsl-stubs に同期。
 * batch-compile-stubs はコア収録を除外するため、全角 CN 等の修正後に必要。
 *
 * Usage:
 *   npm run sync-core-wiki-stubs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allCardsCatalog } from "../src/catalog";
import { validateCardDocument } from "../src/dsl/validator";
import { DEFAULT_WIKI_DIR, runCardPipeline } from "../src/pipeline/runPipeline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const stubsDir = join(root, "src/generated/dsl-stubs");

function main(): void {
  const coreIds = allCardsCatalog.cards.map((c) => c.id);
  let written = 0;
  let skipped = 0;

  for (const id of coreIds) {
    const wikiPath = join(DEFAULT_WIKI_DIR, `${id}.md`);
    const stubPath = join(stubsDir, `${id}.dsl.json`);
    if (!existsSync(wikiPath) || !existsSync(stubPath)) {
      skipped += 1;
      continue;
    }

    const before = JSON.parse(readFileSync(stubPath, "utf8"));
    const report = runCardPipeline(id, { writeFiles: false });
    const validation = validateCardDocument(report.card);
    if (!validation.ok) {
      console.error(`Validation failed for ${id}:`, validation.errors);
      process.exit(1);
    }

    if (JSON.stringify(before) === JSON.stringify(report.card)) continue;

    writeFileSync(stubPath, `${JSON.stringify(report.card, null, 2)}\n`);
    written += 1;
  }

  console.log(
    JSON.stringify({ coreIds: coreIds.length, skipped, stubsUpdated: written }, null, 2),
  );
}

main();
