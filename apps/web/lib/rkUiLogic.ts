import {
  getCardEffect,
  getFullPlayableCardById,
  inferCatalogTierForCardId,
  isCardDslReady,
  loadCardById,
  resolveCardImageUrl,
  type DeckEntry,
} from "@rangers-strike/cards";
import type { WebUiMechanism } from "./webUiEffectCoverage";
import { estimateCardUiCoverage } from "./estimateCardUiCoverage";
import { estimateDeckWarnings } from "./deckWarnings";
import { resolveOperationDropRoute } from "./webUiOperationRouting";
import type { RkUiTestSpec } from "./rkUiTestSpecs/types";

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

function getDslRushPrimitives(cardId: string) {
  const doc = loadCardById(cardId, inferCatalogTierForCardId(cardId));
  const rush = doc.effects?.find(
    (effect) =>
      effect.trigger.type === "operation" && effect.trigger.timing === "rush",
  );
  return rush?.effects ?? [];
}

function dslRushOpensEffectChoice(cardId: string): boolean {
  const primitives = getDslRushPrimitives(cardId);
  if (primitives[0]?.type === "choose") return true;
  return primitives.some(
    (primitive) =>
      primitive.type === "grant_keyword" ||
      primitive.type === "interpret_effect",
  );
}

/** DSL ready な昇格オペの UI 経路（OPERATION_UI_MECHANISMS 未登録分）。 */
export function resolvePromotedOperationUiMechanisms(cardId: string): WebUiMechanism[] {
  if (!isCardDslReady(cardId)) return [];
  const effect = getCardEffect(cardId);
  if (!effect) return ["passive_engine_only"];

  switch (effect.kind) {
    case "permanent":
      return ["operation_permanent_place", "passive_engine_only"];
    case "counter":
      return ["operation_counter_reaction"];
    case "instant": {
      if (effect.target) return ["operation_drag_target_modal"];
      const mechanisms: WebUiMechanism[] = ["operation_drag_direct"];
      if (dslRushOpensEffectChoice(cardId)) {
        mechanisms.push("effect_choice_modal");
      }
      return mechanisms;
    }
    default:
      return ["passive_engine_only"];
  }
}

export function assertRkCardCatalog(spec: RkUiTestSpec): void {
  const card = getFullPlayableCardById(spec.cardId);
  if (!card) {
    throw new Error(`${spec.cardId}: not in full-playable catalog`);
  }
  if (card.name !== spec.name) {
    throw new Error(`${spec.cardId}: name ${card.name} !== ${spec.name}`);
  }
  if (card.type !== "operation") {
    throw new Error(`${spec.cardId}: expected operation, got ${card.type}`);
  }
  if (card.powerCost !== spec.powerCost) {
    throw new Error(
      `${spec.cardId}: powerCost ${card.powerCost} !== ${spec.powerCost}`,
    );
  }
  if (card.category !== spec.category) {
    throw new Error(
      `${spec.cardId}: category ${card.category} !== ${spec.category}`,
    );
  }
  for (const snippet of spec.textSnippets) {
    if (!card.text?.includes(snippet)) {
      throw new Error(`${spec.cardId}: text missing snippet "${snippet}"`);
    }
  }
  const imageUrl = resolveCardImageUrl(spec.cardId);
  if (!imageUrl) {
    throw new Error(`${spec.cardId}: missing imageUrl`);
  }
}

export function assertRkCardUiCoverage(spec: RkUiTestSpec): void {
  if (!isCardDslReady(spec.cardId)) {
    throw new Error(`${spec.cardId}: expected DSL ready`);
  }
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

export function assertRkCardEffectMeta(spec: RkUiTestSpec): void {
  const effect = getCardEffect(spec.cardId);
  if (!effect) {
    throw new Error(`${spec.cardId}: getCardEffect returned undefined`);
  }
  if (effect.kind !== spec.kind) {
    throw new Error(
      `${spec.cardId}: effect kind ${effect.kind} !== ${spec.kind}`,
    );
  }
}

export function assertRkOperationUiRouting(spec: RkUiTestSpec): void {
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

export function assertRkDslKeywords(spec: RkUiTestSpec): void {
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

export function assertRkDeckBuilder(spec: RkUiTestSpec): void {
  const entries: DeckEntry[] = [{ cardId: spec.cardId, count: 1 }];
  const warnings = estimateDeckWarnings(entries);
  if (warnings.uncertainCardIds.includes(spec.cardId)) {
    throw new Error(`${spec.cardId}: flagged as UI uncertain in deck builder`);
  }
}

export function assertRkCardUiLogic(spec: RkUiTestSpec): void {
  assertRkCardCatalog(spec);
  assertRkCardUiCoverage(spec);
  assertRkCardEffectMeta(spec);
  assertRkOperationUiRouting(spec);
  assertRkDslKeywords(spec);
  assertRkDeckBuilder(spec);
}

