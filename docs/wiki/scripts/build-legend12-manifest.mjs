#!/usr/bin/env node
/**
 * legend12-atwiki-pages.json から fetch manifest を生成。
 * 用法: node build-legend12-manifest.mjs <batchIndex 0-based> [batchSize=20]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT_DIR = path.join(__dirname, "../sources/atwiki");
const PAGES = path.join(packageRoot, "src/legend12-atwiki-pages.json");

const batchIndex = Number(process.argv[2] ?? 0);
const batchSize = Number(process.argv[3] ?? 20);

async function main() {
  const map = JSON.parse(await readFile(PAGES, "utf8"));
  const ids = Object.keys(map).sort(
    (a, b) => Number(a.slice(3)) - Number(b.slice(3)),
  );
  const start = batchIndex * batchSize;
  const slice = ids.slice(start, start + batchSize);
  if (!slice.length) {
    console.error("Empty batch", batchIndex);
    process.exit(1);
  }

  const first = slice[0];
  const last = slice[slice.length - 1];
  const name = `manifest-batch${6 + batchIndex}-l12-${first}-${last}.json`;

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
    pages: slice.map((cardId) => ({
      id: map[cardId].page,
      label: cardId,
      title: map[cardId].name,
      cardId,
    })),
  };

  const outPath = path.join(OUT_DIR, name);
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(outPath, slice.length, "cards");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
