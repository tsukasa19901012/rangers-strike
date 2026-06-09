#!/usr/bin/env node
/**
 * 未取得のプロモカードだけ manifest を生成（batch106〜）
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT_DIR = path.join(__dirname, "../sources/atwiki");
const PAGES = path.join(packageRoot, "src/promo-atwiki-pages.json");
const BASE_BATCH = 106;
const BATCH_SIZE = 20;

async function main() {
  const map = JSON.parse(await readFile(PAGES, "utf8"));
  const srcFiles = await readdir(OUT_DIR);

  const pending = Object.keys(map).filter((cardId) => {
    const page = map[cardId].page;
    const prefix = `page-${page}-${cardId}`;
    return !srcFiles.some((f) => f.startsWith(prefix));
  });

  if (!pending.length) {
    console.log("No pending promo cards");
    return;
  }

  console.log(`Pending ${pending.length} cards`);
  const batches = Math.ceil(pending.length / BATCH_SIZE);
  for (let i = 0; i < batches; i++) {
    const slice = pending.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const first = slice[0];
    const last = slice[slice.length - 1];
    const batchNum = BASE_BATCH + i;
    const name = `manifest-batch${batchNum}-pr-${first}-${last}.json`;
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
    console.log(outPath, slice.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
