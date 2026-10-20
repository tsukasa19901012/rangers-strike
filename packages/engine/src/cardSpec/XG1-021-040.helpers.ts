/**
 * cardSpec XG1-021〜XG1-040（クロスギャザー ザ・ファーストエンカウント ブルーターボ〜虎折神）用ヘルパー。
 * XG1-001-020.helpers.ts（BK1・RM1〜RM3・RK1〜RK16 のヘルパーを含む）をそのまま再エクスポートし、侍武装（ユニットに重ねる起動効果）の手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { GameState, PlayerId } from "../types/game";
import { act, legal, resolveAll } from "./XG1-001-020.helpers";

export * from "./XG1-001-020.helpers";

/** 自軍ラッシュエリアの id の起動効果（【侍武装】等）を起動し、重ねる先 host を選ぶ（その後の選択は prefer で解決）。起動できなければ例外。 */
export function stackOnto(s: GameState, id: string, host: string, prefer: string[] = [], playerId: PlayerId = "player1"): GameState {
  const a = legal(s).find((x) => x.type === "activate_field_unit_ability" && x.playerId === playerId && x.unitInstanceId === id);
  if (!a) throw new Error(`no activate_field_unit_ability for ${id}`);
  return resolveAll(act(s, a), [host, ...prefer]);
}

/** ユニットの下に重なっているカードの cardId。 */
export function stackedIds(s: GameState, playerId: PlayerId, unitInstanceId: string): string[] {
  const p = s.players[playerId];
  const c = [...p.rush, ...p.battle].find((x) => x.instanceId === unitInstanceId);
  return (c?.stackedCards ?? []).map((x) => x.instanceId);
}
