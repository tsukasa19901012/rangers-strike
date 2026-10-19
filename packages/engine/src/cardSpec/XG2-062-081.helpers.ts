/**
 * cardSpec XG2-062〜XG2-081（クロスギャザー ザ・ドラゴンタイガー 仮面ライダー装甲響鬼〜デンオウモモタロス）用ヘルパー。
 * XG2-042-061.helpers.ts（RK1〜RK16・RM1〜RM3・BK1・XG2-001〜061 のヘルパーを含む）をそのまま再エクスポートし、
 * 「自軍コマンドを1つホールドして次の効果を発動できる」の支払い、マルチカテゴリのビークルの印刷スペック、
 * コンビネーションの盤面、ダメージの確認を足したもの。
 * 公開 API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { DEFS, act, cardIn, enter, inst, legal, p1Battle, zoneOf } from "./XG2-042-061.helpers";

export * from "./XG2-042-061.helpers";

/** sourceId の「コマンドを1つホールドして発動できる」（effect_hold の支払い）が合法手にあるか。 */
export function canHoldPay(s: GameState, sourceId: string, playerId: PlayerId = "player1"): boolean {
  return legal(s).some(
    (a) => a.type === "initiate_command_payment" && a.playerId === playerId && a.kind === "effect_hold" && a.sourceInstanceId === sourceId,
  );
}

/** sourceId の effect_hold の支払いを、先頭の有効なコマンドで行う。 */
export function holdPay(s: GameState, sourceId: string, playerId: PlayerId = "player1"): GameState {
  const a = legal(s).find(
    (x) => x.type === "initiate_command_payment" && x.playerId === playerId && x.kind === "effect_hold" && x.sourceInstanceId === sourceId,
  );
  if (!a) throw new Error(`no effect_hold payment for ${sourceId}; legal=${legal(s).map((x) => x.type).join(",")}`);
  let next = act(s, a);
  for (let i = 0; i < 4 && next.pendingCommandPayment?.playerId === playerId; i += 1) {
    const p = next.pendingCommandPayment;
    next = act(next, { type: "resolve_command_payment", playerId, commandInstanceIds: p.validInstanceIds.slice(0, p.totalNeeded) });
  }
  return next;
}

/** ビークルの印刷スペック（マルチカテゴリは配列で順序も照合する。追加条件の conditionId も照合する）。 */
export function expectVehicle(
  id: string,
  stats: { name: string; category: string | string[]; powerCost: number | string; size: string; features: string[]; rushCondition?: string },
): void {
  const d = DEFS[id]!;
  expect(d, `${id} の定義がない`).toBeDefined();
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("vehicle");
  expect(d.category).toEqual(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.features ?? []).toEqual(stats.features);
  expect(d.rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
}

/**
 * 自軍バトルフェイズに、自軍バトルエリアの最後に ffrId があり、自軍ラッシュエリアの nextId をバトルエリアに出す
 * （nextId が ffrId から「コンビネーションする」）。進入直後の選択・行動ウィンドウは残す。
 */
export function comboEnter(
  ffrId: string,
  nextId: string,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [fc, fs] = ffrId.split(":") as [string, string];
  const [nc, ns] = nextId.split(":") as [string, string];
  const s = p1Battle({ ...p1, battle: [...(p1.battle ?? []), inst(fc, fs)], rush: [inst(nc, ns), ...(p1.rush ?? [])] }, p2, extra);
  return enter(s, nextId);
}

/** 持ち主のパワーゾーンにダメージ（ウラ向き）として置かれているか。 */
export function isDamageIn(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  return zoneOf(s, playerId, instanceId) === "power" && cardIn(s, playerId, instanceId)?.faceDown === true;
}

/** instanceId を含む合法手（end_phase などは含まない）。 */
export function actionsWith(s: GameState, instanceId: string, playerId: PlayerId = "player1"): string[] {
  return legal(s)
    .filter((a) => a.playerId === playerId && JSON.stringify(a).includes(instanceId))
    .map((a) => a.type);
}
