import type { GameState, PlayerId } from "../types/game";

export type MultiStageWizardKind = "denji_machine" | "mirage_fusion" | "zord_assembly";

/** 多段ウィザード（denji / mirage / zord）— Phase 5 スタブ。 */
export function canStartMultiStageWizard(
  _state: GameState,
  _kind: MultiStageWizardKind,
  _playerId: PlayerId,
): boolean {
  return false;
}

export function resolveMultiStageWizardStep(
  state: GameState,
): { state: GameState; completed: boolean } {
  return { state, completed: false };
}
