/**
 * Official errata and Q&A rulings (wikiwiki.jp/renst).
 * When card text conflicts with errata, errata takes precedence.
 *
 * Sources:
 * - https://wikiwiki.jp/renst/%E3%82%A8%E3%83%A9%E3%83%83%E3%82%BF
 * - Per-card wiki pages (Q&A sections)
 */

import { getUnitEffectBlock, hasBattleEntryHoldNote, listBattleEntryHoldCardIds } from "./unitEffects";

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

function hasNote(cardId: string, fragment: string): boolean {
  const block = getUnitEffectBlock(cardId);
  if (!block) return false;
  return block.unnamedText.some((u) => u.text.includes(fragment));
}

/**
 * Units that require N held commands to enter battle (card text), stacked with RS-069.
 * @see RS-069 Q3 (RS-051 + lightning gravity = 2 holds)
 */
export const UNIT_BATTLE_ENTRY_HOLDS: Partial<Record<string, number>> = Object.fromEntries(
  listBattleEntryHoldCardIds().map((id) => [id, 1]),
);

export function getBattleEntryHoldCount(cardId: string): number {
  return hasBattleEntryHoldNote(cardId) ? 1 : 0;
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
  return cardId === "RS-093" || cardId === "RS-116";
}

/** RS-114: requires ally S unit in battle to enter. */
export function needsAllySInBattle(cardId: string): boolean {
  return hasNote(cardId, "自軍Sユニットがバトルエリアになければ");
}

/** RS-090: auto-enter battle when rushed if possible. */
export function hasAutoBattleOnRushNote(cardId: string): boolean {
  return hasNote(cardId, "ラッシュするとき可能ならバトルエリアに置く");
}

/** RS-077: auto-enter battle each turn if possible. */
export function hasAutoBattleEachTurnNote(cardId: string): boolean {
  return hasNote(cardId, "毎ターン、可能ならバトルエリアに出る");
}

/** RS-092, RS-094, RS-102, RS-103, RS-115: win vs SP1+ on enemy turn but still destroyed. */
export function winButDestroyedVsSp1(cardId: string): boolean {
  return hasNote(cardId, "バトルに勝っても撃破される");
}

/** RS-112: return to hand when enemy damage reaches 6. */
export function returnToHandAt6Damage(cardId: string): boolean {
  return hasNote(cardId, "敵軍ダメージが6点になったとき");
}

/** RS-106: cannot enter battle on turn rushed. */
export function noBattleEntryTurnRushed(cardId: string): boolean {
  return cardId === "RS-106" || hasNote(cardId, "ラッシュしたターンにバトルエリアに出られない");
}

/** RS-090: cannot attack or strike on turn rushed. */
export function noAttackOrStrikeTurnRushed(cardId: string): boolean {
  return (
    hasNote(cardId, "ラッシュしたターンにアタックできない") ||
    hasNote(cardId, "ラッシュしたターンにストライクできない")
  );
}

/** RS-080: deck may contain more than 3 copies. */
export function hidoraDeckUnlimited(cardId: string): boolean {
  return cardId === "RS-080" || hasNote(cardId, "デッキに3枚以上入れてもよい");
}
