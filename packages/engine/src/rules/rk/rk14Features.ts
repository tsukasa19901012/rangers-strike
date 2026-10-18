/**
 * RK-280 ダークレイダー【疾風断】の特徴の扱い（rules/rk/rk2Features.ts から呼ぶ、import の少ない小さなモジュール）。
 * カードの効果のほかの部分は rules/rk/rk14Fields.ts・rules/rk/rk14UnitEffects.ts。
 */
import { isSameCardIdentity } from "@rangers-strike/cards";
import type { CardInstance, GameState, PlayerId, PlayerState } from "../../types/game";

function riddenIn(player: Pick<PlayerState, "battle" | "rush">, instanceId: string): boolean {
  return [...player.battle, ...player.rush].some((c) => c.mountedOnInstanceId === instanceId && c.instanceId !== instanceId);
}

/**
 * RK-280 ダークレイダー【疾風断】「これがライドされているか、これが自軍バトルエリアにある間、敵軍バトルエリアのSユニットは特徴を持たない
 * ユニットとして扱い、特徴を追加されない。」（atwiki/page-1375。Q1: ビークルでライドされて自軍エリアにある・ビークルでライドされずに自軍
 * バトルエリアにある・ユニットでバトルエリアにある、の3つ）。ownerId のバトルエリアの S ユニットなら true。
 */
export function rk14FeaturesStripped(
  state: Pick<GameState, "players" | "definitions">,
  ownerId: PlayerId,
  instance: Pick<CardInstance, "instanceId">,
): boolean {
  const enemy = state.players[ownerId === "player1" ? "player2" : "player1"];
  const raider = [...enemy.battle, ...enemy.rush].some(
    (c) => isSameCardIdentity(c.cardId, "RK-280") && (enemy.battle.some((b) => b.instanceId === c.instanceId) || riddenIn(enemy, c.instanceId)),
  );
  if (!raider) return false;
  const card = state.players[ownerId].battle.find((c) => c.instanceId === instance.instanceId);
  if (!card || state.definitions[card.cardId]?.type !== "unit") return false;
  return card.sizeOverride === "S" || state.definitions[card.cardId]?.size === "S";
}

