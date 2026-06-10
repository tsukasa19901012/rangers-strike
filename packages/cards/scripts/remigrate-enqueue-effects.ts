/**
 * enqueue-only DSL 効果を PATTERNS で再マッチし、grant_keyword / primitives へ移行（M17）。
 *
 * Usage:
 *   npm run remigrate-enqueue-effects
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument, EffectPrimitive } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";
import { rematchEffectPrimitives } from "../src/pipeline/extractEffects";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");
const reportPath = join(root, "pipeline/data/enqueue-remigration.json");

function isEnqueueOnly(primitives: EffectPrimitive[]): boolean {
  return (
    primitives.length > 0 &&
    primitives.every((p) => p.type === "enqueue_trigger")
  );
}

function main(): void {
  let scanned = 0;
  let migrated = 0;
  let stillEnqueue = 0;
  let convertedToDelegate = 0;
  const samples: Array<{ cardId: string; effectId: string; from: string; to: string }> = [];

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    let changed = false;

    for (const effect of doc.effects ?? []) {
      if (!isEnqueueOnly(effect.effects)) continue;
      scanned += 1;

      const rematched = rematchEffectPrimitives(effect.text ?? "", {
        name: effect.name,
        kind: effect.name ? "named" : effect.text?.startsWith("※") ? "note" : "body",
        trigger: effect.trigger,
      });

      if (rematched && !rematched.every((p) => p.type === "enqueue_trigger")) {
        effect.effects = rematched;
        migrated += 1;
        changed = true;
        if (samples.length < 20) {
          samples.push({
            cardId: doc.id,
            effectId: effect.id,
            from: "enqueue_trigger",
            to: rematched.map((p) => p.type).join("+"),
          });
        }
        continue;
      }

      const effectId = effect.effects[0]?.type === "enqueue_trigger"
        ? effect.effects[0].effectId
        : effect.id;
      effect.effects = [
        {
          type: "grant_keyword",
          keyword: `effect_${effectId}`,
          duration: "permanent",
        },
      ];
      convertedToDelegate += 1;
      changed = true;
    }

    if (!changed) continue;

    const hasNative = (doc.effects ?? []).some((e) =>
      e.effects.some((p) => p.type !== "enqueue_trigger" && p.type !== "fallback_handler"),
    );
    if (hasNative) {
      doc.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    }

    const validation = validateCardDocument(doc);
    if (!validation.ok) continue;
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  }

  const remainingEnqueue = readdirSync(dslDir).reduce((count, file) => {
    if (!file.endsWith(".dsl.json")) return count;
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8")) as CardDocument;
    for (const effect of doc.effects ?? []) {
      if (isEnqueueOnly(effect.effects)) {
        stillEnqueue += 1;
        return count + 1;
      }
    }
    return count;
  }, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    scannedEnqueueOnly: scanned,
    migratedToPrimitives: migrated,
    convertedToEffectDelegate: convertedToDelegate,
    remainingEnqueueOnly: stillEnqueue,
    samples,
    note: "M17 remigrate-enqueue-effects: PATTERNS first, then effect_* grant_keyword delegate.",
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        migrated,
        convertedToDelegate,
        remainingEnqueueOnly: stillEnqueue,
      },
      null,
      2,
    ),
  );
  console.log(`→ ${reportPath}`);
}

main();
