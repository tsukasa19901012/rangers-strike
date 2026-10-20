/**
 * cardSpec XG1-061〜XG1-080（クロスギャザー ザ・ファーストエンカウント 仮面ライダーカリス〜仮面ライダーアビス）用ヘルパー。
 * XG1-041-060.helpers.ts（XG1-001〜040・BK1・RM1〜RM3・RK1〜RK16 のヘルパーを含む）をそのまま再エクスポートし、
 * 自軍ターンにバトルエリアへ出す・ストライクのダメージで敵軍がめくるカードを選ぶ手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { act, inst, legal, p1Battle, strike } from "./XG1-041-060.helpers";

export * from "./XG1-041-060.helpers";

/** 自軍（player1）バトルフェイズに、自軍ラッシュエリアの id をバトルエリアへ出す（進入時の選択・コマンドの支払いは残す）。 */
export function enteredFromRush(
  id: string,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [cid, suf] = id.split(":") as [string, string];
  const s = p1Battle({ ...p1, rush: [inst(cid, suf), ...(p1.rush ?? [])] }, p2, extra);
  return act(s, { type: "move_to_battle", playerId: "player1", instanceId: id });
}

/** striker でストライクし、ダメージを受けるプレイヤー（敵軍）がウラ返すパワーゾーンのカードとして flipId を選ぶ。 */
export function strikeFlipping(s: GameState, striker: string, flipId: string, playerId: PlayerId = "player1"): GameState {
  const t = strike(s, striker, playerId);
  const a = legal(t).find((x) => x.type === "resolve_damage_payment" && "instanceId" in x && x.instanceId === flipId);
  if (!a) throw new Error(`no damage payment for ${flipId}`);
  return act(t, a);
}
