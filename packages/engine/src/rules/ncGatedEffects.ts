/**
 * ナンバーコンビネーション（NC）が成立したときだけ有効な「アタックするとき」の効果。
 *
 * 「（この効果は「バルイーグル」または「バルパンサー」からコンビネーションするときは、ナンバーに関係なく
 * 発動する）」と書かれた効果（RS-032【シャークジョーズ】、RS-033【パンサークロー】、RS-189、RS-190 等）は
 * NC の効果であり、ナンバーと並び順が一致するか、指定のユニットからコンビネーションしてバトルエリアに出たときだけ
 * 有効になる（ルール: R-CN-02、R-CN-05）。成立はバトルエリアに出たときに判定し、activatedNcEffects に記録する。
 */
import { findNamedEffectByEffectId, getOnAttackNamedEffect } from "@rangers-strike/cards";
import type { CardInstance, GameState } from "../types/game";

type OnAttackNamed = NonNullable<ReturnType<typeof getOnAttackNamedEffect>>;

const PARTNER_FEATURE_RE = /特徴「([^」]+)」を持つユニットからコンビネーション/;

function partnerCardIds(named: OnAttackNamed): string[] | undefined {
  const trigger = named.trigger as { comboPartnerCardIds?: string[] };
  return trigger.comboPartnerCardIds;
}

/** NC 成立が必要な「アタックするとき」の効果か（「ナンバーに関係なく発動する」の但し書きを持つ）。 */
export function isNcGatedOnAttackEffect(named: OnAttackNamed): boolean {
  return !!partnerCardIds(named)?.length || (named.text ?? "").includes("ナンバーに関係なく");
}

/** 直前のユニット（左隣）から、但し書きの指定どおりコンビネーションしたか。 */
export function comboFromNamedPartner(
  state: Pick<GameState, "definitions">,
  named: OnAttackNamed,
  leftNeighborCardId: string | undefined,
): boolean {
  if (!leftNeighborCardId) return false;
  const ids = partnerCardIds(named);
  if (ids?.includes(leftNeighborCardId)) return true;
  const feature = (named.text ?? "").match(PARTNER_FEATURE_RE)?.[1];
  if (!feature) return false;
  return (state.definitions[leftNeighborCardId]?.features ?? []).includes(feature);
}

/**
 * 「アタックするとき」の名前つき効果のうち、現在有効なものの effectId。
 * NC 成立が必要な効果は、成立していなければ undefined。
 */
export function activeOnAttackNamedEffect(card: Pick<CardInstance, "cardId" | "activatedNcEffects">): OnAttackNamed | undefined {
  const named = getOnAttackNamedEffect(card.cardId);
  if (!named) return undefined;
  if (isNcGatedOnAttackEffect(named) && !card.activatedNcEffects?.includes(named.effectId)) {
    return undefined;
  }
  return named;
}

export function activeOnAttackNamedEffectId(card: Pick<CardInstance, "cardId" | "activatedNcEffects">): string | undefined {
  return activeOnAttackNamedEffect(card)?.effectId;
}

/**
 * 名前つき効果 effectId がこのユニットで有効か。NC の効果（ナンバーの欄の効果: trigger nc / nc_or_combo_from）は
 * バトルエリアに出たときに NC が成立していなければ有効にならない（ルール: R-CN-02 / R-CN-03）。
 * 例: RS-057【レッドファイヤー】、RS-062【ボウケンジャベリン】の「アタックするとき BP＋」。
 */
export function namedEffectActive(
  card: Pick<CardInstance, "cardId" | "activatedNcEffects">,
  effectId: string,
): boolean {
  const named = findNamedEffectByEffectId(card.cardId, effectId);
  if (!named) return false;
  const type = (named.trigger as { type: string }).type;
  if (type === "nc" || type === "nc_or_combo_from") {
    return card.activatedNcEffects?.includes(effectId) ?? false;
  }
  return true;
}
