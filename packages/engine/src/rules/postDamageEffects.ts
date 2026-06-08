import type { GameState, PlayerId } from "../types/game";
import { checkReturnToHandAt6Damage } from "./legend2/destroyEffects";

/** ダメージ適用直後に発動するトリガー（RS-112 等）。 */
export function applyPostDamageTriggers(
  state: GameState,
  damagedPlayerId: PlayerId,
): GameState {
  const rs112 = checkReturnToHandAt6Damage(state, damagedPlayerId);
  if (rs112.logs.length === 0) return rs112.state;
  return {
    ...rs112.state,
    log: [...rs112.state.log, ...rs112.logs],
  };
}
