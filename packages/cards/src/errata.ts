/**
 * Official errata and Q&A rulings (wikiwiki.jp/renst).
 * When card text conflicts with errata, errata takes precedence.
 *
 * Sources:
 * - https://wikiwiki.jp/renst/%E3%82%A8%E3%83%A9%E3%83%83%E3%82%BF
 * - Per-card wiki pages (Q&A sections)
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

/** Errata-corrected operation effect text (Legend 1). */
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
 * RS-026 Q6/Q10: rush-triggered effects resolve before the shippu counter window.
 * @see https://wikiwiki.jp/renst/%E7%96%BE%E9%A2%A8%E6%B5%81%E8%B6%85%E5%BF%8D%E6%B3%95
 */
export const RUSH_COUNTER_AFTER_TRIGGERED_EFFECTS = true;

export function getBattleEntryHoldCount(cardId: string): number {
  return getHoldCountFromRules(cardId);
}

/** Count RS-069 permanents on both players' fields (Q2: stacks). */
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
  const unitHold = getBattleEntryHoldCount(unitCardId);
  if (lightningGravityCount === 0 && unitHold === 0) {
    return 0;
  }
  return lightningGravityCount + unitHold;
}

/** RS-093, RS-116: cannot enter battle area. */
export function cannotEnterBattle(cardId: string): boolean {
  return hasUnnamedRule(cardId, "cannot_enter_battle");
}

/** RS-114: requires ally S unit in battle to enter. */
export function needsAllySInBattle(cardId: string): boolean {
  return hasUnnamedRule(cardId, "needs_ally_s_in_battle");
}

/** RS-092, RS-094, RS-102, RS-103, RS-115: win vs SP1+ on enemy turn but still destroyed. */
export function winButDestroyedVsSp1(cardId: string): boolean {
  return hasUnnamedRule(cardId, "win_but_destroyed_vs_sp1");
}

/** RS-112: return to hand when enemy damage reaches 6. */
export function returnToHandAt6Damage(cardId: string): boolean {
  return hasUnnamedRule(cardId, "return_to_hand_at_6_damage");
}

/** RS-106: cannot enter battle on turn rushed. */
export function noBattleEntryTurnRushed(cardId: string): boolean {
  return hasUnnamedRule(cardId, "no_battle_entry_turn_rushed");
}

/** RS-090: cannot attack or strike on turn rushed. */
export function noAttackOrStrikeTurnRushed(cardId: string): boolean {
  return (
    hasUnnamedRule(cardId, "no_attack_turn_rushed") ||
    hasUnnamedRule(cardId, "no_strike_turn_rushed")
  );
}

/** @deprecated Use deckCopyUnlimited(card) from deckRules. */
export function hidoraDeckUnlimited(cardId: string): boolean {
  const card = getCardById(cardId);
  return card ? deckCopyUnlimited(card) : cardId === "RS-080";
}
