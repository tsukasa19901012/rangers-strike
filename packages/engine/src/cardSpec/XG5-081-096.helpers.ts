/**
 * cardSpec XG5-081〜XG5-096（クロスギャザー XG5 ザ・チケットブレイカー 仮面ライダーアクセルトライアル〜ギルの笛の音）用ヘルパー。
 * XG5-061-080.helpers.ts（RS・RK・RM・BK と XG5-001〜080 のヘルパーを含む）をそのまま再エクスポートし、
 * 一時的な BP の修正を持つカードと、敵軍ターンのアタックの手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";
import { attack, deckCards, st } from "./XG5-061-080.helpers";

export * from "./XG5-061-080.helpers";

/** 一時的な BP の増減（CardInstance.bpModifier）を付けて置くカード。 */
export function withBp(card: CardInstance, delta: number): CardInstance {
  return { ...card, bpModifier: delta } as CardInstance;
}

/** 敵軍（player2）のバトルフェイズに、player2 の attacker（バトルエリア）が player1 の target にアタックする（反応ウィンドウは残す）。 */
export function enemyAttacks(
  p1: Partial<GameState["players"]["player1"]>,
  attacker: CardInstance,
  target: string,
  extra: CardDefinition[] = [],
  p2: Partial<GameState["players"]["player2"]> = {},
): GameState {
  const s = st(
    {
      activePlayer: "player2",
      player1: { deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2, battle: [attacker, ...(p2.battle ?? [])] },
    },
    extra,
  );
  return attack(s, attacker.instanceId, target, "player2");
}


