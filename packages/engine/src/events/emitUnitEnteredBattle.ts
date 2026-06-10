import type { CardInstance, EnterBattleResumeFrom, GameState, PlayerId } from "../types/game";
import type { ComboOutcome } from "../rules/comboTypes";
import { buildUnitEnteredBattleEvent } from "./builders";
import { EventQueue } from "./EventQueue";
import { getEngineEventDispatcher } from "./globalDispatcher";
import { resolveUntilBlocked } from "./EventResolver";

export function emitUnitEnteredBattleEffects(
  state: GameState,
  playerId: PlayerId,
  card: CardInstance,
  battlePosition: number,
  options?: {
    battleBeforeEnter?: CardInstance[];
    rideOff?: boolean;
    resumeFrom?: EnterBattleResumeFrom;
  },
): ComboOutcome {
  const battleBeforeEnterInstanceIds =
    options?.battleBeforeEnter?.map((c) => c.instanceId) ??
    state.players[playerId].battle
      .filter((c) => c.instanceId !== card.instanceId)
      .map((c) => c.instanceId);

  const queue = new EventQueue();
  queue.enqueue(
    buildUnitEnteredBattleEvent({
      state,
      phasePlayerId: playerId,
      playerId,
      instanceId: card.instanceId,
      cardId: card.cardId,
      battlePosition,
      battleBeforeEnterInstanceIds,
      rideOff: options?.rideOff,
      resumeFrom: options?.resumeFrom,
    }),
  );

  const resolved = resolveUntilBlocked(state, queue, getEngineEventDispatcher());
  return {
    state: resolved.state,
    logs: resolved.logs,
    enterResumeFrom: resolved.enterResumeFrom,
  };
}
