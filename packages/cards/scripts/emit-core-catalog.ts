/**
 * U2 — コア 179 枚を generated/catalog/core-playable へ emit。
 *
 * Usage:
 *   npm run emit-core-catalog
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitCoreCatalog } from "./shared/emitCoreCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const result = emitCoreCatalog({ root });

console.log(JSON.stringify({ coreCount: result.coreCount, byExpansion: result.byExpansion }, null, 2));
console.log(`→ ${result.outputPath}`);
