import type { RushAdditionalCondition } from "@rangers-strike/cards";
import { isSmallUnit, resolveRushAdditionalCondition } from "@rangers-strike/cards";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { cardHasGrantKeyword } from "../dsl/promotedKeywordBridge";
import { cardHasKeyword } from "../keywords/cardKeywords";
import { playerHasAllyWithLeadOnField } from "./callLead";

const CONDITION_CHANGE =
  /※このカードの追加条件は、(.+?)のとき、次のように変更される(?:⇒|→)\s*(.+?)(?:。|\s*【)/;

function countDiscardUnitCardsMatching(
  player: GameState["players"][PlayerId],
  definitions: GameState["definitions"],
  predicate: (cardId: string) => boolean,
): number {
  return player.discard.filter((card) => {
    const def = definitions[card.cardId];
    return def?.type === "unit" && predicate(card.cardId);
  }).length;
}

function rushConditionGateMet(
  state: GameState,
  playerId: PlayerId,
  gateText: string,
): boolean {
  const player = state.players[playerId];

  const discardCountMatch = gateText.match(/自軍捨札が(\d+)枚以上/);
  if (discardCountMatch) {
    return player.discard.length >= Number(discardCountMatch[1]);
  }

  const leadSDiscardMatch = gateText.match(
    /自軍捨札にリードを持つSユニットのカードが(\d+)枚以上/,
  );
  if (leadSDiscardMatch) {
    const count = countDiscardUnitCardsMatching(player, state.definitions, (cardId) => {
      if (!isSmallUnit(state.definitions, cardId)) return false;
      for (const cat of ["MA", "ET", "OT", "WB", "DA"] as const) {
        if (cardHasGrantKeyword(cardId, `lead_${cat}`)) return true;
      }
      const def = state.definitions[cardId];
      return !!def?.text?.includes("リード");
    });
    return count >= Number(leadSDiscardMatch[1]);
  }

  const wingSDiscardMatch = gateText.match(
    /自軍捨札にウイングを持つSユニットのカードが(\d+)枚以上/,
  );
  if (wingSDiscardMatch) {
    const count = countDiscardUnitCardsMatching(player, state.definitions, (cardId) => {
      return (
        isSmallUnit(state.definitions, cardId) &&
        cardHasKeyword(state.definitions, cardId, "wing")
      );
    });
    return count >= Number(wingSDiscardMatch[1]);
  }

  return false;
}

function parseAlternateConditionText(text: string): RushAdditionalCondition | undefined {
  const holdMatch = text.match(/追加で自軍コマンドを(\d+)つホールド/);
  if (holdMatch) {
    return {
      conditionId: "hold_extra_command",
      text: holdMatch[0]!,
    };
  }

  const namedDiscard = text.match(/自軍「([^」]+)」1体を捨札に/);
  if (namedDiscard) {
    return {
      conditionId: "discard_named_unit",
      text,
      partnerName: namedDiscard[1],
    };
  }

  return undefined;
}

/** ゲーム状態に応じた実効ラッシュ追加条件（※追加条件変更 等）。 */
export function effectiveRushAdditionalCondition(
  state: Pick<GameState, "players" | "definitions">,
  playerId: PlayerId,
  cardId: string,
  definition?: CardDefinition,
): RushAdditionalCondition | undefined {
  const base = resolveRushAdditionalCondition(cardId, definition);
  const text = definition?.text ?? state.definitions[cardId]?.text ?? "";
  const changeMatch = text.match(CONDITION_CHANGE);
  if (!changeMatch || !base) return base;

  const gateText = changeMatch[1]!.trim();
  const overrideText = changeMatch[2]!.trim();
  if (!rushConditionGateMet(state as GameState, playerId, gateText)) return base;

  return parseAlternateConditionText(overrideText) ?? base;
}

export function effectiveBattleEntryHoldCount(
  state: GameState,
  playerId: PlayerId,
  cardId: string,
  rawHoldCount: number,
): number {
  if (rawHoldCount <= 0) return 0;

  const def = state.definitions[cardId];
  const text = def?.text ?? "";
  if (!text.includes("リード") || !text.includes("無効")) return rawHoldCount;
  if (!cardHasGrantKeyword(cardId, "require_command_hold_entry")) return rawHoldCount;

  const leadMatch = text.match(/リード(MA|ET|DA|WB|OT)を持つ自軍ユニットがあるとき無効/);
  const categories = leadMatch ? [leadMatch[1] as "MA" | "ET" | "DA" | "WB" | "OT"] : undefined;

  if (playerHasAllyWithLeadOnField(state, playerId, categories)) {
    return 0;
  }

  return rawHoldCount;
}
