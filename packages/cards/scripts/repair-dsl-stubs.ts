/**
 * DSL スタブをカード文面から再同期し、重複・壊れた unnamedRules を除去する。
 *
 * Usage: npx tsx packages/cards/scripts/repair-dsl-stubs.ts
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument, EffectPrimitive, UnnamedRuleEntry } from "../src/dsl/types";
import type { UnnamedUnitRule } from "../src/effectTaxonomy";
import { rematchExtractedEffect } from "../src/pipeline/extractEffects";
import { buildUnnamedRules } from "../src/pipeline/generateDsl";
import { parseZordFusionLine } from "../src/pipeline/fusionPartners";
import type { ExtractedEffect } from "../src/pipeline/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");
const repoRoot = join(cardsRoot, "../..");
const dslDir = join(cardsRoot, "src/generated/dsl-stubs");
const reportPath = join(cardsRoot, "pipeline/data/dsl-stub-repair.json");

/** unnamedRules に残す必要がある構造化ルール（effects の grant_keyword だけでは不足）。 */
const STRUCTURED_UNNAMED_RULES = new Set<UnnamedUnitRule>([
  "battle_entry_hold",
  "auto_battle_entry_each_turn",
  "auto_battle_entry_on_rush",
  "destroy_self_damage",
  "to_power_on_destroy",
  "deck_copy_unlimited",
  "needs_ally_s_in_battle",
  "win_but_destroyed_vs_sp1",
  "destroy_on_win_vs_sp1",
  "return_to_hand_at_6_damage",
  "no_battle_entry_turn_rushed",
  "no_attack_turn_rushed",
  "no_strike_turn_rushed",
  "cannot_enter_battle",
  "fusion_material_alias",
  "opponent_may_draw_on_enter",
  "rush_power_to_discard",
  "cannot_enter_battle_own_turn",
  "no_enter_battle_own_turn",
  "battle_entry_discard_s_from_rush",
  "can_attack_enemy_rush_s",
  "cannot_attack_enemy_battle_s",
  "requires_aircraft_attacker",
  "battle_entry_combo_from",
  "battle_entry_combo_from_own_turn",
  "battle_entry_discard_from_hand",
  "battle_adds_ma_category",
]);

/** effects の grant_keyword と重複してよいシンプルな無名キーワードのみ除去対象。 */
const SIMPLE_REDUNDANT_KEYWORDS = new Set([
  "wing",
  "chase",
  "resident",
  "deck_unlimited",
  "cross1",
  "blast",
  "breaker",
  "cannot_attack",
  "cannot_enter_battle",
  "no_battle_rush_turn",
  "not_selectable_except_attack",
  "scrum",
  "tag",
  "register",
  "morph",
]);

function effectHandlesNote(
  primitives: EffectPrimitive[] | undefined,
): boolean {
  if (!primitives?.length) return false;
  return primitives.some(
    (p) =>
      p.type === "grant_keyword" &&
      SIMPLE_REDUNDANT_KEYWORDS.has(p.keyword),
  );
}

function collectExtractedEffects(doc: CardDocument): ExtractedEffect[] {
  const extracted: ExtractedEffect[] = [];
  for (const effect of doc.effects ?? []) {
    if (!effect.text.startsWith("※")) continue;
    const rematched = rematchExtractedEffect(effect.text, {
      name: effect.name,
      trigger: effect.trigger,
      cardId: doc.id,
    });
    if (!rematched) continue;
    extracted.push({ segmentIndex: 0, needsFallback: false, ...rematched });
  }
  return extracted;
}

function isStructuredRule(rule: UnnamedRuleEntry): boolean {
  if (rule.kind === "zord" || rule.kind === "fusion") return true;
  if (
    rule.holdCount !== undefined ||
    rule.damage !== undefined ||
    rule.discardCount !== undefined
  ) {
    return true;
  }
  return !!(
    rule.rule && STRUCTURED_UNNAMED_RULES.has(rule.rule as UnnamedUnitRule)
  );
}

function mergeStructuredRules(
  rules: UnnamedRuleEntry[],
  doc: CardDocument,
): { rules: UnnamedRuleEntry[]; restored: number } {
  const text = doc.text ?? doc.rawText ?? "";
  const rebuilt = buildUnnamedRules(collectExtractedEffects(doc), text);
  let restored = 0;
  const next = [...rules];

  for (const rule of rebuilt) {
    if (rule.kind === "zord") continue;
    if (!isStructuredRule(rule)) continue;

    const exists = next.some(
      (existing) =>
        existing.kind === rule.kind &&
        existing.rule === rule.rule &&
        existing.text === rule.text &&
        existing.holdCount === rule.holdCount &&
        existing.damage === rule.damage &&
        existing.discardCount === rule.discardCount,
    );
    if (exists) continue;

    next.push(rule);
    restored += 1;
  }

  return { rules: next, restored };
}

function isRedundantNoteRule(
  doc: CardDocument,
  rule: UnnamedRuleEntry,
): boolean {
  if (rule.kind !== "note") return false;
  if (
    rule.holdCount !== undefined ||
    rule.damage !== undefined ||
    rule.discardCount !== undefined
  ) {
    return false;
  }
  if (rule.rule && STRUCTURED_UNNAMED_RULES.has(rule.rule as UnnamedUnitRule)) {
    return false;
  }
  const matching = doc.effects?.find((effect) => effect.text === rule.text);
  if (!matching) return false;
  return effectHandlesNote(matching.effects);
}

function syncZordRule(
  doc: CardDocument,
  rules: UnnamedRuleEntry[],
): { rules: UnnamedRuleEntry[]; changed: boolean; action: string } {
  const text = doc.text ?? doc.rawText ?? "";
  const fusion = parseZordFusionLine(text);
  const zordIndex = rules.findIndex((rule) => rule.kind === "zord");

  if (!fusion) {
    if (zordIndex < 0) {
      return { rules, changed: false, action: "none" };
    }
    const next = rules.filter((_, index) => index !== zordIndex);
    return { rules: next, changed: true, action: "removed_invalid_zord" };
  }

  const zordRule: UnnamedRuleEntry = {
    kind: "zord",
    text: fusion.text,
    partnerCardIds: fusion.partnerCardIds,
    partnerSlotCardIds: fusion.partnerSlotCardIds,
  };

  if (zordIndex < 0) {
    return { rules: [zordRule, ...rules], changed: true, action: "added_zord" };
  }

  const existing = rules[zordIndex]!;
  const same =
    existing.text === zordRule.text &&
    JSON.stringify(existing.partnerCardIds) === JSON.stringify(zordRule.partnerCardIds) &&
    JSON.stringify(existing.partnerSlotCardIds) ===
      JSON.stringify(zordRule.partnerSlotCardIds);

  if (same) {
    return { rules, changed: false, action: "none" };
  }

  const next = [...rules];
  next[zordIndex] = zordRule;
  return { rules: next, changed: true, action: "synced_zord" };
}

const stats = {
  scanned: 0,
  updated: 0,
  zordSynced: 0,
  zordRemoved: 0,
  zordAdded: 0,
  notesRemoved: 0,
  notesRestored: 0,
};

for (const file of readdirSync(dslDir)) {
  if (!file.endsWith(".dsl.json")) continue;
  stats.scanned += 1;

  const path = join(dslDir, file);
  const doc = JSON.parse(readFileSync(path, "utf8")) as CardDocument;
  let rules = [...(doc.unnamedRules ?? [])];
  let changed = false;

  const zordResult = syncZordRule(doc, rules);
  rules = zordResult.rules;
  if (zordResult.changed) {
    changed = true;
    if (zordResult.action === "synced_zord") stats.zordSynced += 1;
    if (zordResult.action === "removed_invalid_zord") stats.zordRemoved += 1;
    if (zordResult.action === "added_zord") stats.zordAdded += 1;
  }

  const keptNotes: UnnamedRuleEntry[] = [];
  for (const rule of rules) {
    if (rule.kind === "zord") {
      keptNotes.push(rule);
      continue;
    }
    if (isRedundantNoteRule(doc, rule)) {
      changed = true;
      stats.notesRemoved += 1;
      continue;
    }
    keptNotes.push(rule);
  }
  rules = keptNotes;

  const mergeResult = mergeStructuredRules(rules, doc);
  if (mergeResult.restored > 0) {
    rules = mergeResult.rules;
    changed = true;
    stats.notesRestored += mergeResult.restored;
  }

  if (!changed) continue;

  doc.unnamedRules = rules.length > 0 ? rules : undefined;
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`);
  stats.updated += 1;
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(stats, null, 2)}\n`);
console.log(JSON.stringify(stats, null, 2));

execSync("node scripts/bundle-dsl-overlays.mjs", { cwd: cardsRoot, stdio: "inherit" });
execSync("npm run emit-full-playable-catalog -w @rangers-strike/cards", {
  cwd: repoRoot,
  stdio: "inherit",
});
