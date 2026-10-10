/**
 * キーワード能力の表記判定。
 *
 * ルール: R-KW-00 — キーワードを持つのは、カードに「※キーワード（…）」として記載されている
 * カード（または効果で付与されたもの）だけ。効果名やテキスト中に同じ語が含まれても、
 * その能力を持つことにはならない（【モスブレイカー】はブレイカーではない、
 * 「ダークウイング」はウイングではない）。
 *
 * 本文中のキーワード表記は「※ウイング ※…」「※レジスト（これが…）」「※タクスMA」「※クロス1」の形で、
 * 本文の先頭か空白の直後に置かれる。「…を得る⇒※レジスト」のように効果で付与される表記
 * （直前が空白でない）は、カード自身が持つキーワードではないので数えない。
 */

export type KeywordNotationLabel =
  | "ウイング"
  | "チェイス"
  | "レジスト"
  | "モーフ"
  | "ブレイカー"
  | "スクラム"
  | "タクス"
  | "ブラスト"
  | "クロス"
  | "常駐";

/** キーワード表記の直後に来てよい文字（終端・空白・次の※・効果名・注釈・数値・区分）。 */
const FOLLOW = String.raw`(?=$|[\s※【（(]|[0-9０-９]|MA|ET|OT|WB|DA)`;

const notationCache = new Map<string, RegExp>();

function notationRegex(label: string): RegExp {
  let re = notationCache.get(label);
  if (!re) {
    re = new RegExp(String.raw`(?:^|\s)※${label}${FOLLOW}`, "u");
    notationCache.set(label, re);
  }
  return re;
}

/** カード本文に「※<label>」のキーワード表記があるか。ルール: R-KW-00 */
export function textHasKeywordNotation(
  text: string | undefined | null,
  label: KeywordNotationLabel,
): boolean {
  if (!text) return false;
  return notationRegex(label).test(text);
}
