/**
 * cardSpec XG3-063〜XG3-083（クロスギャザー ザ・Wインパクト 仮面ライダードレイクMF〜宇宙忍デモスト）用ヘルパー。
 * XG3-043-062.helpers.ts をそのまま再エクスポートし、敵軍ターンにアタックする手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState } from "../types/game";
import { attack, deckCards, inst, st } from "./XG3-043-062.helpers";

export * from "./XG3-043-062.helpers";

/** 敵軍（player2）ターンのバトルフェイズに、attacker（敵軍バトルエリア）で自軍の target をアタックする（反応ウィンドウは残す）。 */
export function enemyAttackOn(
  p1: Partial<GameState["players"]["player1"]>,
  target: string,
  attacker = "TST-UNIT-7:atk",
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [aid, asuf] = attacker.split(":") as [string, string];
  const s = st({ activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { battle: [inst(aid, asuf)], deck: deckCards(5, "e"), ...p2 } }, extra);
  return attack(s, attacker, target, "player2");
}
