import { revealNotices } from "../rules/revealNotice";
import type { GameState } from "../types/game";

/**
 * その効果が公開の記録（lastReveal と lastReveal.earlier）に残したカードの instanceId（UI の「オモテにしたカード」の窓に出る）。
 * 山札の上を見る（オモテにする）効果が、見たカードを見せずに進まないことの確認用（sweep/deckTopRevealAllCards.test.ts）。
 */
export function revealedBy(s: GameState, sourceCardId: string): string[] {
  return revealNotices(s)
    .filter((n) => n.sourceCardId === sourceCardId)
    .flatMap((n) => n.cards.map((c) => c.instanceId));
}
