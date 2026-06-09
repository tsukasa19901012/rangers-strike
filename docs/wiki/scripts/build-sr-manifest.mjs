#!/usr/bin/env node
/**
 * sr-atwiki-pages.json から fetch manifest を生成（batch57）
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT_DIR = path.join(__dirname, "../sources/atwiki");
const PAGES = path.join(packageRoot, "src/sr-atwiki-pages.json");
const BATCH_NUM = 57;

async function main() {
  const map = JSON.parse(await readFile(PAGES, "utf8"));
  const ids = Object.keys(map).sort();
  const first = ids[0];
  const last = ids[ids.length - 1];
  const name = `manifest-batch${BATCH_NUM}-sr-${first}-${last}.json`;

  const manifest = {
    accessRules: {
      intervalSeconds: "3-10",
      maxPagesPerRun: 20,
      concurrent: false,
      sameDomainConsecutive: false,
      domainBreak:
        "https://www.grnrngr.com/documents/rangersstrike/rule/index.html",
    },
    batch: name,
    pages: ids.map((cardId) => ({
      id: map[cardId].page,
      label: cardId,
      title: map[cardId].name,
      cardId,
    })),
  };

  const outPath = path.join(OUT_DIR, name);
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(outPath, ids.length, "cards");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
