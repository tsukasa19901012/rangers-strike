/**
 * G1: unimplemented → interpreter（バニラ + 本文のみスタブ）。
 *
 * Usage:
 *   npm run promote-dsl-ready
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument, EffectDefinition } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";
import { rematchExtractedEffect } from "../src/pipeline/extractEffects";
import { sanitizeEffectId } from "../src/pipeline/metaMaps";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");
const reportPath = join(root, "pipeline/data/promote-dsl-ready.json");

function isEmptyText(text: string | undefined): boolean {
  const t = (text ?? "").trim();
  return t.length === 0 || t === "なし" || t === "なし。";
}

function promoteCard(doc: CardDocument): { changed: boolean; mode?: string } {
  if (doc.implementation?.handler !== "unimplemented") return { changed: false };

  const text = (doc.text ?? "").trim();

  if (isEmptyText(text) && !(doc.effects?.length ?? 0)) {
    delete doc.effects;
    doc.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    return { changed: true, mode: "vanilla" };
  }

  if ((doc.effects?.length ?? 0) > 0) {
    doc.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    return { changed: true, mode: "has_effects" };
  }

  const rematched = rematchExtractedEffect(text, {
    kind: text.startsWith("※") ? "note" : "body",
    trigger: { type: "nc" },
  });

  let effect: EffectDefinition;
  if (
    rematched &&
    !rematched.effects.every(
      (p) =>
        p.type === "grant_keyword" &&
        "keyword" in p &&
        p.keyword.startsWith("effect_"),
    )
  ) {
    effect = {
      id: rematched.id,
      name: rematched.name,
      text,
      trigger: rematched.trigger,
      optional: rematched.optional,
      condition: rematched.condition,
      effects: rematched.effects,
    };
  } else {
    effect = {
      id: sanitizeEffectId("body_interpret"),
      text,
      trigger: { type: "nc" },
      effects: [{ type: "interpret_effect" }],
    };
  }

  doc.effects = [effect];
  doc.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
  return { changed: true, mode: rematched ? "rematched" : "interpret_effect" };
}

function main(): void {
  let scanned = 0;
  let promoted = 0;
  const byMode: Record<string, number> = {};

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    if (doc.implementation?.handler !== "unimplemented") continue;
    scanned += 1;

    const result = promoteCard(doc);
    if (!result.changed) continue;

    const validation = validateCardDocument(doc);
    if (!validation.ok) continue;

    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    promoted += 1;
    byMode[result.mode ?? "unknown"] = (byMode[result.mode ?? "unknown"] ?? 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scanned,
    promoted,
    byMode,
    note: "G1 promote-dsl-ready: unimplemented → interpreter",
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ scanned, promoted, byMode }, null, 2));
  console.log(`→ ${reportPath}`);
}

main();
