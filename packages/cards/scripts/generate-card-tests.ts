import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCardRegistryFromCatalog } from "../src/dsl/registry";
import { generateCardTestFile, generateRegistrySmokeTest } from "../src/dsl/testGenerator";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../src/dsl/generated");

const args = process.argv.slice(2);
const smokeOnly = args.includes("--smoke-only");
const cardIds = args.filter((a) => !a.startsWith("--"));

await mkdir(outDir, { recursive: true });

const registry = createCardRegistryFromCatalog();

if (smokeOnly) {
  const path = join(outDir, "registry.smoke.generated.test.ts");
  await writeFile(path, generateRegistrySmokeTest(registry), "utf8");
  console.log(`Wrote ${path}`);
  process.exit(0);
}

const ids =
  cardIds.length > 0
    ? cardIds
    : registry.listDslReady().length > 0
      ? registry.listDslReady()
      : ["RS-046", "RS-001"];

let written = 0;
for (const id of ids) {
  const card = registry.getCard(id);
  if (!card) {
    console.warn(`Skip unknown card: ${id}`);
    continue;
  }
  const path = join(outDir, `${id}.generated.test.ts`);
  await writeFile(path, generateCardTestFile(card), "utf8");
  console.log(`Wrote ${path}`);
  written += 1;
}

const smokePath = join(outDir, "registry.smoke.generated.test.ts");
await writeFile(smokePath, generateRegistrySmokeTest(registry), "utf8");
console.log(`Wrote ${smokePath}`);
console.log(`Done: ${written} card test file(s)`);
