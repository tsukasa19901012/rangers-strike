/**
 * 公式エラッタおよび Q&A 裁定（wikiwiki.jp/renst）。
 * カード文面とエラッタが矛盾する場合、エラッタを優先する。
 *
 * ソース:
 * - https://wikiwiki.jp/renst/%E3%82%A8%E3%83%A9%E3%83%83%E3%82%BF
 * - 各カード Wiki ページ（Q&A セクション）
 */

import { getCardById } from "./catalog";
import { deckCopyUnlimited } from "./deckRules";
import {
  getBattleEntryHoldCount as getHoldCountFromRules,
  hasBattleEntryHoldNote,
  hasUnnamedRule,
  listBattleEntryHoldCardIds,
} from "./unitEffects";

export { hasBattleEntryHoldNote, listBattleEntryHoldCardIds };

/** エラッタ修正済みオペレーション効果文（レジェンド1）。 */
export const ERRATA_EFFECT_TEXT: Partial<Record<string, string>> = {
  "RS-009":
    "敵軍Lユニットを1体選んで撃破する。そうして撃破したLユニットが捨札になったとき、相手はそのLユニットの合体に必要なユニットのカードを捨札から探してバトルエリアに戻す。このとき、戻したユニットの効果は発動しない。",
  "RS-018":
    "自軍ユニットがアタックされたとき発動できる。アタックしてきたユニット以外のユニットをすべての場から1体選んで、かわりにバトルさせる。",
  "RS-030":
    "自分自身のターンを終えるとき、自分自身のコマンドゾーンからホールド状態のコマンドを1つ選んで手札に戻す（常駐）。",
  "RS-067":
    "ストライクされたとき発動できる。ストライクしてきたユニットを撃破する（ダメージは受ける）。そうしたとき、これを捨札にする。",
};

/**
 * RS-026 Q6/Q10: ラッシュ誘発効果は疾風カウンター窓より先に解決する。
 * @see https://wikiwiki.jp/renst/%E7%96%BE%E9%A2%A8%E6%B5%81%E8%B6%85%E5%BF%8D%E6%B3%95
 */
export const RUSH_COUNTER_AFTER_TRIGGERED_EFFECTS = true;

/** 両プレイヤーの場にある RS-069 常駐の枚数を数える（Q2: 重ね効果）。 */
export function countLightningGravityPermanents(
  operationZones: Array<Array<{ cardId: string }>>,
  effectLookup: (cardId: string) => { effectId: string } | undefined,
): number {
  let count = 0;
  for (const zone of operationZones) {
    for (const card of zone) {
      if (effectLookup(card.cardId)?.effectId === "lightning_gravity") {
        count += 1;
      }
    }
  }
  return count;
}

export function requiredHeldCommandsForMBattle(
  lightningGravityCount: number,
  unitCardId: string,
): number {
  const unitHold = getHoldCountFromRules(unitCardId);
  if (lightningGravityCount === 0 && unitHold === 0) {
    return 0;
  }
  return lightningGravityCount + unitHold;
}

/** RS-093, RS-116: バトルエリアに出せない。 */
export function cannotEnterBattle(cardId: string): boolean {
  return hasUnnamedRule(cardId, "cannot_enter_battle");
}

/** RS-114: バトル投入には味方 S ユニットの在戦が必要。 */
export function needsAllySInBattle(cardId: string): boolean {
  return hasUnnamedRule(cardId, "needs_ally_s_in_battle");
}

/** RS-092, RS-094, RS-102, RS-103, RS-115, SR-004 等: 敵ターンに SP1 以上相手へ勝利するが自身は破壊される。 */
export function winButDestroyedVsSp1(cardId: string): boolean {
  return (
    hasUnnamedRule(cardId, "win_but_destroyed_vs_sp1") ||
    hasUnnamedRule(cardId, "destroy_on_win_vs_sp1")
  );
}

/** RS-112: 敵ダメージが6に達したら手札に戻る。 */
export function returnToHandAt6Damage(cardId: string): boolean {
  return hasUnnamedRule(cardId, "return_to_hand_at_6_damage");
}

/** RS-106: ラッシュしたターンはバトル投入できない。 */
export function noBattleEntryTurnRushed(cardId: string): boolean {
  return hasUnnamedRule(cardId, "no_battle_entry_turn_rushed");
}

/** RS-090: ラッシュしたターンはアタック・ストライクできない。 */
export function noAttackOrStrikeTurnRushed(cardId: string): boolean {
  return (
    hasUnnamedRule(cardId, "no_attack_turn_rushed") ||
    hasUnnamedRule(cardId, "no_strike_turn_rushed")
  );
}

/** @deprecated deckRules の deckCopyUnlimited(card) を使用すること。 */
export function hidoraDeckUnlimited(cardId: string): boolean {
  const card = getCardById(cardId);
  return card ? deckCopyUnlimited(card) : cardId === "RS-080";
}
