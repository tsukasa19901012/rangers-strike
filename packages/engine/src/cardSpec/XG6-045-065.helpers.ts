/**
 * cardSpec XG6-045〜XG6-065（クロスギャザー ザ・ギガンティックタイタン テディ〜サブマシーン）用ヘルパー。
 * XG6-023-044.helpers.ts（XG6-001-022・BK・RM・RK のヘルパーを含む）をそのまま再エクスポートし、
 * ※タクス（番号つき）・※モーフの共通テストなどを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import { enemyRushes, enterSeq, fill, inst, morphCandidates, p1Battle, pickAs, released, settle, spOf, sUnit, zoneOf } from "./XG6-023-044.helpers";

export * from "./XG6-023-044.helpers";

type Cat = "WB" | "MA" | "OT" | "ET" | "DA";

/** ※タクス○○ の共通テスト（R-KW-TAKUS-01）: これがバトルエリアの pos 番目にある間、これの次に並ぶ cat を持つ S ユニットは「SP1」を得る。 */
export function takusTests(id: string, cat: Cat, pos: number, page: string): void {
  const HIT = sUnit(`SPEC-TK-${cat}`, { category: cat, bp: 1000, sp: undefined });
  const MISS = sUnit(`SPEC-TK-NOT-${cat}`, { category: cat === "WB" ? "MA" : "WB", bp: 1000, sp: undefined });
  const at = (p: number, next: string) =>
    enterSeq(p1Battle({ rush: [inst(id, "tk"), inst(next, "nx")], battle: fill(p - 1) }, {}, [HIT, MISS]), [`${id}:tk`, `${next}:nx`]);
  it(`${id}: ※タクス${cat} — バトルエリアの${pos}番目にある間、次に並ぶ ${cat} の S ユニット（SP なし）は「SP1」を得る。${cat} を持たないユニットは得ない（出典: ${page}「※タクス${cat}」・R-KW-TAKUS-01）`, () => {
    expect(spOf(at(pos, HIT.id), "player1", `${HIT.id}:nx`)).toBe(1);
    expect(spOf(at(pos, MISS.id), "player1", `${MISS.id}:nx`)).toBe(0);
  });
  it(`${id}: ※タクス${cat} — これが${pos}番目以外（${pos - 1}番目）なら次の ${cat} のユニットも SP を得ない（出典: R-KW-TAKUS-01「${cat}なら${pos}」）`, () => {
    expect(spOf(at(pos - 1, HIT.id), "player1", `${HIT.id}:nx`)).toBe(0);
  });
}

/**
 * ※モーフ の共通テスト（R-KW-MORPH-01〜03）。敵軍が TST-UNIT-0 をラッシュしたとき、
 * 自軍バトルエリアのこれを、自軍コマンドゾーンの特徴が完全一致するユニットカード partnerId と置き換えられる。特徴が違う other は選べない。
 */
export function morphTest(id: string, partnerId: string, otherId: string, page: string, extra: CardDefinition[] = []): void {
  it(`${id}: ※モーフ — 敵軍ユニットがラッシュされたとき、特徴が完全一致する自軍コマンドゾーンのユニットカード（${partnerId}）と置き換えられる。特徴が違う ${otherId} は選べない（出典: ${page}「※モーフ」・R-KW-MORPH-01・R-KW-MORPH-03）`, () => {
    let s = enemyRushes({ battle: [inst(id, "me")], command: [released(partnerId, "pa"), released(otherId, "ot")] }, "TST-UNIT-0:e", extra);
    expect(morphCandidates(s)).toEqual([`${partnerId}:pa`]);
    s = settle(pickAs(s, "player1", `${partnerId}:pa`));
    expect(zoneOf(s, "player1", `${partnerId}:pa`)).toBe("battle");
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("command");
  });
}
