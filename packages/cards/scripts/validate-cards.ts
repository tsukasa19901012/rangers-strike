import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllCardDocuments, loadCardDocument } from "../src/dsl/loader";
import { validateCardDocument } from "../src/dsl/validator";

const __dirname = dirname(fileURLToPath(import.meta.url));

let failed = 0;
let passed = 0;

const docs = loadAllCardDocuments();
for (const doc of docs) {
  const result = validateCardDocument(doc);
  if (!result.ok) {
    failed += 1;
    console.error(`FAIL ${doc.id}:`);
    for (const issue of result.issues) {
      console.error(`  [${issue.code}] ${issue.path}: ${issue.message}`);
    }
  } else {
    passed += 1;
  }
}

const examplePath = join(__dirname, "../src/dsl/examples/RS-046.dsl.json");
try {
  const raw = JSON.parse(await readFile(examplePath, "utf8")) as unknown;
  loadCardDocument(raw);
  console.log("OK  example RS-046.dsl.json");
  passed += 1;
} catch (e) {
  failed += 1;
  console.error("FAIL example RS-046.dsl.json:", e);
}

console.log(`\nValidation: ${passed} passed, ${failed} failed (${docs.length} catalog cards)`);
process.exit(failed > 0 ? 1 : 0);
