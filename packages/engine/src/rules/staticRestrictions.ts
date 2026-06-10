import {
  listUnnamedRules,
  type UnnamedUnitRule,
} from "@rangers-strike/cards";

export type { UnnamedUnitRule };

/** カード定義の UnnamedUnitRule を集約取得（restrictions.ts の静的制限入口）。 */
export function getStaticRestrictions(cardId: string): UnnamedUnitRule[] {
  return listUnnamedRules(cardId);
}

export function hasStaticRestriction(
  cardId: string,
  rule: UnnamedUnitRule,
): boolean {
  return getStaticRestrictions(cardId).includes(rule);
}
