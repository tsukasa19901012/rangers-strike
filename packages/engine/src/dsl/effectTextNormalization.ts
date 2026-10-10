/**
 * DSL 効果定義を効果テキストに合わせて正規化する（カード ID ではなく文言で判断する共通処理）。
 *
 * 1. 任意（optional）かどうかは本文の文言に従う。
 *    「～してもよい」「～選んでもよい」「～できる」等の文言がない効果（※ の注記や「…する。」の命令形）は強制で、
 *    DSL スタブが `optional: true` でも断れない（例: RS-230/231/235/241 の ※ 効果）。
 * 2. 「※これが撃破されて捨札になったとき、自軍捨札（に／から）「X」のカード（があれば）を1枚選び、
 *    自軍ラッシュエリアに出す。」は、トリガーを「撃破されて捨札になったとき」（on_destroy）とし、
 *    「X」のカードだけを選ぶ処理（on_destroy_reanimate_named_from_discard）として扱う。
 *    （スタブによっては trigger が nc だったり、自軍捨札のユニットすべてを選べる汎用 choose になっていた。）
 *
 * 出典: 各カード本文（例: RS-230 atwiki/page-72、RS-231 atwiki/page-373、RS-235 atwiki/page-500）。
 */
import type { CardDocument, EffectDefinition } from "@rangers-strike/cards/dsl/types";

/**
 * 効果テキストが断れる（任意の）文言を含むか。
 * 「～てもよい／でもよい／てよい／ても良い」「～できる」のほか、「好きな数（0 を含む）」「かわりに～すれば」の置換も任意とみなす。
 */
export function isDeclinableEffectText(text: string | undefined): boolean {
  if (!text) return true;
  return /[てで]も?(?:よい|良い)|でき(?:る|ます)|好きな|かわりに/.test(text);
}

/** 本文の文言に従った optional。文言が強制なら false、任意の文言ならスタブの値を使う。 */
export function effectOptionalByText(effect: Pick<EffectDefinition, "optional" | "text">): boolean | undefined {
  if (effect.optional && effect.text && !isDeclinableEffectText(effect.text)) return false;
  return effect.optional;
}

const REANIMATE_NAMED_ON_DESTROY_RE =
  /^※?これが撃破されて捨札になったとき、自軍捨札(?:に|から)[「｢][^」｣]+[」｣](?:のカード)?(?:があれば)?を?1(?:枚|体)選び、?(?:自軍)?ラッシュエリアに出す。?$/;

/** 「撃破されて捨札になったとき、自軍捨札の「X」を1枚選びラッシュエリアに出す」の文言か。 */
export function isReanimateNamedOnDestroyText(text: string | undefined): boolean {
  return !!text && REANIMATE_NAMED_ON_DESTROY_RE.test(text.trim());
}

function normalizeEffect(effect: EffectDefinition): EffectDefinition {
  if (isReanimateNamedOnDestroyText(effect.text)) {
    return {
      ...effect,
      trigger: { type: "on_destroy" },
      optional: false,
      condition: undefined,
      effects: [{ type: "grant_keyword", keyword: "on_destroy_reanimate_named_from_discard", duration: "turn" }],
    } as EffectDefinition;
  }
  const optional = effectOptionalByText(effect);
  if (optional === effect.optional) return effect;
  return { ...effect, optional };
}

const cache = new WeakMap<CardDocument, CardDocument>();

/** カード DSL 文書の効果を本文に合わせて正規化する（結果はキャッシュ）。 */
export function normalizeCardDslDocument<T extends CardDocument | undefined>(doc: T): T {
  if (!doc || !doc.effects) return doc;
  const hit = cache.get(doc);
  if (hit) return hit as T;
  let changed = false;
  const effects = doc.effects.map((e) => {
    const n = normalizeEffect(e);
    if (n !== e) changed = true;
    return n;
  });
  const result = changed ? ({ ...doc, effects } as CardDocument) : doc;
  cache.set(doc, result);
  return result as T;
}
