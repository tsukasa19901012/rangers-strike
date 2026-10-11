/**
 * 「自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。これは、ユニットが重ねられている間
 *  カードとして扱い、重ねたユニットがユニットでなくなるとき捨札になる。このカードに重ねたユニットは、次の能力を得る⇒…」
 * （RS-623【翼合体】・RS-647【ソウルバード】・RS-650【強蹴一閃ライノシュート】・XG1-035 等【侍武装】・XG3-010【ジークの命】）。
 *
 * 重ねたユニットが得る能力は、カードごとに「⇒」の後の文で決まる（キーワード名で一律に決めない）。
 * ここではカードの本文（DSL の効果文）から得る能力を読む。状態に依存しない純粋な部分だけを置く（重ねる処理は
 * rules/stackOntoLargeUnit.ts）。
 */
import type { CardInstance } from "../types/game";
import { getCardDslDocument } from "../dsl/effectLookup";

export const STACK_ONTO_LARGE_PHRASE =
  /自軍ラッシュフェイズ中、DAを持たない自軍Lユニットを1体選び、このユニットに重ねてもよい。/;

/** 重ねたユニットが得る能力（「⇒」の後）。 */
export type StackGrant = {
  /** 「⇒」の後の本文。 */
  text: string;
  /** 「※ウイング」「※レジスト」等のキーワード。 */
  keywords: Array<"wing" | "register">;
  /** 「BP+N」（一覧の形で書かれたときだけ。「…1体につきBP+1000される」等の文は含めない）。 */
  bp: number;
  /** 「このユニットからコンビネーションする「X」はBP+Nされる」（RS-650）。 */
  comboBoost?: { name: string; bp: number };
};

const CACHE = new Map<string, StackGrant | null>();

function grantedTextOf(cardId: string): string | null {
  for (const effect of getCardDslDocument(cardId)?.effects ?? []) {
    const text = (effect.text ?? "").normalize("NFKC");
    if (!STACK_ONTO_LARGE_PHRASE.test(text.replace(/\s+/g, ""))) continue;
    const idx = text.indexOf("⇒");
    return idx >= 0 ? text.slice(idx + 1).trim() : "";
  }
  return null;
}

const LIST_ITEM = /^(?:※(ウイング|レジスト)|BP\+(\d+))$/;

function parseGrant(text: string): StackGrant {
  const grant: StackGrant = { text, keywords: [], bp: 0 };
  // 「※ウイング、BP+2000」「※レジスト」— キーワードと BP 修正を「、」で並べた一覧。
  const items = text.replace(/。$/, "").split("、").map((s) => s.trim());
  if (items.length > 0 && items.every((item) => LIST_ITEM.test(item))) {
    for (const item of items) {
      const m = item.match(LIST_ITEM)!;
      if (m[1] === "ウイング") grant.keywords.push("wing");
      else if (m[1] === "レジスト") grant.keywords.push("register");
      else grant.bp += Number(m[2]);
    }
    return grant;
  }
  const combo = text.match(/^このユニットからコンビネーションする[「｢]([^」｣]+)[」｣]はBP\+(\d+)される。?$/);
  if (combo) grant.comboBoost = { name: combo[1]!, bp: Number(combo[2]) };
  return grant;
}

/** このカードが「DA を持たない自軍 L ユニットに重ねる」能力を持つなら、重ねたユニットが得る能力。持たなければ null。 */
export function stackOntoLargeGrant(cardId: string): StackGrant | null {
  if (CACHE.has(cardId)) return CACHE.get(cardId)!;
  const text = grantedTextOf(cardId);
  const grant = text === null ? null : parseGrant(text);
  CACHE.set(cardId, grant);
  return grant;
}

export function isStackOntoLargeCard(cardId: string): boolean {
  return stackOntoLargeGrant(cardId) !== null;
}

/** 場のユニット host に重ねたカードのうち、この能力で重ねたもの。 */
export function stackOntoLargeCardsOn(host: Pick<CardInstance, "stackedCards">): CardInstance[] {
  return (host.stackedCards ?? []).filter((c) => isStackOntoLargeCard(c.cardId));
}

/** 重ねたカードによって host がキーワードを得ているか。 */
export function stackOntoLargeGrantsKeyword(host: Pick<CardInstance, "stackedCards">, keyword: "wing" | "register"): boolean {
  return stackOntoLargeCardsOn(host).some((c) => stackOntoLargeGrant(c.cardId)!.keywords.includes(keyword));
}

/** 重ねたカードによる host の BP 修正（RS-623「BP+2000」）。 */
export function stackOntoLargeBpBonus(host: Pick<CardInstance, "stackedCards">): number {
  return stackOntoLargeCardsOn(host).reduce((sum, c) => sum + stackOntoLargeGrant(c.cardId)!.bp, 0);
}
