/**
 * cardSpec RM-022〜RM-042（スペシャルメタルエディション サイバリアン〜蝶忍 紅牙）用ヘルパー。
 * RM1-001-021.helpers.ts（RK1〜RK16 のヘルパーを含む）をそのまま再エクスポートし、チェイス・ビークル・バトル用の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import type { CardDefinition } from "@rangers-strike/cards";
import type { GameState, PlayerId } from "../types/game";
import { legal } from "./RM1-001-021.helpers";

export * from "./RM1-001-021.helpers";

/** ビークルの定義（カード評価・本文の確認用の最小のもの）。 */
export function vehicleCard(id: string, over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id,
    name: id,
    type: "vehicle",
    category: "OT",
    rarity: "N",
    expansion: "card-spec",
    powerCost: 0,
    size: "S",
    features: ["メカ"],
    ...over,
  } as unknown as CardDefinition;
}

/** オペレーションの定義（必要パワーの数字を参照する効果の確認用）。 */
export function opCard(id: string, powerCost: number | string, over: Partial<CardDefinition> = {}): CardDefinition {
  return {
    id,
    name: id,
    type: "operation",
    category: "WB",
    rarity: "N",
    expansion: "card-spec",
    powerCost,
    ...over,
  } as unknown as CardDefinition;
}

/** チェイスの乗り換え先として選べるビークル（resolve_chase の候補）。 */
export function chaseTargets(s: GameState, playerId: PlayerId): string[] {
  return legal(s)
    .filter((a) => a.type === "resolve_chase" && a.playerId === playerId)
    .map((a) => ("newVehicleInstanceId" in a ? (a.newVehicleInstanceId as string) : ""))
    .sort();
}

/** 合法手のうち、unit のアタック先（battle）・ストライク・進入後のパスの種類。 */
export function entryOptions(s: GameState, unit: string, playerId: PlayerId): { targets: string[]; strike: boolean; pass: boolean } {
  const acts = legal(s).filter((a) => a.playerId === playerId);
  return {
    targets: acts
      .filter((a) => a.type === "battle" && a.attackerInstanceId === unit)
      .map((a) => ("defenderInstanceId" in a ? (a.defenderInstanceId as string) : ""))
      .sort(),
    strike: acts.some((a) => a.type === "strike" && a.instanceId === unit),
    pass: acts.some((a) => a.type === "pass_battle_entry"),
  };
}
