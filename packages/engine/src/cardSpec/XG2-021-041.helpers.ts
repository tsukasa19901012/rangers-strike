/**
 * cardSpec XG2-021〜XG2-041（クロスギャザー ザ・ドラゴンタイガー 重騎士〜スーパーシンケンイエロー）用ヘルパー。
 * XG2-001-020.helpers.ts（RK1〜RK16・RM1〜RM3・BK1 のヘルパーを含む）をそのまま再エクスポートし、
 * ゲームから除外されたかの確認・ビークルを重ねたかの確認・敵軍ターンのナンバーコンビネーションの小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { act, cardIn, deckCards, fill, inst, st } from "./XG2-001-020.helpers";

export * from "./XG2-001-020.helpers";

/** ゲームから除外された（exile にある）か。 */
export function exiled(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return (s.players[playerId].exile ?? []).some((c) => c.instanceId === instanceId);
}

/** ユニットの下にビークルが重なっている（ライドしている）か。 */
export function ridesOn(s: GameState, playerId: PlayerId, unitId: string, vehicleId: string): boolean {
  const u = cardIn(s, playerId, unitId);
  if (!u) return false;
  return u.mountedOnInstanceId === vehicleId || (u.stackedCards ?? []).some((c) => c.instanceId === vehicleId);
}

/** 敵軍（player2）ターンのバトルフェイズに、player2 のフィラー n 体の後へ id を出す（最後の選択は残す）。 */
export function enemyNcEnter(
  id: string,
  fillerCount: number,
  p2: Partial<GameState["players"]["player2"]> = {},
  p1: Partial<GameState["players"]["player1"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [cid, suf] = id.split(":") as [string, string];
  const s = st(
    {
      activePlayer: "player2",
      player1: { deck: deckCards(5), ...p1 },
      player2: { deck: deckCards(5, "e"), ...p2, battle: [...fill(fillerCount, "ef"), ...(p2.battle ?? [])], rush: [inst(cid, suf), ...(p2.rush ?? [])] },
    },
    extra,
  );
  return act(s, { type: "move_to_battle", playerId: "player2", instanceId: id });
}

/** 手札の枚数。 */
export function handN(s: GameState, playerId: PlayerId = "player1"): number {
  return s.players[playerId].hand.length;
}
