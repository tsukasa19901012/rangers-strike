/**
 * cardSpec XG7-024〜XG7-046（クロスギャザー ザ・ベストパートナー 獣拳神サイダイン〜仮面ライダーオーズ・サゴーゾコンボ）用ヘルパー。
 * XG7-001-023.helpers.ts（BK・RM・RK・RS のヘルパーを含む）をそのまま再エクスポートし、※リード の共通テストなどを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { GameState, PlayerId } from "../types/game";
import { type Cat, type Gaps, inst, legal, powerCards, raw, releasedCat, rushPhaseOf, specIt, sUnit } from "./XG7-001-023.helpers";
import { expect } from "vitest";

export * from "./XG7-001-023.helpers";

/** 手札のカード（オペレーション・ユニット）を使う／ラッシュするときのコマンドの支払いで選べるもの。 */
export function payableFor(s: GameState, sourceInstanceId: string, playerId: PlayerId = "player1"): string[] {
  const a = legal(s).find((x) => x.type === "initiate_command_payment" && x.playerId === playerId && "sourceInstanceId" in x && x.sourceInstanceId === sourceInstanceId);
  if (!a) return [];
  const next = raw(s, a);
  return [...(next.pendingCommandPayment?.validInstanceIds ?? [])].sort();
}

/** ※リード○○ の共通テスト（R-KW-READ-01、atwiki/page-2250）。cat のオペレーションを使用するためのコマンドとしてホールドできる。 */
export function leadTests(id: string, cat: Cat, page: string, gaps: Gaps = {}): void {
  const OP = cat === "WB" ? "TST-OP" : `TST-OP-${cat}`;
  const UNIT = sUnit(`SPEC-LEAD-${cat}`, { category: cat, bp: 1000, powerCost: 0 });
  specIt(
    id,
    `${id}: ※リード${cat} — 自軍ラッシュエリアのこれを、${cat} のオペレーションを使用するためのコマンドとしてホールドできる（出典: ${page}「※リード${cat}」・atwiki/page-2250 Q1）`,
    () => {
      const s = rushPhaseOf({ hand: [inst(OP, "op")], rush: [inst(id, "ld")], command: releasedCat(cat, 1, "lc"), power: powerCards(3) });
      expect(payableFor(s, `${OP}:op`)).toContain(`${id}:ld`);
    },
    gaps.lead_ok,
  );
  specIt(
    id,
    `${id}: ※リード${cat} — ユニットをラッシュするためのコマンドとしてはホールドできない（出典: atwiki/page-2250 本文）`,
    () => {
      const s = rushPhaseOf({ hand: [inst(UNIT.id, "u")], rush: [inst(id, "ld")], command: releasedCat(cat, 1, "lc"), power: powerCards(3) }, {}, [UNIT]);
      expect(payableFor(s, `${UNIT.id}:u`)).not.toContain(`${id}:ld`);
    },
    gaps.lead_unit,
  );
}

/** 合法手のうち、playerId のもので instanceId を含むもの（手札・ゾーンから使う効果の起動の有無を見る）。 */
export function actionsMentioning(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameAction[] {
  return legal(s).filter((a) => a.playerId === playerId && JSON.stringify(a).includes(instanceId));
}

/** ビークル（印刷スペック）の照合。 */
export function expectVehicleSpec(defs: Record<string, CardDefinition>, id: string, stats: { name: string; category: string | string[]; size: string; powerCost: number | string; features: string[] }): void {
  const d = defs[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("vehicle");
  expect(d.category).toEqual(stats.category);
  expect(d.size).toBe(stats.size);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.features ?? []).toEqual(stats.features);
}
