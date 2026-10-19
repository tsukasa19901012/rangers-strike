/**
 * cardSpec XG3-002〜XG3-021（クロスギャザー ザ・Wインパクト ラジエッカー〜カブトライジャー）用ヘルパー。
 * BK1-001-019.helpers.ts（RK・RM・BK のヘルパーを含む）をそのまま再エクスポートし、場以外のゾーンからの起動・ホールドして出す並び・
 * 効果の候補の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect, it } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { act, attackUntilRegister, cardIn, DEFS, deckCards, enter, enterHold, inst, legal, passEntry, settle, st, zoneOf } from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

/** 合法手のうち、player の手で instanceId をどこかのフィールドに持つもの（フェイズ終了・パスを除く）。 */
export function refsOf(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameAction[] {
  return legal(s).filter((a) => {
    if (a.playerId !== playerId) return false;
    if (a.type === "end_phase" || a.type.startsWith("pass_")) return false;
    return Object.values(a as unknown as Record<string, unknown>).some((v) => v === instanceId || (Array.isArray(v) && v.includes(instanceId)));
  });
}

/** instanceId を参照する合法手（起動）を1つ行う。なければ例外。 */
export function useRef(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  const a = refsOf(s, instanceId, playerId)[0];
  if (!a) throw new Error(`no legal action for ${instanceId}; legal=${legal(s).map((x) => x.type).join(",")}`);
  return act(s, a);
}

/** バトルエリアに出す（ホールドしなければ出られないユニットは先頭の有効なコマンドをホールドする）。進入直後の行動ウィンドウは残す。 */
export function enterAny(s: GameState, instanceId: string, playerId: PlayerId = "player1"): GameState {
  const direct = legal(s).some((a) => a.type === "move_to_battle" && a.playerId === playerId && a.instanceId === instanceId);
  if (direct) return enter(s, instanceId, playerId);
  return enterHold(s, instanceId, playerId);
}

/**
 * 自軍（player1）バトルフェイズに、ラッシュエリアの ids を順にバトルエリアへ出す（ホールドが要るユニットはリリース状態のコマンドで払う）。
 * 途中の進入ウィンドウはパスし、最後のユニットの進入直後（効果の選択・行動ウィンドウ）は残す。
 */
export function lineUp(
  ids: string[],
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const units: CardInstance[] = ids.map((id) => {
    const [cid, suf] = id.split(":") as [string, string];
    return inst(cid, suf);
  });
  let s = st({ player1: { deck: deckCards(5), ...p1, rush: [...units, ...(p1.rush ?? [])] }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
  ids.forEach((id, i) => {
    s = enterAny(passEntry(s), id);
    if (i < ids.length - 1) s = passEntry(s);
  });
  return s;
}

/** 除外ゾーンのカード。 */
export function exiled(s: GameState, playerId: PlayerId): string[] {
  return (s.players[playerId].exile ?? []).map((c) => c.instanceId).sort();
}

/** ユニットの印刷スペック（RK2 版の expectStats と同じ。マルチカテゴリを配列で比べられるように toEqual にしたもの）。 */
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

/** ※レジスト の共通テスト（R-KW-RESIST-01。敵軍の BP13000 のユニット TST-UNIT-7 にアタックされて撃破されるところで確かめる）。 */
export function resistTests(id: string, page: string): void {
  const attacked = () => attackUntilRegister({ battle: [inst(id, "me")] }, `${id}:me`);
  it(`${id}: ※レジスト — バトルで撃破されたとき、捨札にするかわりにホールドしてその場に留められる（出典: ${page}「※レジスト」・R-KW-RESIST-01）`, () => {
    let s = attacked();
    const use = legal(s).find((a) => a.type === "use_register" && a.playerId === "player1");
    expect(use).toBeDefined();
    s = settle(act(s, use!));
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("battle");
    expect(cardIn(s, "player1", `${id}:me`)?.commandHeld).toBe(true);
  });
  it(`${id}: ※レジスト — 使わないこともでき、そのときは捨札になる（出典: R-KW-RESIST-01「留めてもよい」）`, () => {
    let s = attacked();
    const pass = legal(s).find((a) => a.type === "pass_register");
    expect(pass).toBeDefined();
    s = settle(act(s, pass!));
    expect(zoneOf(s, "player1", `${id}:me`)).toBe("discard");
  });
}
