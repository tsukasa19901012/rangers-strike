/**
 * A/B 分類カードの Wiki → DSL バッチコンパイル（M4）。
 *
 * Usage:
 *   npm run pipeline:batch
 *   npm run pipeline:batch -- --prefix RS-
 *   npm run pipeline:batch -- --grades A,B --dry-run
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCardPipeline, DEFAULT_WIKI_DIR } from "../src/pipeline/runPipeline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const classificationPath = join(root, "pipeline/data/card-classification.json");
const outputPath = join(root, "pipeline/data/wiki-index.json");
const reportPath = join(root, "pipeline/data/wiki-batch-report.json");

type ClassificationFile = {
  cards: Array<{ id: string; grade: string }>;
};

type WikiIndexEntry = {
  id: string;
  implClass: "A" | "B";
  classificationGrade: string;
  pipelineGrade: string;
  name: string;
  validationOk: boolean;
  effectCount: number;
  warnings: string[];
  triggers: Array<{ type: string; timing?: string; confidence: string }>;
  needsFallback: boolean;
  wikiFound: boolean;
};

function parseArgs(): {
  grades: Set<string>;
  prefix?: string;
  dryRun: boolean;
  limit?: number;
} {
  const args = process.argv.slice(2);
  const grades = new Set(["A", "B"]);
  let prefix: string | undefined;
  let dryRun = false;
  let limit: number | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === "--dry-run") dryRun = true;
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

  return { grades, prefix, dryRun, limit };
}

function wikiPath(cardId: string): string {
  return join(DEFAULT_WIKI_DIR, `${cardId}.md`);
}

function main(): void {
  const { grades, prefix, dryRun, limit } = parseArgs();
  const classification = JSON.parse(
    readFileSync(classificationPath, "utf8"),
  ) as ClassificationFile;

  let targets = classification.cards.filter((c) => grades.has(c.grade));
  if (prefix) {
    targets = targets.filter((c) => c.id.startsWith(prefix));
  }
  if (limit !== undefined && limit > 0) {
    targets = targets.slice(0, limit);
  }

  const entries: WikiIndexEntry[] = [];
  let validated = 0;
  let wikiMissing = 0;
  let failed = 0;

  console.log(`Batch wiki pipeline: ${targets.length} cards (grades=${[...grades].join(",")})`);

  for (const target of targets) {
    const found = existsSync(wikiPath(target.id));
    if (!found) {
      wikiMissing += 1;
      entries.push({
        id: target.id,
        implClass: target.grade as "A" | "B",
        classificationGrade: target.grade,
        pipelineGrade: "—",
        name: target.id,
        validationOk: false,
        effectCount: 0,
        warnings: ["wiki_md_missing"],
        triggers: [],
        needsFallback: true,
        wikiFound: false,
      });
      continue;
    }

    if (dryRun) {
      entries.push({
        id: target.id,
        implClass: target.grade as "A" | "B",
        classificationGrade: target.grade,
        pipelineGrade: "—",
        name: target.id,
        validationOk: true,
        effectCount: 0,
        warnings: [],
        triggers: [],
        needsFallback: false,
        wikiFound: true,
      });
      continue;
    }

    try {
      const report = runCardPipeline(target.id, { writeFiles: false });
      const needsFallback = report.extractedEffects.some((e) => e.needsFallback);
      if (report.validation.ok) validated += 1;
      else failed += 1;

      entries.push({
        id: target.id,
        implClass: target.grade as "A" | "B",
        classificationGrade: target.grade,
        pipelineGrade: report.analysis.grade,
        name: report.parse.name,
        validationOk: report.validation.ok,
        effectCount: report.extractedEffects.length,
        warnings: report.warnings,
        triggers: report.triggers.map((t) => ({
          type: t.trigger.type,
          timing: t.trigger.type === "operation" ? t.trigger.timing : undefined,
          confidence: t.confidence,
        })),
        needsFallback,
        wikiFound: true,
      });
    } catch (err) {
      failed += 1;
      entries.push({
        id: target.id,
        implClass: target.grade as "A" | "B",
        classificationGrade: target.grade,
        pipelineGrade: "—",
        name: target.id,
        validationOk: false,
        effectCount: 0,
        warnings: [String(err)],
        triggers: [],
        needsFallback: true,
        wikiFound: true,
      });
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    grades: [...grades],
    prefix: prefix ?? null,
    total: entries.length,
    wikiFound: entries.filter((e) => e.wikiFound).length,
    wikiMissing,
    validationOk: validated,
    validationFailed: failed,
    needsFallback: entries.filter((e) => e.needsFallback).length,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ summary, cards: entries }, null, 2)}\n`,
  );
  writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log("\n=== Batch complete ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\n→ ${outputPath}`);
}

main();
