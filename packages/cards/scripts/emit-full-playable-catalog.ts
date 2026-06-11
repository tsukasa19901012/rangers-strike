/**
 * U2 — core + promoted シャードを full-playable カタログへマージ。
 *
 * Usage:
 *   npm run emit-full-playable-catalog
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitFullPlayableCatalog } from "./shared/emitFullPlayableCatalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const result = emitFullPlayableCatalog({ root });

console.log(JSON.stringify({ total: result.total, byTier: result.byTier }, null, 2));
console.log(`→ ${result.outputPath}`);
console.log(`→ ${result.indexPath}`);
