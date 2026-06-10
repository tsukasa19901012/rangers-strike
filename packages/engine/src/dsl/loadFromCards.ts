import { loadAllCardDocuments } from "@rangers-strike/cards/dsl/loader";
import type { EffectPrimitive, EffectTrigger } from "@rangers-strike/cards/dsl/types";
import type { GameEvent, GameEventType } from "../events/types";
import { registerDslEffect } from "./registry";
import type { DslEffectDefinition, DslPrimitive } from "./types";
import { isDslInterpretableEffect } from "./dslCatalog";
import { isDirectDslTrigger } from "./triggerRouter";

function mapTrigger(trigger: EffectTrigger): GameEventType | "manual" {
  switch (trigger.type) {
    case "on_rush":
      return "UnitRushed";
    case "enter_battle":
      return "UnitEnteredBattle";
    case "on_attack":
      return "BattleDeclared";
    case "on_turn_end":
      return "TurnEnding";
    case "on_strike":
      return "StrikeDeclared";
    case "on_leave":
    case "on_destroy":
      return "UnitLeftZone";
    case "nc":
      return "UnitEnteredBattle";
    default:
      return "manual";
  }
}

function mapPrimitive(primitive: EffectPrimitive): DslPrimitive | null {
  switch (primitive.type) {
    case "draw":
      return { op: "draw", count: primitive.amount };
    case "deal_damage":
      return {
        op: "damage",
        amount: primitive.amount,
        target: primitive.target === "controller" ? "opponent" : "opponent",
      };
    case "modify_bp":
      return { op: "modify_bp", delta: primitive.amount, target: "self" };
    case "grant_keyword":
      if (primitive.keyword === "bp_plus_per_own_damage") {
        return { op: "set_aura_power", targetInstanceId: "trigger_source" };
      }
      return null;
    default:
      return null;
  }
}

function flattenGrantKeywords(primitives: EffectPrimitive[]): EffectPrimitive[] {
  const flat: EffectPrimitive[] = [];
  for (const primitive of primitives) {
    if (primitive.type === "choose") {
      flat.push(...flattenGrantKeywords(primitive.then));
      continue;
    }
    if (primitive.type === "fallback_handler") continue;
    if (primitive.type === "grant_keyword") flat.push(primitive);
  }
  return flat;
}

function eventCardId(event: GameEvent): string | undefined {
  switch (event.type) {
    case "UnitRushed":
      return event.cardId;
    case "UnitEnteredBattle":
      return event.cardId;
    case "BattleDeclared":
      return event.attackerCardId;
    case "StrikeDeclared":
      return event.strikerCardId;
    case "UnitLeftZone":
      return event.cardId;
    default:
      return undefined;
  }
}

/** @rangers-strike/cards の CardDocument から legacy event DSL 効果を registry へ登録。 */
export function loadCardDslEffectsFromCatalog(): number {
  const documents = loadAllCardDocuments();
  let registered = 0;

  for (const doc of documents) {
    if (doc.implementation?.handler !== "interpreter") continue;

    for (const effect of doc.effects ?? []) {
      if (!isDslInterpretableEffect(effect)) continue;
      if (isDirectDslTrigger(effect.trigger.type)) continue;

      const grantKeywords = flattenGrantKeywords(effect.effects);
      const primitives = grantKeywords
        .map(mapPrimitive)
        .filter((p): p is DslPrimitive => p !== null);
      if (primitives.length === 0) continue;

      const definition: DslEffectDefinition = {
        effectId: effect.id,
        sourceCardId: doc.id,
        trigger: mapTrigger(effect.trigger),
        primitives,
      };
      registerDslEffect(definition);
      registered += 1;
    }
  }

  return registered;
}

export { eventCardId };
