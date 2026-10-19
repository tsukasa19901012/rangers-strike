/**
 * cardSpec XP-001〜XP-016（クロスギャザー プロモーションカード 五色の戦士〜仮面ライダークウガRU・レッドアイ）用ヘルパー。
 * BK1-001-019.helpers.ts（RS・RK・RM・BK のヘルパーの連なりを含む）をそのまま再エクスポートし、
 * マルチカテゴリのスペック照合・RC の盤面・敵軍の手番の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { DEFS, PLAIN_VEHICLE, act, deckCards, inst, legal, norm, rcRideOff, st } from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

type Cat = "WB" | "MA" | "OT" | "ET" | "DA";

/**
 * ユニットの印刷スペック。カテゴリは1つなら文字列、マルチカテゴリなら配列（カタログの表し方のまま）で照合する。
 * SP は「！」を "special"、「－」を undefined、分数は "1/4" のように書く。
 */
export function expectUnit(
  id: string,
  stats: {
    name: string;
    category: Cat | Cat[];
    size: "S" | "M" | "L" | "XL";
    bp: number;
    sp: number | string | undefined;
    powerCost: number | string;
    comboNumber?: number | string;
    features: string[];
    rushCondition?: string;
    /** 追加条件の文（atwiki「追加条件：」）。書いたときだけ照合する。 */
    rushConditionText?: string;
    rarity: string;
  },
): void {
  const d = DEFS[id]! as CardDefinition & { rarity?: string };
  expect(d, `${id} の定義がない`).toBeDefined();
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("unit");
  expect(d.category).toEqual(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.size).toBe(stats.size);
  expect(d.bp).toBe(stats.bp);
  expect(d.sp ?? undefined).toBe(stats.sp);
  expect(d.comboNumber ?? undefined).toBe(stats.comboNumber);
  expect(d.features ?? []).toEqual(stats.features);
  if (stats.rushConditionText !== undefined) {
    expect(norm(d.rushAdditionalCondition?.text)).toBe(norm(stats.rushConditionText));
  } else {
    expect(d.rushAdditionalCondition?.conditionId).toBe(stats.rushCondition);
  }
  expect(d.rarity).toBe(stats.rarity);
}

/** オペレーションの印刷スペック（マルチカテゴリは配列で照合）。 */
export function expectOp(id: string, stats: { name: string; category: Cat | Cat[]; powerCost: number | string; rarity: string }): void {
  const d = DEFS[id]! as CardDefinition & { rarity?: string };
  expect(d, `${id} の定義がない`).toBeDefined();
  expect(d.name).toBe(stats.name);
  expect(d.type).toBe("operation");
  expect(d.category).toEqual(stats.category);
  expect(d.powerCost).toBe(stats.powerCost);
  expect(d.rarity).toBe(stats.rarity);
}

/**
 * 自軍（player1）バトルフェイズに、rider（ラッシュエリア）を RC を持たないビークル（SPEC-VEHICLE）にライドさせて出し、ライドオフする。
 * RC の選択は開いたまま。extra には PLAIN_VEHICLE を自動で足す。
 */
export function rcBoard(
  rider: string,
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
): GameState {
  const [cid, suf] = rider.split(":") as [string, string];
  const s = st(
    {
      player1: { deck: deckCards(5), ...p1, rush: [inst(cid, suf), inst("SPEC-VEHICLE", "v"), ...(p1.rush ?? [])] },
      player2: { deck: deckCards(5, "e"), ...p2 },
    },
    [PLAIN_VEHICLE, ...extra],
  );
  return rcRideOff(s, rider, "SPEC-VEHICLE:v");
}

/** 合法手のうち、指定プレイヤーの指定 type のもの。 */
export function actionsFor(s: GameState, type: string, playerId: PlayerId = "player1") {
  return legal(s).filter((a) => a.type === type && a.playerId === playerId);
}

/** 開いている選択の effectId。 */
export function effectIdOf(s: GameState): string | undefined {
  return s.pendingEffectChoice?.effectId;
}

/** 開いている選択に、指定プレイヤーが instanceId で答える（resolve_effect_choice）。 */
export function answer(s: GameState, playerId: PlayerId, instanceId: string): GameState {
  return act(s, { type: "resolve_effect_choice", playerId, instanceId });
}

/** パワーゾーンのオモテ向きのカード（faceDown: false を明示）。 */
export function faceUpPower(cardId: string, suffix: string): CardInstance {
  return { ...inst(cardId, suffix), faceDown: false };
}
