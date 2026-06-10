/**
 * Auto-generated promoted interpreter smoke (M14/M15)
 * grant_keyword: 40 | interpret_effect: 40 | action_primitive: 40
 */
import { describe, it, expect } from "vitest";
import { cardDsl } from "@rangers-strike/cards";
import { interpretEffectPrimitives } from "../dsl/cardInterpreter";
import { createTestState, inst } from "../testing/fixtures";
import type { CardDefinition } from "@rangers-strike/cards";

const GRANT_KEYWORD_IDS = [
  "PK-001",
  "PK-003",
  "PK-009",
  "PK-014",
  "PR-001",
  "PR-010",
  "PR-011",
  "RK-013",
  "RK-017",
  "RK-030",
  "RK-033",
  "RK-063",
  "RK-076",
  "RK-079",
  "RK-088",
  "RK-097",
  "RK-099",
  "RK-102",
  "RK-104",
  "RK-108",
  "RK-118",
  "RK-126",
  "RK-130",
  "RK-132",
  "RK-133",
  "RK-134",
  "RK-152",
  "RK-159",
  "RK-162",
  "RK-163",
  "RK-164",
  "RK-166",
  "RK-168",
  "RK-169",
  "RK-175",
  "RK-178",
  "RK-181",
  "RK-184",
  "RK-186",
  "RK-191"
] as const;
const INTERPRET_EFFECT_IDS = [
  "BK-009",
  "BK-010",
  "BK-011",
  "BK-012",
  "BK-013",
  "BK-015",
  "BK-016",
  "BK-017",
  "BK-018",
  "BK-019",
  "RK-002",
  "RK-007",
  "RK-018",
  "RK-019",
  "RK-020",
  "RK-030",
  "RK-077",
  "RK-083",
  "RK-084",
  "RK-087",
  "RK-089",
  "RK-108",
  "RK-118",
  "RK-126",
  "RK-132",
  "RK-159",
  "RK-163",
  "RK-166",
  "RK-168",
  "RK-171",
  "RK-173",
  "RK-181",
  "RK-184",
  "RK-186",
  "RK-191",
  "RK-192",
  "RK-194",
  "RK-195",
  "RK-196",
  "RK-197"
] as const;
const ACTION_PRIMITIVE_IDS = [
  "BK-001",
  "BK-002",
  "BK-003",
  "BK-004",
  "BK-005",
  "BK-006",
  "BK-007",
  "BK-008",
  "BK-014",
  "PK-013",
  "PR-025",
  "RK-005",
  "RK-096",
  "RK-097",
  "RK-102",
  "RK-134",
  "RK-162",
  "RK-169",
  "RK-174",
  "RK-178",
  "RK-198",
  "RK-222",
  "RK-226",
  "RK-245",
  "RK-252",
  "RK-254",
  "RK-278",
  "RK-313",
  "RK-322",
  "RK-331",
  "RM-009",
  "RM-010",
  "RS-231",
  "RS-333",
  "RS-334",
  "RS-349",
  "RS-438",
  "RS-523",
  "RS-526",
  "RS-528"
] as const;

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
    expect(1670).toBeGreaterThan(1000);
  });

  for (const cardId of GRANT_KEYWORD_IDS) {
    it(`${cardId} grant_keyword primitives`, () => {
      const doc = registry.getCard(cardId);
      const grantEffects = (doc?.effects ?? []).filter((e) =>
        e.effects.some((p) => p.type === "grant_keyword"),
      );
      expect(grantEffects.length).toBeGreaterThan(0);
      runEffects(cardId, grantEffects.map((e) => e.id));
    });
  }

  for (const cardId of INTERPRET_EFFECT_IDS) {
    it(`${cardId} interpret_effect primitives`, () => {
      const doc = registry.getCard(cardId);
      const interpretEffects = (doc?.effects ?? []).filter((e) =>
        e.effects.every((p) => p.type === "interpret_effect"),
      );
      expect(interpretEffects.length).toBeGreaterThan(0);
      runEffects(cardId, interpretEffects.map((e) => e.id));
    });
  }

  for (const cardId of ACTION_PRIMITIVE_IDS) {
    it(`${cardId} action primitives`, () => {
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
