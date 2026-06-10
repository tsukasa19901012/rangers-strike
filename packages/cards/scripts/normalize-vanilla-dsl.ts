/**
 * vanilla-promoted (A/E/B) の fallback-only DSL を正規化（M11/M12 fallback 移行）。
 * - 効果文「なし」→ effects 削除
 * - stub grade A → stats-only（effects 削除）
 *
 * Usage:
 *   npm run normalize-vanilla-dsl
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument } from "../src/dsl/types";
import { validateCardDocument } from "../src/dsl/validator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");
const stubsPath = join(root, "pipeline/data/wiki-catalog-stubs.json");
const reportPath = join(root, "pipeline/data/vanilla-fallback-migration.json");

const VANILLA_GRADES = new Set(["A", "B", "E"]);

type StubsFile = {
  stubs: Array<{ id: string; grade: string }>;
};

function isFallbackOnly(doc: CardDocument): boolean {
  const effects = doc.effects ?? [];
  return (
    effects.length > 0 &&
    effects.every((e) => e.effects.every((p) => p.type === "fallback_handler"))
  );
}

function hasNativePrimitive(doc: CardDocument): boolean {
  return (doc.effects ?? []).some((e) =>
    e.effects.some((p) => p.type !== "fallback_handler"),
  );
}

function normalize(doc: CardDocument, stubGrade: string): CardDocument {
  const text = (doc.text ?? "").trim();
  const next: CardDocument = { ...doc };

  if (stubGrade === "A" || text === "なし" || text === "なし。") {
    delete next.effects;
    next.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    return next;
  }

  if (isFallbackOnly(next) && !next.unnamedRules?.length) {
    delete next.effects;
    next.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    return next;
  }

  if (hasNativePrimitive(next)) {
    next.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
  }

  return next;
}

function main(): void {
  const stubsFile = JSON.parse(readFileSync(stubsPath, "utf8")) as StubsFile;
  const gradeById = new Map(stubsFile.stubs.map((s) => [s.id, s.grade]));

  let processed = 0;
  let stripped = 0;
  let interpreter = 0;
  let unchanged = 0;

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const id = file.replace(/\.dsl.json$/, "");
    const grade = gradeById.get(id);
    if (!grade || !VANILLA_GRADES.has(grade)) continue;

    const path = join(dslDir, file);
    const before = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    const after = normalize(before, grade);
    const validation = validateCardDocument(after);
    if (!validation.ok) {
      unchanged += 1;
      continue;
    }

    processed += 1;
    const hadEffects = (before.effects?.length ?? 0) > 0;
    const hasEffects = (after.effects?.length ?? 0) > 0;
    if (hadEffects && !hasEffects) stripped += 1;
    else if (after.implementation?.handler === "interpreter") interpreter += 1;
    else unchanged += 1;

    writeFileSync(path, `${JSON.stringify(after, null, 2)}\n`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    processed,
    stripped,
    interpreter,
    unchanged,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`→ ${reportPath}`);
}

main();
