/**
 * U2 — コア 179 枚のマージ済み CardDocument を dsl-stubs へ同期。
 *
 * Usage:
 *   npm run emit-core-dsl-stubs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listCoreCardIds } from "../src/catalog/unifiedCatalog";
import { loadCards } from "../src/dsl/loader";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const stubsDir = join(root, "src/generated/dsl-stubs");
const manifestPath = join(stubsDir, "core-stubs-manifest.json");

function main(): void {
  const coreIds = listCoreCardIds();
  const documents = loadCards("core").filter((doc) => coreIds.has(doc.id));

  if (documents.length !== coreIds.size) {
    throw new Error(
      `Expected ${coreIds.size} core DSL stubs, loader returned ${documents.length}`,
    );
  }

  mkdirSync(stubsDir, { recursive: true });
  let written = 0;

  for (const doc of documents) {
    const path = join(stubsDir, `${doc.id}.dsl.json`);
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    written += 1;
  }

  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "loadCards(core)",
        coreCount: written,
        cardIds: documents.map((doc) => doc.id).sort(),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Wrote ${written} core DSL stubs → ${stubsDir}`);
}

main();
