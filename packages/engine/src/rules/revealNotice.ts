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
  notice: Omit<RevealNotice, "seq" | "earlier">,
): GameState {
  const prev = state.lastReveal;
  const seq = (prev?.seq ?? 0) + 1;
  const { earlier: prevEarlier, ...prevOnly } = prev ?? ({} as RevealNotice);
  const earlier = prev ? [...(prevEarlier ?? []), prevOnly as RevealNotice].slice(-REVEAL_EARLIER_MAX) : undefined;
  return {
    ...state,
    lastReveal: { ...notice, cards: notice.cards.map((c) => ({ ...c })), seq, ...(earlier ? { earlier } : {}) },
  };
}

/** lastReveal に残す直前の公開の数。 */
export const REVEAL_EARLIER_MAX = 3;

/** 記録に残っている公開（古い順。最後が lastReveal）。UI は seq が見せた番号より大きいものを順に見せる。 */
export function revealNotices(state: Pick<GameState, "lastReveal">): RevealNotice[] {
  const last = state.lastReveal;
  if (!last) return [];
  const { earlier, ...only } = last;
  return [...(earlier ?? []), only as RevealNotice];
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
