import type {
  CardInstance,
  GameState,
  RevealDestination,
  RevealedCardNotice,
  RevealNotice,
} from "../types/game";

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

/** 公開したカードの一覧を、行き先（固定値か、カードごとの関数）付きで作る。 */
export function revealedCards(
  cards: readonly Pick<CardInstance, "instanceId" | "cardId">[],
  destination: RevealDestination | ((card: Pick<CardInstance, "instanceId" | "cardId">) => RevealDestination),
): RevealedCardNotice[] {
  return cards.map((c) => ({
    instanceId: c.instanceId,
    cardId: c.cardId,
    destination: typeof destination === "function" ? destination(c) : destination,
  }));
}
