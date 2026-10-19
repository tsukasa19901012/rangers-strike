/**
 * XG7-001〜XG7-068 の選択・キーワードの登録先と、バッチの実装（xg7aEffects.ts 等）が共通に使う部品。
 * 選択の組み立て（openAfter・close・proceed 等）は rules/rm/rm1Effects.ts の部品を使う。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { getDefinition } from "../../core/catalog";
import type { GrantKeywordContext, GrantKeywordResult } from "../../dsl/grantKeyword";
import type { Xg7Flag } from "./xg7Types";

export type ChoiceOutcome = { state: GameState; log?: string } | { error: string };
export type ChoiceResolver = (state: GameState, playerId: PlayerId, instanceId: string) => ChoiceOutcome;
export type ChoiceSkipper = (state: GameState, playerId: PlayerId) => ChoiceOutcome;
export type KeywordHandler = (state: GameState, ctx: GrantKeywordContext) => GrantKeywordResult;

export const CHOICE_RESOLVERS: Record<string, ChoiceResolver> = {};
export const CHOICE_SKIPPERS: Record<string, ChoiceSkipper> = {};
export const CHOICE_CONFIRMERS: Record<string, ChoiceSkipper> = {};
/** `xg7::<cardId>::<name>` の `<cardId>::<name>` → 処理。 */
export const XG7_KEYWORDS: Record<string, KeywordHandler> = {};

export const XG7_KEYWORD_PREFIX = "xg7::";

export function noop(detail: string): KeywordHandler {
  return (state) => ({ state, detail });
}

export function isCard(cardId: string, id: string): boolean {
  return isSameCardIdentity(cardId, id);
}

// ---------------------------------------------------------------------------
// ターンを限った記録（GameState.xg7.flags）

export function hasFlag(state: GameState, key: string, playerId: PlayerId, instanceId?: string, turn: number = state.turn): boolean {
  return (state.xg7?.flags ?? []).some((f) => f.key === key && f.playerId === playerId && f.turn === turn && (instanceId === undefined || f.instanceId === instanceId));
}

export function flagsOf(state: GameState, key: string, playerId: PlayerId, turn: number = state.turn): Xg7Flag[] {
  return (state.xg7?.flags ?? []).filter((f) => f.key === key && f.playerId === playerId && f.turn === turn);
}

export function addFlag(state: GameState, flag: Omit<Xg7Flag, "turn"> & { turn?: number }): GameState {
  // 古いターンの記録は捨てる（次の相手ターンまで残すものがあるので、いまのターンより前のものだけ）。
  const kept = (state.xg7?.flags ?? []).filter((f) => f.turn >= state.turn);
  return { ...state, xg7: { ...state.xg7, flags: [...kept, { ...flag, turn: flag.turn ?? state.turn }] } };
}

// ---------------------------------------------------------------------------
// カードの情報

/** 「特徴に色を持つ」の10種（atwiki/page-2406 Q1・page-2407 Q1）。 */
export const COLORS = ["レッド", "ブルー", "イエロー", "ピンク", "グリーン", "ブラック", "ホワイト", "シルバー", "バイオレット", "ゴールド"];

export function printedFeatures(state: Pick<GameState, "definitions">, cardId: string): string[] {
  return getDefinition(state.definitions, cardId)?.features ?? [];
}

export function hasColorFeature(state: Pick<GameState, "definitions">, cardId: string): boolean {
  return printedFeatures(state, cardId).some((f) => COLORS.includes(f));
}

/** 必要パワーの数字（「+」「-」を除く。数字がなければ NaN）。 */
export function costNumberOf(state: Pick<GameState, "definitions">, cardId: string): number {
  const cost = getDefinition(state.definitions, cardId)?.powerCost;
  if (typeof cost === "number") return cost;
  const digits = String(cost ?? "").replace(/[^0-9]/g, "");
  return digits === "" ? Number.NaN : Number(digits);
}

/** 2枚の特徴のうち同じものの数。 */
export function sharedFeatureCount(a: readonly string[], b: readonly string[]): number {
  const set = new Set(a);
  return [...new Set(b)].filter((f) => set.has(f)).length;
}

export function cardsOfZone(state: GameState, playerId: PlayerId, zone: "battle" | "rush" | "hand" | "power" | "discard" | "command" | "deck"): CardInstance[] {
  return state.players[playerId][zone];
}
