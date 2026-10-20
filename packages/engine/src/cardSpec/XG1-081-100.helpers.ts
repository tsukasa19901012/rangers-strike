/**
 * cardSpec XG1-081〜XG1-100（クロスギャザー ザ・ファーストエンカウント 磁雷神〜ロボコン）用ヘルパー。
 * XG1-061-080.helpers.ts（XG1-001〜080・BK1・RM1〜RM3・RK1〜RK16 のヘルパーを含む）をそのまま再エクスポートし、
 * 自軍スタートフェイズにバトルエリアのユニットをラッシュエリアに戻す手順・保留中のコマンドの支払いを進める手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { act, endTurn, enemyBoard, legal, stepPrefer } from "./XG1-061-080.helpers";

export * from "./XG1-061-080.helpers";

/** 敵軍（player2）バトルフェイズから相手がターンを終え、自軍（player1）スタートフェイズにバトルエリアのユニットをラッシュエリアに戻すところまで進める。 */
export function returnedAtStart(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const s = endTurn(enemyBoard(p1, p2, extra));
  return stepPrefer(s, "player1", ["return_all_battle_to_rush"]) ?? s;
}

/** playerId の保留中のコマンドの支払い（initiate_command_payment）を1つ進める（act が支払いまで解決する）。 */
export function payCommands(s: GameState, playerId: PlayerId = "player1"): GameState {
  const a = legal(s).find((x) => x.type === "initiate_command_payment" && x.playerId === playerId);
  if (!a) throw new Error("no command payment");
  return act(s, a);
}
