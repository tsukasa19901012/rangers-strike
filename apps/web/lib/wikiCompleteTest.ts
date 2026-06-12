import {
  getCardEffect,
  getFullPlayableCardById,
  inferCatalogTierForCardId,
  isCardDslReady,
  loadCardById,
  resolveCardImageUrl,
  type DeckEntry,
} from "@rangers-strike/cards";
import { estimateCardUiCoverage } from "./estimateCardUiCoverage";
import { estimateDeckWarnings } from "./deckWarnings";
import { resolveOperationDropRoute } from "./webUiOperationRouting";
import {
  resolvePromotedOperationUiMechanisms,
} from "./rkUiLogic";
import type { WikiCardCompleteSpec } from "./wikiTestSpecs/types";

function listDslGrantKeywords(cardId: string): string[] {
  const doc = loadCardById(cardId, inferCatalogTierForCardId(cardId));
  const keywords = new Set<string>();
  for (const effect of doc.effects ?? []) {
    for (const primitive of effect.effects) {
      if (primitive.type === "grant_keyword") {
        keywords.add(primitive.keyword);
      }
    }
  }
  return [...keywords];
}

function normalizeCategory(category: string | string[]): string {
  return Array.isArray(category) ? category.join(",") : category;
}

function resolveCatalogText(cardId: string): string {
  const card = getFullPlayableCardById(cardId);
  if (card?.text) return card.text;
  const doc = loadCardById(cardId, inferCatalogTierForCardId(cardId));
  return doc.text ?? doc.rawText ?? "";
}

export function assertWikiCardCatalog(spec: WikiCardCompleteSpec): void {
  const card = getFullPlayableCardById(spec.cardId);
  if (!card) {
    throw new Error(`${spec.cardId}: not in full-playable catalog`);
  }
  const cardText = resolveCatalogText(spec.cardId);
  if (card.name !== spec.name) {
    throw new Error(`${spec.cardId}: name ${card.name} !== ${spec.name}`);
  }
  if (card.type !== spec.cardType) {
    throw new Error(`${spec.cardId}: type ${card.type} !== ${spec.cardType}`);
  }
  if (card.powerCost !== spec.powerCost) {
    throw new Error(
      `${spec.cardId}: powerCost ${card.powerCost} !== ${spec.powerCost}`,
    );
  }
  if (normalizeCategory(card.category) !== normalizeCategory(spec.category)) {
    throw new Error(
      `${spec.cardId}: category ${normalizeCategory(card.category)} !== ${normalizeCategory(spec.category)}`,
    );
  }
  if (spec.bp !== undefined && card.bp !== spec.bp) {
    throw new Error(`${spec.cardId}: bp ${card.bp} !== ${spec.bp}`);
  }
  if (spec.size !== undefined && card.size !== spec.size) {
    throw new Error(`${spec.cardId}: size ${card.size} !== ${spec.size}`);
  }
  if (cardText.length > 0) {
    for (const snippet of spec.textSnippets) {
      if (!cardText.includes(snippet)) {
        throw new Error(`${spec.cardId}: text missing snippet "${snippet}"`);
      }
    }
  }
  const imageUrl = resolveCardImageUrl(spec.cardId);
  if (!imageUrl) {
    throw new Error(`${spec.cardId}: missing imageUrl`);
  }
}

export function assertWikiCardDslReady(spec: WikiCardCompleteSpec): void {
  if (!isCardDslReady(spec.cardId)) {
    throw new Error(`${spec.cardId}: expected DSL ready (complete version)`);
  }
}

export function assertWikiCardUiCoverage(spec: WikiCardCompleteSpec): void {
  assertWikiCardDslReady(spec);
  const coverage = estimateCardUiCoverage(spec.cardId);
  if (coverage.tier !== "promoted-ui") {
    throw new Error(
      `${spec.cardId}: expected promoted-ui, got ${coverage.tier} (${coverage.badges.join(", ")})`,
    );
  }
  if (coverage.badges.includes("DSL未実装")) {
    throw new Error(`${spec.cardId}: should not be DSL未実装`);
  }
}

export function assertWikiOperationEffectMeta(spec: WikiCardCompleteSpec): void {
  if (spec.cardType !== "operation" || !spec.operationKind) return;
  const effect = getCardEffect(spec.cardId);
  if (!effect) {
    throw new Error(`${spec.cardId}: getCardEffect returned undefined`);
  }
  if (effect.kind !== spec.operationKind) {
    throw new Error(
      `${spec.cardId}: effect kind ${effect.kind} !== ${spec.operationKind}`,
    );
  }
}

export function assertWikiOperationUiRouting(spec: WikiCardCompleteSpec): void {
  if (spec.cardType !== "operation" || !spec.expectedMechanisms?.length) return;
  const mechanisms = resolvePromotedOperationUiMechanisms(spec.cardId);
  for (const expected of spec.expectedMechanisms) {
    if (!mechanisms.includes(expected)) {
      throw new Error(
        `${spec.cardId}: missing UI mechanism ${expected} (have ${mechanisms.join(", ")})`,
      );
    }
  }
  if (spec.expectedDropRoute && spec.expectedDropRoute !== "n/a") {
    const route = resolveOperationDropRoute(spec.cardId);
    if (route.kind !== spec.expectedDropRoute) {
      throw new Error(
        `${spec.cardId}: drop route ${route.kind} !== ${spec.expectedDropRoute}`,
      );
    }
  }
}

export function assertWikiDslKeywords(spec: WikiCardCompleteSpec): void {
  if (!spec.expectedDslKeywords?.length) return;
  const keywords = listDslGrantKeywords(spec.cardId);
  for (const expected of spec.expectedDslKeywords) {
    if (!keywords.includes(expected)) {
      throw new Error(
        `${spec.cardId}: missing DSL keyword ${expected} (have ${keywords.join(", ")})`,
      );
    }
  }
}

export function assertWikiDeckBuilder(spec: WikiCardCompleteSpec): void {
  const entries: DeckEntry[] = [{ cardId: spec.cardId, count: 1 }];
  const warnings = estimateDeckWarnings(entries);
  if (warnings.uncertainCardIds.includes(spec.cardId)) {
    throw new Error(`${spec.cardId}: flagged as UI uncertain in deck builder`);
  }
}

export function assertWikiCardComplete(spec: WikiCardCompleteSpec): void {
  assertWikiCardCatalog(spec);
  assertWikiCardUiCoverage(spec);
  assertWikiDslKeywords(spec);
  assertWikiDeckBuilder(spec);
  if (spec.cardType === "operation") {
    assertWikiOperationEffectMeta(spec);
    assertWikiOperationUiRouting(spec);
  }
}
