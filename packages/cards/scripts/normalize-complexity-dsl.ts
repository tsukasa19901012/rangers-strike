/**
 * complexity-promoted (C/D) DSL の implementation 正規化（M13）。
 *
 * Usage:
 *   npm run normalize-complexity-dsl
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
const reportPath = join(root, "pipeline/data/complexity-fallback-migration.json");

const COMPLEXITY_GRADES = new Set(["C", "D"]);

type StubsFile = {
  stubs: Array<{ id: string; grade: string }>;
};

function hasNativePrimitive(doc: CardDocument): boolean {
  return (doc.effects ?? []).some((e) =>
    e.effects.some((p) => p.type !== "fallback_handler"),
  );
}

function isFallbackOnly(doc: CardDocument): boolean {
  const effects = doc.effects ?? [];
  return (
    effects.length > 0 &&
    effects.every((e) => e.effects.every((p) => p.type === "fallback_handler"))
  );
}

function normalize(doc: CardDocument): CardDocument {
  const next: CardDocument = { ...doc };
  const effectCount = next.effects?.length ?? 0;

  if (effectCount === 0) {
    next.implementation = { source: "dsl", handler: "unimplemented", testGenerated: true };
    return next;
  }

  if (hasNativePrimitive(next)) {
    next.implementation = { source: "dsl", handler: "interpreter", testGenerated: true };
    return next;
  }

  if (isFallbackOnly(next)) {
    next.implementation = { source: "hybrid", handler: "typescript", testGenerated: true };
  }

  return next;
}

function main(): void {
  const stubsFile = JSON.parse(readFileSync(stubsPath, "utf8")) as StubsFile;
  const gradeById = new Map(stubsFile.stubs.map((s) => [s.id, s.grade]));

  let processed = 0;
  let interpreter = 0;
  let typescript = 0;
  let unimplemented = 0;

  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const id = file.replace(/\.dsl.json$/, "");
    const grade = gradeById.get(id);
    if (!grade || !COMPLEXITY_GRADES.has(grade)) continue;

    const path = join(dslDir, file);
    const before = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
    const after = normalize(before);
    const validation = validateCardDocument(after);
    if (!validation.ok) continue;

    processed += 1;
    const handler = after.implementation?.handler;
    if (handler === "interpreter") interpreter += 1;
    else if (handler === "typescript") typescript += 1;
    else if (handler === "unimplemented") unimplemented += 1;

    writeFileSync(path, `${JSON.stringify(after, null, 2)}\n`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    processed,
    interpreter,
    typescript,
    unimplemented,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`→ ${reportPath}`);
}

main();
