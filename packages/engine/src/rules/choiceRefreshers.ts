import type { GameState, PendingEffectChoice } from "../types/game";

/**
 * refreshOnOpen.key の選択を（再開で）開くとき候補を作り直す関数の登録先。
 * 循環 import の初期化順に影響されないよう、依存のない独立モジュールに置く。
 */
export type ChoiceRefresher = (state: GameState, choice: PendingEffectChoice) => PendingEffectChoice | null;

const CHOICE_REFRESHERS: Record<string, ChoiceRefresher> = {};

/** null を返すと選択を開かない。 */
export function registerChoiceRefresher(key: string, refresher: ChoiceRefresher): void {
  CHOICE_REFRESHERS[key] = refresher;
}

export function getChoiceRefresher(key: string): ChoiceRefresher | undefined {
  return CHOICE_REFRESHERS[key];
}
