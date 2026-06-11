/**
 * DSL スタブの 合体― 行から zord unnamedRules.partnerCardIds を補完する。
 *
 * Usage: npx tsx packages/cards/scripts/repair-fusion-partners.ts
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseZordFusionLine } from "../src/pipeline/fusionPartners";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");
const repoRoot = join(cardsRoot, "../..");
const dslDir = join(cardsRoot, "src/generated/dsl-stubs");

let repaired = 0;
let skipped = 0;

for (const file of readdirSync(dslDir)) {
  if (!file.endsWith(".dsl.json")) continue;
  const path = join(dslDir, file);
  const card = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const text = String(card.text ?? card.rawText ?? "");
  const fusion = parseZordFusionLine(text);
  if (!fusion) {
    skipped += 1;
    continue;
  }

  const rules = Array.isArray(card.unnamedRules)
    ? ([...(card.unnamedRules as object[])] as Array<Record<string, unknown>>)
    : [];
  const zordIndex = rules.findIndex((rule) => rule.kind === "zord");
  const existing = zordIndex >= 0 ? rules[zordIndex]! : null;
  const existingIds = Array.isArray(existing?.partnerCardIds)
    ? (existing.partnerCardIds as string[])
    : [];

  if (
    existingIds.length === fusion.partnerCardIds.length &&
    existingIds.every((id, i) => id === fusion.partnerCardIds[i])
  ) {
    skipped += 1;
    continue;
  }

  const zordRule = {
    kind: "zord",
    text: fusion.text,
    partnerCardIds: fusion.partnerCardIds,
  };

  if (zordIndex >= 0) {
    rules[zordIndex] = zordRule;
  } else {
    rules.unshift(zordRule);
  }

  card.unnamedRules = rules;
  writeFileSync(path, `${JSON.stringify(card, null, 2)}\n`);
  repaired += 1;
}

console.log(`repair-fusion-partners: repaired=${repaired} skipped=${skipped}`);

execSync("npm run emit:catalog --workspace=@rangers-strike/cards", {
  cwd: repoRoot,
  stdio: "inherit",
});
