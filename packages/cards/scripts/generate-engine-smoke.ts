/**
 * promoted カードの engine interpreter smoke テスト生成（M14/M15）。
 *
 * Usage:
 *   npm run generate-engine-smoke
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { complexityPromotedCatalog, vanillaPromotedCatalog } from "../src/extendedCatalog";
import { createFullPlayableRegistry } from "../src/dsl/registry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsRoot = join(__dirname, "..");
const engineOut = join(cardsRoot, "../engine/src/generated/promotedInterpreter.smoke.generated.test.ts");
const manifestPath = join(cardsRoot, "pipeline/data/engine-smoke-manifest.json");

function collectSmokeCardIds(): {
  grantKeyword: string[];
  effectDelegate: string[];
  actionPrimitive: string[];
} {
  const registry = createFullPlayableRegistry();
  const promotedIds = new Set([
    ...vanillaPromotedCatalog.cards.map((c) => c.id),
    ...complexityPromotedCatalog.cards.map((c) => c.id),
  ]);
  const grantKeyword: string[] = [];
  const effectDelegate: string[] = [];
  const actionPrimitive: string[] = [];

  for (const card of registry.listCards()) {
    if (!promotedIds.has(card.id)) continue;
    if (card.implementation?.handler !== "interpreter") continue;
    const hasGrant = card.effects?.some((e) =>
      e.effects.some(
        (p) => p.type === "grant_keyword" && !p.keyword?.startsWith("effect_"),
      ),
    );
    const hasDelegate = card.effects?.some((e) =>
      e.effects.every(
        (p) => p.type === "grant_keyword" && p.keyword?.startsWith("effect_"),
      ),
    );
    const hasAction = card.effects?.some((e) =>
      e.effects.some((p) =>
        ["draw", "modify_bp", "choose", "deal_damage", "move", "discard"].includes(p.type),
      ),
    );
    if (hasGrant && grantKeyword.length < 40) grantKeyword.push(card.id);
    if (hasDelegate && effectDelegate.length < 40) effectDelegate.push(card.id);
    if (hasAction && actionPrimitive.length < 40) actionPrimitive.push(card.id);
  }

  return { grantKeyword, effectDelegate, actionPrimitive };
}

function main(): void {
  const registry = createFullPlayableRegistry();
  const { grantKeyword, effectDelegate, actionPrimitive } = collectSmokeCardIds();
  const promotedDslReady = registry
    .listDslReady()
    .filter(
      (id) =>
        vanillaPromotedCatalog.cards.some((c) => c.id === id) ||
        complexityPromotedCatalog.cards.some((c) => c.id === id),
    ).length;

  const content = `/**
 * Auto-generated promoted interpreter smoke (M14/M15)
 * grant_keyword: ${grantKeyword.length} | effect_delegate: ${effectDelegate.length} | action_primitive: ${actionPrimitive.length}
 */
import { describe, it, expect } from "vitest";
import { cardDsl } from "@rangers-strike/cards";
import { interpretEffectPrimitives } from "../dsl/cardInterpreter";
import { createTestState, inst } from "../testing/fixtures";
import type { CardDefinition } from "@rangers-strike/cards";

const GRANT_KEYWORD_IDS = ${JSON.stringify(grantKeyword, null, 2)} as const;
const EFFECT_DELEGATE_IDS = ${JSON.stringify(effectDelegate, null, 2)} as const;
const ACTION_PRIMITIVE_IDS = ${JSON.stringify(actionPrimitive, null, 2)} as const;

function toDefinition(doc: NonNullable<ReturnType<typeof cardDsl.createFullPlayableRegistry>["getCard"]>): CardDefinition {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    category: doc.category,
    rarity: doc.rarity,
    expansion: doc.expansion,
    powerCost: doc.powerCost,
    bp: doc.bp,
    sp: doc.sp,
    size: doc.size,
    text: doc.text,
    features: doc.features,
  };
}

function runEffects(cardId: string, effectIds: string[]) {
  const registry = cardDsl.createFullPlayableRegistry();
  const doc = registry.getCard(cardId);
  expect(doc).toBeDefined();
  const battle = inst(cardId, "u1");
  const state = createTestState({
    phase: "battle",
    player1: { battle: [battle] },
  });
  state.definitions[cardId] = toDefinition(doc!);
  for (const effectId of effectIds) {
    const effect = doc!.effects?.find((e) => e.id === effectId);
    expect(effect).toBeDefined();
    expect(() =>
      interpretEffectPrimitives(state, {
        effectId: effect!.id,
        sourceCardId: cardId,
        playerId: "player1",
        phasePlayerId: "player1",
        triggerSourceInstanceId: battle.instanceId,
        discardOperation: false,
      }, effect!.effects),
    ).not.toThrow();
  }
}

describe("promoted interpreter smoke", () => {
  const registry = cardDsl.createFullPlayableRegistry();

  it("has promoted dslReady cards", () => {
    expect(${promotedDslReady}).toBeGreaterThan(1000);
  });

  for (const cardId of GRANT_KEYWORD_IDS) {
    it(\`\${cardId} grant_keyword primitives\`, () => {
      const doc = registry.getCard(cardId);
      const grantEffects = (doc?.effects ?? []).filter((e) =>
        e.effects.some((p) => p.type === "grant_keyword"),
      );
      expect(grantEffects.length).toBeGreaterThan(0);
      runEffects(cardId, grantEffects.map((e) => e.id));
    });
  }

  for (const cardId of EFFECT_DELEGATE_IDS) {
    it(\`\${cardId} effect_delegate primitives\`, () => {
      const doc = registry.getCard(cardId);
      const delegateEffects = (doc?.effects ?? []).filter((e) =>
        e.effects.every(
          (p) => p.type === "grant_keyword" && p.keyword?.startsWith("effect_"),
        ),
      );
      expect(delegateEffects.length).toBeGreaterThan(0);
      runEffects(cardId, delegateEffects.map((e) => e.id));
    });
  }

  for (const cardId of ACTION_PRIMITIVE_IDS) {
    it(\`\${cardId} action primitives\`, () => {
      const doc = registry.getCard(cardId);
      const actionEffects = (doc?.effects ?? []).filter((e) =>
        e.effects.some((p) =>
          ["draw", "modify_bp", "choose", "deal_damage", "move", "discard"].includes(p.type),
        ),
      );
      expect(actionEffects.length).toBeGreaterThan(0);
      runEffects(cardId, actionEffects.map((e) => e.id));
    });
  }
});
`;

  mkdirSync(dirname(engineOut), { recursive: true });
  writeFileSync(engineOut, content);
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        promotedDslReady,
        grantKeywordSamples: grantKeyword.length,
        effectDelegateSamples: effectDelegate.length,
        actionPrimitiveSamples: actionPrimitive.length,
        grantKeyword,
        effectDelegate,
        actionPrimitive,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `→ ${engineOut} (grant=${grantKeyword.length}, delegate=${effectDelegate.length}, action=${actionPrimitive.length})`,
  );
  console.log(`→ ${manifestPath}`);
}

main();
