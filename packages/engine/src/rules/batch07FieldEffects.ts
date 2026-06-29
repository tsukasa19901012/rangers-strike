import type { GameState, PlayerId } from "../types/game";
import { cardName } from "../core/catalog";
import { getCardDslDocument } from "../dsl/effectLookup";
import { buildLogEntry } from "../log/formatLog";
import { startSelectUnitChoice } from "./pendingChoices";

function cardHasAllyRushReturnKeyword(cardId: string): boolean {
  const doc = getCardDslDocument(cardId);
  return (
    doc?.effects?.some((e) =>
      e.effects.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "on_ally_rush_named_return_self_to_hand",
      ),
    ) ?? false
  );
}

function parseAllyRushReturnNames(
  text: string,
): { rushedName: string; selfNames: string[] } | null {
  const orMatch = text.match(
    /自分が「([^」]+)」をラッシュしたとき、自軍エリアに「([^」]+)」(?:または「([^」]+)」)?があれば/,
  );
  if (orMatch) {
    const selfNames = [orMatch[2]!];
    if (orMatch[3]) selfNames.push(orMatch[3]);
    return { rushedName: orMatch[1]!, selfNames };
  }
  const single = text.match(
    /自分が「([^」]+)」をラッシュしたとき、自軍エリアに「([^」]+)」があれば/,
  );
  if (!single) return null;
  return { rushedName: single[1]!, selfNames: [single[2]!] };
}

/** RS-235 等: 味方が指定名をラッシュしたとき、場の自分を手札に戻す。 */
export function tryOnAllyRushNamedReturnSelfToHand(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedCardId: string,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  const rushedName = cardName(state.definitions, rushedCardId);
  const player = state.players[rusherPlayerId];
  const logs: string[] = [];

  for (const zone of ["rush", "battle"] as const) {
    for (const card of player[zone]) {
      if (!cardHasAllyRushReturnKeyword(card.cardId)) continue;
      const effect = getCardDslDocument(card.cardId)?.effects?.find((e) =>
        e.effects.some(
          (p) =>
            p.type === "grant_keyword" &&
            p.keyword === "on_ally_rush_named_return_self_to_hand",
        ),
      );
      const names = parseAllyRushReturnNames(effect?.text ?? "");
      if (!names || names.rushedName !== rushedName) continue;
      const selfName = cardName(state.definitions, card.cardId);
      if (!names.selfNames.includes(selfName)) continue;

      const withChoice = startSelectUnitChoice(state, {
        playerId: rusherPlayerId,
        effectId: "on_ally_rush_return_self",
        sourceCardId: card.cardId,
        sourceInstanceId: rushedInstanceId,
        phasePlayerId,
        validInstanceIds: [card.instanceId],
        unitDestination: "hand",
        optional: true,
      });
      if (withChoice) {
        logs.push(
          buildLogEntry(
            rusherPlayerId,
            "rush_effect",
            card.cardId,
            state.definitions,
            "on_ally_rush_return_self",
          ),
        );
        return { state: withChoice, logs };
      }
    }
  }

  return { state, logs };
}

export function getBattleEntryPowerDiscardCount(cardId: string): number {
  const doc = getCardDslDocument(cardId);
  for (const effect of doc?.effects ?? []) {
    for (const primitive of effect.effects) {
      if (primitive.type !== "grant_keyword") continue;
      const match = primitive.keyword.match(/^require_power_discard_(\d+)_to_battle$/);
      if (match) return Number(match[1]);
    }
  }
  return 0;
}
