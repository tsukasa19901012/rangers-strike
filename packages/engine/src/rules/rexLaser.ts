import type { GameState, PlayerId } from "../types/game";
import { getDefinition, unitBp } from "../core/catalog";
import { findInZone, updatePlayer } from "../core/helpers";
import { tryLeaveField } from "./operationCounters";

/** RS-302 レックスレーザー: 印刷BP3000の全ユニットを持ち主パワーへ。 */
export function applyRexLaserOnRush(
  state: GameState,
  phasePlayerId: PlayerId,
): GameState {
  let next = state;
  for (const ownerId of ["player1", "player2"] as const) {
    for (const zone of ["rush", "battle"] as const) {
      const player = next.players[ownerId];
      for (const card of [...player[zone]]) {
        const def = getDefinition(next.definitions, card.cardId);
        if (def?.type !== "unit" || unitBp(def) !== 3000) continue;
        if (!findInZone(player, zone, card.instanceId)) continue;
        const leave = tryLeaveField(next, {
          ownerPlayerId: ownerId,
          instanceId: card.instanceId,
          fromZone: zone,
          toZone: "power",
          leavingCardId: card.cardId,
          phasePlayerId,
        });
        next = leave.state;
      }
    }
  }
  return next;
}
