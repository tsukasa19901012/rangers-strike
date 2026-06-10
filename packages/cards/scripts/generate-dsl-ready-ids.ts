/**
 * fullPlayable レジストリから DSL ready / unimplemented カード ID を抽出。
 *
 * Usage:
 *   npm run generate-dsl-ready-ids
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFullPlayableRegistry } from "../src/dsl/registry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputPath = join(root, "src/generated/dsl-ready-ids.json");

type DslReadyIdsFile = {
  generatedAt: string;
  dslReady: string[];
  unimplemented: string[];
};

function main(): void {
  const registry = createFullPlayableRegistry();
  const snap = registry.snapshot();

  const output: DslReadyIdsFile = {
    generatedAt: new Date().toISOString(),
    dslReady: snap.dslReady,
    unimplemented: snap.unimplemented,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(
    `dsl-ready-ids: dslReady=${output.dslReady.length}, unimplemented=${output.unimplemented.length}`,
  );
}

main();
