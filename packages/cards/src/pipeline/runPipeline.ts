import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCardDocument } from "../dsl/validator";
import { applyCardOverride } from "../dsl/overrides/loadCardOverrides";
import { generatePipelineTestFile } from "./generatePipelineTest";
import { analyzeCard } from "./analyzeCard";
import { extractEffects } from "./extractEffects";
import { extractTriggers } from "./extractTriggers";
import { generateCardDocument } from "./generateDsl";
import { parseWikiMarkdown } from "./parseWiki";
import type { PipelineOutputPaths, PipelineReport } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_WIKI_DIR = join(__dirname, "../../../../docs/wiki/cards");
export const DEFAULT_OUTPUT_DIR = join(__dirname, "../../pipeline/examples");

export type RunPipelineOptions = {
  wikiDir?: string;
  outputDir?: string;
  writeFiles?: boolean;
};

export function runCardPipeline(
  cardId: string,
  options: RunPipelineOptions = {},
): PipelineReport {
  const warnings: string[] = [];
  const completedSteps: PipelineReport["completedSteps"] = [];

  const parse = parseWikiMarkdown(cardId, options.wikiDir ?? DEFAULT_WIKI_DIR);
  completedSteps.push("parse");

  const analysis = analyzeCard(parse);
  warnings.push(...analysis.warnings);
  completedSteps.push("analyze");

  const triggers = extractTriggers(parse, analysis);
  completedSteps.push("extract_triggers");

  const extractedEffects = extractEffects(parse, analysis, triggers);
  if (extractedEffects.some((e) => e.needsFallback)) {
    warnings.push("one or more segments require fallback_handler / TS implementation");
  }
  completedSteps.push("extract_effects");

  const card = applyCardOverride(generateCardDocument(parse, analysis, extractedEffects));
  completedSteps.push("generate_dsl");

  const validation = validateCardDocument(card);
  completedSteps.push("validate");

  const testFile = generatePipelineTestFile(card);
  completedSteps.push("generate_tests");

  const report: PipelineReport = {
    cardId,
    completedSteps,
    parse,
    analysis,
    triggers,
    extractedEffects,
    card,
    validation,
    testFile,
    warnings,
  };

  if (options.writeFiles !== false) {
    writePipelineOutput(report, options.outputDir ?? DEFAULT_OUTPUT_DIR);
  }

  return report;
}

export function writePipelineOutput(
  report: PipelineReport,
  outputDir: string = DEFAULT_OUTPUT_DIR,
): PipelineOutputPaths {
  const cardDir = join(outputDir, report.cardId);
  mkdirSync(cardDir, { recursive: true });

  const paths: PipelineOutputPaths = {
    cardJson: join(cardDir, "card.json"),
    testFile: join(cardDir, "card.generated.test.ts"),
    reportJson: join(cardDir, "pipeline-report.json"),
  };

  writeFileSync(paths.cardJson, `${JSON.stringify(report.card, null, 2)}\n`);
  writeFileSync(paths.testFile, report.testFile);

  const summary = {
    cardId: report.cardId,
    completedSteps: report.completedSteps,
    grade: report.analysis.grade,
    validation: report.validation,
    warnings: report.warnings,
    triggers: report.triggers.map((t) => ({
      index: t.segmentIndex,
      type: t.trigger.type,
      confidence: t.confidence,
      reason: t.reason,
    })),
    effects: report.extractedEffects.map((e) => ({
      id: e.id,
      pattern: e.matchedPattern,
      needsFallback: e.needsFallback,
    })),
  };
  writeFileSync(paths.reportJson, `${JSON.stringify(summary, null, 2)}\n`);

  return paths;
}

export function runCardPipelineBatch(
  cardIds: string[],
  options: RunPipelineOptions = {},
): PipelineReport[] {
  return cardIds.map((id) => runCardPipeline(id, options));
}

export const EXAMPLE_CARD_IDS = ["RS-020", "RS-054", "RS-059"] as const;
