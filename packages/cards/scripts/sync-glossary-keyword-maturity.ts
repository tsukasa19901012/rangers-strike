/**
 * glossary/*.md の「実装仕様」行を keyword-implementation マトリクスと同期する。
 *
 * Usage:
 *   npx tsx packages/cards/scripts/sync-glossary-keyword-maturity.ts
 *   npx tsx packages/cards/scripts/sync-glossary-keyword-maturity.ts --check
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const glossaryDir = join(repoRoot, "docs/wiki/glossary");

/** glossary ファイル → 実装仕様一行（keyword-implementation.md §2 準拠） */
export const KEYWORD_GLOSSARY_MATURITY: Record<string, string> = {
  "p1289.md": "**高** — `resist.ts`, `registerEligible` on battle destroy",
  "p1290.md": "**高** — `scrumBlocksAttack`（右隣 CN+1 のみ）",
  "wing.md": "**高** — `hold_for_wing`, `canWingAttackFromRush`, `resetWingUnitForReuse`",
  "p2393.md": "**高** — `crossValueForCard`, `crossAdjustedBattlePosition`",
  "p1701.md": "**高** — `blastBypassesRushAdditionalCondition`（damage≥WIN-1 OR 表パワー≤1）",
  "p2355.md": "**高** — `effectTargetability.ts`, `breakerBlocksEffectTarget`",
  "p1291.md": "**中** — `taxisSpFloor` → `legend3EffectiveSp`",
  "p1294.md": "**高** — `morphReaction.ts`, `activeMorph.ts`（能動モーフ primitive）",
  "ride.md": "**高** — `attachRideForBattleEntry`, `ridingComboEffects.ts`",
  "p228.md": "**高** — `ridingComboEffects.ts`, `no_strike_after_rideoff`",
  "chase-term.md": "**高** — `chase.ts`, `canRiderMountVehicle`, battle→rush remount",
};

const SPEC_LINE = /^実装仕様:.*$/m;

function syncFile(relativePath: string, specLine: string, checkOnly: boolean): boolean {
  const path = join(glossaryDir, relativePath);
  const content = readFileSync(path, "utf8");
  const nextLine = `実装仕様: ${specLine}`;
  if (!SPEC_LINE.test(content)) {
    throw new Error(`${relativePath}: 実装仕様 line not found`);
  }
  const next = content.replace(SPEC_LINE, nextLine);
  if (next === content) return false;
  if (!checkOnly) writeFileSync(path, next);
  return true;
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  let changed = 0;
  for (const [file, spec] of Object.entries(KEYWORD_GLOSSARY_MATURITY)) {
    if (syncFile(file, spec, checkOnly)) changed += 1;
  }
  if (checkOnly && changed > 0) {
    console.error(`${changed} glossary file(s) out of sync`);
    process.exit(1);
  }
  console.log(checkOnly ? "glossary keyword maturity: in sync" : `updated ${changed} glossary file(s)`);
}

main();
