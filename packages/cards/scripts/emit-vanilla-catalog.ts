/**
 * A/E/B グレードスタブを vanilla-promoted カタログへ昇格（M11）。
 *
 * Usage:
 *   npm run emit-vanilla-catalog
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitPromotedCatalog } from "./shared/emitPromotedCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const result = emitPromotedCatalog({
  root,
  grades: new Set(["A", "B", "E"]),
  expansionLabel: "vanilla-promoted",
  outputDir: "src/generated/catalog/vanilla-promoted",
  manifestName: "manifest.json",
});

console.log(JSON.stringify({ promotedCount: result.promotedCount, byGrade: result.byGrade }, null, 2));
console.log(`→ ${result.outputPath}`);
