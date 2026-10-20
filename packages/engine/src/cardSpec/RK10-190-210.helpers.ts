/**
 * cardSpec RK-190〜RK-210（ザ・マスクドライダーEXP vol.3 フォッグマザー〜仮面ライダーギャレンJF）用ヘルパー。
 * RK9-169-189.helpers.ts（RK1〜RK8 のヘルパーを含む）をそのまま再エクスポートし、任意の効果の受け入れ・見送りと盤面の型を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { act, canConfirm, confirm, deckCards, legal, pick, rushFromHand, st } from "./RK9-169-189.helpers";

export * from "./RK9-169-189.helpers";

/**
 * 開いている任意の効果を「行う」と答える。確定型（confirm_effect_choice）なら確定し、
 * そうでなければ候補の先頭（id 指定があればそれ）を選ぶ。
 */
export function accept(s: GameState, id?: string): GameState {
  const p = s.pendingEffectChoice;
  if (!p) throw new Error("no pendingEffectChoice");
  if (id !== undefined) return pick(s, id);
  if (p.kind === "confirm" && canConfirm(s)) return confirm(s);
  if (p.validInstanceIds.length > 0) return pick(s, p.validInstanceIds[0]!);
  return confirm(s);
}

/** 盤面を作る（phase・手番・両プレイヤーの山札5枚を既定にする）。 */
export function boardOf(
  phase: GameState["phase"],
  activePlayer: PlayerId,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  return st({ phase, activePlayer, player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 手札のユニットをラッシュする（失敗なら例外）。ラッシュしたときの選択は開いたまま。 */
export function rushed(s: GameState, instanceId: string, playerId: PlayerId = "player1", materials?: string[]): GameState {
  const r = rushFromHand(s, playerId, instanceId, materials ? { materials } : {});
  expect(r.ok, r.error).toBe(true);
  return r.state;
}

/** バトルフェイズのストライクが合法か（相手のダメージ確認用ではなく、合法手の有無だけ）。 */
export function canAttackAny(s: GameState, attacker: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "battle" && a.playerId === playerId && a.attackerInstanceId === attacker);
}

/** 敵軍（player2）の手番で、player2 のユニットを player1 のユニットにアタックさせる（反応は残す）。 */
export function enemyAttack(s: GameState, attacker: string, defender: string): GameState {
  return act(s, { type: "battle", playerId: "player2", attackerInstanceId: attacker, defenderInstanceId: defender });
}
