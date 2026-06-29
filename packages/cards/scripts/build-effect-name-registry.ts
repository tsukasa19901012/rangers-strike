/**
 * DSL スタブから効果名レジストリを生成する。
 *
 * Usage: npx tsx packages/cards/scripts/build-effect-name-registry.ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { effectIdFromName } from "../src/pipeline/effectNameIds";
import { hashEffectText } from "../src/pipeline/metaMaps";
import {
  normalizeEffectName,
  slugifyJapaneseEffectName,
} from "../src/pipeline/japaneseEffectSlug";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");
const outPath = join(root, "src/pipeline/effect-name-registry.json");
const reportPath = join(root, "pipeline/data/effect-name-registry-report.json");

function main(): void {
  const names = new Set<string>();
  for (const file of readdirSync(dslDir)) {
    if (!file.endsWith(".dsl.json")) continue;
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8"));
    for (const effect of doc.effects ?? []) {
      if (effect.name) names.add(normalizeEffectName(effect.name));
    }
  }

  const registry: Record<string, string> = {};
  const used = new Set<string>();
  const collisions: Array<{ name: string; slug: string }> = [];

  for (const name of [...names].sort()) {
    const known = effectIdFromName(name);
    let id = known && !known.startsWith("named_") ? known : slugifyJapaneseEffectName(name);
    if (used.has(id)) {
      const suffix = hashEffectText(name).slice(0, 6);
      id = `${id}_${suffix}`;
      collisions.push({ name, slug: id });
    }
    let n = 2;
    while (used.has(id)) {
      id = `${id.split("_").slice(0, -1).join("_") || id}_${n}`;
      n += 1;
    }
    used.add(id);
    registry[name] = id;
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(registry, null, 2)}\n`);
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        uniqueNames: names.size,
        registryEntries: Object.keys(registry).length,
        collisionCount: collisions.length,
        sampleCollisions: collisions.slice(0, 20),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${Object.keys(registry).length} entries → ${outPath}`);
}

main();
