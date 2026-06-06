import type { GameState, PlayerId } from "../../types/game";
import { cardName, getDefinition, isUnit } from "../../core/catalog";
import { findInZone, opponent, removeAt, updatePlayer } from "../../core/helpers";
import { buildLogEntry } from "../../log/formatLog";
import { withTurnModifiers } from "../turnModifiers";

export type OperationOutcome = {
  state: GameState;
  detail: string;
};

/** RS-071: 山札トップを公開；ヒドラー兵をラッシュするか山札の下へ。 */
export function resolveHidoraEgg(
  state: GameState,
  playerId: PlayerId,
): OperationOutcome {
  const player = state.players[playerId];
  if (player.deck.length === 0) {
    return { state, detail: "empty_deck" };
  }

  const [top, rest] = removeAt(player.deck, 0);
  const def = getDefinition(state.definitions, top.cardId);
  const isHidora =
    def?.name === "ヒドラー兵" || top.cardId === "RS-080";

  let nextPlayer;
  if (isHidora) {
    nextPlayer = {
      ...player,
      deck: rest,
      rush: [...player.rush, top],
    };
  } else {
    nextPlayer = {
      ...player,
      deck: [...rest, top],
    };
  }

  const nextState = {
    ...state,
    ...updatePlayer(state, playerId, nextPlayer),
  };

  return {
    state: nextState,
    detail: isHidora
      ? `rush:${cardName(state.definitions, top.cardId)}`
      : `bottom:${cardName(state.definitions, top.cardId)}`,
  };
}

/** RS-072: このターン相手の常駐とカウンターを無効化。 */
export function resolveInfiniteChain(
  state: GameState,
  playerId: PlayerId,
): OperationOutcome {
  const player = state.players[playerId];
  const nextPlayer = withTurnModifiers(player, { infiniteChainActive: true });
  return {
    state: { ...state, ...updatePlayer(state, playerId, nextPlayer) },
    detail: "infinite_chain",
  };
}

export function hidoraEggLog(
  playerId: PlayerId,
  detail: string,
  definitions: GameState["definitions"],
): string {
  return buildLogEntry(playerId, "operation_effect", "RS-071", definitions, detail);
}

export function infiniteChainLog(
  playerId: PlayerId,
  definitions: GameState["definitions"],
): string {
  return buildLogEntry(playerId, "operation_effect", "RS-072", definitions, "infinite_chain");
}
