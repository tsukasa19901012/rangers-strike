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
import type {
  CardDocument,
  EffectCondition,
  EffectDefinition,
  EffectPrimitive,
  TargetSelector,
} from "@rangers-strike/cards/dsl/types";

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

/**
 * 「ユニット」はラッシュエリア・バトルエリアにあるもの（R-TGT-01）。
 * 本文が「敵軍（S/M/L）ユニット」「自軍（S/M/L）ユニット」をエリアの指定なしで選ぶのに、
 * DSL スタブが選択範囲をバトルエリアだけにしている場合、ラッシュエリアも含める。
 * 本文に「バトル」「アタック」「ブロック」「ストライク」があるもの（バトル中のユニットに限る文脈）は変えない。
 */
export function unitTargetSpansRushArea(text: string | undefined, owner: "self" | "opponent"): boolean {
  if (!text) return false;
  if (/バトル|アタック|ブロック|ストライク/.test(text)) return false;
  const side = owner === "opponent" ? "敵軍" : "自軍";
  return new RegExp(`${side}[SML]?ユニット(?!の?カード)`).test(text);
}

function widenSelector(selector: TargetSelector, text: string | undefined): TargetSelector {
  if (selector.type !== "zone" || selector.zone !== "battle") return selector;
  if (selector.owner !== "opponent" && selector.owner !== "self") return selector;
  if (!unitTargetSpansRushArea(text, selector.owner)) return selector;
  const { filter, owner } = selector;
  return {
    type: "zones",
    zones: [
      { zone: "rush", owner, ...(filter ? { filter } : {}) },
      { zone: "battle", owner, ...(filter ? { filter } : {}) },
    ],
  } as TargetSelector;
}

function widenCondition(cond: EffectCondition | undefined, text: string | undefined): EffectCondition | undefined {
  if (!cond) return cond;
  if (cond.type === "has_target") {
    const target = widenSelector(cond.target, text);
    return target === cond.target ? cond : { ...cond, target };
  }
  if (cond.type === "and") {
    let changed = false;
    const conditions = cond.conditions.map((c) => {
      const n = widenCondition(c, text)!;
      if (n !== c) changed = true;
      return n;
    });
    return changed ? { ...cond, conditions } : cond;
  }
  if (cond.type === "not") {
    const condition = widenCondition(cond.condition, text)!;
    return condition === cond.condition ? cond : { ...cond, condition };
  }
  return cond;
}

function widenPrimitives(primitives: EffectPrimitive[], text: string | undefined): EffectPrimitive[] {
  let changed = false;
  const out = primitives.map((p) => {
    if (p.type !== "choose") return p;
    const valid = widenSelector(p.valid, text);
    const then = widenPrimitives(p.then, text);
    if (valid === p.valid && then === p.then) return p;
    changed = true;
    return { ...p, valid, then };
  });
  return changed ? out : primitives;
}

/**
 * 「パワーゾーンにダメージ以外のカード」を選ぶ文言: ユニットカードに限らず（オペレーションカードも）、
 * ウラ向き（ダメージ）のカードは除く（RS-264/265 ジェットデルタ／ジェットシーカー）。
 */
function powerNonDamageCardSelector(selector: TargetSelector, text: string | undefined): TargetSelector {
  if (selector.type !== "zone" || selector.zone !== "power") return selector;
  if (!text || !/パワーゾーン(?:に|の|から)ダメージ以外のカード/.test(text)) return selector;
  return { ...selector, filter: { ...selector.filter, cardType: "any", faceDown: false } };
}

function fixPowerNonDamage(effect: EffectDefinition): EffectDefinition {
  const text = effect.text;
  let changed = false;
  const fix = (primitives: EffectPrimitive[]): EffectPrimitive[] =>
    primitives.map((p) => {
      if (p.type !== "choose") return p;
      const valid = powerNonDamageCardSelector(p.valid, text);
      const then = fix(p.then);
      if (valid === p.valid && then === p.then) return p;
      changed = true;
      return { ...p, valid, then };
    });
  const effects = fix(effect.effects);
  let condition = effect.condition;
  if (condition?.type === "has_target") {
    const target = powerNonDamageCardSelector(condition.target, text);
    if (target !== condition.target) {
      condition = { ...condition, target };
      changed = true;
    }
  }
  return changed ? ({ ...effect, effects, condition } as EffectDefinition) : effect;
}

/**
 * 「これがアタックしなかったとき」はアタックしたとき（on_attack）ではない。
 * DSL スタブが on_attack にしていたら、CN を持つカード（NC の欄）は NC のトリガーにし、
 * アタックしなかったことの判定は効果側に任せる（RS-273〜276 ファイブマン）。
 */
function fixDidNotAttackTrigger(effect: EffectDefinition, doc: CardDocument): EffectDefinition {
  if (effect.trigger.type !== "on_attack") return effect;
  if (!effect.text || !/^これがアタックしなかったとき/.test(effect.text.trim())) return effect;
  const hasCn = (doc as { comboNumber?: unknown }).comboNumber !== undefined;
  return { ...effect, trigger: hasCn ? { type: "nc" } : { type: "conditional" } } as EffectDefinition;
}

/** R-TGT-01: 本文の「ユニット」に合わせて選択範囲をラッシュエリアまで広げる。 */
function widenUnitTargetsToRushArea(effect: EffectDefinition): EffectDefinition {
  const effects = widenPrimitives(effect.effects, effect.text);
  const condition = widenCondition(effect.condition, effect.text);
  if (effects === effect.effects && condition === effect.condition) return effect;
  return { ...effect, effects, condition } as EffectDefinition;
}

function normalizeEffect(input: EffectDefinition, doc: CardDocument): EffectDefinition {
  const effect = fixDidNotAttackTrigger(fixPowerNonDamage(widenUnitTargetsToRushArea(input)), doc);
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
    const n = normalizeEffect(e, doc);
    if (n !== e) changed = true;
    return n;
  });
  const result = changed ? ({ ...doc, effects } as CardDocument) : doc;
  cache.set(doc, result);
  return result as T;
}
