/**
 * dsl-stubs 内の RC カードで nc トリガーになっている効果を riding_combo に揃える。
 *
 * Usage:
 *   npm run sync-rc-dsl-triggers
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dslDir = join(__dirname, "../src/generated/dsl-stubs");

function syncRcTriggers(doc: CardDocument): number {
  if (doc.comboNumber !== "RC" || !doc.effects?.length) return 0;
  let changed = 0;
  for (const effect of doc.effects) {
    const trigger = effect.trigger;
    if (
      trigger.type === "nc" ||
      trigger.type === "nc_or_combo_from"
    ) {
      effect.trigger = { type: "riding_combo" };
      changed += 1;
    }
  }
  return changed;
}

function main(): void {
  let files = 0;
  let updated = 0;
  let effectsPatched = 0;

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    const patched = syncRcTriggers(doc);
    if (patched === 0) continue;

    const validation = validateCardDocument(doc);
    if (!validation.ok) {
      console.error(`Validation failed after RC sync: ${doc.id}`, validation.errors);
      process.exit(1);
    }

    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    files += 1;
    effectsPatched += patched;
    updated += 1;
  }

  console.log(
    JSON.stringify(
      { rcStubFilesPatched: updated, effectsPatched },
      null,
      2,
    ),
  );
}

main();
