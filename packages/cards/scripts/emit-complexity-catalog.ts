/**
 * C/D グレードスタブを complexity-promoted カタログへ昇格（M12）。
 *
 * Usage:
 *   npm run emit-complexity-catalog
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitPromotedCatalog } from "./shared/emitPromotedCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const result = emitPromotedCatalog({
  root,
  grades: new Set(["C", "D"]),
  expansionLabel: "complexity-promoted",
  outputDir: "src/generated/catalog/complexity-promoted",
  manifestName: "manifest.json",
});

console.log(JSON.stringify({ promotedCount: result.promotedCount, byGrade: result.byGrade }, null, 2));
console.log(`→ ${result.outputPath}`);
