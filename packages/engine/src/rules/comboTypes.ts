import type { EnterBattleResumeFrom } from "../types/game";
import type { GameState } from "../types/game";

export type ComboOutcome = {
  state: GameState;
  logs: string[];
  /** Remaining enter-battle step if a combo choice interrupted resolution. */
  enterResumeFrom?: EnterBattleResumeFrom;
};
