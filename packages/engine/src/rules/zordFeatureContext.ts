/**
 * 追加条件の素材（「特徴「A」と「B」を持つ自軍ユニット1体を捨札にする」等）を判定するときの、ユニットの特徴。
 *
 * 素材の判定（rules/zord.ts isValidZordUpMaterial）はカード定義とプレイヤーだけを受け取るので、効果やフェイズで追加された特徴
 * （rules/addedFeatures.ts unitFeatures。RS-499 ゲキバイオレットの「自軍ラッシュフェイズ中、特徴に「レッド」…を追加される」等）を
 * 参照できない。applyAction / getLegalActions の入口で、その時点の GameState をここに置き（入れ子は呼び出し後に戻す）、
 * 素材の判定ではその状態の場のユニットとして特徴を読む。状態がなければ（単体の関数呼び出し）カードの特徴だけを使う。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { unitFeatures } from "./addedFeatures";

let current: GameState | null = null;

/** state を素材の特徴の判定に使う状態として fn を実行する。 */
export function withZordFeatureContext<T>(state: GameState, fn: () => T): T {
  const previous = current;
  current = state;
  try {
    return fn();
  } finally {
    current = previous;
  }
}

/** 素材の判定に使うユニットの特徴（場にあれば追加された特徴を含む）。 */
export function zordMaterialFeatures(
  def: CardDefinition | undefined,
  card: Pick<CardInstance, "cardId" | "instanceId">,
): string[] {
  const printed = def?.features ?? [];
  const state = current;
  if (!state) return [...printed];
  for (const pid of ["player1", "player2"] as const) {
    const p = state.players[pid];
    if (p.rush.some((c) => c.instanceId === card.instanceId) || p.battle.some((c) => c.instanceId === card.instanceId)) {
      return unitFeatures(state, pid, card);
    }
  }
  return [...printed];
}
