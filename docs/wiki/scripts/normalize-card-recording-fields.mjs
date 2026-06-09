#!/usr/bin/env node
/**
 * カード md の収録項目を「収録:」に統一（弾 / セット → 収録）
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS = path.join(__dirname, "../cards");

async function main() {
  let updated = 0;
  for (const file of (await readdir(CARDS)).filter((f) => f.endsWith(".md"))) {
    let md = await readFile(path.join(CARDS, file), "utf8");
    const before = md;
    if (/^弾:/m.test(md)) {
      md = md.replace(/^弾:\s*(.+)$/m, "収録: $1");
    } else if (/^セット:/m.test(md)) {
      md = md.replace(/^セット:\s*(.+)$/m, "収録: $1");
    }
    if (md !== before) {
      await writeFile(path.join(CARDS, file), md);
      updated += 1;
    }
  }
  console.log(`normalized ${updated} card md files to 収録:`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
