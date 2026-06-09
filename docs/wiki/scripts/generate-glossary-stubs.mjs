#!/usr/bin/env node
/**
 * glossary-atwiki-pages.json から docs/wiki/glossary/*.md を生成
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../../packages/cards");
const PAGES = path.join(packageRoot, "src/glossary-atwiki-pages.json");
const GLOSSARY = path.join(__dirname, "../glossary");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function stub(slug, { page, name }) {
  const url = `https://w.atwiki.jp/renst/pages/${page}.html`;
  return `# ${name}

用語ID: ${slug}

atwiki: page ${page}

出典:
* ${url}
* https://w.atwiki.jp/renst/pages/57.html

定義:
> （atwiki 未取得）

関連: UNKNOWN

実装仕様: 未確認

confidence: LOW
`;
}

async function main() {
  await mkdir(GLOSSARY, { recursive: true });
  const map = JSON.parse(await readFile(PAGES, "utf8"));
  let created = 0;
  let skipped = 0;
  for (const [slug, meta] of Object.entries(map)) {
    const p = path.join(GLOSSARY, `${slug}.md`);
    if (await exists(p)) {
      skipped += 1;
      continue;
    }
    await writeFile(p, stub(slug, meta));
    created += 1;
  }
  console.log(`created ${created} stubs, skipped ${skipped} existing`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
