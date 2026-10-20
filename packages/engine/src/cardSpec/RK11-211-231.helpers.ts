/**
 * cardSpec RK-211〜RK-231（ザ・マスクドライダーEXP vol.3 仮面ライダーブレイドJF〜オロチ）用ヘルパー。
 * RK10-190-210.helpers.ts（RK1〜RK9 のヘルパーを含む）をそのまま再エクスポートし、スクラムの共通テストと盤面の小道具を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす（holdOnField だけは盤面の状態を直接変える）。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { attackTargets, inst, st, sUnit } from "./RK10-190-210.helpers";

export * from "./RK10-190-210.helpers";

/** CN n の S ユニット（スクラムの確認用）。 */
export function cnUnit(n: number): CardDefinition {
  return sUnit(`SPEC-CN${n}`, { bp: 1000, comboNumber: n } as never);
}

/** 敵軍（player2）のバトルフェイズで、player1 のバトルエリアが battle のとき、player2 の TST-UNIT-7（BP13000）がアタックできる相手。 */
function enemyTargets(battle: CardInstance[], extra: CardDefinition[]): string[] {
  const s = st({ activePlayer: "player2", player1: { battle }, player2: { battle: [inst("TST-UNIT-7", "atk")] } }, extra);
  return attackTargets(s, "TST-UNIT-7:atk", "player2").sort();
}

/** ※スクラム の共通テスト（R-KW-SCRUM-01。RS7-453-473.b.test.ts と同じ形）。 */
export function scrumTests(id: string, cn: number, page: string): void {
  const next = cnUnit(cn + 1);
  const other = cnUnit(cn + 2);
  const extra = [next, other];
  it(`${id}: ※スクラム — CN${cn + 1} のユニットが次に並んでいる間はアタックされない（出典: ${page}「※スクラム」・R-KW-SCRUM-01）`, () => {
    expect(enemyTargets([inst(id, "me"), inst(next.id, "nx")], extra)).toEqual([`${next.id}:nx`]);
  });

  it(`${id}: ※スクラム — 次に並ぶユニットの CN が ${cn + 1} でなければアタックされる（出典: ${page}「これのＣＮより1多いＣＮを持つユニットが」）`, () => {
    expect(enemyTargets([inst(id, "me"), inst(other.id, "nx")], extra)).toContain(`${id}:me`);
  });

  it(`${id}: ※スクラム — CN${cn + 1} のユニットが前に並んでいるだけならアタックされる（出典: ${page}「これの次に並んでいる間」）`, () => {
    expect(enemyTargets([inst(next.id, "nx"), inst(id, "me")], extra)).toContain(`${id}:me`);
  });
}

/** 場のユニットをホールド状態にする（「このターンを終えるときホールド状態なら」の確認用。盤面の状態を直接変える）。 */
export function holdOnField(s: GameState, playerId: PlayerId, instanceId: string): GameState {
  const p = s.players[playerId];
  const hold = (c: CardInstance) => (c.instanceId === instanceId ? { ...c, commandHeld: true } : c);
  return { ...s, players: { ...s.players, [playerId]: { ...p, battle: p.battle.map(hold), rush: p.rush.map(hold) } } };
}
