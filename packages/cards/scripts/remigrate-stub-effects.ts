/**
 * enqueue-only / effect_* delegate を PATTERNS で再マッチ（M19）。
 *
 * Usage:
 *   npm run remigrate-stub-effects
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument, EffectPrimitive } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";
import { rematchExtractedEffect } from "../src/pipeline/extractEffects";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");
const reportPath = join(root, "pipeline/data/stub-effect-remigration.json");

function isRemigratable(primitives: EffectPrimitive[]): boolean {
  if (primitives.length === 0) return false;
  if (primitives.every((p) => p.type === "enqueue_trigger")) return true;
  if (primitives.length !== 1) return false;
  const only = primitives[0];
  if (!only) return false;
  if (only.type === "interpret_effect") return true;
  if (only.type === "grant_keyword" && only.keyword.startsWith("effect_")) return true;
  return false;
}

function remigrateEffect(
  effect: NonNullable<CardDocument["effects"]>[number],
): { changed: boolean; to?: string } {
  if (!isRemigratable(effect.effects)) return { changed: false };

  const wasInterpretOnly =
    effect.effects.length === 1 && effect.effects[0]?.type === "interpret_effect";

  const rematched = rematchExtractedEffect(effect.text ?? "", {
    name: effect.name,
    kind: effect.text?.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
  });

  if (
    rematched &&
    !rematched.effects.every(
      (p) =>
        p.type === "enqueue_trigger" ||
        (p.type === "grant_keyword" && p.keyword.startsWith("effect_")),
    )
  ) {
    effect.id = rematched.id;
    effect.effects = rematched.effects;
    if (rematched.name !== undefined) effect.name = rematched.name;
    if (rematched.trigger !== undefined) effect.trigger = rematched.trigger;
    if (rematched.optional !== undefined) effect.optional = rematched.optional;
    if (rematched.condition !== undefined) effect.condition = rematched.condition;
    return { changed: true, to: rematched.effects.map((p) => p.type).join("+") };
  }

  if (wasInterpretOnly) return { changed: false };

  if (isRemigratable(effect.effects)) {
    effect.effects = [{ type: "interpret_effect" }];
    return { changed: true, to: "interpret_effect" };
  }

  return { changed: false };
}

function main(): void {
  let scanned = 0;
  let migrated = 0;
  let remainingDelegate = 0;
  const samples: Array<{ cardId: string; effectId: string; to: string }> = [];

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    let changed = false;

    for (const effect of doc.effects ?? []) {
      if (!isRemigratable(effect.effects)) continue;
      scanned += 1;
      const result = remigrateEffect(effect);
      if (!result.changed) {
        if (
          effect.effects.every(
            (p) =>
              p.type === "grant_keyword" && p.keyword?.startsWith("effect_"),
          )
        ) {
          remainingDelegate += 1;
        }
        continue;
      }
      migrated += 1;
      changed = true;
      if (samples.length < 25) {
        samples.push({
          cardId: doc.id,
          effectId: effect.id,
          to: result.to ?? "unknown",
        });
      }
    }

    if (!changed) continue;
    doc.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    const validation = validateCardDocument(doc);
    if (!validation.ok) continue;
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scanned,
    migratedToPrimitives: migrated,
    remainingEffectDelegate: remainingDelegate,
    samples,
    note: "M19 remigrate-stub-effects: re-match enqueue + effect_* delegates.",
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ scanned, migrated, remainingDelegate }, null, 2));
  console.log(`→ ${reportPath}`);
}

main();
