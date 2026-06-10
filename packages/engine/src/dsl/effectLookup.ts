import { cardDsl } from "@rangers-strike/cards";
import type {
  EffectDefinition,
  EffectTrigger,
  OperationTiming,
} from "@rangers-strike/cards/dsl/types";

let fullPlayableRegistry: ReturnType<typeof cardDsl.createFullPlayableRegistry> | null = null;

function getFullPlayableRegistry(): ReturnType<typeof cardDsl.createFullPlayableRegistry> {
  if (!fullPlayableRegistry) {
    fullPlayableRegistry = cardDsl.createFullPlayableRegistry();
  }
  return fullPlayableRegistry;
}

/** コア 179 枚 → なければ full-playable（昇格 stub）レジストリへフォールバック。 */
export function getCardDslDocument(cardId: string) {
  const core = cardDsl.getDefaultCardRegistry().getCard(cardId);
  if (core) return core;
  return getFullPlayableRegistry().getCard(cardId);
}

export function isDslInterpreterCard(cardId: string): boolean {
  return getCardDslDocument(cardId)?.implementation?.handler === "interpreter";
}

function triggerMatches(
  effectTrigger: EffectTrigger,
  triggerType: EffectTrigger["type"],
  operationTiming?: OperationTiming,
): boolean {
  if (effectTrigger.type !== triggerType) return false;
  if (triggerType === "operation" && operationTiming) {
    return effectTrigger.type === "operation" && effectTrigger.timing === operationTiming;
  }
  return true;
}

export function listDslEffectsForTrigger(
  cardId: string,
  triggerType: EffectTrigger["type"],
  operationTiming?: OperationTiming,
): EffectDefinition[] {
  const doc = getCardDslDocument(cardId);
  if (!doc?.effects || !isDslInterpreterCard(cardId)) return [];
  return doc.effects.filter((effect) =>
    triggerMatches(effect.trigger, triggerType, operationTiming),
  );
}

export function getDslEffectById(cardId: string, effectId: string): EffectDefinition | undefined {
  const doc = getCardDslDocument(cardId);
  return doc?.effects?.find((effect) => effect.id === effectId);
}
