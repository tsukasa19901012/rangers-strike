import {
  EXAMPLE_CARD_IDS,
  runCardPipeline,
  runCardPipelineBatch,
} from "../src/pipeline/runPipeline";

const args = process.argv.slice(2);

function printReportSummary(report: ReturnType<typeof runCardPipeline>): void {
  const v = report.validation.ok ? "OK" : "FAIL";
  console.log(
    `${report.cardId}  grade=${report.analysis.grade}  validate=${v}  effects=${report.extractedEffects.length}  warnings=${report.warnings.length}`,
  );
  if (!report.validation.ok) {
    for (const issue of report.validation.issues) {
      console.log(`  [${issue.code}] ${issue.path}: ${issue.message}`);
    }
  }
  for (const w of report.warnings) {
    console.log(`  warn: ${w}`);
  }
}

if (args.includes("--examples")) {
  const reports = runCardPipelineBatch([...EXAMPLE_CARD_IDS]);
  console.log("\n=== Pipeline examples generated ===");
  for (const r of reports) printReportSummary(r);
  const failed = reports.filter((r) => !r.validation.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

if (args.length === 0) {
  console.error("Usage: npm run pipeline:card -- RS-020 [RS-054 ...]");
  console.error("       npm run pipeline:card -- --examples");
  process.exit(1);
}

const cardIds = args.filter((a) => !a.startsWith("--"));
const reports = runCardPipelineBatch(cardIds);
console.log("\n=== Card pipeline complete ===");
for (const r of reports) printReportSummary(r);
const failed = reports.filter((r) => !r.validation.ok).length;
process.exit(failed > 0 ? 1 : 0);
