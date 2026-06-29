/**
 * RS 常駐/即時オペの DSL 効果文を wikiReference から補完する。
 *
 * Usage: npx tsx packages/cards/scripts/enrich-rs-operation-dsl.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { CardDocument } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";
import { WIKI_OPERATION_TEXT } from "../src/wikiReference";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");

function main(): void {
  let updated = 0;
  for (const file of readdirSync(dslDir)) {
    if (!file.startsWith("RS-") || !file.endsWith(".dsl.json")) continue;
    const cardId = file.replace(".dsl.json", "");
    const wikiText = WIKI_OPERATION_TEXT[cardId];
    if (!wikiText) continue;

    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    if (doc.type !== "operation") continue;

    let changed = false;
    for (const effect of doc.effects ?? []) {
      if ((effect.text ?? "").trim().length > 0) continue;
      effect.text = wikiText;
      changed = true;
    }
    if (!changed) continue;

    if (!(doc.text ?? "").trim()) {
      doc.text = wikiText;
      doc.rawText = wikiText;
    }

    const validation = validateCardDocument(doc);
    if (!validation.ok) {
      console.warn(`skip ${cardId}:`, validation.issues.map((i) => i.message).join("; "));
      continue;
    }

    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    updated += 1;
  }
  console.log(JSON.stringify({ updated }, null, 2));
}

main();
