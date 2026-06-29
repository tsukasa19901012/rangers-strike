/**
 * RS カードのリリース準備監査 — wiki DSL / スタブ / 実装経路を横断チェック。
 *
 * Usage:
 *   npx tsx packages/cards/scripts/audit-rs-release-readiness.ts
 *   npx tsx packages/cards/scripts/audit-rs-release-readiness.ts --json
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CardDocument, EffectDefinition, EffectPrimitive } from "../src/dsl/types";
import {
  ENGINE_IMPLEMENTED_CATCHALL_CARD_IDS,
  ENGINE_NATIVE_GRANT_KEYWORDS,
} from "../src/engineImplementedCatchall";
import {
  isCatchallGrantKeyword,
  isHashGrantKeywordStub,
} from "../src/pipeline/hashGrantKeywords";
import { isOperationImplemented } from "../src/operationCatalog";
import { WIKI_OPERATION_TEXT } from "../src/wikiReference";
import { rematchExtractedEffect } from "../src/pipeline/extractEffects";
import {
  RS_CATCHALL_EFFECT_KEYS,
  RS_CATCHALL_KEYWORDS,
} from "../src/rsCatchallImplemented";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dslDir = join(root, "src/generated/dsl-stubs");
const reportPath = join(root, "pipeline/data/rs-release-readiness.json");

/** grantKeyword.ts PASSIVE_GRANT_KEYWORDS の cards 側ミラー（監査用）。 */
const PASSIVE_GRANT_KEYWORDS = new Set([
  "over_technology_m_bp_plus_on_attacked",
  "block_m_battle_entry_bp5000_plus",
  "category_substitute_via_hold",
  "auto_battle_entry_from_rush",
  "auto_battle_entry_each_turn",
  "auto_battle_entry_if_enemy_battle",
  "all_enemy_s_auto_battle_entry",
  "no_ride_while_held",
  "not_selectable",
  "cannot_attack_enemy_battle",
  "cannot_attack",
  "counter_redirect_attack",
  "m_battle_entry_requires_hold",
  "fusion_material_alias",
  "battle_entry_hold_1",
  "require_command_hold_entry",
  "last_battle_protect_other_s",
  "substitute_on_wb_destroy",
  "win_but_destroyed_vs_sp1",
  "destroy_on_win_vs_sp1",
  "no_battle_entry_turn_rushed",
  "morph",
  "resident",
  "wing",
  "chase",
  "register",
  "commander",
  "mothership",
  "ride_bp_boost_500",
  "ride_bp_boost_1000",
  "cross1",
  "blast",
  "breaker",
  "scrum",
  "not_selectable_except_attack",
  "no_strike_after_rideoff",
  "combo_l_category_sp1",
  "combo_l_category_attack_rush",
  "opponent_destroy_lower_bp_on_battle_win",
  "while_command_leave_hold_from_discard",
  "strike_intercept_with_s_unit",
  "destroy_striker_on_strike_self_discard",
  "m_must_hold_command_for_battle",
  "ignore_rule_hold_command_entry",
  "nc_sp1_if_no_enemy_units",
]);

const STRUCTURED_PRIMITIVE_TYPES = new Set([
  "choose",
  "destroy",
  "move",
  "draw",
  "mill",
  "modify_bp",
  "modify_sp",
  "set_bp",
  "damage",
  "deal_damage",
  "cancel_damage",
  "prevent_battle",
  "discard",
  "shuffle",
  "reveal",
  "search",
  "hold",
  "hold_command",
  "release",
  "release_command",
  "block_battle_entry",
  "open_reaction",
  "deploy",
  "return_to_zone",
  "flip_power",
  "fallback_handler",
]);

type ReleaseTier = "ready" | "runtime_catchall" | "blocked";

type EffectAudit = {
  cardId: string;
  effectId: string;
  tier: ReleaseTier;
  reason: string;
  textPreview?: string;
};

function isStructuredPrimitive(primitives: EffectPrimitive[]): boolean {
  return primitives.some((p) => STRUCTURED_PRIMITIVE_TYPES.has(p.type));
}

function isKnownGrantKeyword(keyword: string): boolean {
  return (
    PASSIVE_GRANT_KEYWORDS.has(keyword) ||
    ENGINE_NATIVE_GRANT_KEYWORDS.has(keyword) ||
    RS_CATCHALL_KEYWORDS.has(keyword) ||
    keyword.startsWith("deck_search_") ||
    keyword.startsWith("rush_trim_power_") ||
    keyword.startsWith("power_zone_min_") ||
    keyword.startsWith("end_turn_return_") ||
    keyword.startsWith("attack_bp_plus_vs_") ||
    keyword.startsWith("hold_all_enemy_bp") ||
    keyword.startsWith("return_") ||
    keyword === "battle_destroy_to_power" ||
    keyword === "alternating_draw_3_mill" ||
    keyword === "opponent_hand_counter_to_power" ||
    keyword === "combo_number_delta_minus_1" ||
    keyword === "deck_search_minus_power_rush" ||
    keyword === "opponent_rush_s_to_hand" ||
    keyword === "opponent_rush_s_to_battle" ||
    keyword === "deploy_enemy_command_silent" ||
    keyword === "release_m_command_to_rush" ||
    keyword === "draw_deck_to_command_or_hand"
  );
}

function classifyEffect(doc: CardDocument, effect: EffectDefinition): EffectAudit {
  const cardId = doc.id;
  const effectId = effect.id;
  const textPreview = (effect.text ?? doc.text ?? "").slice(0, 80);
  const primitives = effect.effects ?? [];

  if (primitives.some((p) => p.type === "grant_keyword" && isHashGrantKeywordStub(p.keyword))) {
    return { cardId, effectId, tier: "blocked", reason: "hash_grant_keyword_stub", textPreview };
  }

  if (ENGINE_IMPLEMENTED_CATCHALL_CARD_IDS.has(cardId)) {
    return { cardId, effectId, tier: "ready", reason: "engine_catchall_card", textPreview };
  }

  if (isOperationImplemented(effectId)) {
    return { cardId, effectId, tier: "ready", reason: "implemented_operation", textPreview };
  }

  if (primitives.some((p) => p.type === "interpret_effect")) {
    if (doc.type === "unit" || doc.type === "commander") {
      return { cardId, effectId, tier: "ready", reason: "unit_interpret_runtime", textPreview };
    }
    if (isOperationImplemented(effectId)) {
      return { cardId, effectId, tier: "ready", reason: "interpret_effect_operation", textPreview };
    }
    return { cardId, effectId, tier: "blocked", reason: "unimplemented_interpret_effect", textPreview };
  }

  const grantKeywords = primitives
    .filter((p): p is Extract<EffectPrimitive, { type: "grant_keyword" }> => p.type === "grant_keyword")
    .map((p) => p.keyword);

  if (grantKeywords.length > 0 && !grantKeywords.some(isCatchallGrantKeyword)) {
    return { cardId, effectId, tier: "ready", reason: "structured_grant_keyword", textPreview };
  }

  if (isStructuredPrimitive(primitives)) {
    return { cardId, effectId, tier: "ready", reason: "structured_primitives", textPreview };
  }

  if (grantKeywords.some(isKnownGrantKeyword)) {
    return { cardId, effectId, tier: "ready", reason: "known_grant_keyword", textPreview };
  }

  if (grantKeywords.some(isCatchallGrantKeyword)) {
    const key = `${cardId}:${effectId}`;
    if (RS_CATCHALL_EFFECT_KEYS.has(key)) {
      return { cardId, effectId, tier: "ready", reason: "rs_catchall_implemented", textPreview };
    }
    const rematched = rematchExtractedEffect(effect.text ?? "", {
      name: effect.name,
      kind: (effect.text ?? "").startsWith("※") ? "note" : effect.name ? "named" : "body",
      trigger: effect.trigger,
    });
    if (rematched && isStructuredPrimitive(rematched.effects)) {
      return { cardId, effectId, tier: "ready", reason: "catchall_rematch_structured", textPreview };
    }
    return { cardId, effectId, tier: "runtime_catchall", reason: "semantic_catchall_runtime", textPreview };
  }

  if ((effect.text ?? "").trim().length === 0 && doc.type === "operation") {
    return { cardId, effectId, tier: "ready", reason: "legacy_operation_handler", textPreview };
  }

  return { cardId, effectId, tier: "blocked", reason: "unclassified", textPreview };
}

function wikiTextMatches(doc: CardDocument): boolean {
  const wiki = WIKI_OPERATION_TEXT[doc.id];
  if (!wiki) return true;
  const cardText = (doc.rawText ?? doc.text ?? "").replace(/\s+/g, "");
  const wikiNorm = wiki.replace(/\s+/g, "");
  return cardText.includes(wikiNorm.slice(0, 40)) || wikiNorm.includes(cardText.slice(0, 40));
}

function main(): void {
  const jsonOnly = process.argv.includes("--json");
  const audits: EffectAudit[] = [];
  const wikiMismatches: string[] = [];
  let rsCards = 0;

  for (const file of readdirSync(dslDir)) {
    if (!file.startsWith("RS-") || !file.endsWith(".dsl.json")) continue;
    rsCards += 1;
    const doc = JSON.parse(readFileSync(join(dslDir, file), "utf8")) as CardDocument;
    if (!wikiTextMatches(doc)) wikiMismatches.push(doc.id);
    for (const effect of doc.effects ?? []) {
      audits.push(classifyEffect(doc, effect));
    }
  }

  const byTier = { ready: 0, runtime_catchall: 0, blocked: 0 };
  const blockedSamples: EffectAudit[] = [];
  const catchallSamples: EffectAudit[] = [];
  const blockedCards = new Set<string>();

  for (const a of audits) {
    byTier[a.tier] += 1;
    if (a.tier === "blocked") {
      blockedCards.add(a.cardId);
      if (blockedSamples.length < 30) blockedSamples.push(a);
    }
    if (a.tier === "runtime_catchall" && catchallSamples.length < 15) {
      catchallSamples.push(a);
    }
  }

  const releaseReady =
    byTier.blocked === 0 &&
    audits.every((a) => a.reason !== "hash_grant_keyword_stub");

  const report = {
    generatedAt: new Date().toISOString(),
    rsCards,
    totalEffects: audits.length,
    byTier,
    blockedCardCount: blockedCards.size,
    releaseReady,
    wikiTextMismatches: wikiMismatches.length,
    blockedSamples,
    catchallSamples,
    note: "runtime_catchall = semantic grant_keyword; 発動時に effectDelegate 経由で rematch→interpret。",
  };

  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(JSON.stringify(report, null, 2));
  console.log(`→ ${reportPath}`);
}

main();
