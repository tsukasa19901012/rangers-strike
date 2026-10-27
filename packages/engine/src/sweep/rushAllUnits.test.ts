/**
 * 全ユニットのラッシュ確認。カードごとに、条件を満たす盤面を本物のカードで組み（rushBoard.ts）、
 * 合法手だけでラッシュできるかを確かめる。満たしていないとき（パワーが 1 足りない）に出せないことも見る。
 *
 * カード仕様テストは条件をテスト用の仮カードで組むので、「コマンドがユニットのカードだけ」のような
 * 実戦の盤面が出てこなかった（XG7-037 などの「追加で自軍コマンドを1つホールドする」が、オペレーション
 * のコマンドしか数えずラッシュできなかった。PR #62）。
 */
import { describe, expect, it } from "vitest";
import {
  RushBoardSkip,
  allUnitCards,
  buildRushBoard,
  needsPrintedPower,
  rushThroughLegalActions,
  type RushBoardOptions,
} from "./rushBoard";

/** 盤面を組んでラッシュを試し、思った結果にならなかったカードを「ID: 理由」で返す。 */
function mismatches(options: RushBoardOptions, expectRush: boolean, only = allUnitCards): string[] {
  const out: string[] = [];
  for (const unit of only) {
    try {
      const state = buildRushBoard(unit, options);
      const r = rushThroughLegalActions(state, state.players.player1.hand[0]!.instanceId);
      if (r.ok !== expectRush) out.push(`${unit.id} ${unit.name}: ${r.ok ? "ラッシュできた" : r.why}`);
    } catch (e) {
      out.push(`${unit.id} ${unit.name}: ${e instanceof RushBoardSkip ? `盤面を組めない（${e.message}）` : String(e)}`);
    }
  }
  return out;
}

/** 1 本あたり 2〜5 秒ほど。他のテストと並んで動くと 5 秒（vitest の既定）を超えることがある。 */
const TIMEOUT = 60_000;

describe("全ユニットのラッシュ", () => {
  it("カードは 1,000 枚以上ある（カタログを読めている）", () => {
    expect(allUnitCards.length).toBeGreaterThan(1000);
  }, TIMEOUT);

  it("コマンドがユニットのカードだけでもラッシュできる", () => {
    expect(mismatches({ commands: "unit", extraPower: 2 }, true)).toEqual([]);
  }, TIMEOUT);

  it("コマンドがオペレーションのカードだけでもラッシュできる", () => {
    expect(mismatches({ commands: "operation", extraPower: 2 }, true)).toEqual([]);
  }, TIMEOUT);

  it("パワーはちょうど、コマンドはカテゴリ分（と追加条件で使う分）だけでもラッシュできる", () => {
    expect(mismatches({ commands: "operation", extraPower: 0, tight: true }, true)).toEqual([]);
  }, TIMEOUT);

  it("素材のユニットがバトルエリアにいてもラッシュできる", () => {
    expect(mismatches({ commands: "operation", extraPower: 2, materialsInBattle: true }, true)).toEqual([]);
  }, TIMEOUT);

  it("パワーが 1 足りなければラッシュできない（ゾードダウンと必要パワー 0 は除く）", () => {
    expect(mismatches({ commands: "operation", extraPower: -1 }, false, allUnitCards.filter(needsPrintedPower))).toEqual([]);
  }, TIMEOUT);
});
