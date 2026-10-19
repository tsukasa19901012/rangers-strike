/**
 * cardSpec XG1-041〜XG1-060（クロスギャザー ザ・ファーストエンカウント 仮面ライダーアマゾン〜コーカサスビートルアンデッド）用ヘルパー。
 * XG1-021-040.helpers.ts（XG1-001-020・BK1・RM1〜RM3・RK1〜RK16 のヘルパーを含む）をそのまま再エクスポートし、
 * RC（ライドオフ）と相手のターンをまたぐ手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { PLAIN_VEHICLE, act, endTurn, inst, legal, p1Battle, rcRideOff } from "./XG1-021-040.helpers";

export * from "./XG1-021-040.helpers";

/**
 * 自軍（player1）バトルフェイズに、ラッシュエリアのビークル（PLAIN_VEHICLE。RC を持たない）に rider をライドさせてバトルエリアに出し、
 * ライドオフして RC を発動する（RC の選択は残す）。p1.rush はビークル・rider の後に足す。
 */
export function rcAt(
  rider: string,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [cid, suf] = rider.split(":") as [string, string];
  const s = p1Battle({ ...p1, rush: [inst("SPEC-VEHICLE", "v"), inst(cid, suf), ...(p1.rush ?? [])] }, p2, [PLAIN_VEHICLE, ...extra]);
  return rcRideOff(s, rider, "SPEC-VEHICLE:v");
}

/** playerId の合法手から、types の順に最初に見つかった種類の手を1つ行う（なければ null）。 */
export function stepPrefer(s: GameState, playerId: PlayerId, types: string[]): GameState | null {
  const ls = legal(s).filter((a) => a.playerId === playerId);
  for (const t of types) {
    const a = ls.find((x) => x.type === t);
    if (a) return act(s, a);
  }
  return null;
}

/**
 * 自軍（player1）のターンを終え、相手（player2）のターンをバトルフェイズまで進める
 * （スタートフェイズのバトルエリアの戻し・ドロー・チャージ・ラッシュは何もしないで進める）。
 */
export function toEnemyBattle(s: GameState): GameState {
  let next = endTurn(s);
  for (let i = 0; i < 10 && !(next.activePlayer === "player2" && next.phase === "battle"); i += 1) {
    const n = stepPrefer(next, "player2", ["return_all_battle_to_rush", "draw", "end_phase"]);
    if (!n) break;
    next = n;
  }
  return next;
}
