#!/usr/bin/env node
/**
 * glossary-atwiki-pages.json から fetch manifest を生成（batch63〜）
 * 未取得ページのみ含める（既存 page-{id}-*.md がある場合はスキップ）
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const OUT_DIR = path.join(__dirname, "../sources/atwiki");
const SRC = path.join(__dirname, "../sources/atwiki");
const PAGES = path.join(packageRoot, "src/glossary-atwiki-pages.json");
const BASE_BATCH = 63;

const batchIndex = Number(process.argv[2] ?? 0);
const batchSize = Number(process.argv[3] ?? 20);

async function fetchedPageIds() {
  const ids = new Set();
  for (const f of await readdir(SRC)) {
    const m = f.match(/^page-(\d+)-/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

async function main() {
  const map = JSON.parse(await readFile(PAGES, "utf8"));
  const fetched = await fetchedPageIds();
  const pending = Object.entries(map)
    .filter(([, e]) => !fetched.has(String(e.page)))
    .map(([slug, e]) => ({ slug, ...e }));

  const start = batchIndex * batchSize;
  const slice = pending.slice(start, start + batchSize);
  if (!slice.length) {
    console.error("Empty batch", batchIndex, `(pending ${pending.length})`);
    process.exit(1);
  }

  const first = slice[0].slug;
  const last = slice[slice.length - 1].slug;
  const batchNum = BASE_BATCH + batchIndex;
  const name = `manifest-batch${batchNum}-gl-${first}-${last}.json`;

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
    pages: slice.map(({ slug, page, name }) => ({
      id: page,
      label: slug,
      title: name,
    })),
  };

  const outPath = path.join(OUT_DIR, name);
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(outPath, slice.length, "terms", `(pending total ${pending.length})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
