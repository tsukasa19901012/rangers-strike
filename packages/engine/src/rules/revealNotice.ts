import type { GameState, RevealNotice } from "../types/game";

/**
 * 効果でカードをオモテにした（公開した）ことを記録する。
 * 公開情報なので両プレイヤーの UI がこれを見て公開カードを表示する。
 */
export function recordReveal(
  state: GameState,
  notice: Omit<RevealNotice, "seq">,
): GameState {
  const seq = (state.lastReveal?.seq ?? 0) + 1;
  return {
    ...state,
    lastReveal: { ...notice, cards: notice.cards.map((c) => ({ ...c })), seq },
  };
}
