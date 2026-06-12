import type { CardDocument, EffectDefinition, UnnamedRuleEntry } from "../dsl/types";
import type {
  CardAnalysis,
  ExtractedEffect,
  WikiParseResult,
} from "./types";
import { lookupCatalogCard } from "./catalogLookup";
import {
  EXPANSION_FROM_SET,
  SIZE_MAP,
  inferCategoryFromWikiLabels,
  inferRushAdditionalCondition,
  parseComboNumber,
  parsePowerCost,
  parseSp,
  sanitizeEffectId,
} from "./metaMaps";
import { canonicalCardName } from "../cardName";
import { parseZordFusionLine } from "./fusionPartners";

const NOTE_RULE_BY_PATTERN: Record<string, string> = {
  wing_note: "wing",
  chase_note: "chase",
  resident_note: "resident",
  deck_unlimited_note: "deck_unlimited",
  cross1_note: "cross1",
  blast_note: "blast",
  breaker_note: "breaker",
  cannot_attack_note: "cannot_attack",
  cannot_enter_battle_note: "cannot_enter_battle",
  no_battle_rush_turn_note: "no_battle_rush_turn",
  not_selectable_except_attack_note: "not_selectable_except_attack",
  scrum_note: "scrum",
  tag_note: "tag",
  resist_note: "register",
  morph_note: "morph",
  require_command_hold_entry: "require_command_hold_entry",
};

function buildUnnamedRules(
  effects: ExtractedEffect[],
  cardText: string,
): UnnamedRuleEntry[] {
  const rules: UnnamedRuleEntry[] = [];
  const fusion = parseZordFusionLine(cardText);
  if (fusion) {
    rules.push({
      kind: "zord",
      text: fusion.text,
      partnerCardIds: fusion.partnerCardIds,
      partnerSlotCardIds: fusion.partnerSlotCardIds,
    });
  }
  for (const eff of effects) {
    if (!eff.text.startsWith("※")) continue;
    if (eff.matchedPattern === "destroy_self_damage") {
      const damage = Number(eff.text.match(/(\d+)点ダメージ/)?.[1] ?? 1);
      rules.push({
        kind: "note",
        text: eff.text,
        rule: "destroy_self_damage",
        damage,
      });
    } else if (eff.matchedPattern === "auto_battle_entry") {
      rules.push({
        kind: "note",
        text: eff.text,
        rule: "auto_battle_entry_each_turn",
      });
    } else if (eff.matchedPattern === "alias_keyword") {
      const alias = eff.text.match(/「([^」]+)」/)?.[1];
      rules.push({
        kind: "fusion",
        text: eff.text,
        rule: "fusion_material_alias",
        partnerCardIds: alias ? [] : undefined,
      });
    } else if (eff.matchedPattern && NOTE_RULE_BY_PATTERN[eff.matchedPattern]) {
      rules.push({
        kind: "note",
        text: eff.text,
        rule: NOTE_RULE_BY_PATTERN[eff.matchedPattern],
      });
    } else if (
      eff.matchedPattern?.endsWith("_note") &&
      eff.effects?.[0]?.type === "grant_keyword"
    ) {
      rules.push({
        kind: "note",
        text: eff.text,
        rule: eff.effects[0].keyword,
      });
    }
  }
  return rules;
}

function toEffectDefinitions(extracted: ExtractedEffect[]): EffectDefinition[] {
  const seen = new Set<string>();
  return extracted.map((eff) => {
    let id = sanitizeEffectId(eff.id);
    if (seen.has(id)) {
      let suffix = 2;
      while (seen.has(`${id}_${suffix}`)) suffix += 1;
      id = `${id}_${suffix}`;
    }
    seen.add(id);
    return {
      id,
      name: eff.name,
      text: eff.text,
      trigger: eff.trigger,
      condition: eff.condition,
      optional: eff.optional,
      effects: eff.effects,
    };
  });
}

function inferExpansion(parse: WikiParseResult, catalog?: CardDocument): CardDocument["expansion"] {
  if (catalog?.expansion) return catalog.expansion;
  const setName = parse.status.収録 ?? parse.expansionLabel ?? "";
  return EXPANSION_FROM_SET[setName] ?? "legend1";
}

function inferCategory(parse: WikiParseResult, catalog?: CardDocument): CardDocument["category"] {
  if (catalog?.category) return catalog.category;
  return inferCategoryFromWikiLabels(parse.categoryLabel, parse.status.カテゴリ);
}

export function generateCardDocument(
  parse: WikiParseResult,
  analysis: CardAnalysis,
  extractedEffects: ExtractedEffect[],
): CardDocument {
  const catalog = lookupCatalogCard(parse.cardId);
  const powerCost = catalog?.powerCost ?? parsePowerCost(parse.status.必要パワー);
  const cardType = catalog?.type ?? analysis.cardType;

  const card: CardDocument = {
    $schema: "https://rangers-strike.dev/schema/card.schema.json",
    id: parse.cardId,
    name: canonicalCardName(catalog?.name ?? parse.name),
    type: cardType,
    category: inferCategory(parse, catalog),
    rarity: catalog?.rarity ?? "N",
    expansion: inferExpansion(parse, catalog),
    powerCost,
    text: catalog?.text ?? parse.effectTexts[0] ?? "",
    rawText: catalog?.text ?? parse.effectTexts[0] ?? "",
  };

  if (catalog?.imageUrl) card.imageUrl = catalog.imageUrl;
  if (catalog?.imageSourceUrl) card.imageSourceUrl = catalog.imageSourceUrl;

  if (cardType === "unit") {
    const bp = catalog?.bp ?? Number(parse.status.BP);
    if (Number.isFinite(bp)) {
      card.bp = bp;
    } else {
      // Wiki に BP 未記載のテンプレート / 常駐効果ユニット
      card.bp = 0;
    }
    card.size = catalog?.size ?? SIZE_MAP[parse.status.種類 ?? ""] ?? "S";
    const sp = catalog?.sp ?? parseSp(parse.status.SP);
    if (sp !== null && sp !== undefined) card.sp = sp;
    const combo = catalog?.comboNumber ?? parseComboNumber(parse.status.CN);
    if (combo !== null && combo !== undefined) card.comboNumber = combo;
    const featuresRaw = parse.status.特徴 ?? parse.featuresLabel;
    if (catalog?.features) {
      card.features = catalog.features;
    } else if (featuresRaw && featuresRaw !== "なし") {
      card.features = featuresRaw.split(/[／/]/).map((s) => s.trim()).filter(Boolean);
    }
    const rush = catalog?.rushAdditionalCondition ??
      inferRushAdditionalCondition(parse.status.追加条件, powerCost);
    if (rush) card.rushAdditionalCondition = rush;
  }

  if (cardType === "vehicle") {
    card.size = catalog?.size ?? SIZE_MAP[parse.status.種類 ?? ""] ?? "S";
    const featuresRaw = parse.status.特徴 ?? parse.featuresLabel;
    if (catalog?.features) {
      card.features = catalog.features;
    } else if (featuresRaw && featuresRaw !== "なし") {
      card.features = featuresRaw.split(/[／/]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  if (cardType === "operation" && extractedEffects.length === 1) {
    const only = extractedEffects[0];
    if (only && !only.needsFallback && only.matchedPattern === "place_in_power") {
      card.effectId = only.id;
    }
  }

  if (analysis.grade === "A") {
    card.implementation = {
      source: "dsl",
      handler: "interpreter",
      testGenerated: true,
    };
    return card;
  }

  const meaningfulEffects = extractedEffects.filter(
    (e) => e.matchedPattern !== "no_effect" && e.effects.length > 0,
  );
  const effects = toEffectDefinitions(meaningfulEffects);
  if (effects.length > 0) {
    card.effects = effects;
  }

  const unnamedRules = buildUnnamedRules(meaningfulEffects, card.text ?? "");
  if (unnamedRules.length > 0) {
    card.unnamedRules = unnamedRules;
  }

  const anyFallback = meaningfulEffects.some((e) => e.needsFallback);
  card.implementation = {
    source: anyFallback ? "hybrid" : "dsl",
    handler: anyFallback ? "typescript" : "interpreter",
    testGenerated: true,
  };

  return card;
}
