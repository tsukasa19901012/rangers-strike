/**
 * cardSpec XG2-001〜XG2-020（クロスギャザー ザ・ドラゴンタイガー ファイブレッド〜合身獣士・ブルタウラス）用ヘルパー。
 * BK1-001-019.helpers.ts（RK1〜RK16・RM1〜RM3・BK1 のヘルパーを含む）をそのまま再エクスポートし、
 * マルチカテゴリのユニットの印刷スペック・「持ち主のゾーンに置く」の行き先の確認・敵軍ターンの盤面の小さな手順を足したもの。
 * 公開エンジン API（createTestState / applyAction / getLegalActions）だけでゲーム状況を動かす。
 */
import { expect } from "vitest";
import type { CardDefinition } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../types/game";
import { DEFS, act, cardIn, deckCards, inst, legal, resolveAll, st, zoneOf } from "./BK1-001-019.helpers";

export * from "./BK1-001-019.helpers";

/**
 * ユニットの印刷スペック。カテゴリはマルチカテゴリ（["OT","ET"] 等）も書ける（順序も照合する）。
 * SP は "special"（「！」）・分数（"1/2" 等）・数値・undefined（「－」）。
 */
export function expectUnit(
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
  expect(d, `${id} の定義がない`).toBeDefined();
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

/** 「持ち主のゾーンに置く」— パワーゾーン（オモテ向き）かコマンドゾーンにあるか。 */
export function inOwnersZone(s: GameState, playerId: PlayerId, instanceId: string): boolean {
  const z = zoneOf(s, playerId, instanceId);
  if (z === "power") return cardIn(s, playerId, instanceId)?.faceDown !== true;
  return z === "command";
}

/** 選択を解決し続ける。行き先の選択（パワーゾーン／コマンドゾーン）が出たら prefer を優先する。 */
export function resolveZone(s: GameState, prefer: string[] = []): GameState {
  return resolveAll(s, [...prefer, "power", "power_zone", "command", "command_zone"]);
}

/** 敵軍（player2）ターンのバトルフェイズの盤面。 */
export function enemyTurn(
  p1: Partial<GameState["players"]["player1"]> = {},
  p2: Partial<GameState["players"]["player2"]> = {},
  extra: CardDefinition[] = [],
  phase: GameState["phase"] = "battle",
): GameState {
  return st({ phase, activePlayer: "player2", player1: { deck: deckCards(5), ...p1 }, player2: { deck: deckCards(5, "e"), ...p2 } }, extra);
}

/** 合法手のうち type が一致し、player のもの。 */
export function legalTypes(s: GameState, playerId: PlayerId): string[] {
  return [...new Set(legal(s).filter((a) => a.playerId === playerId).map((a) => a.type))].sort();
}

/** 指定の S ユニット n 体（instanceId は `${cardId}:${prefix}${i}`）。 */
export function units(cardId: string, n: number, prefix: string): CardInstance[] {
  return Array.from({ length: n }, (_, i) => inst(cardId, `${prefix}${i}`));
}

/** 素材の選択（pendingZordSetup の material ステップ）の候補。始められなければ null。 */
export function zordMaterialChoices(s: GameState, instanceId: string, playerId: PlayerId = "player1"): string[] | null {
  const begin = legal(s).find((a) => a.type === "begin_zord_setup" && a.playerId === playerId && a.zordInstanceId === instanceId);
  if (!begin) return null;
  let n = act(s, begin);
  for (let i = 0; i < 4 && n.pendingZordSetup && n.pendingZordSetup.step !== "material"; i++) {
    const a = legal(n).find((x) => x.type === "resolve_zord_setup");
    if (!a) break;
    n = act(n, a);
  }
  return n.pendingZordSetup?.step === "material" ? [...n.pendingZordSetup.validInstanceIds].sort() : [];
}
