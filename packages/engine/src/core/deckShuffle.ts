/**
 * 山札のシャッフル（共通）。
 *
 * 「自分か相手の山札がシャッフルされたとき」（RS-571 デカバイクロボ【ソードトルネード】atwiki/page-1214）を判定できるよう、
 * シャッフルしたカード（インスタンスのオブジェクト）に、シャッフルの通し番号を記録する（状態には現れない WeakMap）。
 * applyAction の前後で番号を比べ、そのアクションの間に山札がシャッフルされたかを調べる（deckShuffledSince）。
 */
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { engineRandomInt } from "./rng";
import { noteEngineSideEffect } from "./sideEffects";

const shuffleMarks = new WeakMap<object, number>();
let shuffleEpoch = 0;

/** カードの並びを無作為に並べ替える（山札のシャッフル）。乱数はゲーム状態の rngState から作る（core/rng.ts）。 */
export function shuffleCards<T>(cards: T[]): T[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = engineRandomInt(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  noteEngineSideEffect();
  shuffleEpoch += 1;
  for (const card of copy) {
    if (card && typeof card === "object") shuffleMarks.set(card as object, shuffleEpoch);
  }
  return copy;
}

/** 現在のシャッフルの通し番号。 */
export function currentShuffleEpoch(): number {
  return shuffleEpoch;
}

/** epoch の後に、そのプレイヤーの山札がシャッフルされたか（山札にあるカードの記録で判定）。 */
export function deckShuffledSince(state: GameState, playerId: PlayerId, epoch: number): boolean {
  if (shuffleEpoch === epoch) return false;
  return state.players[playerId].deck.some((c: CardInstance) => (shuffleMarks.get(c) ?? 0) > epoch);
}
