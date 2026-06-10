import {
  getCardById,
  getCardEffect,
  getUnitEffectBlock,
  isCardDslReady,
  isCardDslUnimplemented,
  resolvePlayableCard,
} from "@rangers-strike/cards";
import { getCardImplementationStatus } from "./cardImplementationStatus";

export type CardUiCoverage = {
  tier: "core" | "promoted-dsl" | "promoted-ui" | "promoted-partial";
  badges: string[];
};

function hasUiWiring(cardId: string): boolean {
  if (getCardEffect(cardId)) return true;
  const unitEffects = getUnitEffectBlock(cardId);
  return (
    (unitEffects?.namedEffects.length ?? 0) > 0 ||
    (unitEffects?.unnamedText.length ?? 0) > 0
  );
}

export function estimateCardUiCoverage(cardId: string): CardUiCoverage {
  const known = getCardById(cardId) ?? resolvePlayableCard(cardId);
  if (!known) {
    return { tier: "promoted-partial", badges: [] };
  }

  if (isCardDslUnimplemented(cardId)) {
    return { tier: "promoted-partial", badges: ["DSL未実装"] };
  }

  if (getCardById(cardId)) {
    const badges = ["Core"];
    if (hasUiWiring(cardId)) badges.push("UI配線");
    return { tier: "core", badges };
  }

  if (isCardDslReady(cardId) && hasUiWiring(cardId)) {
    return { tier: "promoted-dsl", badges: ["DSL対応"] };
  }

  if (isCardDslReady(cardId) && getCardImplementationStatus(cardId) === "ui-uncertain") {
    return { tier: "promoted-partial", badges: ["DSL対応", "UI未確認"] };
  }

  if (getCardImplementationStatus(cardId) === "ui-uncertain") {
    return { tier: "promoted-partial", badges: ["UI未確認"] };
  }

  return { tier: "promoted-partial", badges: [] };
}
