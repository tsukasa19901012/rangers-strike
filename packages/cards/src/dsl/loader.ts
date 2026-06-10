import { allCardsCatalog } from "../catalog";
import { getCardEffect } from "../effects";
import { applyLegend1StarterOverlay } from "./legend1/starter/loadStarterOverlays";
import { applyGeneratedDslOverlay } from "./generated/loadGeneratedOverlays";
import { applyStubDslOverlay } from "./stubs/loadStubOverlays";
import { wikiStubsCatalog, vanillaPromotedCatalog, complexityPromotedCatalog } from "../extendedCatalog";
import type { CardDefinition } from "../schema";
import type { NamedUnitEffect, UnitEffectBlock } from "../effectTaxonomy";
import { getUnitEffectBlock } from "../unitEffects";
import type { CardDocument, EffectDefinition, EffectPrimitive, ImplementationMeta } from "./types";
import { assertValidCardDocument, validateCardDocument } from "./validator";
import {
  buildNamedEffectDsl,
  buildOperationEffectDsl,
  buildUnnamedRuleEffects,
} from "./effectBuilders";

/** レガシー named effect → DSL EffectDefinition */
function namedEffectToDsl(named: NamedUnitEffect, cardId?: string): EffectDefinition {
  return buildNamedEffectDsl(named, cardId);
}

function unitBlockToUnnamedRules(block: UnitEffectBlock): CardDocument["unnamedRules"] {
  return block.unnamedText.map((u) => ({
    kind: u.kind,
    text: u.text,
    rule: u.rule,
    holdCount: u.holdCount,
    damage: u.damage,
    discardCount: u.discardCount,
    partnerCardIds: u.partnerCardIds,
  }));
}

function inferImplementation(card: CardDocument): ImplementationMeta {
  const hasDslPrimitives = card.effects?.some((e) =>
    e.effects.some((p) => p.type !== "fallback_handler"),
  );
  const hasFallbackOnly = card.effects?.every((e) =>
    e.effects.every((p) => p.type === "fallback_handler"),
  );
  const hasLegacyOp = card.type === "operation" && !!card.effectId;

  if (hasDslPrimitives) {
    return { source: "dsl", handler: "interpreter" };
  }
  if (hasLegacyOp && card.effects?.length) {
    return { source: "hybrid", handler: "typescript" };
  }
  if (hasLegacyOp) {
    return { source: "legacy_operation", handler: "typescript" };
  }
  if (hasFallbackOnly && (card.effects?.length ?? 0) > 0) {
    return { source: "legacy_unit_effects", handler: "typescript" };
  }
  if (
    (card.effects?.length ?? 0) === 0 &&
    (card.rushAdditionalCondition || (card.unnamedRules?.length ?? 0) > 0)
  ) {
    return { source: "dsl", handler: "interpreter" };
  }
  if ((card.effects?.length ?? 0) === 0 && !card.effectId) {
    return { source: "dsl", handler: "unimplemented" };
  }
  return { source: "legacy_unit_effects", handler: "typescript" };
}

/** CardDefinition + unitEffects + operation meta を CardDocument に統合 */
export function cardDefinitionToDocument(def: CardDefinition): CardDocument {
  const block = getUnitEffectBlock(def.id);
  const opMeta = getCardEffect(def.id);

  const effects: EffectDefinition[] = [];

  if (block) {
    effects.push(...block.namedEffects.map((n) => namedEffectToDsl(n, def.id)));
    for (const unnamed of block.unnamedText) {
      const built = buildUnnamedRuleEffects(unnamed);
      if (built) effects.push(built);
    }
  }

  if (opMeta && !effects.some((e) => e.id === opMeta.effectId)) {
    const built = buildOperationEffectDsl(def.id, opMeta);
    effects.push(
      built ?? {
        id: opMeta.effectId,
        text: opMeta.text,
        trigger: {
          type: "operation",
          timing: opMeta.kind === "counter" ? "counter" : opMeta.kind === "permanent" ? "resident" : "rush",
        },
        effects: [{ type: "fallback_handler", effectId: opMeta.effectId }],
      },
    );
  }

  const doc: CardDocument = {
    id: def.id,
    name: def.name,
    type: def.type,
    category: def.category,
    rarity: def.rarity,
    expansion: def.expansion,
    powerCost: def.powerCost,
    bp: def.bp,
    sp: def.sp,
    size: def.size,
    comboNumber: def.comboNumber,
    text: def.text,
    rawText: block?.rawText,
    effectId: def.effectId ?? opMeta?.effectId,
    tags: def.tags,
    features: def.features,
    imageUrl: def.imageUrl,
    imageSourceUrl: def.imageSourceUrl,
    rushAdditionalCondition: def.rushAdditionalCondition ?? block?.rushAdditionalCondition,
    unnamedRules: block ? unitBlockToUnnamedRules(block) : undefined,
    effects: effects.length > 0 ? effects : undefined,
  };

  doc.implementation = inferImplementation(doc);
  return doc;
}

/** 単一 JSON オブジェクトを CardDocument として読み込み・検証 */
export function loadCardDocument(raw: unknown): CardDocument {
  const result = validateCardDocument(raw);
  if (!result.ok) {
    const detail = result.issues.map((i) => `${i.path}: ${i.message}`).join("; ");
    throw new Error(`loadCardDocument: validation failed — ${detail}`);
  }
  const doc = raw as CardDocument;
  doc.implementation = doc.implementation ?? inferImplementation(doc);
  return doc;
}

/** 検証のみ（例外を投げない） */
export function tryLoadCardDocument(raw: unknown): {
  document?: CardDocument;
  validation: ReturnType<typeof validateCardDocument>;
} {
  const validation = validateCardDocument(raw);
  if (!validation.ok) {
    return { validation };
  }
  const doc = raw as CardDocument;
  doc.implementation = doc.implementation ?? inferImplementation(doc);
  return { document: doc, validation };
}

/** 既存カタログから全 CardDocument を生成（一括生成 DSL → L1 スターターで上書き） */
export function loadAllCardDocuments(): CardDocument[] {
  return allCardsCatalog.cards.map((def) =>
    applyLegend1StarterOverlay(applyGeneratedDslOverlay(cardDefinitionToDocument(def))),
  );
}

/** 拡張パック単位で読み込み */
export function loadExpansionDocuments(expansion: string): CardDocument[] {
  return allCardsCatalog.cards
    .filter((c) => c.expansion === expansion)
    .map((def) =>
      applyLegend1StarterOverlay(applyGeneratedDslOverlay(cardDefinitionToDocument(def))),
    );
}

/** Wiki スタブカードの CardDocument（プレイ不可・DSL オーバーレイ適用）。 */
export function loadWikiStubDocuments(): CardDocument[] {
  return wikiStubsCatalog.cards.map((def) =>
    applyStubDslOverlay(cardDefinitionToDocument(def)),
  );
}

/** A/E/B 昇格カードの CardDocument（stub DSL オーバーレイ適用）。 */
export function loadVanillaPromotedDocuments(): CardDocument[] {
  return vanillaPromotedCatalog.cards.map((def) =>
    applyStubDslOverlay(cardDefinitionToDocument(def)),
  );
}

/** C/D 昇格カードの CardDocument（stub DSL オーバーレイ適用）。 */
export function loadComplexityPromotedDocuments(): CardDocument[] {
  return complexityPromotedCatalog.cards.map((def) =>
    applyStubDslOverlay(cardDefinitionToDocument(def)),
  );
}

/** プレイ可能 179 + vanilla-promoted + complexity-promoted の CardDocument。 */
export function loadFullPlayableDocuments(): CardDocument[] {
  const core = loadAllCardDocuments();
  const seen = new Set(core.map((c) => c.id));
  const promoted = [
    ...loadVanillaPromotedDocuments(),
    ...loadComplexityPromotedDocuments(),
  ].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  return [...core, ...promoted];
}

/** プレイ可能 179 + Wiki スタブの全 CardDocument。 */
export function loadExtendedCardDocuments(): CardDocument[] {
  const playable = loadAllCardDocuments();
  const playableIds = new Set(playable.map((c) => c.id));
  const stubs = loadWikiStubDocuments().filter((c) => !playableIds.has(c.id));
  return [...playable, ...stubs];
}

/** DSL JSON ファイルのマージ（上書き） */
export function mergeCardDocument(base: CardDocument, overlay: Partial<CardDocument>): CardDocument {
  const merged: CardDocument = {
    ...base,
    ...overlay,
    id: base.id,
    effects: overlay.effects ?? base.effects,
    unnamedRules: overlay.unnamedRules ?? base.unnamedRules,
    tags: overlay.tags ?? base.tags,
    features: overlay.features ?? base.features,
  };
  assertValidCardDocument(merged);
  merged.implementation = overlay.implementation ?? inferImplementation(merged);
  return merged;
}

/** primitives のみを持つ DSL 効果か */
export function isFullyDslEffect(effect: EffectDefinition): boolean {
  return effect.effects.every((p: EffectPrimitive) => p.type !== "fallback_handler");
}

export function listDslReadyCardIds(documents: CardDocument[]): string[] {
  return documents
    .filter((d) => d.effects?.some(isFullyDslEffect))
    .map((d) => d.id);
}
