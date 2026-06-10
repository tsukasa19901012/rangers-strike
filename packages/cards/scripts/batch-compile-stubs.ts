/**
 * Wiki スタブのバッチ DSL コンパイル（M7/M8）。
 *
 * Usage:
 *   npm run pipeline:compile-stubs
 *   npm run pipeline:compile-stubs -- --grades A,B,C,D,E
 *   npm run pipeline:compile-stubs-extended   # C,D,E のみ追加
 *   npm run pipeline:compile-stubs -- --prefix BK- --limit 10
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allCardsCatalog } from "../src/catalog";
import { runCardPipeline, DEFAULT_WIKI_DIR } from "../src/pipeline/runPipeline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const stubsPath = join(root, "pipeline/data/wiki-catalog-stubs.json");
const outputDir = join(root, "src/generated/dsl-stubs");
const reportPath = join(root, "pipeline/data/stub-compile-report.json");

type StubsFile = {
  stubs: Array<{ id: string; grade: string; wikiFound: boolean }>;
};

type CompileEntry = {
  id: string;
  grade: string;
  validationOk: boolean;
  effectCount: number;
  handler?: string;
  warnings: string[];
  wikiFound: boolean;
};

function parseArgs(): {
  grades: Set<string>;
  prefix?: string;
  dryRun: boolean;
  limit?: number;
  mergeReport: boolean;
} {
  const args = process.argv.slice(2);
  const grades = new Set(["A", "B"]);
  let prefix: string | undefined;
  let dryRun = false;
  let limit: number | undefined;
  let mergeReport = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--merge-report") mergeReport = true;
    else if (arg === "--grades" && args[i + 1]) {
      grades.clear();
      for (const g of args[i + 1]!.split(",")) grades.add(g.trim());
      i += 1;
    } else if (arg === "--prefix" && args[i + 1]) {
      prefix = args[i + 1];
      i += 1;
    } else if (arg === "--limit" && args[i + 1]) {
      limit = Number(args[i + 1]);
      i += 1;
    }
  }

  return { grades, prefix, dryRun, limit, mergeReport };
}

function wikiPath(cardId: string): string {
  return join(DEFAULT_WIKI_DIR, `${cardId}.md`);
}

function countDslStubFiles(): number {
  if (!existsSync(outputDir)) return 0;
  return readdirSync(outputDir).filter((f) => f.endsWith(".dsl.json")).length;
}

function loadPreviousEntries(): CompileEntry[] {
  if (!existsSync(reportPath)) return [];
  try {
    const prev = JSON.parse(readFileSync(reportPath, "utf8")) as { cards: CompileEntry[] };
    return prev.cards ?? [];
  } catch {
    return [];
  }
}

function main(): void {
  const { grades, prefix, dryRun, limit, mergeReport } = parseArgs();
  const playableIds = new Set(allCardsCatalog.cards.map((c) => c.id));
  const stubsFile = JSON.parse(readFileSync(stubsPath, "utf8")) as StubsFile;

  let targets = stubsFile.stubs.filter(
    (s) => grades.has(s.grade) && !playableIds.has(s.id),
  );
  if (prefix) {
    targets = targets.filter((s) => s.id.startsWith(prefix));
  }
  if (limit !== undefined && limit > 0) {
    targets = targets.slice(0, limit);
  }

  const previousById = new Map(
    mergeReport ? loadPreviousEntries().map((e) => [e.id, e]) : [],
  );
  const entries: CompileEntry[] = mergeReport ? [...previousById.values()] : [];
  let compiled = 0;
  let validationOk = 0;
  let wikiMissing = 0;

  console.log(
    `Batch stub compile: ${targets.length} cards (grades=${[...grades].join(",")})`,
  );

  if (!dryRun) {
    mkdirSync(outputDir, { recursive: true });
  }

  for (const target of targets) {
    const found = existsSync(wikiPath(target.id));
    if (!found) {
      wikiMissing += 1;
      const entry: CompileEntry = {
        id: target.id,
        grade: target.grade,
        validationOk: false,
        effectCount: 0,
        warnings: ["wiki_md_missing"],
        wikiFound: false,
      };
      previousById.set(target.id, entry);
      continue;
    }

    if (dryRun) {
      previousById.set(target.id, {
        id: target.id,
        grade: target.grade,
        validationOk: true,
        effectCount: 0,
        warnings: [],
        wikiFound: true,
      });
      continue;
    }

    try {
      const report = runCardPipeline(target.id, { writeFiles: false });
      const outPath = join(outputDir, `${target.id}.dsl.json`);
      writeFileSync(outPath, `${JSON.stringify(report.card, null, 2)}\n`);
      compiled += 1;
      if (report.validation.ok) validationOk += 1;

      previousById.set(target.id, {
        id: target.id,
        grade: target.grade,
        validationOk: report.validation.ok,
        effectCount: report.card.effects?.length ?? 0,
        handler: report.card.implementation?.handler,
        warnings: report.warnings,
        wikiFound: true,
      });
    } catch (err) {
      previousById.set(target.id, {
        id: target.id,
        grade: target.grade,
        validationOk: false,
        effectCount: 0,
        warnings: [String(err)],
        wikiFound: true,
      });
    }
  }

  const allEntries = [...previousById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const batchValidationOk = allEntries.filter((e) => e.validationOk).length;

  const summary = {
    generatedAt: new Date().toISOString(),
    grades: [...grades],
    prefix: prefix ?? null,
    batchTargets: targets.length,
    batchCompiled: compiled,
    batchValidationOk: validationOk,
    totalEntries: allEntries.length,
    totalDslFiles: dryRun ? countDslStubFiles() : countDslStubFiles(),
    validationOk: batchValidationOk,
    validationFailed: allEntries.filter((e) => e.wikiFound && !e.validationOk).length,
    wikiMissing: allEntries.filter((e) => !e.wikiFound).length,
    dryRun,
  };

  if (!dryRun) {
    writeFileSync(
      join(outputDir, "manifest.json"),
      `${JSON.stringify({ ...summary, outputDir: "src/generated/dsl-stubs" }, null, 2)}\n`,
    );
  }

  writeFileSync(reportPath, `${JSON.stringify({ summary, cards: allEntries }, null, 2)}\n`);

  console.log("\n=== Stub compile complete ===");
  console.log(JSON.stringify(summary, null, 2));
  if (!dryRun) console.log(`\n→ ${outputDir}`);
}

main();
