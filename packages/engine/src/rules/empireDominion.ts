import type { GameState, PlayerId } from "../types/game";
import { cardName, getDefinition } from "../core/catalog";
import { opponent, updatePlayer } from "../core/helpers";
import { tryLeaveField } from "./operationCounters";

/** RS-365 帝国の掌握: 手札公開→同名敵ユニット撃破→手札全捨→撃破数SP+1。 */
export function applyEmpireDominionEnterBattle(
  state: GameState,
  playerId: PlayerId,
  enteringInstanceId: string,
  phasePlayerId: PlayerId,
): GameState {
  const player = state.players[playerId];
  const handNames = new Set(
    player.hand.map((c) => cardName(state.definitions, c.cardId)),
  );
  if (handNames.size === 0) {
    return state;
  }

  const enemyId = opponent(playerId);
  let next = state;
  let destroyCount = 0;

  for (const zone of ["rush", "battle"] as const) {
    const enemy = next.players[enemyId];
    for (const card of [...enemy[zone]]) {
      const name = cardName(next.definitions, card.cardId);
      if (!handNames.has(name)) continue;
      const def = getDefinition(next.definitions, card.cardId);
      if (def?.type !== "unit") continue;
      const leave = tryLeaveField(next, {
        ownerPlayerId: enemyId,
        instanceId: card.instanceId,
        fromZone: zone,
        toZone: "discard",
        leavingCardId: card.cardId,
        phasePlayerId,
      });
      next = leave.state;
      destroyCount += 1;
    }
  }

  const updatedPlayer = next.players[playerId];
  next = {
    ...next,
    ...updatePlayer(next, playerId, {
      ...updatedPlayer,
      hand: [],
      discard: [...updatedPlayer.discard, ...updatedPlayer.hand],
      battle: updatedPlayer.battle.map((c) =>
        c.instanceId === enteringInstanceId
          ? { ...c, spModifier: (c.spModifier ?? 0) + destroyCount }
          : c,
      ),
    }),
  };

  return next;
}
