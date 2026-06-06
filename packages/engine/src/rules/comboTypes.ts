import type { EnterBattleResumeFrom } from "../types/game";
import type { GameState } from "../types/game";

export type ComboOutcome = {
  state: GameState;
  logs: string[];
  /** コンボ選択が解決を中断した場合の残り戦闘進入ステップ。 */
  enterResumeFrom?: EnterBattleResumeFrom;
};
