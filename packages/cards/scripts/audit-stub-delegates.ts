/**
 * スタブ DSL の enqueue_trigger 委譲監査（M15）。
 *
 * Usage:
 *   npm run audit:stub-delegates
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument } from "../src/dsl/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");
const outputPath = join(root, "pipeline/data/stub-delegate-audit.json");

function main(): void {
  let total = 0;
  let enqueueTrigger = 0;
  let fallbackHandler = 0;
  let grantKeyword = 0;
  let nativeOther = 0;
  let cardsWithEnqueue = 0;
  let cardsFallbackOnly = 0;

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    total += 1;
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8")) as CardDocument;
    let cardEnqueue = 0;
    let cardFallback = 0;

    for (const effect of doc.effects ?? []) {
      for (const p of effect.effects) {
        if (p.type === "enqueue_trigger") {
          enqueueTrigger += 1;
          cardEnqueue += 1;
        } else if (p.type === "fallback_handler") {
          fallbackHandler += 1;
          cardFallback += 1;
        } else if (p.type === "grant_keyword") {
          grantKeyword += 1;
        } else {
          nativeOther += 1;
        }
      }
    }

    if (cardEnqueue > 0) cardsWithEnqueue += 1;
    if (cardFallback > 0 && cardEnqueue === 0 && nativeOther === 0) cardsFallbackOnly += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dslFiles: total,
    primitives: {
      enqueueTrigger,
      fallbackHandler,
      grantKeyword,
      nativeOther,
    },
    cardsWithEnqueue,
    cardsFallbackOnly,
  };

  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`→ ${outputPath}`);
}

main();
