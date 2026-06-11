import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allCardsCatalog } from "../src/catalog.js";
import { loadCardById } from "../src/dsl/loader.js";
import { applyLegend1StarterOverlay, listLegend1StarterCardIds } from "../src/dsl/legend1/starter/loadStarterOverlays.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../src/dsl/generated");

function main(): void {
  mkdirSync(outDir, { recursive: true });
  const starterIds = new Set(listLegend1StarterCardIds());
  let written = 0;

  for (const def of allCardsCatalog.cards) {
    let doc = loadCardById(def.id, "core");
    if (starterIds.has(def.id)) {
      doc = applyLegend1StarterOverlay(doc);
    }
    const path = join(outDir, `${def.id}.dsl.json`);
    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    written += 1;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: written,
    starterOverlays: starterIds.size,
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Generated ${written} DSL documents → ${outDir}`);
}

main();
