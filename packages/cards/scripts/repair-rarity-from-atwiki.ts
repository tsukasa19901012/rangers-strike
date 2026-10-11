/**
 * カタログ・DSL オーバーレイのレアリティを atwiki の表記（「レアリティ：…」）に合わせて直す。
 *
 * 原因: Wiki スタブ生成と DSL 生成がレアリティの既定値 "N" を入れ、昇格したカード（RS-179 以降等）がそのまま
 * "N" になっていた（RS-180・RS-194・RS-527 等）。ここでは各 JSON の `"rarity": "…"` の値だけを書き換える
 * （整形や他のフィールドは変えない）。最後に `node scripts/bundle-dsl-overlays.mjs` でバンドルを作り直すこと。
 *
 * Usage:
 *   npx tsx packages/cards/scripts/repair-rarity-from-atwiki.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCatalogRarity } from "../src/pipeline/atwikiRarity";
import type { Rarity } from "../src/schema";
import { loadAtwikiRarityIndex } from "./shared/atwikiRarityIndex";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const atwikiDir = join(root, "../../docs/wiki/sources/atwiki");

const index = loadAtwikiRarityIndex(atwikiDir);

/**
 * 整形済み JSON の `"rarity": "…"` を、その直前に現れる `"id": "…"`（カード ID。カードオブジェクトでは
 * id → name → type → category → rarity の順）のカードとして書き換える。
 */
function repairText(text: string): { text: string; changed: string[] } {
  const changed: string[] = [];
  const out = text.replace(/"rarity":(\s*)"([A-Z]+)"/g, (whole, space: string, rarity: string, offset: number) => {
    const before = text.slice(Math.max(0, offset - 2000), offset);
    const ids = [...before.matchAll(/"id":\s*"([^"]+)"/g)];
    const id = ids.at(-1)?.[1];
    if (!id) return whole;
    const next = resolveCatalogRarity(rarity as Rarity, index.get(id) ?? []);
    if (!next || next === rarity) return whole;
    changed.push(`${id}:${rarity}->${next}`);
    return `"rarity":${space}"${next}"`;
  });
  return { text: out, changed };
}

const files: string[] = [
  "src/generated/catalog/core-playable/cards.json",
  "src/generated/catalog/full-playable/cards.json",
  "src/generated/catalog/vanilla-promoted/cards.json",
  "src/generated/catalog/complexity-promoted/cards.json",
  "src/generated/catalog/wiki-stubs/cards.json",
  "pipeline/data/wiki-catalog-stubs.json",
];
for (const dir of ["src/dsl/generated", "src/generated/dsl-stubs"]) {
  for (const f of readdirSync(join(root, dir))) {
    if (f.endsWith(".dsl.json")) files.push(join(dir, f));
  }
}

let total = 0;
for (const rel of files) {
  const path = join(root, rel);
  const { text, changed } = repairText(readFileSync(path, "utf8"));
  if (changed.length === 0) continue;
  writeFileSync(path, text);
  total += changed.length;
  if (!rel.endsWith(".dsl.json")) console.log(`${rel}: ${changed.length} 件`);
}
console.log(`atwiki のレアリティ ${index.size} 枚分。書き換え ${total} 件。`);
