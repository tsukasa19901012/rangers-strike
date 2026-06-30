import type {
  NamedEffectTrigger,
  NamedUnitEffect,
  UnitEffectBlock,
  UnnamedUnitRule,
  UnnamedUnitText,
} from "../effectTaxonomy";
import type { CardDocument, EffectDefinition, EffectTrigger } from "../dsl/types";
import { canonicalCardName, fusionMaterialAliasNames } from "../cardName";
import { corePlayableCatalog, fullPlayableCatalog } from "./unifiedCatalog";
import { effectIdFromName } from "../pipeline/effectNameIds";
import {
  isRideOffUnconditionalEffectText,
  normalizeNamedComboTrigger,
} from "../ridingComboTrigger";

const CARD_NAME_TO_ID = new Map<string, string>();
for (const card of fullPlayableCatalog.cards) {
  const key = canonicalCardName(card.name);
  if (!CARD_NAME_TO_ID.has(key)) CARD_NAME_TO_ID.set(key, card.id);
}

/** コアのみ — 同名エイリアスは低い id を優先（例: マジフェニックス → RS-057）。 */
const CARD_ALIAS_TO_ID = new Map<string, string>();
function registerAlias(alias: string, cardId: string): void {
  const existing = CARD_ALIAS_TO_ID.get(alias);
  if (!existing || cardId < existing) {
    CARD_ALIAS_TO_ID.set(alias, cardId);
  }
}
for (const card of corePlayableCatalog.cards) {
  registerAlias(canonicalCardName(card.name), card.id);
  for (const alias of fusionMaterialAliasNames(card.text)) {
    registerAlias(alias, card.id);
  }
}

function resolveCardNameToId(name: string): string | undefined {
  const key = canonicalCardName(name);
  return CARD_ALIAS_TO_ID.get(key) ?? CARD_NAME_TO_ID.get(key);
}

function extractComboFromPartnerIds(text: string): string[] {
  const comboIdx = text.indexOf("からコンビネーション");
  if (comboIdx < 0) return [];

  const segment = text.slice(Math.max(0, comboIdx - 120), comboIdx);
  const partnerCardIds = [
    ...new Set(
      [...segment.matchAll(/「([^」]+)」/g)]
        .map((match) => resolveCardNameToId(match[1]!))
        .filter((id): id is string => id !== undefined),
    ),
  ];
  return partnerCardIds;
}

function enrichNcComboFromTrigger(
  trigger: NamedEffectTrigger,
  text: string,
): NamedEffectTrigger {
  if (trigger.type !== "nc") return trigger;

  const hasComboFromOverride =
    text.includes("ナンバーに関係なく発動") ||
    /「[^」]+」からコンビネーション/.test(text);
  if (!hasComboFromOverride) return trigger;

  const partnerCardIds = extractComboFromPartnerIds(text);
  if (partnerCardIds.length === 0) return trigger;
  return { type: "nc_or_combo_from", partnerCardIds };
}

function toNamedTrigger(
  trigger: EffectTrigger,
  text: string,
  comboNumber: CardDocument["comboNumber"],
): NamedEffectTrigger | undefined {
  if (
    trigger.type === "operation" ||
    trigger.type === "on_destroy" ||
    trigger.type === "on_leave" ||
    trigger.type === "on_damage"
  ) {
    return undefined;
  }
  if (trigger.type === "on_strike") {
    return { type: "on_strike" };
  }
  const enriched = enrichNcComboFromTrigger(trigger as NamedEffectTrigger, text);
  return normalizeNamedComboTrigger(enriched, comboNumber);
}

const BATTLE_ENTRY_HOLD_TEXT =
  /^※これは自軍コマンドを(\d+)つホールドしなければバトルエリアに出られない/;

function parseBattleEntryHoldCount(text: string): number | undefined {
  const match = text.match(BATTLE_ENTRY_HOLD_TEXT);
  return match ? Number(match[1]) : undefined;
}

function normalizeUnnamedRuleEntry(entry: {
  kind: UnnamedUnitText["kind"];
  text: string;
  rule?: string;
  holdCount?: number;
  damage?: number;
  discardCount?: number;
  partnerCardIds?: string[];
  partnerSlotCardIds?: string[][];
}): UnnamedUnitText {
  const holdFromText = parseBattleEntryHoldCount(entry.text);
  if (entry.rule === "require_command_hold_entry" || holdFromText !== undefined) {
    return {
      ...entry,
      rule: "battle_entry_hold",
      holdCount: entry.holdCount ?? holdFromText ?? 1,
    };
  }
  return {
    ...entry,
    rule: entry.rule as UnnamedUnitRule | undefined,
  };
}

function isSemanticWiredEffectId(effectId: string): boolean {
  return (
    effectId.includes("_") &&
    !effectId.startsWith("fx_unknown") &&
    effectId.length < 32
  );
}

function resolveUnitEffectId(effect: EffectDefinition, cardId: string): string {
  if (effect.name === "母艦") {
    if (cardId === "RS-105") return "dekabase_mothership";
    if (cardId === "RS-076") return "jaguar_mothership";
  }
  const fromName = effect.name ? effectIdFromName(effect.name) : undefined;
  if (!fromName || fromName === effect.id) return fromName ?? effect.id;

  const idSemantic = isSemanticWiredEffectId(effect.id);
  const nameSemantic = isSemanticWiredEffectId(fromName);
  if (idSemantic && !nameSemantic) return effect.id;
  if (nameSemantic && !idSemantic) return fromName;
  if (idSemantic && nameSemantic) {
    if (effect.id.startsWith("grant_")) return effect.id;
    return fromName;
  }
  return fromName ?? effect.id;
}

function toNamedUnitEffect(
  effect: EffectDefinition,
  comboNumber: CardDocument["comboNumber"],
  cardId: string,
): NamedUnitEffect | undefined {
  const text = effect.text ?? "";
  const trigger = toNamedTrigger(effect.trigger, text, comboNumber);
  if (!trigger) return undefined;
  return {
    name: effect.name ?? effect.id,
    effectId: resolveUnitEffectId(effect, cardId),
    text,
    trigger,
  };
}

/** CardDocument → unitEffects 互換ブロック（U4 レジストリ参照用）。 */
export function cardDocumentToUnitEffectBlock(doc: CardDocument): UnitEffectBlock {
  const namedEffects = (doc.effects ?? [])
    .map((effect) => toNamedUnitEffect(effect, doc.comboNumber, doc.id))
    .filter((entry): entry is NamedUnitEffect => entry !== undefined);

  const unnamedText: UnnamedUnitText[] = (doc.unnamedRules ?? []).map((rule) =>
    normalizeUnnamedRuleEntry({
      kind: rule.kind as UnnamedUnitText["kind"],
      text: rule.text,
      rule: rule.rule,
      holdCount: rule.holdCount,
      damage: rule.damage,
      discardCount: rule.discardCount,
      partnerCardIds: rule.partnerCardIds,
      partnerSlotCardIds: rule.partnerSlotCardIds,
    }),
  );

  return {
    rushAdditionalCondition: doc.rushAdditionalCondition,
    unnamedText,
    namedEffects,
    rawText: doc.rawText ?? doc.text ?? "",
  };
}

export function unitEffectBlockHasData(block: UnitEffectBlock): boolean {
  return block.namedEffects.length > 0 || block.unnamedText.length > 0 || !!block.rushAdditionalCondition;
}
