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
  return enrichNcComboFromTrigger(trigger as NamedEffectTrigger, text);
}

function toNamedUnitEffect(effect: EffectDefinition): NamedUnitEffect | undefined {
  const text = effect.text ?? "";
  const trigger = toNamedTrigger(effect.trigger, text);
  if (!trigger) return undefined;
  return {
    name: effect.name ?? effect.id,
    effectId: effect.id,
    text,
    trigger,
  };
}

/** CardDocument → unitEffects 互換ブロック（U4 レジストリ参照用）。 */
export function cardDocumentToUnitEffectBlock(doc: CardDocument): UnitEffectBlock {
  const namedEffects = (doc.effects ?? [])
    .map(toNamedUnitEffect)
    .filter((entry): entry is NamedUnitEffect => entry !== undefined);

  const unnamedText: UnnamedUnitText[] = (doc.unnamedRules ?? []).map((rule) => ({
    kind: rule.kind as UnnamedUnitText["kind"],
    text: rule.text,
    rule: rule.rule as UnnamedUnitRule | undefined,
    holdCount: rule.holdCount,
    damage: rule.damage,
    discardCount: rule.discardCount,
    partnerCardIds: rule.partnerCardIds,
    partnerSlotCardIds: rule.partnerSlotCardIds,
  }));

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
