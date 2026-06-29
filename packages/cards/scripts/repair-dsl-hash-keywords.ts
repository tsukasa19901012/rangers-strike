/**
 * grant_keyword の catchall スタブを extractEffects で再マッチする。
 *
 * Usage: npx tsx packages/cards/scripts/repair-dsl-hash-keywords.ts
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument, EffectPrimitive } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";
import { rematchExtractedEffect } from "../src/pipeline/extractEffects";
import { isUnresolvedCatchallGrantKeyword } from "../src/pipeline/hashGrantKeywords";
import { buildNoteCardKeyword } from "../src/pipeline/noteCardKeywords";
import { buildEffectCardKeyword } from "../src/pipeline/effectCardKeywords";
import { slugifyEffectId, noteEffectIdFromBody } from "../src/pipeline/metaMaps";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const repoRoot = join(root, "../..");
const dslDir = join(root, "src/generated/dsl-stubs");
const reportPath = join(root, "pipeline/data/dsl-hash-keyword-repair.json");

const STALE_NOTE_KEYWORD = /^(note_slug|while_field_note|note_on_rush)::/;

function isCatchallStub(primitives: EffectPrimitive[]): boolean {
  return primitives.some(
    (p) => p.type === "grant_keyword" && isUnresolvedCatchallGrantKeyword(p.keyword),
  );
}

function needsHashRepair(primitives: EffectPrimitive[]): boolean {
  return (
    isCatchallStub(primitives) ||
    primitives.some((p) => p.type === "grant_keyword" && STALE_NOTE_KEYWORD.test(p.keyword))
  );
}

function effectDuration(
  trigger: NonNullable<CardDocument["effects"]>[number]["trigger"],
): "permanent" | "turn" {
  return trigger?.type === "while_in_field" || trigger?.type === "nc" ? "permanent" : "turn";
}

function isUnnamedEffect(
  effect: NonNullable<CardDocument["effects"]>[number],
): boolean {
  return (
    effect.id?.startsWith("unnamed_") === true ||
    effect.id?.startsWith("note_") === true ||
    (effect.text?.startsWith("※") ?? false) ||
    !effect.name
  );
}

function remigrateEffect(
  cardId: string,
  effect: NonNullable<CardDocument["effects"]>[number],
): { changed: boolean; to?: string } {
  if (!needsHashRepair(effect.effects)) return { changed: false };

  const rematched = rematchExtractedEffect(effect.text ?? "", {
    name: effect.name,
    kind: effect.text?.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
    cardId,
  });

  if (rematched && !isCatchallStub(rematched.effects)) {
    effect.id = rematched.id;
    effect.effects = rematched.effects;
    if (rematched.name !== undefined) effect.name = rematched.name;
    if (rematched.trigger !== undefined) effect.trigger = rematched.trigger;
    if (rematched.optional !== undefined) effect.optional = rematched.optional;
    if (rematched.condition !== undefined) effect.condition = rematched.condition;
    return { changed: true, to: rematched.effects.map((p) => p.type).join("+") };
  }

  if (isUnnamedEffect(effect)) {
    const keyword = buildNoteCardKeyword(cardId, effect.text ?? "", effect.id);
    effect.id = noteEffectIdFromBody(effect.text ?? "").replace(/^note_/, "unnamed_");
    effect.effects = [{ type: "grant_keyword", keyword, duration: "permanent" }];
    return { changed: true, to: "note_card" };
  }

  if (effect.name) {
    const keyword = buildEffectCardKeyword(cardId, effect.id);
    effect.effects = [
      { type: "grant_keyword", keyword, duration: effectDuration(effect.trigger) },
    ];
    return { changed: true, to: "effect_card" };
  }

  return { changed: false };
}

function dedupeEffectIds(doc: CardDocument): void {
  const seen = new Set<string>();
  for (const effect of doc.effects ?? []) {
    let id = effect.id;
    if (!seen.has(id)) {
      seen.add(id);
      continue;
    }
    const base = id.replace(/_[a-f0-9]{6,8}$/, "");
    const textSlug = slugifyEffectId(effect.text ?? "").slice(0, 12) || "alt";
    let suffix = 2;
    let candidate = `${base}_${textSlug}`.slice(0, 48);
    while (seen.has(candidate)) {
      suffix += 1;
      candidate = `${base}_v${suffix}`.slice(0, 48);
    }
    effect.id = candidate;
    seen.add(candidate);
  }
}

function main(): void {
  let scanned = 0;
  let scannedUnnamed = 0;
  let repaired = 0;
  let repairedUnnamed = 0;
  let remaining = 0;
  const samples: Array<{ cardId: string; effectId: string; to: string }> = [];

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    let changed = false;

    for (const effect of doc.effects ?? []) {
      if (!needsHashRepair(effect.effects)) continue;
      scanned += 1;
      if (isUnnamedEffect(effect)) scannedUnnamed += 1;
      const result = remigrateEffect(doc.id, effect);
      if (!result.changed) {
        if (isCatchallStub(effect.effects)) remaining += 1;
        continue;
      }
      repaired += 1;
      if (isUnnamedEffect(effect)) repairedUnnamed += 1;
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
    dedupeEffectIds(doc);
    doc.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    const validation = validateCardDocument(doc);
    if (!validation.ok) continue;
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scanned,
    scannedUnnamed,
    repaired,
    repairedUnnamed,
    remainingCatchallStubs: remaining,
    samples,
    note: "Re-match catchall grant_keyword stubs via extractEffects PATTERNS.",
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ scanned, scannedUnnamed, repaired, repairedUnnamed, remaining }, null, 2));
  console.log(`→ ${reportPath}`);

  if (repaired > 0) {
    execSync("npm run emit-full-playable-catalog --workspace=@rangers-strike/cards", {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }
}

main();
