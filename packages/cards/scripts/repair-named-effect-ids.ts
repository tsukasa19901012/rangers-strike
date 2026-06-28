/**
 * named_* effect ID を semantic ID へ修復し、extractEffects で primitives を再マッチする。
 *
 * Usage: npx tsx packages/cards/scripts/repair-named-effect-ids.ts
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument, EffectPrimitive } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";
import { effectIdFromName } from "../src/pipeline/effectNameIds";
import { hashEffectText } from "../src/pipeline/metaMaps";
import { rematchExtractedEffect } from "../src/pipeline/extractEffects";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const repoRoot = join(root, "../..");
const dslDir = join(root, "src/generated/dsl-stubs");
const reportPath = join(root, "pipeline/data/named-effect-id-repair.json");

function isNamedHashId(id: string): boolean {
  return id.startsWith("named_");
}

function isSp1OnlyStub(primitives: EffectPrimitive[]): boolean {
  return (
    primitives.length === 1 &&
    primitives[0]?.type === "grant_keyword" &&
    primitives[0]?.keyword === "SP1"
  );
}

function remigrateEffect(
  effect: NonNullable<CardDocument["effects"]>[number],
): { changed: boolean; reason?: string } {
  let changed = false;
  const reasons: string[] = [];

  if (effect.name && isNamedHashId(effect.id)) {
    const semantic = effectIdFromName(effect.name);
    if (semantic && semantic !== effect.id) {
      effect.id = semantic;
      changed = true;
      reasons.push("rename");
    }
  }

  const rematched = rematchExtractedEffect(effect.text ?? "", {
    name: effect.name,
    kind: effect.text?.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
  });

  if (
    rematched &&
    (isSp1OnlyStub(effect.effects) ||
      isNamedHashId(effect.id) ||
      effect.effects.every((p) => p.type === "interpret_effect"))
  ) {
    const improved =
      rematched.id !== effect.id ||
      JSON.stringify(rematched.effects) !== JSON.stringify(effect.effects);
    if (improved && !rematched.id.startsWith("named_")) {
      effect.id = rematched.id;
      effect.effects = rematched.effects;
      if (rematched.name !== undefined) effect.name = rematched.name;
      if (rematched.trigger !== undefined) effect.trigger = rematched.trigger;
      if (rematched.optional !== undefined) effect.optional = rematched.optional;
      if (rematched.condition !== undefined) effect.condition = rematched.condition;
      changed = true;
      reasons.push(`rematch:${rematched.matchedPattern ?? "unknown"}`);
    }
  }

  if (effect.name && isNamedHashId(effect.id)) {
    const semantic = effectIdFromName(effect.name);
    if (semantic) {
      effect.id = semantic;
      changed = true;
      reasons.push("rename_fallback");
    }
  }

  return { changed, reason: reasons.join("+") || undefined };
}

function deduplicateEffectIds(effects: NonNullable<CardDocument["effects"]>): void {
  const used = new Set<string>();
  for (const effect of effects) {
    let id = effect.id;
    if (used.has(id)) {
      id = `${id}_${hashEffectText(effect.text ?? "").slice(0, 8)}`;
    }
    let n = 2;
    while (used.has(id)) {
      id = `${effect.id}_${n}`;
      n += 1;
    }
    effect.id = id;
    used.add(id);
  }
}

function main(): void {
  let scanned = 0;
  let repairedCards = 0;
  let renamedEffects = 0;
  let rematchedEffects = 0;
  let remainingNamed = 0;
  const samples: Array<{ cardId: string; from: string; to: string; reason?: string }> = [];

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    let changed = false;

    for (const effect of doc.effects ?? []) {
      if (!isNamedHashId(effect.id)) continue;
      scanned += 1;
      const beforeId = effect.id;
      const result = remigrateEffect(effect);
      if (!result.changed) continue;
      changed = true;
      if (beforeId !== effect.id) renamedEffects += 1;
      rematchedEffects += 1;
      if (samples.length < 30) {
        samples.push({
          cardId: doc.id,
          from: beforeId,
          to: effect.id,
          reason: result.reason,
        });
      }
    }

    if (!changed) continue;
    deduplicateEffectIds(doc.effects ?? []);
    doc.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    const validation = validateCardDocument(doc);
    if (!validation.ok) {
      console.warn(`skip ${doc.id}: ${validation.errors.join("; ")}`);
      continue;
    }
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
    repairedCards += 1;
  }

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8")) as CardDocument;
    for (const effect of doc.effects ?? []) {
      if (isNamedHashId(effect.id)) remainingNamed += 1;
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scanned,
    repairedCards,
    renamedEffects,
    rematchedEffects,
    remainingNamedIds: remainingNamed,
    samples,
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`→ ${reportPath}`);

  if (repairedCards > 0) {
    execSync("node scripts/bundle-dsl-overlays.mjs", { cwd: root, stdio: "inherit" });
    execSync("npm run emit-full-playable-catalog --workspace=@rangers-strike/cards", {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }
}

main();
