import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");

function bundleDirectory(sourceDir, outputPath, suffix) {
  const bundle = {};
  if (!existsSync(sourceDir)) {
    writeFileSync(outputPath, "{}");
    return 0;
  }

  for (const file of readdirSync(sourceDir)) {
    if (!file.endsWith(suffix)) continue;
    const cardId = file.slice(0, -suffix.length);
    bundle[cardId] = JSON.parse(readFileSync(join(sourceDir, file), "utf8"));
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(bundle));
  return Object.keys(bundle).length;
}

const generatedCount = bundleDirectory(
  join(cardsRoot, "src/dsl/generated"),
  join(cardsRoot, "src/dsl/generated/overlays-bundle.json"),
  ".dsl.json",
);

const stubCount = bundleDirectory(
  join(cardsRoot, "src/generated/dsl-stubs"),
  join(cardsRoot, "src/generated/dsl-stubs/stubs-bundle.json"),
  ".dsl.json",
);

console.log(`Bundled ${generatedCount} generated overlays and ${stubCount} stub overlays.`);
