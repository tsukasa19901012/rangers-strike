/**
 * クロスギャザー XG5 の継続効果の判定（低い層から呼ぶ小さなモジュール。カードの効果そのものは rules/xg5/xg5aEffects.ts 等）。
 * core/catalog.ts を import しない（定義は state.definitions を直接見る）。
 *
 * - `xg5GrantsScrum`: XG5-001 ゴーグルレッド ※・XG5-041 ゴセイイエロー【兄妹の絆】（keywords/battleKeywords.ts scrumBlocksAttack）。
 * - `xg5CostNumber`: 必要パワーの数字（XG5-003 ゴーグルブルー【ブルージェットダッシュ】で敵軍ユニットは1少なくなる）。
 * - `isXg5StackedUnderUnitOperation`: XG5-012 ゴレムカード・XG5-015 スティライザー（ユニットの下に重ね、ユニットでなくなるとき捨札。rules/rk/rk1Features.ts）。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import type { Xg5Flag } from "./xg5Types";
import { hasTurnRuleModifier } from "../../core/scopedModifiers";

type Defs = Pick<GameState, "definitions">;

function opp(playerId: PlayerId): PlayerId {
  return playerId === "player1" ? "player2" : "player1";
}

export function xg5Flags(state: Pick<GameState, "xg5">, kind: string): Xg5Flag[] {
  return (state.xg5?.flags ?? []).filter((f) => f.kind === kind);
}

export function hasXg5Flag(state: Pick<GameState, "xg5" | "turn">, kind: string, playerId: PlayerId): boolean {
  return xg5Flags(state, kind).some((f) => f.playerId === playerId && f.turn === state.turn);
}

function fieldOf(state: Pick<GameState, "players">, playerId: PlayerId): CardInstance[] {
  const p = state.players[playerId];
  return [...p.battle, ...p.rush];
}

/**
 * XG5-001 ゴーグルレッド ※「これが自軍エリアにある間、ナンバーに数字を持つ自軍ユニットは次の能力を得る⇒スクラム」（atwiki/page-2180）。
 * XG5-041 ゴセイイエロー【兄妹の絆】「これは次の相手ターン終了時まで、次の能力を得る⇒「BP+3000｣「スクラム」」（flags の xg5-041）。
 */
export function xg5GrantsScrum(state: Pick<GameState, "players" | "definitions" | "xg5" | "turn">, playerId: PlayerId, defender: CardInstance): boolean {
  if (typeof state.definitions[defender.cardId]?.comboNumber === "number" && fieldOf(state, playerId).some((c) => isSameCardIdentity(c.cardId, "XG5-001"))) {
    return true;
  }
  return xg5Flags(state, "xg5-041").some((f) => f.target === defender.instanceId && f.turn >= state.turn);
}

/** 必要パワーの数字（「+」「-」を除く）。 */
export function printedCostNumber(state: Defs, cardId: string): number {
  const raw = state.definitions[cardId]?.powerCost;
  if (typeof raw === "number") return raw;
  const m = String(raw ?? "").match(/\d+/);
  return m ? Number(m[0]) : Number.NaN;
}

/**
 * viewerId の効果が見る、ownerId のユニット card の必要パワーの数字。
 * XG5-003【ブルージェットダッシュ】「このターン、敵軍ユニットの必要パワーの数字は1少なくなる」（atwiki/page-2185。0より少なくならない＝Q1）。
 */
export function xg5CostNumber(state: Pick<GameState, "definitions" | "players">, viewerId: PlayerId, ownerId: PlayerId, cardId: string): number {
  const n = printedCostNumber(state, cardId);
  if (!Number.isFinite(n)) return n;
  // NC の効果そのものは rules/promotedNcEffects.ts（enemy_power_cost_minus のターンのルール）。
  const minus = ownerId === opp(viewerId) && hasTurnRuleModifier(state.players[viewerId], "enemy_power_cost_minus") ? 1 : 0;
  return Math.max(0, n - minus);
}

/** XG5-012 ゴレムカード・XG5-015 スティライザー（ユニットの下に重ね、重ねたユニットがユニットでなくなるとき捨札になる）。 */
export function isXg5StackedUnderUnitOperation(cardId: string): boolean {
  return isSameCardIdentity(cardId, "XG5-012") || isSameCardIdentity(cardId, "XG5-015");
}
