/**
 * cardSpec SX-001〜SX-010・SR-001〜SR-008（クロスギャザーのシークレットレア・レンジャーズストライクのシークレットレア）用ヘルパー。
 * PROMO1-PK-SK.helpers.ts（BK1・RM・RK のヘルパーを含む）をそのまま再エクスポートし、マルチカテゴリのユニットのスペック確認などを足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { GameState, PlayerId } from "../types/game";
import { DEFS, legal, pick, resolveAll, tryAct } from "./PROMO1-PK-SK.helpers";

export * from "./PROMO1-PK-SK.helpers";

/** 印刷スペック（カテゴリはマルチカテゴリなら配列で比べる）。 */
export function expectUnitStats(
  id: string,
  stats: {
    name: string;
    category: string | string[];
    size: string;
    bp: number;
    sp: number | string | undefined;
    powerCost: number | string;
    comboNumber?: number | string;
    features: string[];
    rushCondition?: string;
  },
): void {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("unit");
  expect(d.category).toEqual(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp ?? undefined).toBe(stats.sp);
  expect(d.comboNumber).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features);
  expect(d.rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
}

/** レジスト（use_register）が指定プレイヤーに提示されているか。 */
export function registerOfferedTo(s: GameState, playerId: PlayerId): boolean {
  return legal(s).some((a) => a.type === "use_register" && a.playerId === playerId);
}

/** 除外ゾーン（ゲームから除外したカード）の instanceId。 */
export function exiled(s: GameState, playerId: PlayerId): string[] {
  return (s.players[playerId].exile ?? []).map((c) => c.instanceId).sort();
}

/** 手札のカード（オペレーション・ユニット）を使うためのコマンド支払いを始め、ホールドできるコマンドの instanceId を返す（始められなければ undefined）。 */
export function payableFor(s: GameState, sourceInstanceId: string, playerId: PlayerId = "player1"): string[] | undefined {
  const r = tryAct(s, { type: "initiate_command_payment", playerId, kind: "category_use", sourceInstanceId });
  if (!r.ok) return undefined;
  return r.state.pendingCommandPayment?.validInstanceIds.slice().sort();
}

/** 手札のオペレーションを、指定したコマンドをホールドして使う。 */
export function useOpHolding(
  s: GameState,
  sourceInstanceId: string,
  commandInstanceIds: string[],
  playerId: PlayerId = "player1",
): { ok: boolean; state: GameState; error?: string } {
  const r = tryAct(s, { type: "initiate_command_payment", playerId, kind: "category_use", sourceInstanceId });
  if (!r.ok) return r;
  if (!r.state.pendingCommandPayment) return r;
  return tryAct(r.state, { type: "resolve_command_payment", playerId, commandInstanceIds });
}

/** 今の選択肢を1つずつ選んで解決し、ok を満たす最初の状態を返す（選択肢の名前が決まっていない「どちらかを選ぶ」効果用）。 */
export function firstOptionWhere(s: GameState, ok: (t: GameState) => boolean, prefer: string[] = []): GameState | undefined {
  for (const id of s.pendingEffectChoice?.validInstanceIds ?? []) {
    const t = resolveAll(pick(s, id), prefer);
    if (ok(t)) return t;
  }
  return undefined;
}
