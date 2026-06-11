import type { CardInstance, GameState, PlayerId } from "../types/game";
import { getDefinition } from "../core/catalog";
import { updatePlayer } from "../core/helpers";
import { moveFromExile } from "./exile";
import { recordSUnitRecoveredFromDiscardToHand } from "./turnRecoveryTracking";

export type ReanimateDestination = "rush" | "battle" | "hand";

export type ReanimateRequest = {
  playerId: PlayerId;
  instanceId: string;
  from: "discard" | "exile";
  to: ReanimateDestination;
};

/**
 * 捨札／除外から場または手札へ戻す（フレームワーク）。
 * カード個別効果はこのヘルパーを呼び出す。
 */
export function applyReanimate(
  state: GameState,
  request: ReanimateRequest,
): GameState {
  const player = state.players[request.playerId];

  if (request.from === "exile") {
    const exiled = (player.exile ?? []).find((c) => c.instanceId === request.instanceId);
    if (!exiled) return state;
    const def = getDefinition(state.definitions, exiled.cardId);
    if (!def || def.type !== "unit") return state;
    return moveFromExile(state, request.playerId, request.instanceId, request.to);
  }

  const index = player.discard.findIndex((c) => c.instanceId === request.instanceId);
  if (index < 0) return state;
  const card = player.discard[index]!;
  const def = getDefinition(state.definitions, card.cardId);
  if (!def || def.type !== "unit") return state;
  const discard = [...player.discard];
  discard.splice(index, 1);

  let nextState: GameState = {
    ...state,
    ...updatePlayer(state, request.playerId, {
      ...player,
      discard,
      [request.to]: [...player[request.to], card as CardInstance],
    }),
  };
  if (request.from === "discard" && request.to === "hand") {
    nextState = recordSUnitRecoveredFromDiscardToHand(
      nextState,
      request.playerId,
      card.cardId,
    );
  }
  return nextState;
}
