/**
 * U0 — カタログ / loader parity 監査。
 *
 * Usage:
 *   npm run audit:catalog-parity -w @rangers-strike/cards
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  allParityGatesPassed,
  runCatalogParityAudit,
} from "../src/catalog/parity";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "pipeline/data/catalog-parity.json");

function main(): void {
  const report = runCatalogParityAudit();
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Catalog parity → ${outputPath}`);
  console.log(`Gates: ${report.gatesPassed}/${report.gatesTotal} pass`);
  for (const gate of report.gates) {
    const mark = gate.status === "pass" ? "✓" : gate.status === "partial" ? "~" : "✗";
    console.log(`  ${mark} ${gate.id} ${gate.name}: ${gate.current}`);
  }
  console.log(`Loader fingerprint: ${report.summary.loaderFingerprint}`);

  if (!allParityGatesPassed(report)) {
    const failed = report.gates.filter((g) => g.status !== "pass");
    console.error(`\nCatalog parity failed (${failed.length} gate(s)):`);
    for (const gate of failed) {
      console.error(`  - ${gate.id}: ${gate.current}`);
      if (gate.details?.length) {
        for (const detail of gate.details) {
          console.error(`      ${detail}`);
        }
      }
    }
    process.exit(1);
  }
}

main();
