/**
 * RK-035 ダークウイング【ソニックブレイカー】（と RK-280 ダークレイダー【疾風断】）の特徴の扱い（rules/addedFeatures.ts・rules/rk/rk1NamedEffects.ts 等の低い層から使う小さなモジュール）。
 * カードの効果そのものは rules/rk/rk2UnitEffects.ts。
 */
import type { CardInstance, GameState, PlayerId } from "../../types/game";
import { rk14FeaturesStripped } from "./rk14Features";

export const DARK_WING_CARD_ID = "RK-035";

/**
 * 「これが自軍バトルエリアにある間、すべての敵軍ユニットは特徴を持たないユニットとして扱い、特徴を追加されない。」（atwiki/page-180）
 * ownerId の場のユニット（ラッシュエリア・バトルエリア）で、相手のバトルエリアにダークウイングがあるなら true。
 * 場以外のカード（山札・手札等のユニットカード）はユニットではないので対象外（grnrngr/faq-rider-1 RK-043 Q2「対象は「ユニットカード」」）。
 */
export function rk2FeaturesStripped(
  state: Pick<GameState, "players" | "definitions">,
  ownerId: PlayerId,
  instance: Pick<CardInstance, "instanceId">,
): boolean {
  // RK-280 ダークレイダー【疾風断】（敵軍バトルエリアの S ユニット。rules/rk/rk14Features.ts）。
  if (rk14FeaturesStripped(state, ownerId, instance)) return true;
  const enemyId: PlayerId = ownerId === "player1" ? "player2" : "player1";
  if (!state.players[enemyId].battle.some((c) => c.cardId === DARK_WING_CARD_ID)) return false;
  const owner = state.players[ownerId];
  return (
    owner.battle.some((c) => c.instanceId === instance.instanceId) ||
    owner.rush.some((c) => c.instanceId === instance.instanceId)
  );
}
