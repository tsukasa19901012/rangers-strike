import type { GameState, PlayerId } from "../types/game";
import { startRuinSurveyChoice, applyEffectChoicePlacement } from "./pendingChoices";

export function startRuinSurvey(
  state: GameState,
  playerId: PlayerId,
  sourceCardId: string,
): GameState | null {
  return startRuinSurveyChoice(state, playerId, sourceCardId);
}

export function applyResolveRuinSurvey(
  state: GameState,
  playerId: PlayerId,
  placement: "top" | "bottom",
): { state: GameState; log: string } | { error: string } {
  const result = applyEffectChoicePlacement(state, playerId, placement);
  if ("error" in result) return result;
  return { state: result.state, log: result.log ?? "" };
}
