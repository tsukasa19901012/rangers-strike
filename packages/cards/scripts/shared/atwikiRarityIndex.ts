import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseAtwikiRarities } from "../../src/pipeline/atwikiRarity";
import type { Rarity } from "../../src/schema";

/** docs/wiki/sources/atwiki/page-N-<ID>.md からカード ID → レアリティ（版の順）の索引を作る。 */
export function loadAtwikiRarityIndex(atwikiDir: string): Map<string, Rarity[]> {
  const index = new Map<string, Rarity[]>();
  for (const file of readdirSync(atwikiDir)) {
    const m = file.match(/^page-\d+-([A-Z]+\d*-\d+[A-Za-z]?)\.md$/);
    if (!m) continue;
    const rarities = parseAtwikiRarities(readFileSync(join(atwikiDir, file), "utf8"));
    if (rarities.length === 0) continue;
    const prev = index.get(m[1]!) ?? [];
    index.set(m[1]!, [...prev, ...rarities.filter((r) => !prev.includes(r))]);
  }
  return index;
}
