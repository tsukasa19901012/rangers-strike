/**
 * grant_keyword のハッシュスタブ（opponent_must_* 等）を extractEffects で再マッチする。
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
import { isHashGrantKeywordStub } from "../src/pipeline/hashGrantKeywords";
import { slugifyEffectId } from "../src/pipeline/metaMaps";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const repoRoot = join(root, "../..");
const dslDir = join(root, "src/generated/dsl-stubs");
const reportPath = join(root, "pipeline/data/dsl-hash-keyword-repair.json");

function isHashKeywordStub(primitives: EffectPrimitive[]): boolean {
  return primitives.some(
    (p) => p.type === "grant_keyword" && isHashGrantKeywordStub(p.keyword),
  );
}

function remigrateEffect(
  effect: NonNullable<CardDocument["effects"]>[number],
): { changed: boolean; to?: string } {
  if (!isHashKeywordStub(effect.effects)) return { changed: false };

  const rematched = rematchExtractedEffect(effect.text ?? "", {
    name: effect.name,
    kind: effect.text?.startsWith("※") ? "note" : effect.name ? "named" : "body",
    trigger: effect.trigger,
  });

  if (
    rematched &&
    !rematched.effects.some(
      (p) => p.type === "grant_keyword" && isHashGrantKeywordStub(p.keyword),
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
  let repaired = 0;
  let remaining = 0;
  const samples: Array<{ cardId: string; effectId: string; to: string }> = [];

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const path = join(dslDir, file);
    const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    let changed = false;

    for (const effect of doc.effects ?? []) {
      if (!isHashKeywordStub(effect.effects)) continue;
      scanned += 1;
      const result = remigrateEffect(effect);
      if (!result.changed) {
        remaining += 1;
        continue;
      }
      repaired += 1;
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
    repaired,
    remainingHashStubs: remaining,
    samples,
    note: "Re-match grant_keyword hash stubs via extractEffects PATTERNS.",
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ scanned, repaired, remaining }, null, 2));
  console.log(`→ ${reportPath}`);

  if (repaired > 0) {
    execSync("npm run emit-full-playable-catalog --workspace=@rangers-strike/cards", {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }
}

main();
