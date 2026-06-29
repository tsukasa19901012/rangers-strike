import type { GameState, PlayerId } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { findInZone } from "../core/helpers";
import { buildLogEntry } from "../log/formatLog";
import { getCardDslDocument } from "../dsl/effectLookup";
import { startSelectHandChoice } from "./pendingChoices";

function cardHasFormationDeploy(cardId: string): boolean {
  const doc = getCardDslDocument(cardId);
  return (
    doc?.effects?.some((effect) =>
      effect.effects.some(
        (p) =>
          p.type === "grant_keyword" &&
          p.keyword === "while_in_field_formation_deploy",
      ),
    ) ?? false
  );
}

/** RS-296 編隊出撃: 航空機ラッシュ時、同名ユニットを手札からラッシュ。 */
export function tryFormationDeployOnRush(
  state: GameState,
  rusherPlayerId: PlayerId,
  rushedInstanceId: string,
  phasePlayerId: PlayerId,
): { state: GameState; logs: string[] } {
  const player = state.players[rusherPlayerId];
  const rushed = findInZone(player, "rush", rushedInstanceId)?.card;
  if (!rushed) return { state, logs: [] };

  const rushedDef = getDefinition(state.definitions, rushed.cardId);
  if (!rushedDef?.features?.includes("航空機")) return { state, logs: [] };

  const rushedName = cardName(state.definitions, rushed.cardId);
  for (const carrier of player.rush) {
    if (carrier.instanceId === rushedInstanceId) continue;
    if (!cardHasFormationDeploy(carrier.cardId)) continue;

    const withChoice = startSelectHandChoice(state, {
      playerId: rusherPlayerId,
      effectId: "geki_e7b7a8",
      sourceCardId: carrier.cardId,
      sourceInstanceId: carrier.instanceId,
      phasePlayerId,
      cardName: rushedName,
      optional: true,
    });
    if (!withChoice) continue;
    return {
      state: withChoice,
      logs: [
        buildLogEntry(
          rusherPlayerId,
          "named_effect",
          carrier.cardId,
          state.definitions,
          "choice:formation_deploy",
        ),
      ],
    };
  }

  return { state, logs: [] };
}
