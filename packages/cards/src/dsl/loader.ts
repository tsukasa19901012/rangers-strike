import type { CatalogTier } from "../catalog/tiers";
import { listCardIds } from "../catalog/unifiedCatalog";
import type { CardDefinition } from "../schema";
import { applyCardOverride } from "./overrides/loadCardOverrides";
import {
  inferImplementation,
  isFullyDslEffect,
  mergeCardDocument,
} from "./cardDocumentMerge";
import {
  definitionToCardDocumentShell,
  getDslStubPartial,
  inferCatalogTierForCardId,
  resolveCatalogDefinition,
} from "./loadDslStub";
import type { CardDocument } from "./types";
import { validateCardDocument } from "./validator";

export { cardDefinitionToDocument } from "./legacyCardDocument";
export {
  inferImplementation,
  isFullyDslEffect,
  mergeCardDocument,
} from "./cardDocumentMerge";

function patchCatalogDistributionFields(
  doc: CardDocument,
  def: CardDefinition,
): CardDocument {
  return mergeCardDocument(doc, {
    imageUrl: def.imageUrl,
    imageSourceUrl: def.imageSourceUrl,
    expansion: def.expansion,
  });
}

function buildCardDocumentFromCatalogAndDsl(
  def: CardDefinition,
  stub: Partial<CardDocument>,
): CardDocument {
  if (stub.effects && stub.implementation) {
    const fromStub = loadCardDocument({ ...stub, id: def.id });
    return patchCatalogDistributionFields(fromStub, def);
  }

  const shell = definitionToCardDocumentShell(def);
  const merged = mergeCardDocument(shell, stub);
  return patchCatalogDistributionFields(merged, def);
}

/**
 * U3/U4 — 単一ローダー入口: カタログ stats + dsl-stubs + overrides。
 */
export function loadCardById(cardId: string, tier?: CatalogTier): CardDocument {
  const resolved = resolveCatalogDefinition(cardId, tier);
  if (!resolved) {
    throw new Error(`loadCardById: unknown card id ${cardId}`);
  }

  const { definition } = resolved;
  const stub = getDslStubPartial(cardId);

  if (stub) {
    const doc = buildCardDocumentFromCatalogAndDsl(definition, stub);
    const withOverride = applyCardOverride(doc);
    const validation = validateCardDocument(withOverride);
    if (validation.ok) {
      withOverride.implementation =
        withOverride.implementation ?? inferImplementation(withOverride);
      return withOverride;
    }
  }

  const shell = definitionToCardDocumentShell(definition);
  const withOverride = applyCardOverride(shell);
  withOverride.implementation =
    withOverride.implementation ?? inferImplementation(withOverride);
  return withOverride;
}

/** tier 内の全 CardDocument を読み込む。 */
export function loadCards(tier: CatalogTier = "full-playable"): CardDocument[] {
  return listCardIds(tier).map((id) => loadCardById(id, tier));
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

/** @deprecated `loadCards("core")` を使用 */
export function loadAllCardDocuments(): CardDocument[] {
  return loadCards("core");
}

/** 拡張パック単位で読み込み */
export function loadExpansionDocuments(expansion: string): CardDocument[] {
  return loadCards("core").filter((card) => card.expansion === expansion);
}

/** @deprecated `loadCards("wiki-stubs")` を使用 */
export function loadWikiStubDocuments(): CardDocument[] {
  return loadCards("wiki-stubs");
}

/** @deprecated `loadCards("vanilla-promoted")` を使用 */
export function loadVanillaPromotedDocuments(): CardDocument[] {
  return loadCards("vanilla-promoted");
}

/** @deprecated `loadCards("complexity-promoted")` を使用 */
export function loadComplexityPromotedDocuments(): CardDocument[] {
  return loadCards("complexity-promoted");
}

/** @deprecated `loadCards("full-playable")` を使用 */
export function loadFullPlayableDocuments(): CardDocument[] {
  return loadCards("full-playable");
}

/** @deprecated `loadCards("extended")` を使用 */
export function loadExtendedCardDocuments(): CardDocument[] {
  return loadCards("extended");
}

export function listDslReadyCardIds(documents: CardDocument[]): string[] {
  return documents
    .filter((d) => d.effects?.some(isFullyDslEffect))
    .map((d) => d.id);
}

export { inferCatalogTierForCardId } from "./loadDslStub";
