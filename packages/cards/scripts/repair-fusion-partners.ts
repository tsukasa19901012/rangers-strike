/**
 * @deprecated Use repair-dsl-stubs.ts
 * DSL スタブの 合体― 行から zord unnamedRules.partnerCardIds を補完する。
 *
 * Usage: npx tsx packages/cards/scripts/repair-fusion-partners.ts
 */
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");

execSync("npx tsx scripts/repair-dsl-stubs.ts", { cwd: cardsRoot, stdio: "inherit" });
