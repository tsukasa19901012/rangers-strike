import type { CardInstance, GameState } from "../../types/game";
import type { ComboOutcome } from "../../rules/comboTypes";
import type { EventListener, UnitEnteredBattleEvent } from "../types";

export type EnterBattleEffectsImpl = (
  state: GameState,
  playerId: UnitEnteredBattleEvent["playerId"],
  card: CardInstance,
  battlePosition: number,
  options?: {
    battleBeforeEnter?: CardInstance[];
    rideOff?: boolean;
    resumeFrom?: UnitEnteredBattleEvent["resumeFrom"];
  },
) => ComboOutcome;

let enterBattleEffectsImpl: EnterBattleEffectsImpl | undefined;

export function registerEnterBattleEffectsImpl(impl: EnterBattleEffectsImpl): void {
  enterBattleEffectsImpl = impl;
}

export function resetEnterBattleEffectsImplForTests(): void {
  enterBattleEffectsImpl = undefined;
}

function requireImpl(): EnterBattleEffectsImpl {
  if (!enterBattleEffectsImpl) {
    throw new Error("enter battle effects impl not registered");
  }
  return enterBattleEffectsImpl;
}

/**
 * バトル進入時効果（legend2/3 battleEffects + enterBattleEffects + NC 等）。
 * 実装本体は `combo.resolveEnterBattleEffectsImpl`。
 */
export const unitEnteredBattleListener: EventListener = (event, state) => {
  const enterEvent = event as UnitEnteredBattleEvent;
  const player = state.players[enterEvent.playerId];
  const card = player.battle.find((c) => c.instanceId === enterEvent.instanceId);
  if (!card) return { state };

  const battleBeforeEnter = enterEvent.battleBeforeEnterInstanceIds
    .map((id) => player.battle.find((c) => c.instanceId === id))
    .filter((c): c is CardInstance => !!c);

  const outcome = requireImpl()(
    state,
    enterEvent.playerId,
    card,
    enterEvent.battlePosition,
    {
      battleBeforeEnter,
      rideOff: enterEvent.rideOff,
      resumeFrom: enterEvent.resumeFrom,
    },
  );

  return {
    state: outcome.state,
    logs: outcome.logs.length > 0 ? outcome.logs : undefined,
    enterResumeFrom: outcome.enterResumeFrom,
  };
};
