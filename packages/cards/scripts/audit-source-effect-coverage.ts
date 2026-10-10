/**
 * E7 監査: 原文（atwiki）に効果テキストがあるのに効果定義 0 件のカードを検出する。
 *
 * Usage:
 *   npm run audit:source-effect-coverage
 *
 * 効果定義 0 件のカードが 1 枚でもあれば exit 1。
 * カタログ text が空（効果定義はある）カードは参考として件数のみ出力する。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSourceEffectCoverageAudit } from "./shared/sourceEffectCoverage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, "../pipeline/data/source-effect-coverage.json");

function main(): void {
  const report = runSourceEffectCoverageAudit("full-playable");

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`,
  );

  console.log(
    JSON.stringify(
      {
        scanned: report.scanned,
        withSourceText: report.withSourceText,
        missingSource: report.missingSource.length,
        noDefinitions: report.noDefinitions.map((e) => e.cardId),
        emptyCatalogText: report.emptyCatalogText.map((e) => e.cardId),
      },
      null,
      2,
    ),
  );
  console.log(`→ ${outputPath}`);

  if (report.noDefinitions.length > 0) {
    console.error(
      `原文に効果テキストがあるのに効果定義 0 件: ${report.noDefinitions.map((e) => e.cardId).join(", ")}`,
    );
    process.exit(1);
  }
}

main();
