/**
 * cardSpec RK-022〜RK-042（ザ・マスクドライダーEXP vol.1 のユニット・ビークル）用ヘルパー。
 * RK1-001-021.helpers.ts をそのまま再エクスポートし、ライド（RC）・ビークル用の手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameAction } from "../types/actions";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { DEFS, act, inst, legal, passEntry, settle } from "./RK1-001-021.helpers";

export * from "./RK1-001-021.helpers";

/** 印刷スペック（RK1 版の expectStats を、分数 SP〈"1/3" 等〉も書けるように広げたもの）。 */
export function expectStats(
  id: string,
  stats: {
    name: string;
    category: string;
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
  expect(d.category).toBe(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp ?? undefined).toBe(stats.sp);
  expect(d.comboNumber).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features);
  expect(d.rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
}

/** ビークルの印刷スペック（名前・種類・カテゴリ・必要パワー・サイズ・特徴）。 */
export function expectVehicleStats(
  id: string,
  stats: { name: string; category: string; powerCost: number | string; size: string; features: string[] },
): void {
  const d = DEFS[id]!;
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("vehicle");
  expect(d.category).toBe(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.features ?? []).toEqual(stats.features);
}

/** ライドしてバトルエリアに出る（mount_ride）。ビークルの進入効果の選択・ライドオフの選択は残す。 */
export function mount(s: GameState, rider: string, vehicle: string, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "mount_ride", playerId, riderInstanceId: rider, vehicleInstanceId: vehicle });
}

/** ライドオフ選択（resolve_ride_off_choice）が開いているか。 */
export function rideOffOffered(s: GameState, playerId: PlayerId = "player1"): boolean {
  return legal(s).some((a) => a.type === "resolve_ride_off_choice" && a.playerId === playerId);
}

/** ライドオフ選択に答える（rideOff=true でライドオフして RC を発動する）。 */
export function rideOff(s: GameState, off: boolean, playerId: PlayerId = "player1"): GameState {
  return act(s, { type: "resolve_ride_off_choice", playerId, rideOff: off });
}

/** ライドして出てライドオフする（ビークルの進入効果の選択は先に解決しておくこと）。RC の選択は残す。 */
export function mountAndRideOff(s: GameState, rider: string, vehicle: string, playerId: PlayerId = "player1"): GameState {
  return rideOff(mount(s, rider, vehicle, playerId), true, playerId);
}

/** ライド中のユニット（rider）と、バトルエリア／ラッシュエリアに置くビークル（vehicle）の組。 */
export function ridingPair(riderId: string, riderSuf: string, vehicleId: string, vehicleSuf: string): CardInstance[] {
  return [inst(vehicleId, vehicleSuf), { ...inst(riderId, riderSuf), mountedOnInstanceId: `${vehicleId}:${vehicleSuf}` }];
}

/** RC を持つ S ユニット（ビークルにライドできる）。 */
export function rcUnit(id: string, over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id,
    name: id,
    type: "unit",
    category: "ET",
    rarity: "N",
    expansion: "card-spec",
    powerCost: 0,
    bp: 1000,
    sp: 1,
    size: "S",
    comboNumber: "RC",
    ...over,
  } as CardDefinition;
}

/** 進入直後の行動ウィンドウ・反応をパスする。 */
export function calm(s: GameState, playerId: PlayerId = "player1"): GameState {
  return passEntry(settle(s), playerId);
}

/** 合法手のうち type が一致するもの。 */
export function actionsOf(s: GameState, type: GameAction["type"]): GameAction[] {
  return legal(s).filter((a) => a.type === type);
}
