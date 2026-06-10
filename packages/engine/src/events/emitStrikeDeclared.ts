import type { GameState, PendingStrike } from "../types/game";
import { findInZone } from "../core/helpers";
import { buildStrikeDeclaredEvent } from "./builders";
import { getEngineEventDispatcher } from "./globalDispatcher";

/** ストライク宣言時に StrikeDeclared を発火（反応窓は呼び出し元が Pending で開く）。 */
export function emitStrikeDeclared(
  state: GameState,
  pending: PendingStrike,
): GameState {
  const striker = findInZone(
    state.players[pending.strikerPlayerId],
    "battle",
    pending.strikerInstanceId,
  );
  const event = buildStrikeDeclaredEvent({
    state,
    phasePlayerId: pending.battlePhasePlayer,
    strikerPlayerId: pending.strikerPlayerId,
    strikerInstanceId: pending.strikerInstanceId,
    strikerCardId: striker?.card.cardId ?? pending.strikerInstanceId,
    damage: pending.damage,
  });
  const outcome = getEngineEventDispatcher().dispatch(event, state);
  return outcome.state;
}
