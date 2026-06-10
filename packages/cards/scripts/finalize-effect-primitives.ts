/**
 * G2/G3: effect_* delegate / enqueue-only → interpret_effect へ一括移行。
 *
 * Usage:
 *   npm run finalize-effect-primitives
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument, EffectPrimitive } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDirs = [
  join(root, "src/generated/dsl-stubs"),
  join(root, "src/dsl/generated"),
];
const reportPath = join(root, "pipeline/data/finalize-effect-primitives.json");

function shouldFinalize(primitives: EffectPrimitive[]): boolean {
  if (primitives.length !== 1) return false;
  const only = primitives[0];
  if (!only) return false;
  if (only.type === "enqueue_trigger") return true;
  if (only.type === "grant_keyword" && only.keyword.startsWith("effect_")) return true;
  return false;
}

function finalizePrimitives(primitives: EffectPrimitive[]): EffectPrimitive[] {
  if (!shouldFinalize(primitives)) return primitives;
  return [{ type: "interpret_effect" }];
}

function main(): void {
  let scanned = 0;
  let finalized = 0;
  let fromDelegate = 0;
  let fromEnqueue = 0;

  for (const dslDir of dslDirs) {
  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    let changed = false;

    for (const effect of doc.effects ?? []) {
      if (!shouldFinalize(effect.effects)) continue;
      scanned += 1;
      const wasDelegate =
        effect.effects[0]?.type === "grant_keyword" &&
        effect.effects[0].keyword.startsWith("effect_");
      const wasEnqueue = effect.effects[0]?.type === "enqueue_trigger";
      effect.effects = finalizePrimitives(effect.effects);
      finalized += 1;
      changed = true;
      if (wasDelegate) fromDelegate += 1;
      if (wasEnqueue) fromEnqueue += 1;
    }

    if (!changed) continue;
    if (doc.implementation?.handler === "unimplemented") {
      doc.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    }
    const validation = validateCardDocument(doc);
    if (!validation.ok) continue;
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scanned,
    finalized,
    fromDelegate,
    fromEnqueue,
    note: "G2/G3 finalize-effect-primitives: stub delegates → interpret_effect",
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ scanned, finalized, fromDelegate, fromEnqueue }, null, 2));
  console.log(`→ ${reportPath}`);
}

main();
